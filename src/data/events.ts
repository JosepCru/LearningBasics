/**
 * Escritura de eventos y mantenimiento de proyecciones.
 * Toda escritura pasa por aquí: valida con Zod y, en UNA transacción, guarda el evento,
 * lo encola para sincronizar y actualiza las proyecciones afectadas.
 */
import { AppEvent, withoutVoided, type EventType, type PayloadOf } from '../core/events/schemas';
import { uuidv7 } from '../core/events/uuid';
import { applyReview, replayReviews, type Rating } from '../core/scheduling/fsrs';
import type { CardRow, LearningDB } from './db';

/** Hasta iniciar sesión (Fase 3), los eventos pertenecen al usuario "local". */
export const LOCAL_USER = 'local';

async function deviceId(db: LearningDB): Promise<string> {
  const row = await db.meta.get('deviceId');
  if (typeof row?.value === 'string') return row.value;
  const id = uuidv7();
  await db.meta.put({ key: 'deviceId', value: id });
  return id;
}

export async function appendEvent<T extends EventType>(
  db: LearningDB,
  type: T,
  payload: PayloadOf<T>,
  now: Date = new Date(),
): Promise<AppEvent> {
  return db.transaction('rw', [db.events, db.outbox, db.cardStates, db.meta], async () => {
    const event = AppEvent.parse({
      id: uuidv7(now.getTime()),
      userId: (await boundAccount(db)) ?? LOCAL_USER,
      deviceId: await deviceId(db),
      type,
      clientCreatedAt: now.toISOString(),
      schemaVersion: 1,
      payload,
    });
    await db.events.add(event);
    await db.outbox.add({ eventId: event.id, createdAt: event.clientCreatedAt, attempts: 0, nextAttemptAt: event.clientCreatedAt });
    await project(db, event);
    return event;
  });
}

/** Actualiza las proyecciones tras un evento nuevo. */
async function project(db: LearningDB, event: AppEvent): Promise<void> {
  if (event.type === 'review') {
    const { cardId, rating, reviewedAt } = event.payload;
    const row = await db.cardStates.get(cardId);
    const last = row?.state.lastReview;
    if (!row || !last || reviewedAt >= last) {
      // Caso normal: el repaso es posterior al último conocido → paso incremental.
      const state = applyReview(row?.state, rating as Rating, new Date(reviewedAt));
      await db.cardStates.put({ cardId, state, due: state.due, firstReviewAt: row?.firstReviewAt ?? reviewedAt });
    } else {
      // Llegó un repaso anterior (otro dispositivo, importación): se reproduce la tarjeta entera.
      await rebuildCard(db, cardId);
    }
  } else if (event.type === 'void') {
    const target = await db.events.get(event.payload.targetEventId);
    if (target?.type === 'review') await rebuildCard(db, target.payload.cardId);
  }
}

async function rebuildCard(db: LearningDB, cardId: string): Promise<void> {
  const voids = await db.events.where('type').equals('void').toArray();
  const reviews = (await db.events.where('payload.cardId').equals(cardId).toArray()).filter((e) => e.type === 'review');
  const live = withoutVoided([...reviews, ...voids]).filter((e) => e.type === 'review');
  const row = cardRowFrom(cardId, live);
  if (row) await db.cardStates.put(row);
  else await db.cardStates.delete(cardId);
}

function cardRowFrom(cardId: string, reviews: AppEvent[]): CardRow | undefined {
  const inputs = reviews.flatMap((e) =>
    e.type === 'review' ? [{ id: e.id, rating: e.payload.rating as Rating, reviewedAt: e.payload.reviewedAt }] : [],
  );
  const state = replayReviews(inputs);
  if (!state) return undefined;
  const firstReviewAt = inputs.map((r) => r.reviewedAt).sort()[0]!;
  return { cardId, state, due: state.due, firstReviewAt };
}

export type IngestResult = { added: number; existing: number };

/**
 * Incorpora eventos ya validados que vienen de fuera (servidor o importación).
 * Une por ID: los existentes se ignoran y nunca se modifica ni borra nada.
 * Con `enqueue`, los nuevos se encolan para subirlos (importación); los que llegan del
 * servidor no, porque ya están allí.
 */
export async function ingestEvents(
  db: LearningDB,
  incoming: readonly AppEvent[],
  opts: { enqueue: boolean },
): Promise<IngestResult> {
  return db.transaction('rw', [db.events, db.outbox, db.cardStates], async () => {
    const unique = [...new Map(incoming.map((e) => [e.id, e])).values()];
    const found = await db.events.bulkGet(unique.map((e) => e.id));
    const fresh = unique.filter((_, i) => !found[i]);
    if (fresh.length === 0) return { added: 0, existing: unique.length };

    await db.events.bulkAdd(fresh);
    if (opts.enqueue) {
      await db.outbox.bulkPut(
        fresh.map((e) => ({ eventId: e.id, createdAt: e.clientCreatedAt, attempts: 0, nextAttemptAt: e.clientCreatedAt })),
      );
    }

    // Tarjetas afectadas: se reproducen enteras (los eventos pueden llegar en cualquier orden).
    const cards = new Set<string>();
    const voidTargets: string[] = [];
    for (const e of fresh) {
      if (e.type === 'review') cards.add(e.payload.cardId);
      if (e.type === 'void') voidTargets.push(e.payload.targetEventId);
    }
    for (const target of await db.events.bulkGet(voidTargets)) {
      if (target?.type === 'review') cards.add(target.payload.cardId);
    }
    for (const cardId of cards) await rebuildCard(db, cardId);
    return { added: fresh.length, existing: unique.length - fresh.length };
  });
}

/**
 * Vincula la base local a una cuenta. La primera vez, los eventos creados sin sesión
 * (`userId: 'local'`) pasan a ser de esa cuenta. Si el dispositivo ya pertenece a otra
 * cuenta, devuelve false y no toca nada.
 */
export async function bindAccount(db: LearningDB, userId: string): Promise<boolean> {
  return db.transaction('rw', [db.meta, db.events], async () => {
    const bound = (await db.meta.get('accountId'))?.value;
    if (bound === userId) return true;
    if (typeof bound === 'string') return false;
    await db.events.toCollection().modify((e) => {
      if (e.userId === LOCAL_USER) e.userId = userId;
    });
    await db.meta.put({ key: 'accountId', value: userId });
    return true;
  });
}

/** Cuenta vinculada a este dispositivo, si la hay. */
export async function boundAccount(db: LearningDB): Promise<string | undefined> {
  const v = (await db.meta.get('accountId'))?.value;
  return typeof v === 'string' ? v : undefined;
}

/** Recalcula todas las proyecciones desde los eventos (tras importar o migrar). */
export async function rebuildProjections(db: LearningDB): Promise<void> {
  await db.transaction('rw', [db.events, db.cardStates], async () => {
    const live = withoutVoided(await db.events.toArray());
    const byCard = new Map<string, AppEvent[]>();
    for (const e of live) {
      if (e.type !== 'review') continue;
      const list = byCard.get(e.payload.cardId) ?? [];
      list.push(e);
      byCard.set(e.payload.cardId, list);
    }
    await db.cardStates.clear();
    await db.cardStates.bulkPut([...byCard].flatMap(([cardId, list]) => cardRowFrom(cardId, list) ?? []));
  });
}
