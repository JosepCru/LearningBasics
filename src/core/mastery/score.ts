import type { AttemptPayload } from '../events/schemas';

/**
 * Cuánto demuestra un intento sobre el dominio de su objetivo, entre 0 y 1.
 *
 * Es la pieza que más influye en lo que verás como "Iniciado", "En desarrollo" o
 * "Consolidado": el resto del cálculo (antigüedad, retención, umbrales) solo pondera y
 * agrega estas puntuaciones. Ver docs/MASTERY.md.
 *
 * Datos disponibles en `p`:
 *   p.result          'correct' | 'incorrect' (resultado final del ejercicio)
 *   p.tries           respuestas comprobadas (1 = acertó a la primera si es correcto)
 *   p.hintsUsed       pistas abiertas
 *   p.solutionViewed  vio la solución (antes de acertar, o en lugar de acertar)
 *   p.selfGraded      se marcó correcta a sí mismo (texto corto)
 *
 * Restricciones que comprueban los tests (score.test.ts):
 *   - devuelve un número entre 0 y 1;
 *   - un fallo final vale 0;
 *   - acertar a la primera sin ayuda vale 1 y es lo máximo;
 *   - usar ayuda nunca puntúa más que no usarla.
 */
export function scoreAttempt(p: AttemptPayload): number {
  // Valores de la tabla de MASTERY.md. Ver la tabla para el razonamiento.
  // Ver la solución antes de acertar equivale a no haberlo resuelto.
  if (p.result === 'incorrect' || p.solutionViewed) return 0;
  // Sin comprobación automática: cuenta, pero menos que un acierto verificado.
  if (p.selfGraded) return 0.8;
  if (p.tries === 1 && p.hintsUsed === 0) return 1;
  // Pistas o reintentos: llegó por sí mismo, pero con ayuda. Valor plano, no decreciente.
  return 0.6;
}
