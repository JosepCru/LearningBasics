/**
 * Cola de repaso del día: tarjetas vencidas (las más en riesgo de olvido primero) y
 * tarjetas nuevas, limitadas por día. Una tarjeta nueva solo entra cuando ya has
 * completado una lección que trabaja su objetivo: no se repasa lo que no se ha estudiado.
 */
import { isDue, retrievability, type CardState } from './fsrs';

export const REVIEW_DEFAULTS = {
  /** Tarjetas nuevas que se introducen como máximo cada día. */
  newPerDay: 10,
} as const;

export type QueueInput = {
  /** Tarjetas activas del contenido, en orden del currículo. */
  cards: readonly { id: string; objective: string }[];
  states: ReadonlyMap<string, CardState>;
  unlockedObjectives: ReadonlySet<string>;
  /** Tarjetas cuyo primer repaso fue hoy (hora local). */
  introducedToday: number;
  now: Date;
  newPerDay?: number;
};

export type ReviewQueue = {
  due: string[];
  fresh: string[];
  /** Nuevas desbloqueadas que esperan a otro día por el límite diario. */
  waitingNew: number;
  /** Tarjetas aún bloqueadas (su lección no está completada). */
  locked: number;
};

export function buildReviewQueue(input: QueueInput): ReviewQueue {
  const newPerDay = input.newPerDay ?? REVIEW_DEFAULTS.newPerDay;
  const due: { id: string; r: number; due: string }[] = [];
  const unseen: string[] = [];
  let locked = 0;

  for (const card of input.cards) {
    const state = input.states.get(card.id);
    if (state) {
      if (isDue(state, input.now)) due.push({ id: card.id, r: retrievability(state, input.now), due: state.due });
    } else if (input.unlockedObjectives.has(card.objective)) {
      unseen.push(card.id);
    } else {
      locked++;
    }
  }

  due.sort((a, b) => a.r - b.r || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const slots = Math.max(0, newPerDay - input.introducedToday);
  return {
    due: due.map((d) => d.id),
    fresh: unseen.slice(0, slots),
    waitingNew: Math.max(0, unseen.length - slots),
    locked,
  };
}
