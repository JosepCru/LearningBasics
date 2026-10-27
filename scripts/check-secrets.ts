/**
 * npm run check-secrets — falla si el build (dist/) o el repositorio contienen secretos.
 * Ejecutar después de `npm run build`. Ver docs/SECURITY.md.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { checkSecrets } from './secrets';

const repo = path.resolve(import.meta.dirname, '..');
if (!existsSync(path.join(repo, 'dist'))) {
  console.error('No hay dist/: ejecuta npm run build antes de revisar el bundle.');
  process.exit(1);
}
const findings = checkSecrets(repo);
if (findings.length > 0) {
  console.error('✖ Posibles secretos encontrados:');
  for (const f of findings) console.error(`  ${f.file}: ${f.reason}`);
  process.exit(1);
}
console.log('Sin secretos en el build ni archivos .env versionados.');
