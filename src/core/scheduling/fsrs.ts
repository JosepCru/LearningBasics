/**
 * Adaptador de repetición espaciada (FSRS vía ts-fsrs). Es el único módulo que conoce
 * la librería: si cambia su API, solo cambia este archivo.
 *
 * El estado de una tarjeta NO se sincroniza: se reconstruye reproduciendo sus repasos
 * en orden. Por eso todo aquí es determinista para unas mismas entradas.
 */
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';

export type Rating = 1 | 2 | 3 | 4; // Otra vez, Difícil, Bien, Fácil

/** Estado serializable (JSON) de una tarjeta. */
export type CardState = {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  /** 0 nueva, 1 aprendiendo, 2 repaso, 3 reaprendiendo */
  state: 0 | 1 | 2 | 3;
  lastReview?: string;
};

export type ReviewInput = { id: string; rating: Rating; reviewedAt: string };

// Parámetros por defecto de FSRS (retención objetivo 0.9). El "fuzz" reparte las fechas
// para que las tarjetas aprendidas juntas no venzan el mismo día; ts-fsrs lo calcula con
// una semilla derivada del propio repaso, así que es reproducible (ver fsrs.test.ts).
const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

function toCard(s: CardState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    ...(s.lastReview ? { last_review: new Date(s.lastReview) } : {}),
  };
}

function fromCard(c: Card): CardState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as CardState['state'],
    ...(c.last_review ? { lastReview: c.last_review.toISOString() } : {}),
  };
}

export function newCardState(at: Date): CardState {
  return fromCard(createEmptyCard(at));
}

/** Aplica un repaso. Sin estado previo, la tarjeta se crea en el momento del repaso. */
export function applyReview(state: CardState | undefined, rating: Rating, at: Date): CardState {
  const card = state ? toCard(state) : createEmptyCard(at);
  return fromCard(scheduler.next(card, at, rating as Grade).card);
}

/** Fecha de vencimiento que tendría la tarjeta con cada respuesta posible. */
export function previewDue(state: CardState | undefined, at: Date): Record<Rating, Date> {
  const preview = scheduler.repeat(state ? toCard(state) : createEmptyCard(at), at);
  return {
    1: preview[1].card.due,
    2: preview[2].card.due,
    3: preview[3].card.due,
    4: preview[4].card.due,
  };
}

/** Probabilidad estimada de recordar la tarjeta ahora (0–1). Nuevas: 0. */
export function retrievability(state: CardState, at: Date): number {
  if (state.state === 0) return 0;
  return scheduler.get_retrievability(toCard(state), at, false);
}

export function isDue(state: CardState, at: Date): boolean {
  return new Date(state.due).getTime() <= at.getTime();
}

/** Orden canónico de repasos: por fecha y, a igualdad, por ID. Igual en todos los dispositivos. */
export function compareReviews(a: ReviewInput, b: ReviewInput): number {
  return a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Reconstruye el estado de una tarjeta a partir de todos sus repasos, en cualquier orden. */
export function replayReviews(reviews: readonly ReviewInput[]): CardState | undefined {
  let state: CardState | undefined;
  for (const r of [...reviews].sort(compareReviews)) state = applyReview(state, r.rating, new Date(r.reviewedAt));
  return state;
}
