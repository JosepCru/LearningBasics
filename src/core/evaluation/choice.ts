import { fail, ok, type EvaluationResult } from './types';

export type ChoiceSpec = { options: { id: string; correct: boolean; misconception?: string }[] };

export function evaluateChoice(spec: ChoiceSpec, selectedId: string): EvaluationResult {
  const option = spec.options.find((o) => o.id === selectedId);
  if (!option) return fail('unparseable');
  if (option.correct) return ok();
  return fail('incorrect', { errorTags: option.misconception ? [option.misconception] : [] });
}

/**
 * Baraja determinista (Fisher–Yates con semilla): el mismo ejercicio mantiene el
 * mismo orden dentro de una sesión aunque el componente se vuelva a renderizar.
 */
export function shuffledOrder<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
