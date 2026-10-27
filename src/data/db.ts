/**
 * Base de datos local (IndexedDB vía Dexie). Ver docs/SYNC.md.
 *
 * Migraciones: nunca edites una versión publicada. Añade `this.version(n + 1)` con el
 * esquema nuevo y, si hace falta, un `.upgrade()`; y un caso en db.test.ts.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { AppEvent } from '../core/events/schemas';
import type { CardState } from '../core/scheduling/fsrs';

export type OutboxEntry = {
  eventId: string;
  createdAt: string;
  /** Usados por el motor de sincronización (Fase 3). */
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
};

/** Proyección: estado actual de cada tarjeta. Se puede reconstruir desde los eventos. */
export type CardRow = {
  cardId: string;
  state: CardState;
  due: string;
  firstReviewAt: string;
};

export type MetaRow = { key: string; value: unknown };

/** Evento que no se pudo sincronizar o importar: se aparta para no bloquear el resto. */
export type QuarantineRow = {
  eventId: string;
  direction: 'outgoing' | 'incoming';
  /** El evento tal cual (puede no cumplir el esquema si es entrante). */
  event: unknown;
  error: string;
  at: string;
};

export const SCHEMA_V1 = {
  // `payload.cardId` solo existe en los repasos: IndexedDB omite del índice los demás.
  events: 'id, type, clientCreatedAt, payload.cardId',
  outbox: 'eventId, nextAttemptAt',
  cardStates: 'cardId, due',
  meta: 'key',
} as const;

/** v2 (Fase 3): cuarentena de sincronización. Sin cambios en las tablas existentes. */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  quarantine: 'eventId, direction',
} as const;

export class LearningDB extends Dexie {
  events!: EntityTable<AppEvent, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'eventId'>;
  cardStates!: EntityTable<CardRow, 'cardId'>;
  meta!: EntityTable<MetaRow, 'key'>;
  quarantine!: EntityTable<QuarantineRow, 'eventId'>;

  constructor(name = 'learningbasics') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
  }
}

/**
 * Pide al navegador que no borre los datos por falta de espacio. Safari puede seguir
 * borrándolos tras 7 días sin uso si la web no está instalada (ver docs/SYNC.md).
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
