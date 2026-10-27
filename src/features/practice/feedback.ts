import type { CompiledExercise } from '../../core/content/compiled';
import type { EvaluationResult } from '../../core/evaluation';

/** Traduce el código de evaluación a un mensaje que explica qué falló y cómo seguir. */
export function feedbackMessage(exercise: CompiledExercise, result: EvaluationResult): string {
  const unit = exercise.type === 'numeric' ? exercise.answer.unit : undefined;
  switch (result.feedback) {
    case 'correct':
      return 'Correcto.';
    case 'correct-equivalent-unit':
      return `Correcto. Has usado una unidad equivalente; la respuesta de referencia está en ${unit}.`;
    case 'incorrect':
      return 'No es correcto.';
    case 'wrong-value':
      return 'El valor no es correcto. Revisa el planteamiento y los cálculos.';
    case 'missing-unit':
      return result.valueMatches
        ? `El número es correcto, pero falta la unidad. Escribe el resultado en ${unit}.`
        : 'Falta la unidad. Escribe el número seguido de la unidad, por ejemplo «12.5 g».';
    case 'unexpected-unit':
      return 'Esta magnitud no lleva unidades: escribe solo el número.';
    case 'unknown-unit':
      return 'No reconozco esa unidad. Usa símbolos como g, kg, mol, mL, L, K o g/mol.';
    case 'wrong-dimension':
      return 'Esa unidad no corresponde a la magnitud que se pide.';
    case 'wrong-unit':
      return result.valueMatches
        ? `El valor es equivalente, pero el ejercicio pide el resultado en ${unit}.`
        : `Expresa el resultado en ${unit}.`;
    case 'no-match':
      return 'No coincide con la respuesta esperada.';
    case 'unparseable':
      if (exercise.type === 'numeric') return 'No entiendo el número. Escribe, por ejemplo, «0.25 mol» o «6.02e23».';
      if (exercise.type === 'multiple-choice') return 'Elige una opción.';
      return 'Escribe una respuesta.';
  }
}

/** Resultado de un ejercicio en la sesión, en las categorías que usará el dominio (Fase 2). */
export type ExerciseOutcome = 'correct-unaided' | 'correct-with-help' | 'not-solved';
