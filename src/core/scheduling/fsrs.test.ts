import { describe, expect, it } from 'vitest';
import { applyReview, isDue, previewDue, replayReviews, retrievability, type ReviewInput } from './fsrs';

const T0 = new Date('2026-01-10T09:00:00Z');
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

describe('adaptador FSRS', () => {
  it('una tarjeta nueva repasada con "Bien" vence en el futuro', () => {
    const s = applyReview(undefined, 3, T0);
    expect(s.reps).toBe(1);
    expect(new Date(s.due).getTime()).toBeGreaterThan(T0.getTime());
    expect(isDue(s, T0)).toBe(false);
  });

  it('"Otra vez" programa antes que "Bien", y "Bien" antes que "Fácil"', () => {
    const p = previewDue(undefined, T0);
    expect(p[1].getTime()).toBeLessThan(p[3].getTime());
    expect(p[3].getTime()).toBeLessThan(p[4].getTime());
  });

  it('los intervalos crecen con repasos correctos sucesivos', () => {
    let s = applyReview(undefined, 3, T0);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const at = new Date(s.due);
      s = applyReview(s, 3, at);
      intervals.push(new Date(s.due).getTime() - at.getTime());
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
  });

  it('un fallo en fase de repaso cuenta como lapso', () => {
    let s = applyReview(undefined, 4, T0);
    s = applyReview(s, 3, new Date(s.due));
    expect(s.state).toBe(2);
    s = applyReview(s, 1, new Date(s.due));
    expect(s.lapses).toBe(1);
  });

  it('la retrievability baja con el tiempo', () => {
    const s = applyReview(applyReview(undefined, 3, T0), 3, days(1));
    expect(retrievability(s, days(2))).toBeGreaterThan(retrievability(s, days(60)));
    expect(retrievability(s, days(60))).toBeGreaterThan(0);
  });

  it('es determinista (fuzz incluido): mismas entradas, mismo estado', () => {
    const run = () => {
      let s = applyReview(undefined, 3, T0);
      for (let i = 0; i < 6; i++) s = applyReview(s, 3, new Date(s.due));
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe('replayReviews', () => {
  const reviews: ReviewInput[] = [
    { id: 'a', rating: 3, reviewedAt: days(0).toISOString() },
    { id: 'b', rating: 1, reviewedAt: days(3).toISOString() },
    { id: 'c', rating: 3, reviewedAt: days(3.01).toISOString() },
    { id: 'd', rating: 4, reviewedAt: days(9).toISOString() },
  ];

  it('el resultado no depende del orden de llegada (dos dispositivos convergen)', () => {
    const expected = replayReviews(reviews);
    const shuffled = [reviews[2]!, reviews[0]!, reviews[3]!, reviews[1]!];
    expect(replayReviews(shuffled)).toEqual(expected);
    expect(replayReviews([...reviews].reverse())).toEqual(expected);
  });

  it('equivale a aplicar los repasos uno a uno en orden', () => {
    let s;
    for (const r of reviews) s = applyReview(s, r.rating, new Date(r.reviewedAt));
    expect(replayReviews(reviews)).toEqual(s);
  });

  it('sin repasos no hay estado', () => {
    expect(replayReviews([])).toBeUndefined();
  });
});
