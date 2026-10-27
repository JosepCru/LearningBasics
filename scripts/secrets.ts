/**
 * Detección de secretos en el build y en el repositorio (lo usa scripts/check-secrets.ts).
 *
 * La clave anon/publishable de Supabase SÍ puede estar en el bundle (es pública por diseño).
 * Lo que nunca puede aparecer: la clave service_role / secret key, claves privadas o
 * archivos .env versionados. Ver docs/SECURITY.md.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export type Finding = { file: string; reason: string };

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/** Busca secretos en un texto. Exportada para los tests. */
export function scanText(text: string): string[] {
  const reasons: string[] = [];
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) reasons.push('clave secreta de Supabase (sb_secret_…)');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) reasons.push('clave privada (PEM)');
  for (const token of text.match(JWT_RE) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { role?: string };
      if (payload.role === 'service_role') reasons.push('JWT con role "service_role"');
    } catch {
      /* no es un JWT válido: se ignora */
    }
  }
  return reasons;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function checkSecrets(repo: string): Finding[] {
  const findings: Finding[] = [];
  const dist = path.join(repo, 'dist');
  if (existsSync(dist)) {
    for (const file of walk(dist).filter((f) => /\.(js|mjs|html|json|css|map|txt|webmanifest)$/.test(f))) {
      for (const reason of scanText(readFileSync(file, 'utf8'))) findings.push({ file: path.relative(repo, file), reason });
    }
  }
  const tracked = execSync('git ls-files', { cwd: repo, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const file of tracked) {
    const base = path.basename(file);
    if (/^\.env(\..*)?$/.test(base) && base !== '.env.example') findings.push({ file, reason: 'archivo .env versionado' });
  }
  return findings;
}
