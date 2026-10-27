import type { TextNormalization } from '../content/schemas';
import { fail, ok, type EvaluationResult } from './types';

/**
 * Normaliza texto para comparar respuestas cortas.
 * Limitación conocida: no entiende sinónimos, paráfrasis ni erratas.
 */
export function normalizeText(text: string, opts: TextNormalization): string {
  let s = text.normalize('NFC').trim().replace(/[.;:!¡?¿]+$/u, '');
  if (opts.whitespace) s = s.replace(/\s+/g, ' ');
  if (opts.case) s = s.toLocaleLowerCase('es');
  if (opts.accents) s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '').normalize('NFC');
  return s.trim();
}

export type ShortTextSpec = { accept: string[]; normalize: TextNormalization };

export function evaluateShortText(spec: ShortTextSpec, input: string): EvaluationResult {
  if (input.trim() === '') return fail('unparseable');
  const given = normalizeText(input, spec.normalize);
  const match = spec.accept.some((a) => normalizeText(a, spec.normalize) === given);
  return match ? ok() : fail('no-match');
}
