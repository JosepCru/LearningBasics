/**
 * Estimación de dominio por objetivo: una heurística interpretable, no una medida
 * científica. Fórmulas y justificación en docs/MASTERY.md.
 */
import type { AttemptPayload } from '../events/schemas';
import { isUnaided, type AttemptRecord } from './attempt';
import { scoreAttempt } from './score';

export const MASTERY_CONFIG = {
  /** Días tras los que un intento pesa la mitad. */
  halfLifeDays: 21,
  /** Multiplicador para intentos hechos al menos `retentionGapDays` después del primero. */
  retentionBonus: 1.5,
  retentionGapDays: 1,
  /** Por debajo de este número de evidencias: "Sin datos". */
  minEvidence: 3,
  developingFrom: 0.5,
  consolidatedFrom: 0.8,
  /** "Retenido" exige un acierto sin ayuda al menos estos días después del primer intento. */
  retainedGapDays: 7,
  /** Errores repetidos: misma etiqueta de misconception N veces en la ventana. */
  repeatedErrorCount: 2,
  repeatedErrorWindowDays: 14,
} as const;

export type MasteryBand = 'no-data' | 'started' | 'developing' | 'consolidated' | 'retained';

export const BAND_LABELS: Record<MasteryBand, string> = {
  'no-data': 'Sin datos',
  started: 'Iniciado',
  developing: 'En desarrollo',
  consolidated: 'Consolidado',
  retained: 'Retenido',
};

export type ObjectiveMastery = {
  objectiveId: string;
  /** Media ponderada 0–1, o null sin evidencias. */
  score: number | null;
  evidence: number;
  band: MasteryBand;
  /** Etiquetas de misconception repetidas recientemente. */
  repeatedErrors: string[];
  /** Débil: errores repetidos o banda "Iniciado". Lo usará el planificador. */
  weak: boolean;
  lastAttemptAt: Date | null;
};

export type MasteryOptions = {
  now: Date;
  /** Revisión vigente de un ejercicio; undefined si ya no existe en el contenido. */
  currentRevision: (exerciseId: string) => number | undefined;
  /** Inyectable para los tests; por defecto, la función de score.ts. */
  score?: (p: AttemptPayload) => number;
};

const DAY = 86_400_000;

export function computeMastery(attempts: readonly AttemptRecord[], opts: MasteryOptions): Map<string, ObjectiveMastery> {
  const score = opts.score ?? scoreAttempt;
  const c = MASTERY_CONFIG;

  // Los intentos contra una revisión anterior de la respuesta no cuentan como evidencia.
  const valid = attempts.filter((a) => {
    const current = opts.currentRevision(a.payload.exerciseId);
    return current === undefined || a.payload.exerciseRevision >= current;
  });

  const byObjective = new Map<string, AttemptRecord[]>();
  for (const a of valid) {
    const list = byObjective.get(a.payload.objectiveId) ?? [];
    list.push(a);
    byObjective.set(a.payload.objectiveId, list);
  }

  const result = new Map<string, ObjectiveMastery>();
  for (const [objectiveId, list] of byObjective) {
    list.sort((x, y) => x.at.getTime() - y.at.getTime());
    const first = list[0]!.at.getTime();

    let weighted = 0;
    let totalWeight = 0;
    for (const a of list) {
      const ageDays = Math.max(0, (opts.now.getTime() - a.at.getTime()) / DAY);
      const decay = 0.5 ** (ageDays / c.halfLifeDays);
      const delayed = (a.at.getTime() - first) / DAY >= c.retentionGapDays;
      const weight = decay * (delayed ? c.retentionBonus : 1);
      weighted += weight * score(a.payload);
      totalWeight += weight;
    }
    const value = totalWeight > 0 ? weighted / totalWeight : null;

    const retainedProof = list.some((a) => isUnaided(a.payload) && (a.at.getTime() - first) / DAY >= c.retainedGapDays);
    const band = bandFor(value, list.length, retainedProof);

    const windowStart = opts.now.getTime() - c.repeatedErrorWindowDays * DAY;
    const tagCounts = new Map<string, number>();
    for (const a of list) {
      if (a.at.getTime() < windowStart) continue;
      for (const tag of new Set(a.payload.errorTags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const repeatedErrors = [...tagCounts].filter(([, n]) => n >= c.repeatedErrorCount).map(([t]) => t).sort();

    result.set(objectiveId, {
      objectiveId,
      score: value,
      evidence: list.length,
      band,
      repeatedErrors,
      weak: repeatedErrors.length > 0 || band === 'started',
      lastAttemptAt: list.at(-1)!.at,
    });
  }
  return result;
}

function bandFor(score: number | null, evidence: number, retainedProof: boolean): MasteryBand {
  const c = MASTERY_CONFIG;
  if (score === null || evidence < c.minEvidence) return 'no-data';
  if (score < c.developingFrom) return 'started';
  if (score < c.consolidatedFrom) return 'developing';
  return retainedProof ? 'retained' : 'consolidated';
}
