import type { AttemptPayload } from '../events/schemas';

/** Un intento con su fecha: lo que necesita el cálculo de dominio. */
export type AttemptRecord = {
  id: string;
  at: Date;
  payload: AttemptPayload;
};

/** Correcto a la primera, sin pistas, sin ver la solución y sin autoevaluarse. */
export function isUnaided(p: AttemptPayload): boolean {
  return p.result === 'correct' && p.tries === 1 && p.hintsUsed === 0 && !p.solutionViewed && !p.selfGraded;
}
