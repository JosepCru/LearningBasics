/**
 * Conexión con Supabase. La URL y la clave pública (anon/publishable) van en el bundle a
 * propósito: la seguridad la da Row Level Security. Ver docs/SECURITY.md.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RemoteError, type OutgoingRow, type Remote, type RemoteRow } from './remote';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const syncConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** Cliente único, o null si la app se compiló sin configuración de Supabase. */
export function getSupabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  client ??= createClient(URL!, KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Login por código: no hay tokens en la URL que procesar (y la URL usa # para rutas).
      detectSessionInUrl: false,
      storageKey: 'lb-auth',
    },
  });
  return client;
}

type PostgrestLikeError = { message: string; code?: string };

/** Traduce un error de Supabase al tipo que entiende el motor de sincronización. */
export function classifyError(error: PostgrestLikeError, status: number): RemoteError {
  const msg = `${error.code ? `${error.code}: ` : ''}${error.message}`;
  if (status === 0 || /failed to fetch|networkerror|fetch failed|load failed/i.test(error.message)) {
    return new RemoteError('network', msg);
  }
  if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') return new RemoteError('auth', msg);
  if (status === 408 || status === 429 || status >= 500) return new RemoteError('server', msg);
  if (status >= 400) return new RemoteError('rejected', msg);
  return new RemoteError('server', msg);
}

const COLUMNS = 'id,user_id,device_id,type,schema_version,client_created_at,payload,seq';

export class SupabaseRemote implements Remote {
  constructor(private sb: SupabaseClient) {}

  async push(rows: OutgoingRow[]): Promise<void> {
    // INSERT … ON CONFLICT (id) DO NOTHING: reenviar es idempotente.
    const { error, status } = await this.sb.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw classifyError(error, status);
  }

  async pull(afterSeq: number, limit: number): Promise<RemoteRow[]> {
    const { data, error, status } = await this.sb
      .from('events')
      .select(COLUMNS)
      .gt('seq', afterSeq)
      .order('seq', { ascending: true })
      .limit(limit);
    if (error) throw classifyError(error, status);
    return (data ?? []) as RemoteRow[];
  }
}
