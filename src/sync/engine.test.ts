import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { LearningDB } from '../data/db';
import { appendEvent } from '../data/events';
import { backoffMs, readSyncMeta, runSync, SYNC_CONFIG } from './engine';
import { FakeServer } from './fake-remote';

const opened: LearningDB[] = [];
const freshDb = () => {
  const db = new LearningDB(`sync-${Math.random()}`);
  opened.push(db);
  return db;
};
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

const USER = 'user-1';
const T0 = new Date('2026-06-01T08:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const clock = (d: Date) => () => d;

const review = (cardId: string, rating: 1 | 2 | 3 | 4, when: Date) => ({
  cardId,
  cardRevision: 1,
  rating,
  reviewedAt: when.toISOString(),
  durationMs: 1000,
});
const lesson = (id: string) => ({ lessonId: id, action: 'completed' as const });

describe('subida', () => {
  it('sin conexión → online: sube todo el outbox exactamente una vez', async () => {
    const server = new FakeServer();
    const remote = server.client(USER);
    const db = freshDb();
    await appendEvent(db, 'lesson', lesson('l1'), at(0));
    await appendEvent(db, 'lesson', lesson('l2'), at(1));

    remote.failNext = { op: 'push', kind: 'network' };
    expect(await runSync(db, remote, { userId: USER, now: clock(at(2)) })).toMatchObject({ status: 'offline' });
    expect(server.rows).toHaveLength(0);
    expect(await db.outbox.count()).toBe(2);

    // Al volver la conexión (pasado el tiempo de espera) se sube todo.
    expect(await runSync(db, remote, { userId: USER, now: clock(at(30)) })).toMatchObject({ status: 'ok', pushed: 2 });
    expect(server.rows).toHaveLength(2);
    expect(await db.outbox.count()).toBe(0);

    // Una segunda sincronización no duplica nada.
    await runSync(db, remote, { userId: USER, now: clock(at(31)) });
    expect(server.rows).toHaveLength(2);
  });

  it('respeta la espera entre reintentos, salvo si se pide a mano', async () => {
    const server = new FakeServer();
    const remote = server.client(USER);
    const db = freshDb();
    await appendEvent(db, 'lesson', lesson('l1'), at(0));
    remote.failNext = { op: 'push', kind: 'server' };
    await runSync(db, remote, { userId: USER, now: clock(at(0)), random: () => 0 });
    const entry = (await db.outbox.toArray())[0]!;
    expect(entry).toMatchObject({ attempts: 1, lastError: expect.stringContaining('server') });
    expect(entry.nextAttemptAt).toBe(new Date(at(0).getTime() + SYNC_CONFIG.backoffBaseMs).toISOString());

    const calls = remote.pushCalls;
    await runSync(db, remote, { userId: USER, now: clock(at(0)) });
    expect(remote.pushCalls).toBe(calls); // aún no toca reintentar
    await runSync(db, remote, { userId: USER, now: clock(at(0)), ignoreBackoff: true });
    expect(server.rows).toHaveLength(1);
  });

  it('un fallo tras subir pero antes de confirmar no duplica al reintentar', async () => {
    const server = new FakeServer();
    const remote = server.client(USER);
    const db = freshDb();
    const e = await appendEvent(db, 'lesson', lesson('l1'), at(0));
    // El servidor guardó el evento, pero la respuesta no llegó: el outbox lo conserva.
    server.insert(USER, [{ id: e.id, user_id: USER, device_id: e.deviceId, type: e.type, schema_version: 1, client_created_at: e.clientCreatedAt, payload: e.payload }]);
    await db.events.update(e.id, { userId: USER });
    expect(await runSync(db, remote, { userId: USER, now: clock(at(1)) })).toMatchObject({ status: 'ok' });
    expect(server.rows).toHaveLength(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('un evento rechazado va a cuarentena sin bloquear al resto', async () => {
    const server = new FakeServer();
    const remote = server.client(USER);
    const db = freshDb();
    await appendEvent(db, 'lesson', lesson('l1'), at(0));
    const bad = await appendEvent(db, 'lesson', lesson('l2'), at(1));
    await appendEvent(db, 'lesson', lesson('l3'), at(2));
    server.rejectIds.add(bad.id);

    expect(await runSync(db, remote, { userId: USER, now: clock(at(3)) })).toMatchObject({
      status: 'ok',
      pushed: 2,
      quarantined: 1,
    });
    expect(server.rows.map((r) => (r.payload as { lessonId: string }).lessonId)).toEqual(['l1', 'l3']);
    expect(await db.quarantine.get(bad.id)).toMatchObject({ direction: 'outgoing' });
    expect(await db.outbox.count()).toBe(0);
    expect(await db.events.get(bad.id)).toBeDefined(); // nunca se borra
  });

  it('sesión caducada: no pierde nada y pide iniciar sesión', async () => {
    const server = new FakeServer();
    const remote = server.client(USER);
    const db = freshDb();
    await appendEvent(db, 'lesson', lesson('l1'), at(0));
    remote.failNext = { op: 'push', kind: 'auth' };
    expect(await runSync(db, remote, { userId: USER, now: clock(at(1)) })).toMatchObject({ status: 'auth-required' });
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('bajada y convergencia', () => {
  it('dos dispositivos con repasos sin conexión convergen al mismo estado', async () => {
    const server = new FakeServer();
    const phone = freshDb();
    const laptop = freshDb();
    await appendEvent(phone, 'review', review('c1', 3, at(0)), at(0));
    await appendEvent(laptop, 'review', review('c1', 1, at(60)), at(60));
    await appendEvent(phone, 'review', review('c1', 4, at(3000)), at(3000));
    await appendEvent(laptop, 'lesson', lesson('l1'), at(61));

    for (let i = 0; i < 2; i++) {
      await runSync(phone, server.client(USER), { userId: USER, now: clock(at(4000)) });
      await runSync(laptop, server.client(USER), { userId: USER, now: clock(at(4000)) });
    }
    expect(await phone.events.count()).toBe(4);
    expect(await laptop.events.count()).toBe(4);
    expect((await phone.cardStates.get('c1'))!.state).toEqual((await laptop.cardStates.get('c1'))!.state);
    expect((await phone.cardStates.get('c1'))!.state.reps).toBe(3);
  });

  it('no pierde eventos que se confirman fuera de orden', async () => {
    const server = new FakeServer();
    const other = freshDb();
    const db = freshDb();
    await appendEvent(other, 'lesson', lesson('l1'), at(0));
    await runSync(other, server.client(USER), { userId: USER, now: clock(at(1)) });

    // Una transacción obtiene seq=2 pero tarda; otra con seq=3 confirma antes.
    const lateSeq = server.nextSeq();
    const e3 = await appendEvent(other, 'lesson', lesson('l3'), at(2));
    await runSync(other, server.client(USER), { userId: USER, now: clock(at(3)) });

    await runSync(db, server.client(USER), { userId: USER, now: clock(at(4)) });
    expect(await db.events.count()).toBe(2);
    expect((await readSyncMeta(db)).cursor).toBe(3);

    // Ahora confirma la de seq=2: el margen de solape la recoge.
    const late = await appendEvent(other, 'lesson', lesson('l2'), at(2));
    server.insertLate(
      { id: late.id, user_id: USER, device_id: late.deviceId, type: 'lesson', schema_version: 1, client_created_at: late.clientCreatedAt, payload: late.payload },
      lateSeq,
    );
    await runSync(db, server.client(USER), { userId: USER, now: clock(at(5)) });
    expect(await db.events.get(late.id)).toBeDefined();
    expect(await db.events.get(e3.id)).toBeDefined();
  });

  it('pagina la bajada y avanza el cursor', async () => {
    const server = new FakeServer();
    const source = freshDb();
    for (let i = 0; i < SYNC_CONFIG.pullPage + 30; i++) await appendEvent(source, 'lesson', lesson(`l${i}`), at(i));
    await runSync(source, server.client(USER), { userId: USER, now: clock(at(5000)) });

    const db = freshDb();
    const result = await runSync(db, server.client(USER), { userId: USER, now: clock(at(5001)) });
    expect(result).toMatchObject({ status: 'ok', pulled: SYNC_CONFIG.pullPage + 30 });
    expect((await readSyncMeta(db)).cursor).toBe(SYNC_CONFIG.pullPage + 30);
  }, 20_000);

  it('aparta en cuarentena los eventos entrantes que no cumplen el esquema', async () => {
    const server = new FakeServer();
    server.insert(USER, [
      { id: '0190a000-0000-7000-8000-000000000001', user_id: USER, device_id: 'x', type: 'lesson', schema_version: 2, client_created_at: T0.toISOString(), payload: { future: true } },
    ]);
    const db = freshDb();
    expect(await runSync(db, server.client(USER), { userId: USER, now: clock(at(1)) })).toMatchObject({ status: 'ok', pulled: 0 });
    expect(await db.quarantine.count()).toBe(1);
    expect(await db.events.count()).toBe(0);
  });

  it('se niega a sincronizar un dispositivo vinculado a otra cuenta', async () => {
    const server = new FakeServer();
    const db = freshDb();
    await runSync(db, server.client('user-a'), { userId: 'user-a', now: clock(at(0)) });
    expect(await runSync(db, server.client('user-b'), { userId: 'user-b', now: clock(at(1)) })).toEqual({
      status: 'account-mismatch',
    });
  });
});

describe('backoffMs', () => {
  it('crece exponencialmente con tope y jitter de hasta el 20 %', () => {
    expect(backoffMs(1, () => 0)).toBe(2_000);
    expect(backoffMs(2, () => 0)).toBe(4_000);
    expect(backoffMs(20, () => 0)).toBe(SYNC_CONFIG.backoffMaxMs);
    expect(backoffMs(1, () => 1)).toBe(2_400);
  });
});
