# Despliegue y configuración de Supabase

La app funciona sin Supabase (todo se guarda en el navegador). Supabase añade la cuenta y
la sincronización entre dispositivos. Esta guía se hace **una sola vez** (unos 20 minutos).

> Valores **públicos**: la URL del proyecto y la clave *anon* o *publishable*.
> Valores **secretos** que nunca deben salir del panel de Supabase: la clave
> *service_role* / *secret key* y la contraseña de la base de datos. Ver [SECURITY.md](SECURITY.md).

## 1. Crear el proyecto

1. Entra en https://supabase.com y crea una cuenta (plan gratuito).
2. **New project**. Nombre: `learningbasics`. Región: la más cercana (p. ej. *West EU*).
3. Contraseña de la base de datos: genera una larga y guárdala en tu gestor de contraseñas.
   La app no la usa.

## 2. Crear la tabla y sus permisos

1. En el proyecto: **SQL Editor → New query**.
2. Pega el contenido completo de
   [`supabase/migrations/20261027120000_events.sql`](../supabase/migrations/20261027120000_events.sql)
   y pulsa **Run**. Debe terminar sin errores.
3. Comprueba en **Table Editor** que existe `events` con el aviso **RLS enabled**.

Las mismas reglas se prueban automáticamente en cada push (job «Base de datos» del CI).

## 3. Inicio de sesión por código

1. **Authentication → Sign In / Providers → Email**: activado. *Email OTP Length*: 6.
   *Email OTP Expiration*: 600 segundos (10 minutos).
2. **Authentication → Emails → Templates → Magic Link**: el correo debe incluir el código.
   Sustituye el cuerpo por algo como:

   ```html
   <h2>Tu código para LearningBasics</h2>
   <p>Escribe este código en la aplicación:</p>
   <p style="font-size: 28px; letter-spacing: 6px"><strong>{{ .Token }}</strong></p>
   <p>Caduca en 10 minutos. Si no lo has pedido tú, ignora este correo.</p>
   ```

   Asunto: `Tu código de LearningBasics`.
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://josepcru.github.io/LearningBasics/`
   - *Redirect URLs*: añade `http://localhost:5173/LearningBasics/`

> El servicio de correo incluido en Supabase tiene un límite bajo de envíos por hora.
> Para un solo usuario basta; si algún día no llegan correos, revisa ese límite o
> configura un SMTP propio en *Authentication → Emails → SMTP Settings*.

## 4. Conectar la web

1. En Supabase: **Project Settings → API** (o el botón **Connect**). Copia:
   - *Project URL*
   - *anon public* key (o *publishable key*, empieza por `sb_publishable_`)
2. En GitHub: repositorio → **Settings → Secrets and variables → Actions → pestaña
   Variables → New repository variable**. Crea:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clave anon/publishable

   Son *Variables* (no *Secrets*) porque son públicas: acabarán dentro de la web.
3. Relanza el despliegue: **Actions → CI → Run workflow** (o haz un push).

## 5. Crear tu cuenta y cerrar el registro

1. Abre la web → icono de sincronización (arriba a la derecha) → escribe tu correo →
   **Enviar código** → introduce el código.
2. Al entrar, tu progreso local se sube automáticamente.
3. Ya con tu cuenta creada: **Authentication → Sign In / Providers →** desactiva
   **Allow new users to sign up**. Así nadie más puede crear cuentas en tu proyecto.

## 6. Desarrollo local (opcional)

```bash
cp .env.example .env.local
```

Rellena los dos valores en `.env.local` (Git lo ignora) y reinicia `npm run dev`.

## Mantenimiento

- **Pausa por inactividad**: los proyectos gratuitos se pausan tras unos días sin uso.
  La app sigue funcionando en local y acumula los cambios; reactiva el proyecto desde el
  panel y se sincronizará solo.
- **Cambios de esquema**: cada migración nueva de `supabase/migrations/` se aplica igual
  (SQL Editor) después de que pase el CI.
