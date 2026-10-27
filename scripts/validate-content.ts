/**
 * npm run validate-content [-- --update-lock]
 * Valida todo content/ sin escribir nada (salvo el lock si se pide).
 */
import { printIssues, runPipeline, updateLock } from './content/pipeline';

const shouldUpdateLock = process.argv.includes('--update-lock');
const result = runPipeline({ strictLock: shouldUpdateLock ? false : undefined });

if (shouldUpdateLock && result.errors.length === 0) {
  const added = updateLock(result.ids);
  result.warnings = result.warnings.filter((w) => !w.file.endsWith('ids.lock.json'));
  console.log(`ids.lock.json actualizado (${added} ID(s) nuevos).`);
}

printIssues(result);
const topics = result.compiled?.topics ?? [];
const count = (fn: (t: (typeof topics)[number]) => number) => topics.reduce((n, t) => n + fn(t), 0);
console.log(
  `\nContenido: ${topics.length} temas, ${count((t) => t.lessons.length)} lecciones, ` +
    `${count((t) => t.exercises.length)} ejercicios, ${count((t) => t.flashcards.length)} flashcards.`,
);

if (result.errors.length > 0) {
  console.error(`\nValidación fallida: ${result.errors.length} error(es).`);
  process.exit(1);
}
console.log('Validación correcta.');
