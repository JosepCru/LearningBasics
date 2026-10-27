import type { CompiledExercise } from '../content/compiled';
import { evaluateChoice } from './choice';
import { evaluateNumeric } from './numeric';
import { evaluateShortText } from './short-text';
import type { EvaluationResult } from './types';

export type ExerciseResponse =
  | { type: 'multiple-choice'; optionId: string }
  | { type: 'numeric'; text: string }
  | { type: 'short-text'; text: string };

/** Punto de entrada único: despacha según el tipo de ejercicio. */
export function evaluate(exercise: CompiledExercise, response: ExerciseResponse): EvaluationResult {
  if (exercise.type !== response.type) throw new Error(`Respuesta de tipo ${response.type} para ${exercise.type}`);
  switch (exercise.type) {
    case 'multiple-choice':
      return evaluateChoice(exercise, (response as { optionId: string }).optionId);
    case 'numeric':
      return evaluateNumeric(exercise.answer, (response as { text: string }).text);
    case 'short-text':
      return evaluateShortText(exercise, (response as { text: string }).text);
  }
}

export type { EvaluationResult, FeedbackCode } from './types';
