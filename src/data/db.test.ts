import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ExportFile, type AttemptPayload } from '../core/events/schemas';
import { exportEvents } from './backup';
import { LearningDB } from './db';
import { appendEvent, rebuildProjections } from './events';

const opened: LearningDB[] = [];
function freshDb(name = `test-${Math.random()}`): LearningDB {
  const db = new LearningDB(name);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

const T0 = new Date('2026-04-01T08:00:00Z');
const at = (days: number) => new Date(T0.getTime() + days * 86_400_000);

const attempt: AttemptPayload = {
  exerciseId: 'chem.mole.ex04',
  exerciseRevision: 1,
  objectiveId: 'chem.mole.o2',
  result: 'correct',
  tries: 1,
  hintsUsed: 0,
  solutionViewed: false,
  selfGraded: false,
  feedback: ['correct'],
  errorTags: [],
  lastResponse: '44.01 g/mol',
  durationMs: 12_000,
};

const review = (cardId: string, rating: 1 | 2 | 3 | 4, when: Date) => ({
  cardId,
  cardRevision: 1,
  rating,
  reviewedAt: when.toISOString(),
  durationMs: 3000,
});

describe('persistencia local', () => {
  it('guarda el evento y lo encola para sincronizar en la misma operación', async () => {
    const db = freshDb();
    const e = await appendEvent(db, 'attempt', attempt, T0);
    expect(await db.events.get(e.id)).toEqual(e);
    expect(await db.outbox.get(e.id)).toMatchObject({ eventId: e.id, attempts: 0 });
    expect(e).toMatchObject({ userId: 'local', schemaVersion: 1, clientCreatedAt: T0.toISOString() });
  });

  it('rechaza payloads inválidos sin escribir nada', async () => {
    const db = freshDb();
    await expect(appendEvent(db, 'attempt', { ...attempt, tries: -1 }, T0)).rejects.toThrow();
    expect(await db.events.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('mantiene el mismo deviceId entre eventos', async () => {
    const db = freshDb();
    const a = await appendEvent(db, 'attempt', attempt, T0);
    const b = await appendEvent(db, 'lesson', { lessonId: 'chem.mole.l1', action: 'completed' }, T0);
    expect(a.deviceId).toBe(b.deviceId);
  });

  it('los datos sobreviven a cerrar y reabrir la base de datos (recarga de la app)', async () => {
    const name = `persist-${Math.random()}`;
    const db1 = freshDb(name);
    await appendEvent(db1, 'review', review('chem.mole.fc01', 3, T0), T0);
    db1.close();
    const db2 = freshDb(name);
    expect(await db2.events.count()).toBe(1);
    expect(await db2.cardStates.get('chem.mole.fc01')).toBeDefined();
  });
});

describe('proyección de tarjetas', () => {
  it('un repaso crea el estado de la tarjeta con su primera fecha', async () => {
    const db = freshDb();
    await appendEvent(db, 'review', review('c1', 3, T0), T0);
    const row = await db.cardStates.get('c1');
    expect(row).toMatchObject({ cardId: 'c1', firstReviewAt: T0.toISOString() });
    expect(row!.state.reps).toBe(1);
  });

  it('rebuildProjections reproduce exactamente el estado incremental', async () => {
    const db = freshDb();
    await appendEvent(db, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(db, 'review', review('c2', 1, at(0)), at(0));
    await appendEvent(db, 'review', review('c1', 3, at(3)), at(3));
    await appendEvent(db, 'review', review('c2', 3, at(1)), at(1));
    await appendEvent(db, 'review', review('c1', 4, at(12)), at(12));
    const incremental = await db.cardStates.orderBy('cardId').toArray();
    await rebuildProjections(db);
    expect(await db.cardStates.orderBy('cardId').toArray()).toEqual(incremental);
  });

  it('un repaso que llega fuera de orden reconstruye la tarjeta', async () => {
    const inOrder = freshDb();
    await appendEvent(inOrder, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(inOrder, 'review', review('c1', 1, at(4)), at(4));
    await appendEvent(inOrder, 'review', review('c1', 3, at(9)), at(9));

    const outOfOrder = freshDb();
    await appendEvent(outOfOrder, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(outOfOrder, 'review', review('c1', 3, at(9)), at(9));
    await appendEvent(outOfOrder, 'review', review('c1', 1, at(4)), at(10)); // llega tarde

    expect((await outOfOrder.cardStates.get('c1'))!.state).toEqual((await inOrder.cardStates.get('c1'))!.state);
  });

  it('anular un repaso con un evento void recalcula la tarjeta', async () => {
    const db = freshDb();
    await appendEvent(db, 'review', review('c1', 3, at(0)), at(0));
    const before = (await db.cardStates.get('c1'))!.state;
    const mistaken = await appendEvent(db, 'review', review('c1', 1, at(2)), at(2));
    await appendEvent(db, 'void', { targetEventId: mistaken.id, reason: 'pulsé el botón equivocado' }, at(2));
    expect((await db.cardStates.get('c1'))!.state).toEqual(before);
    expect(await db.events.count()).toBe(3); // nada se borra
  });
});

describe('exportación', () => {
  it('produce un archivo válido con todos los eventos en orden', async () => {
    const db = freshDb();
    await appendEvent(db, 'attempt', attempt, at(1));
    await appendEvent(db, 'review', review('c1', 3, at(0)), at(0));
    const file = await exportEvents(db, at(2));
    expect(ExportFile.safeParse(file).success).toBe(true);
    expect(file.events.map((e) => e.type)).toEqual(['review', 'attempt']);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });
});
