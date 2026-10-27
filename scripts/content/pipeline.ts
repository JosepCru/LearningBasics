/**
 * Orquesta load → validate → compile. Lo usan validate-content y build-content.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IdsLock } from '../../src/core/content/schemas';
import { compileContent, type CompileResult } from './compile';
import { loadContent, type Issue } from './load';
import { validateTree } from './validate';

export const CONTENT_ROOT = path.resolve(import.meta.dirname, '../../content');
export const LOCK_FILE = path.join(CONTENT_ROOT, 'ids.lock.json');

export type PipelineResult = {
  errors: Issue[];
  warnings: Issue[];
  ids: string[];
  compiled?: CompileResult;
};

export function readLock(file = LOCK_FILE): string[] {
  if (!existsSync(file)) return [];
  return IdsLock.parse(JSON.parse(readFileSync(file, 'utf8'))).ids;
}

/** Une los IDs actuales al lock. Nunca elimina IDs: el lock solo crece. */
export function updateLock(ids: string[], file = LOCK_FILE): number {
  const previous = readLock(file);
  const merged = [...new Set([...previous, ...ids])].sort();
  writeFileSync(file, JSON.stringify({ version: 1, ids: merged }, null, 2) + '\n');
  return merged.length - previous.length;
}

export function runPipeline(opts: { root?: string; lockedIds?: string[]; strictLock?: boolean } = {}): PipelineResult {
  const root = opts.root ?? CONTENT_ROOT;
  const { tree, errors: loadErrors } = loadContent(root);
  const validation = validateTree(tree, {
    lockedIds: opts.lockedIds ?? readLock(),
    strictLock: opts.strictLock ?? process.env.CI === 'true',
  });
  // Se compila aunque haya errores de validación para informar también de los de render.
  const compiled = compileContent(tree);
  return {
    errors: [...loadErrors, ...validation.errors, ...compiled.errors],
    warnings: validation.warnings,
    ids: validation.ids,
    compiled,
  };
}

export function printIssues(result: PipelineResult): void {
  const print = (label: string, issues: Issue[]) => {
    if (issues.length === 0) return;
    console.log(`\n${label} (${issues.length})`);
    for (const { file, message } of issues) console.log(`  ${file}\n    ${message}`);
  };
  print('⚠ Avisos', result.warnings);
  print('✖ Errores', result.errors);
}
