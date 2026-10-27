/**
 * npm run content:build — valida y emite el contenido compilado:
 *   src/generated/content/manifest.json
 *   src/generated/content/topics/<topicId>.json
 *   public/generated/content-assets/<topicId>/<archivo>
 * Ambas carpetas están en .gitignore: se regeneran en cada build.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { printIssues, runPipeline } from './content/pipeline';

const repo = path.resolve(import.meta.dirname, '..');
const outDir = path.join(repo, 'src/generated/content');
const publicDir = path.join(repo, 'public');

const result = runPipeline();
printIssues(result);
if (result.errors.length > 0 || !result.compiled) {
  console.error(`\nNo se genera el contenido: ${result.errors.length} error(es). Ejecuta npm run validate-content.`);
  process.exit(1);
}

const { manifest, topics, assets } = result.compiled;
rmSync(outDir, { recursive: true, force: true });
rmSync(path.join(publicDir, 'generated'), { recursive: true, force: true });
mkdirSync(path.join(outDir, 'topics'), { recursive: true });

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
for (const topic of topics) {
  writeFileSync(path.join(outDir, 'topics', `${topic.id}.json`), JSON.stringify(topic));
}
for (const asset of assets) {
  const target = path.join(publicDir, asset.to);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(asset.from, target);
}

console.log(`Contenido generado: ${topics.length} temas, ${assets.length} recursos (hash ${manifest.contentHash}).`);
