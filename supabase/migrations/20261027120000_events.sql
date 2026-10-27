-- Log de eventos de aprendizaje: append-only, uno por fila. Ver docs/SYNC.md y docs/SECURITY.md.

create table public.events (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id         text not null check (char_length(device_id) between 1 and 100),
  type              text not null check (type in ('attempt', 'review', 'session_segment', 'lesson', 'setting', 'void')),
  schema_version    smallint not null check (schema_version >= 1),
  client_created_at timestamptz not null,
  payload           jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 16384),
  received_at       timestamptz not null default now(),
  -- Cursor de sincronización: lo asigna el servidor.
  seq               bigint generated always as identity
);

comment on table public.events is 'Eventos inmutables de aprendizaje (intentos, repasos, lecciones…). Append-only.';

create index events_user_seq on public.events (user_id, seq);

-- Row Level Security: cada usuario solo ve e inserta sus propias filas.
alter table public.events enable row level security;

create policy events_select_own on public.events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy events_insert_own on public.events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Sin políticas de UPDATE/DELETE y, además, sin permisos: el historial es inmutable
-- aunque alguien añadiera por error una política más adelante.
revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;
-- Permiso de inserción solo sobre las columnas que escribe el cliente:
-- `seq` y `received_at` los asigna siempre el servidor.
grant insert (id, user_id, device_id, type, schema_version, client_created_at, payload)
  on public.events to authenticated;
