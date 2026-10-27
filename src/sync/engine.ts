/**
 * Un ciclo de sincronización: subir lo pendiente y bajar lo nuevo. Ver docs/SYNC.md.
 *
 * Garantías:
 *  - Reintentar es seguro: cada evento tiene su ID desde que se crea y el servidor ignora
 *    los duplicados.
 *  - Un fallo a mitad no pierde nada: el outbox solo se vacía tras confirmar la subida.
 *  - Un evento que el servidor rechaza va a cuarentena y no bloquea a los demás.
 *  - Nunca se borra ni modifica un evento.
 */
import { AppEvent } from '../core/events/schemas';
import type { LearningDB, OutboxEntry } from '../data/db';
import { bindAccount, ingestEvents } from '../data/events';
import { RemoteError, type OutgoingRow, type Remote, type RemoteRow } from './remote';

export const SYNC_CONFIG = {
  pushBatch: 200,
  pullPage: 1000,
  /** Filas que se vuelven a leer por si una transacción confirmó fuera de orden. */
  pullOverlap: 100,
  backoffBaseMs: 2_000,
  backoffMaxMs: 5 * 60_000,
} as const;

export type SyncMeta = {
  cursor: number;
  lastSuccessAt?: string;
  lastError?: string;
};

export type SyncOutcome =
  | { status: 'ok'; pushed: number; pulled: number; quarantined: number }
  | { status: 'offline' | 'server-error'; message: string; pushed: number }
  | { status: 'auth-required'; message: string }
  | { status: 'account-mismatch' };

export type SyncOptions = {
  userId: string;
  now?: () => Date;
  /** Para tests: azar del jitter (0–1). */
  random?: () => number;
  /** Sincronización pedida a mano: sube también lo que estaba esperando a reintentar. */
  ignoreBackoff?: boolean;
};

export async function readSyncMeta(db: LearningDB): Promise<SyncMeta> {
  const v = (await db.meta.get('sync'))?.value as SyncMeta | undefined;
  return v ?? { cursor: 0 };
}

async function writeSyncMeta(db: LearningDB, patch: Partial<SyncMeta>): Promise<void> {
  await db.meta.put({ key: 'sync', value: { ...(await readSyncMeta(db)), ...patch } });
}

export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(SYNC_CONFIG.backoffMaxMs, SYNC_CONFIG.backoffBaseMs * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (1 + 0.2 * random()));
}

function toRow(e: AppEvent): OutgoingRow {
  return {
    id: e.id,
    user_id: e.userId,
    device_id: e.deviceId,
    type: e.type,
    schema_version: e.schemaVersion,
    client_created_at: e.clientCreatedAt,
    payload: e.payload,
  };
}

/** Convierte una fila del servidor en evento local, o null si no cumple el esquema. */
export function fromRow(row: RemoteRow): { event: AppEvent } | { error: string } {
  const parsed = AppEvent.safeParse({
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    type: row.type,
    schemaVersion: row.schema_version,
    clientCreatedAt: new Date(row.client_created_at).toISOString(),
    payload: row.payload,
  });
  return parsed.success ? { event: parsed.data } : { error: parsed.error.issues.map((i) => i.message).join('; ') };
}

