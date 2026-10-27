/**
 * Propiedades que debe cumplir scoreAttempt, sea cual sea tu elección de valores.
 * No fijan números concretos (salvo los extremos): esa decisión es tuya.
 */
import { describe, expect, it } from 'vitest';
import type { AttemptPayload } from '../events/schemas';
import { scoreAttempt } from './score';

const base: AttemptPayload = {
  exerciseId: 'chem.x.ex01',
  exerciseRevision: 1,
  objectiveId: 'chem.x.o1',
  result: 'correct',
  tries: 1,
  hintsUsed: 0,
  solutionViewed: false,
  selfGraded: false,
  feedback: ['correct'],
  errorTags: [],
  lastResponse: '1',
  durationMs: 1000,
};
const p = (over: Partial<AttemptPayload>): AttemptPayload => ({ ...base, ...over });

const variants: AttemptPayload[] = [
  base,
  p({ hintsUsed: 1 }),
  p({ hintsUsed: 3 }),
  p({ tries: 2 }),
  p({ tries: 4, hintsUsed: 2 }),
  p({ solutionViewed: true, tries: 2 }),
  p({ selfGraded: true }),
  p({ result: 'incorrect', tries: 1 }),
  p({ result: 'incorrect', tries: 3, hintsUsed: 2, solutionViewed: true }),
];

describe('scoreAttempt', () => {
  it('siempre devuelve un número entre 0 y 1', () => {
    for (const v of variants) {
      const s = scoreAttempt(v);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('acertar a la primera sin ayuda vale 1 y es el máximo', () => {
    expect(scoreAttempt(base)).toBe(1);
    for (const v of variants) expect(scoreAttempt(v)).toBeLessThanOrEqual(1);
  });

  it('un fallo final vale 0', () => {
    expect(scoreAttempt(p({ result: 'incorrect' }))).toBe(0);
    expect(scoreAttempt(p({ result: 'incorrect', tries: 3, hintsUsed: 2, solutionViewed: true }))).toBe(0);
  });

  it('usar ayuda nunca puntúa más que no usarla', () => {
    expect(scoreAttempt(p({ hintsUsed: 1 }))).toBeLessThan(scoreAttempt(base));
    expect(scoreAttempt(p({ hintsUsed: 2 }))).toBeLessThanOrEqual(scoreAttempt(p({ hintsUsed: 1 })));
    expect(scoreAttempt(p({ tries: 2 }))).toBeLessThan(scoreAttempt(base));
    expect(scoreAttempt(p({ tries: 2, solutionViewed: true }))).toBeLessThanOrEqual(scoreAttempt(p({ tries: 2 })));
    expect(scoreAttempt(p({ selfGraded: true }))).toBeLessThan(scoreAttempt(base));
  });
});
