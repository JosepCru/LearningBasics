import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppEvent } from '../core/events/schemas';
import { applyImport, exportEvents, previewImport } from './backup';
import { LearningDB, SCHEMA_V1 } from './db';
import { appendEvent, bindAccount, ingestEvents } from './events';

const opened: Dexie[] = [];
const track = <T extends Dexie>(db: T): T => (opened.push(db), db);
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});
const freshDb = (name = `t-${Math.random()}`) => track(new LearningDB(name));

const T0 = new Date('2026-05-01T08:00:00Z');
const at = (d: number) => new Date(T0.getTime() + d * 86_400_000);
const review = (cardId: string, rating: 1 | 2 | 3 | 4, when: Date) => ({
  cardId,
  cardRevision: 1,
  rating,
  reviewedAt: when.toISOString(),
  durationMs: 1000,
});

describe('migración de la base local v1 → v2', () => {
  it('conserva eventos, outbox y tarjetas, y crea la tabla de cuarentena', async () => {
    const name = `mig-${Math.random()}`;
    // Base con el esquema publicado en la Fase 2.
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    track(v1);
    const legacy = new LearningDB(`src-${Math.random()}`);
    track(legacy);
    const e = await appendEvent(legacy, 'review', review('c1', 3, T0), T0);
    await v1.table('events').add(e);
    await v1.table('outbox').add({ eventId: e.id, createdAt: e.clientCreatedAt, attempts: 0, nextAttemptAt: e.clientCreatedAt });
    await v1.table('cardStates').put(await legacy.cardStates.get('c1'));
    v1.close();

    const v2 = freshDb(name);
    expect(v2.verno).toBe(2);
    expect(await v2.events.get(e.id)).toEqual(e);
    expect(await v2.outbox.count()).toBe(1);
    expect(await v2.cardStates.get('c1')).toBeDefined();
    expect(await v2.quarantine.count()).toBe(0);
  });
});

describe('ingestEvents', () => {
  it('une por ID, es idempotente y recalcula las tarjetas afectadas', async () => {
    const source = freshDb();
    await appendEvent(source, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(source, 'review', review('c1', 3, at(3)), at(3));
    const events = await source.events.toArray();

    const target = freshDb();
    expect(await ingestEvents(target, events, { enqueue: false })).toEqual({ added: 2, existing: 0 });
    expect(await ingestEvents(target, events, { enqueue: false })).toEqual({ added: 0, existing: 2 });
    expect(await target.events.count()).toBe(2);
    expect(await target.outbox.count()).toBe(0);
    expect((await target.cardStates.get('c1'))!.state).toEqual((await source.cardStates.get('c1'))!.state);
  });

  it('combina repasos de dos dispositivos en el mismo estado en ambos', async () => {
    const a = freshDb();
    const b = freshDb();
    await appendEvent(a, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(b, 'review', review('c1', 1, at(2)), at(2));
    await appendEvent(a, 'review', review('c1', 4, at(5)), at(5));
    const fromA = await a.events.toArray();
    const fromB = await b.events.toArray();
    await ingestEvents(a, fromB, { enqueue: false });
    await ingestEvents(b, fromA, { enqueue: false });
    expect((await a.cardStates.get('c1'))!.state).toEqual((await b.cardStates.get('c1'))!.state);
    expect((await a.cardStates.get('c1'))!.state.reps).toBe(3);
  });
});

describe('bindAccount', () => {
  it('asigna los eventos locales a la cuenta la primera vez y bloquea otra cuenta', async () => {
    const db = freshDb();
    await appendEvent(db, 'lesson', { lessonId: 'l1', action: 'completed' }, T0);
    expect(await bindAccount(db, 'user-a')).toBe(true);
    expect((await db.events.toArray()).map((e) => e.userId)).toEqual(['user-a']);
    const next = await appendEvent(db, 'lesson', { lessonId: 'l2', action: 'completed' }, T0);
    expect(next.userId).toBe('user-a');
    expect(await bindAccount(db, 'user-a')).toBe(true);
    expect(await bindAccount(db, 'user-b')).toBe(false);
    expect((await db.events.toArray()).every((e) => e.userId === 'user-a')).toBe(true);
  });
});

describe('importación', () => {
  async function exportedText(db: LearningDB) {
    return JSON.stringify(await exportEvents(db, at(9)));
  }

  it('muestra una vista previa correcta y nunca borra datos', async () => {
    const source = freshDb();
    await appendEvent(source, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(source, 'lesson', { lessonId: 'l1', action: 'completed' }, at(0));
    const text = await exportedText(source);

    const target = freshDb();
    const mine = await appendEvent(target, 'lesson', { lessonId: 'l9', action: 'completed' }, at(1));
    const parsed = await previewImport(target, text);
    expect(parsed.ok && parsed.preview).toMatchObject({ fresh: 2, existing: 0, invalid: 0 });
    if (!parsed.ok) return;
    expect(await applyImport(target, parsed.preview)).toEqual({ added: 2, existing: 0 });
    expect(await target.events.get(mine.id)).toEqual(mine);
    expect(await target.events.count()).toBe(3);
    // Los importados se encolan para subirlos.
    expect(await target.outbox.count()).toBe(3);

    // Reimportar el mismo archivo no cambia nada.
    const again = await previewImport(target, text);
    expect(again.ok && again.preview).toMatchObject({ fresh: 0, existing: 2 });
    if (again.ok) expect(await applyImport(target, again.preview)).toEqual({ added: 0, existing: 2 });
    expect(await target.events.count()).toBe(3);
  });

  it('descarta eventos inválidos sin rechazar el resto', async () => {
    const source = freshDb();
    await appendEvent(source, 'lesson', { lessonId: 'l1', action: 'completed' }, at(0));
    const file = JSON.parse(await exportedText(source)) as { events: unknown[] };
    file.events.push({ id: 'roto', type: 'lesson' } as unknown as AppEvent);
    const parsed = await previewImport(freshDb(), JSON.stringify(file));
    expect(parsed.ok && parsed.preview).toMatchObject({ fresh: 1, invalid: 1 });
  });

  it.each([
    ['{no es json', 'no es JSON válido'],
    ['{"format":"otra-app","version":1,"events":[]}', 'No es una copia de LearningBasics'],
    ['{"format":"learningbasics-export","version":9,"exportedAt":"2026-01-01T00:00:00Z","events":[]}', 'No es una copia'],
  ])('rechaza archivos que no son copias válidas: %s', async (text, message) => {
    const parsed = await previewImport(freshDb(), text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(message);
  });
});
