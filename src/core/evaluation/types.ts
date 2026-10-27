/**
 * Resultado de evaluar una respuesta. `feedback` es un código estable: la UI lo
 * traduce a texto; los eventos de intento (Fase 2) lo guardan tal cual.
 */
export type FeedbackCode =
  | 'correct'
  | 'correct-equivalent-unit' // valor correcto expresado en otra unidad válida
  | 'incorrect'
  | 'wrong-value'
  | 'missing-unit'
  | 'unexpected-unit'
  | 'unknown-unit'
  | 'wrong-dimension'
  | 'wrong-unit' // misma dimensión, pero el ejercicio exige la unidad exacta
  | 'unparseable'
  | 'no-match'; // texto corto sin coincidencia

export type EvaluationResult = {
  correct: boolean;
  feedback: FeedbackCode;
  /** Etiquetas de misconception asociadas a la respuesta (opción múltiple). */
  errorTags: string[];
  /** Para numéricos: si el valor coincide aunque falle la unidad. */
  valueMatches?: boolean;
};

export const ok = (feedback: FeedbackCode = 'correct'): EvaluationResult => ({
  correct: true,
  feedback,
  errorTags: [],
});

export const fail = (feedback: FeedbackCode, extra: Partial<EvaluationResult> = {}): EvaluationResult => ({
  correct: false,
  feedback,
  errorTags: [],
  ...extra,
});
