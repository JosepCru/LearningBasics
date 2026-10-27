/**
 * Copia de seguridad: exportar todos los eventos a JSON e importarlos de forma segura.
 * Importar une por ID: nunca borra ni modifica nada, y repetirlo no cambia nada.
 */
import { AppEvent, ExportFile } from '../core/events/schemas';
import type { LearningDB } from './db';
import { boundAccount, ingestEvents, LOCAL_USER, type IngestResult } from './events';

export async function exportEvents(db: LearningDB, now: Date = new Date()): Promise<ExportFile> {
  const events = await db.events.orderBy('clientCreatedAt').toArray();
  return ExportFile.parse({ format: 'learningbasics-export', version: 1, exportedAt: now.toISOString(), events });
}

export function exportFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `learningbasics-${stamp}.export.json`;
}

/** Descarga el archivo en el navegador. */
export function downloadJson(data: unknown, fileName: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportPreview = {
  valid: AppEvent[];
  /** Eventos que no cumplen el esquema: no se importarán. */
  invalid: number;
  fresh: number;
  existing: number;
  exportedAt: string;
};

export type ImportParse = { ok: true; preview: ImportPreview } | { ok: false; error: string };

/**
 * Lee y valida un archivo de copia. Valida evento a evento para que uno defectuoso no
 * impida importar los demás; un archivo con otro formato se rechaza entero.
 */
export async function previewImport(db: LearningDB, text: string): Promise<ImportParse> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
  const { format, version, exportedAt, events } = (raw ?? {}) as Record<string, unknown>;
  // Solo la cabecera: los eventos se validan uno a uno más abajo.
  const header = ExportFile.pick({ format: true, version: true, exportedAt: true }).safeParse({ format, version, exportedAt });
  if (!header.success || !Array.isArray(events)) {
    return { ok: false, error: 'No es una copia de LearningBasics (formato o versión no reconocidos).' };
  }
  const valid: AppEvent[] = [];
  let invalid = 0;
  for (const e of events) {
    const parsed = AppEvent.safeParse(e);
    if (parsed.success) valid.push(parsed.data);
    else invalid++;
  }
  const found = await db.events.bulkGet(valid.map((e) => e.id));
  const fresh = found.filter((f) => !f).length;
  return {
    ok: true,
    preview: { valid, invalid, fresh, existing: valid.length - fresh, exportedAt: header.data.exportedAt },
  };
}

/** Importa los eventos válidos de una vista previa. Hacer una copia antes es cosa de quien llama. */
export async function applyImport(db: LearningDB, preview: ImportPreview): Promise<IngestResult> {
  // Los eventos pasan a la cuenta de este dispositivo (o a "local" si aún no hay sesión).
  const owner = (await boundAccount(db)) ?? LOCAL_USER;
  return ingestEvents(
    db,
    preview.valid.map((e) => ({ ...e, userId: owner })),
    { enqueue: true },
  );
}
