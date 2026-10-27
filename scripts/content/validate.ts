/**
 * Comprobaciones entre archivos sobre el árbol ya cargado.
 * Ver content/CONTENT_GUIDE.md §5 para la lista completa.
 */
import { withinTolerance } from '../../src/core/evaluation/numeric';
import { isKnownUnit } from '../../src/core/evaluation/units';
import { evaluateVerify, isTrivialVerify } from '../chem/verify-expr';
import { allTopics, type ContentTree, type Issue } from './load';

export type ValidationOptions = {
  /** IDs publicados (ids.lock.json). */
  lockedIds: string[];
  /** En CI, los IDs nuevos sin registrar en el lock son error y no aviso. */
  strictLock: boolean;
};

export type ValidationResult = { errors: Issue[]; warnings: Issue[]; ids: string[] };

export function validateTree(tree: ContentTree, options: ValidationOptions): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (file: string, message: string) => errors.push({ file, message });
  const warn = (file: string, message: string) => warnings.push({ file, message });

  // 1. IDs únicos en todo el contenido
  const seen = new Map<string, string>();
  const register = (id: string, file: string) => {
    const previous = seen.get(id);
    if (previous) err(file, `ID duplicado "${id}" (ya usado en ${previous})`);
    else seen.set(id, file);
  };
  const sourceIds = new Set<string>();
  for (const s of tree.sources) {
    if (sourceIds.has(s.id)) err('content/sources.yaml', `Fuente duplicada "${s.id}"`);
    sourceIds.add(s.id);
  }

  for (const subject of tree.subjects) {
    register(subject.data.id, subject.file);
    for (const unit of subject.units) register(unit.data.id, unit.file);
  }
  for (const { topic } of allTopics(tree)) {
    register(topic.data.id, topic.file);
    for (const o of topic.data.objectives) register(o.id, topic.file);
    for (const l of topic.lessons) register(l.data.id, l.file);
    for (const e of topic.exercises) register(e.data.id, e.file);
    for (const f of topic.flashcards) register(f.data.id, f.file);
  }

  // 2. Prerrequisitos: existen y sin ciclos
  const topicsById = new Map([...allTopics(tree)].map(({ topic }) => [topic.data.id, topic]));
  for (const topic of topicsById.values()) {
    for (const pre of topic.data.prerequisites) {
      if (pre === topic.data.id) err(topic.file, 'Un tema no puede ser prerrequisito de sí mismo');
      else if (!topicsById.has(pre)) err(topic.file, `Prerrequisito inexistente "${pre}"`);
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(' → ');
      err(topicsById.get(id)!.file, `Ciclo de prerrequisitos: ${cycle}`);
      return;
    }
    state.set(id, 'visiting');
    for (const pre of topicsById.get(id)?.data.prerequisites ?? []) {
      if (topicsById.has(pre) && pre !== id) visit(pre, [...trail, id]);
    }
    state.set(id, 'done');
  };
  for (const id of topicsById.keys()) visit(id, []);

  // 3–5. Lecciones, ejercicios y flashcards
  const aiDrafted: string[] = [];
  for (const { topic } of allTopics(tree)) {
    const objectives = new Set(topic.data.objectives.map((o) => o.id));
    const checkObjective = (file: string, owner: string, objective: string) => {
      if (!objectives.has(objective)) err(file, `${owner}: objetivo "${objective}" no pertenece al tema ${topic.data.id}`);
    };

    if (topic.lessons.filter((l) => !l.data.retired).length === 0) {
      warn(topic.file, 'El tema no tiene lecciones activas');
    }
    for (const { file, data } of topic.lessons) {
      for (const o of data.objectives) checkObjective(file, data.id, o);
      for (const s of data.sources) {
        if (!sourceIds.has(s.ref)) err(file, `Fuente "${s.ref}" no existe en content/sources.yaml`);
      }
      if (data.provenance === 'ai-drafted' && !data.retired) aiDrafted.push(data.id);
    }

    for (const { file, data: ex } of topic.exercises) {
      checkObjective(file, ex.id, ex.objective);
      if (ex.type === 'multiple-choice') {
        const correct = ex.options.filter((o) => o.correct).length;
        if (correct !== 1) err(file, `${ex.id}: debe haber exactamente una opción correcta (hay ${correct})`);
        const optionIds = ex.options.map((o) => o.id);
        if (new Set(optionIds).size !== optionIds.length) err(file, `${ex.id}: ids de opción repetidos`);
      } else if (ex.type === 'numeric') {
        if (ex.answer.unit && !isKnownUnit(ex.answer.unit)) {
          err(file, `${ex.id}: unidad desconocida "${ex.answer.unit}"`);
        }
        try {
          const computed = evaluateVerify(ex.verify);
          if (!withinTolerance(computed, ex.answer.value, ex.answer.tolerance)) {
            err(
              file,
              `${ex.id}: verify da ${formatNumber(computed)} pero answer.value es ${formatNumber(ex.answer.value)} ` +
                `(fuera de la tolerancia ${JSON.stringify(ex.answer.tolerance)})`,
            );
          }
          if (isTrivialVerify(ex.verify)) {
            warn(file, `${ex.id}: verify es solo un número; no comprueba nada de forma independiente`);
          }
        } catch (e) {
          err(file, `${ex.id}: verify no se puede evaluar: ${(e as Error).message}`);
        }
      }
    }

    for (const { file, data } of topic.flashcards) checkObjective(file, data.id, data.objective);
  }

  if (aiDrafted.length > 0) {
    warn('content', `${aiDrafted.length} lección(es) en borrador de IA sin revisar: ${aiDrafted.join(', ')}`);
  }

  // 6. Protección del progreso: ids.lock.json
  const ids = [...seen.keys()].sort();
  const current = new Set(ids);
  for (const id of options.lockedIds) {
    if (!current.has(id)) {
      err('content/ids.lock.json', `El ID publicado "${id}" ha desaparecido. Márcalo con retired: true en lugar de borrarlo.`);
    }
  }
  const locked = new Set(options.lockedIds);
  const unlocked = ids.filter((id) => !locked.has(id));
  if (unlocked.length > 0) {
    const message =
      `${unlocked.length} ID(s) nuevos sin registrar en ids.lock.json. ` +
      'Ejecuta: npm run validate-content -- --update-lock';
    if (options.strictLock) err('content/ids.lock.json', message);
    else warn('content/ids.lock.json', message);
  }

  return { errors, warnings, ids };
}

function formatNumber(n: number): string {
  return Math.abs(n) >= 1e5 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(4) : String(Number(n.toPrecision(6)));
}
