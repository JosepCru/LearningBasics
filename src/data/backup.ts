/**
 * Copia de seguridad: todos los eventos en un JSON validable.
 * La importación (fusión segura por ID) llega en la Fase 3.
 */
import { ExportFile } from '../core/events/schemas';
import type { LearningDB } from './db';

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
