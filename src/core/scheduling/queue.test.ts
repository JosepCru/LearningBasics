import { describe, expect, it } from 'vitest';
import { applyReview, type CardState } from './fsrs';
import { buildReviewQueue } from './queue';

const T0 = new Date('2026-02-01T09:00:00Z');
const at = (days: number) => new Date(T0.getTime() + days * 86_400_000);

const cards = [
  { id: 'c1', objective: 'o1' },
  { id: 'c2', objective: 'o1' },
  { id: 'c3', objective: 'o2' },
  { id: 'c4', objective: 'o3' },
];

describe('buildReviewQueue', () => {
  it('sin lecciones completadas no hay tarjetas nuevas', () => {
    const q = buildReviewQueue({ cards, states: new Map(), unlockedObjectives: new Set(), introducedToday: 0, now: T0 });
    expect(q).toEqual({ due: [], fresh: [], waitingNew: 0, locked: 4 });
  });

  it('desbloquea solo las tarjetas de objetivos estudiados, en orden del currículo', () => {
    const q = buildReviewQueue({
      cards,
      states: new Map(),
      unlockedObjectives: new Set(['o1', 'o3']),
      introducedToday: 0,
      now: T0,
    });
    expect(q.fresh).toEqual(['c1', 'c2', 'c4']);
    expect(q.locked).toBe(1);
  });

  it('respeta el límite diario de nuevas, descontando las ya introducidas hoy', () => {
    const q = buildReviewQueue({
      cards,
      states: new Map(),
      unlockedObjectives: new Set(['o1', 'o2', 'o3']),
      introducedToday: 1,
      newPerDay: 2,
      now: T0,
    });
    expect(q.fresh).toEqual(['c1']);
    expect(q.waitingNew).toBe(3);
  });

  it('incluye solo las vencidas y prioriza la menor retrievability', () => {
    // c1: un repaso "Bien" hace 30 días (muy olvidada). c2: repasada ayer con "Fácil" (no vence).
    // c3: un repaso "Difícil" hace 10 días.
    const states = new Map<string, CardState>([
      ['c1', applyReview(undefined, 3, at(-30))],
      ['c2', applyReview(undefined, 4, at(-1))],
      ['c3', applyReview(undefined, 2, at(-10))],
    ]);
    const q = buildReviewQueue({ cards, states, unlockedObjectives: new Set(), introducedToday: 0, now: T0 });
    expect(q.due).toEqual(['c1', 'c3']);
  });
});
