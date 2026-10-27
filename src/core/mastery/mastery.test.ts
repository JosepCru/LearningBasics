import { describe, expect, it } from 'vitest';
import type { AttemptPayload } from '../events/schemas';
import type { AttemptRecord } from './attempt';
import { computeMastery, MASTERY_CONFIG } from './mastery';

/**
 * Estos tests usan una puntuación de referencia fija (la tabla de MASTERY.md) para
 * comprobar el resto del cálculo sin depender de cómo implementes scoreAttempt.
 */
const referenceScore = (p: AttemptPayload): number => {
  if (p.result === 'incorrect') return 0;
  if (p.selfGraded) return 0.8;
  if (p.tries === 1 && p.hintsUsed === 0 && !p.solutionViewed) return 1;
  return 0.6;
};

const NOW = new Date('2026-03-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let seq = 0;
function attempt(at: Date, over: Partial<AttemptPayload> = {}): AttemptRecord {
  return {
    id: `a${++seq}`,
    at,
    payload: {
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
      ...over,
    },
  };
}

const run = (attempts: AttemptRecord[], currentRevision: (id: string) => number | undefined = () => 1) =>
  computeMastery(attempts, { now: NOW, currentRevision, score: referenceScore }).get('chem.x.o1');

const wrong = (at: Date, tags: string[] = []) =>
  attempt(at, { result: 'incorrect', tries: 2, feedback: ['incorrect', 'incorrect'], errorTags: tags });

describe('computeMastery', () => {
  it('sin intentos → el objetivo no aparece (la UI lo muestra como "Sin datos")', () => {
    expect(computeMastery([], { now: NOW, currentRevision: () => 1, score: referenceScore }).size).toBe(0);
  });

  it(`menos de ${MASTERY_CONFIG.minEvidence} evidencias → "Sin datos" aunque acierte`, () => {
    expect(run([attempt(daysAgo(0)), attempt(daysAgo(0))])).toMatchObject({ band: 'no-data', evidence: 2 });
  });

  it('tres aciertos sin ayuda el mismo día → "Consolidado", no "Retenido"', () => {
    const m = run([attempt(daysAgo(0)), attempt(daysAgo(0)), attempt(daysAgo(0))]);
    expect(m).toMatchObject({ band: 'consolidated', score: 1 });
  });

  it('acierto sin ayuda 8 días después del primero → "Retenido"', () => {
    const m = run([attempt(daysAgo(8)), attempt(daysAgo(8)), attempt(daysAgo(0))]);
    expect(m?.band).toBe('retained');
  });

  it('un acierto con ayuda 8 días después no basta para "Retenido"', () => {
    const m = run([attempt(daysAgo(8)), attempt(daysAgo(8)), attempt(daysAgo(0), { hintsUsed: 1 })]);
    expect(m?.band).not.toBe('retained');
  });

  it('los intentos antiguos pesan menos que los recientes', () => {
    // Un fallo antiguo y un acierto reciente puntúan más que al revés.
    const oldFail = run([wrong(daysAgo(42)), attempt(daysAgo(0)), attempt(daysAgo(0))]);
    const recentFail = run([attempt(daysAgo(42)), attempt(daysAgo(42)), wrong(daysAgo(0))]);
    expect(oldFail!.score!).toBeGreaterThan(recentFail!.score!);
  });

  it('caso numérico: vida media de 21 días y bonus de retención', () => {
    // Acierto hace 21 días (peso 0.5) y fallo hoy, 21 días después del primero (peso 1 × 1.5).
    const m = run([attempt(daysAgo(21)), wrong(daysAgo(0)), wrong(daysAgo(0))]);
    // (0.5·1 + 1.5·0 + 1.5·0) / (0.5 + 1.5 + 1.5) = 0.142857…
    expect(m!.score!).toBeCloseTo(0.5 / 3.5, 6);
    expect(m!.band).toBe('started');
  });

  it('bandas intermedias con la puntuación de referencia', () => {
    const helped = (at: Date) => attempt(at, { hintsUsed: 1 });
    expect(run([helped(daysAgo(0)), helped(daysAgo(0)), helped(daysAgo(0))])?.band).toBe('developing');
  });

  it('los intentos de una revisión anterior de la respuesta no cuentan', () => {
    const attempts = [attempt(daysAgo(1)), attempt(daysAgo(1)), attempt(daysAgo(1))];
    expect(run(attempts, () => 2)).toBeUndefined();
    // Si el ejercicio ya no existe (retirado), el historial se conserva.
    expect(run(attempts, () => undefined)?.evidence).toBe(3);
  });

  it('detecta errores repetidos y marca el objetivo como débil', () => {
    const m = run([
      wrong(daysAgo(2), ['charge-sign']),
      wrong(daysAgo(1), ['charge-sign', 'other']),
      attempt(daysAgo(0)),
      attempt(daysAgo(0)),
      attempt(daysAgo(0)),
    ]);
    expect(m?.repeatedErrors).toEqual(['charge-sign']);
    expect(m?.weak).toBe(true);
  });

  it('los errores fuera de la ventana de 14 días no cuentan como repetidos', () => {
    const m = run([wrong(daysAgo(30), ['charge-sign']), wrong(daysAgo(20), ['charge-sign'])]);
    expect(m?.repeatedErrors).toEqual([]);
  });

  it('agrupa por objetivo', () => {
    const map = computeMastery(
      [attempt(daysAgo(0)), attempt(daysAgo(0), { objectiveId: 'chem.x.o2', exerciseId: 'chem.x.ex02' })],
      { now: NOW, currentRevision: () => 1, score: referenceScore },
    );
    expect([...map.keys()].sort()).toEqual(['chem.x.o1', 'chem.x.o2']);
  });
});
