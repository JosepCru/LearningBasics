/**
 * Contrato con el servidor. El motor de sincronización solo conoce esta interfaz;
 * la implementación real está en supabase.ts y los tests usan una simulada.
 */

/** Fila de public.events tal como la devuelve el servidor. */
export type RemoteRow = {
  id: string;
  user_id: string;
  device_id: string;
  type: string;
  schema_version: number;
  client_created_at: string;
  payload: unknown;
  seq: number;
};

export type OutgoingRow = Omit<RemoteRow, 'seq'>;

export type RemoteErrorKind =
  /** Sin red, timeout: reintentar más tarde. */
  | 'network'
  /** 5xx, 429: el servidor falla o limita; reintentar con espera. */
  | 'server'
  /** Sesión caducada o inválida: hay que volver a iniciar sesión. */
  | 'auth'
  /** El servidor rechaza los datos (validación, permisos): no sirve reintentar. */
  | 'rejected';

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

export interface Remote {
  /** Inserta filas; las que ya existen (mismo id) se ignoran. Lanza RemoteError. */
  push(rows: OutgoingRow[]): Promise<void>;
  /** Filas con seq > afterSeq, en orden de seq, como mucho `limit`. Lanza RemoteError. */
  pull(afterSeq: number, limit: number): Promise<RemoteRow[]>;
}
