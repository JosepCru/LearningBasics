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
      userId: LOCAL_USER,
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
