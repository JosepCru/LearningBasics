import type { SyncPhase } from '../../sync/manager';

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function timeAgo(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return 'nunca';
  const s = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(s) < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, 'hour');
  return rtf.format(Math.round(h / 24), 'day');
}

export type SyncTone = 'ok' | 'busy' | 'warn' | 'error' | 'muted';

/** Texto corto para la cabecera y su tono. */
export function syncSummary(
  phase: SyncPhase,
  pending: number | undefined,
  lastSuccessAt: string | undefined,
  now: Date = new Date(),
): { text: string; tone: SyncTone } {
  switch (phase) {
    case 'disabled':
      return { text: 'Solo en este dispositivo', tone: 'muted' };
    case 'signed-out':
      return { text: 'Sin sincronizar', tone: 'muted' };
    case 'syncing':
      return { text: 'Sincronizando…', tone: 'busy' };
    case 'offline':
      return { text: pending ? `Sin conexión · ${pending} pendientes` : 'Sin conexión', tone: 'warn' };
    case 'auth-required':
      return { text: 'Inicia sesión de nuevo', tone: 'error' };
    case 'account-mismatch':
      return { text: 'Otra cuenta en este dispositivo', tone: 'error' };
    case 'error':
      return { text: 'Error de sincronización', tone: 'error' };
    case 'idle':
      return pending
        ? { text: `${pending} pendientes`, tone: 'busy' }
        : { text: `Sincronizado ${timeAgo(lastSuccessAt, now)}`, tone: 'ok' };
  }
}