export async function runSync(db: LearningDB, remote: Remote, opts: SyncOptions): Promise<SyncOutcome> {
  const now = opts.now ?? (() => new Date());
  const random = opts.random ?? Math.random;

  if (!(await bindAccount(db, opts.userId))) return { status: 'account-mismatch' };

  // ---------- Subida ----------
  let pushed = 0;
  let quarantined = 0;
  for (;;) {
    const nowIso = now().toISOString();
    const threshold = opts.ignoreBackoff ? '9999' : nowIso;
    const due = (await db.outbox.where('nextAttemptAt').belowOrEqual(threshold).toArray())
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .slice(0, SYNC_CONFIG.pushBatch);
    if (due.length === 0) break;

    const events = (await db.events.bulkGet(due.map((d) => d.eventId))).filter((e): e is AppEvent => !!e);
    try {
      await remote.push(events.map(toRow));
      await db.outbox.bulkDelete(due.map((d) => d.eventId));
      pushed += events.length;
    } catch (e) {
      if (!(e instanceof RemoteError)) throw e;
      if (e.kind === 'rejected') {
        // Se aísla el evento culpable subiendo uno a uno.
        const result = await pushOneByOne(db, remote, events, nowIso);
        pushed += result.pushed;
        quarantined += result.quarantined;
        if (result.stop) return await failure(db, result.stop, pushed);
        continue;
      }
      await postpone(db, due, now(), random, e.message);
      return await failure(db, e, pushed);
    }
    if (opts.ignoreBackoff && due.length < SYNC_CONFIG.pushBatch) {
      // Con el umbral abierto, una tanda incompleta significa que no queda nada más.
      break;
    }
  }

  // ---------- Bajada ----------
  let pulled = 0;
  try {
    let { cursor } = await readSyncMeta(db);
    for (;;) {
      const rows = await remote.pull(Math.max(0, cursor - SYNC_CONFIG.pullOverlap), SYNC_CONFIG.pullPage);
      const valid: AppEvent[] = [];
      for (const row of rows) {
        const converted = fromRow(row);
        if ('event' in converted) valid.push(converted.event);
        else if (!(await db.quarantine.get(row.id))) {
          await db.quarantine.put({ eventId: row.id, direction: 'incoming', event: row, error: converted.error, at: now().toISOString() });
        }
      }
      pulled += (await ingestEvents(db, valid, { enqueue: false })).added;
      const maxSeq = rows.reduce((m, r) => Math.max(m, r.seq), cursor);
      const advanced = maxSeq > cursor;
      cursor = maxSeq;
      await writeSyncMeta(db, { cursor });
      // Página completa y hemos avanzado: puede haber más.
      if (rows.length < SYNC_CONFIG.pullPage || !advanced) break;
    }
  } catch (e) {
    if (!(e instanceof RemoteError)) throw e;
    return await failure(db, e, pushed);
  }

  await writeSyncMeta(db, { lastSuccessAt: now().toISOString(), lastError: undefined });
  return { status: 'ok', pushed, pulled, quarantined };
}

async function pushOneByOne(
  db: LearningDB,
  remote: Remote,
  events: AppEvent[],
  nowIso: string,
): Promise<{ pushed: number; quarantined: number; stop?: RemoteError }> {
  let pushed = 0;
  let quarantined = 0;
  for (const event of events) {
    try {
      await remote.push([toRow(event)]);
      await db.outbox.delete(event.id);
      pushed++;
    } catch (e) {
      if (!(e instanceof RemoteError)) throw e;
      if (e.kind !== 'rejected') return { pushed, quarantined, stop: e };
      await db.transaction('rw', [db.outbox, db.quarantine], async () => {
        await db.quarantine.put({ eventId: event.id, direction: 'outgoing', event, error: e.message, at: nowIso });
        await db.outbox.delete(event.id);
      });
      quarantined++;
    }
  }
  return { pushed, quarantined };
}

async function postpone(db: LearningDB, entries: OutboxEntry[], now: Date, random: () => number, error: string) {
  await db.outbox.bulkPut(
    entries.map((d) => ({
      ...d,
      attempts: d.attempts + 1,
      nextAttemptAt: new Date(now.getTime() + backoffMs(d.attempts + 1, random)).toISOString(),
      lastError: error,
    })),
  );
}

async function failure(db: LearningDB, e: RemoteError, pushed: number): Promise<SyncOutcome> {
  await writeSyncMeta(db, { lastError: e.message });
  if (e.kind === 'auth') return { status: 'auth-required', message: e.message };
  return { status: e.kind === 'network' ? 'offline' : 'server-error', message: e.message, pushed };
}
