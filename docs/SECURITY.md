# Modelo de seguridad

## Configuración pública frente a secretos

| Valor | ¿Público? | Dónde vive |
|---|---|---|
| URL del proyecto Supabase | Sí | Variable de GitHub Actions `VITE_SUPABASE_URL`; `.env.local` en desarrollo |
| Clave anon / publishable | Sí | Variable de GitHub Actions `VITE_SUPABASE_ANON_KEY`; `.env.local` |
| Clave `service_role` / secret key | **No, nunca** | Solo en el panel de Supabase. No se usa en este proyecto |
| Contraseña de la base de datos | **No** | Solo en el panel de Supabase / gestor de contraseñas |

Todo lo que empieza por `VITE_` acaba **dentro del bundle** y cualquiera puede leerlo.
La clave anon está diseñada para eso: no da acceso a datos por sí sola; la protección real
la aplica Row Level Security. La clave `service_role` se salta RLS: si se filtrara, cualquiera
podría leer y escribir todos los datos. Por eso nunca va en `src/`, en `.env` commiteado
ni en una variable `VITE_*`.

## Row Level Security

Todas las tablas con datos de usuario tienen RLS activado. Tabla inicial:

```sql
create table public.events (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  device_id         text not null,
  type              text not null check (type in ('attempt','review','session_segment','lesson','setting','void')),
  schema_version    smallint not null,
  client_created_at timestamptz not null,
  payload           jsonb not null check (pg_column_size(payload) < 16384),
  received_at       timestamptz not null default now(),
  seq               bigint generated always as identity
);
create index events_user_seq on public.events (user_id, seq);

alter table public.events enable row level security;

create policy events_select on public.events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy events_insert on public.events
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke update, delete, truncate on public.events from anon, authenticated;
```

- Sin políticas de `update` ni `delete`, y además permisos revocados: el servidor garantiza
  que el historial es append-only.
- `(select auth.uid())` en lugar de `auth.uid()` evita reevaluar la función por fila.

### Tests de políticas (pgTAP, `supabase/tests/`)

En CI con la Supabase CLI local (Docker):

- Usuario A lee solo sus filas; no ve las de B.
- Usuario A no puede insertar con `user_id` de B.
- Nadie puede hacer `update` ni `delete`.
- El rol `anon` no lee ni inserta nada.
- Payload > 16 KB y `type` desconocido se rechazan.

## Autenticación

- Código OTP de 6 dígitos por email (Supabase Auth).
- **Site URL** y **Redirect URLs** permitidas:
  - `https://josepcru.github.io/LearningBasics/`
  - `http://localhost:5173/LearningBasics/`
- **Registro público desactivado** después de crear la cuenta del propietario
  (Authentication → Sign In / Providers → desactivar "Allow new users to sign up").
- El SMTP por defecto de Supabase tiene límites bajos de envío por hora; suficiente para un
  usuario. Se documentará cómo configurar SMTP propio si hiciera falta.

## GitHub Pages

- Solo sirve archivos estáticos y no permite cabeceras HTTP propias: la Content Security
  Policy se declara con `<meta http-equiv="Content-Security-Policy">`, con `connect-src`
  limitado a `'self'` y al dominio del proyecto Supabase.
- El HTML de las lecciones se genera en build desde Markdown del propio repositorio; no se
  renderiza HTML de terceros en runtime.

## Repositorio

- `.gitignore` excluye `.env*` (salvo `.env.example`), exportaciones de progreso
  (`*.export.json`) y artefactos de build.
- El progreso personal nunca se guarda en Git.
- CI ejecuta un escaneo de secretos sobre el diff.

## Amenazas consideradas

| Amenaza | Mitigación |
|---|---|
| Otra persona se registra y usa tu proyecto Supabase | Registro desactivado; RLS aísla sus datos igualmente |
| Filtración de la clave anon | Es pública por diseño; RLS |
| Filtración de `service_role` | Nunca existe en el repo ni en el frontend |
| Manipulación del historial desde un cliente | Sin `update`/`delete` en el servidor |
| Payloads enormes / abuso de cuota | `check` de tamaño; rate limits de Supabase |
| XSS desde contenido | Contenido propio, renderizado en build; CSP |
