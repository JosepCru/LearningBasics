/**
 * Orquesta la sincronización en la app: cuándo se lanza (arranque, al volver la red o la
 * pestaña, tras escribir, cada 5 min o a mano), que solo haya un ciclo a la vez entre
 * pestañas, y el estado visible. La lógica del ciclo está en engine.ts.
 */
import type { Session } from '@supabase/supabase-js';
import { db } from '../data/instance';
import { runSync, type SyncOutcome } from './engine';
import { getSupabase, SupabaseRemote } from './supabase';

export type SyncPhase =
  | 'disabled' // la app se compiló sin Supabase
  | 'signed-out'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'auth-required'
  | 'account-mismatch';

export type SyncState = {
  phase: SyncPhase;
  email?: string;
  lastSuccessAt?: string;
  lastError?: string;
};

const INTERVAL_MS = 5 * 60_000;
const DEBOUNCE_MS = 3_000;

let state: SyncState = { phase: getSupabase() ? 'signed-out' : 'disabled' };
const listeners = new Set<() => void>();
let session: Session | null = null;
let debounce: ReturnType<typeof setTimeout> | undefined;
let running = false;
let started = false;

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const syncStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
};

/** Arranca la sincronización automática. Llamar una vez al iniciar la app. */
export function startSync(): void {
  const sb = getSupabase();
  if (!sb || started) return;
  started = true;

  sb.auth.onAuthStateChange((_event, s) => {
    session = s;
    if (!s) {
      set({ phase: 'signed-out', email: undefined });
      return;
    }
    set({ email: s.user.email ?? undefined, phase: state.phase === 'signed-out' ? 'idle' : state.phase });
    // Fuera del callback: supabase-js recomienda no esperar otras llamadas dentro de él.
    setTimeout(() => void syncNow(), 0);
  });

  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => set({ phase: session ? 'offline' : state.phase }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => void syncNow(), INTERVAL_MS);
}

/** Pide una sincronización pronto (tras escribir). Varias llamadas seguidas se agrupan. */
export function requestSync(): void {
  if (!session) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

export async function syncNow(opts: { manual?: boolean } = {}): Promise<void> {
  const sb = getSupabase();
  if (!sb || !session || running) return;
  if (!navigator.onLine) {
    set({ phase: 'offline' });
    return;
  }

  const run = async () => {
    running = true;
    set({ phase: 'syncing' });
    try {
      const outcome = await runSync(db, new SupabaseRemote(sb), {
        userId: session!.user.id,
        ignoreBackoff: opts.manual,
      });
      apply(outcome);
    } catch (e) {
      console.error(e);
      set({ phase: 'error', lastError: e instanceof Error ? e.message : String(e) });
    } finally {
      running = false;
    }
  };

  // Un único ciclo a la vez entre pestañas del mismo navegador.
  if (navigator.locks) {
    await navigator.locks.request('learningbasics-sync', { ifAvailable: true }, async (lock) => {
      if (lock) await run();
    });
  } else {
    await run();
  }
}

function apply(outcome: SyncOutcome) {
  switch (outcome.status) {
    case 'ok':
      set({ phase: 'idle', lastSuccessAt: new Date().toISOString(), lastError: undefined });
      break;
    case 'offline':
      set({ phase: 'offline', lastError: outcome.message });
      break;
    case 'server-error':
      set({ phase: 'error', lastError: outcome.message });
      break;
    case 'auth-required':
      set({ phase: 'auth-required', lastError: outcome.message });
      break;
    case 'account-mismatch':
      set({ phase: 'account-mismatch' });
      break;
  }
}
