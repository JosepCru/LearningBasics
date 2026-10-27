/**
 * Inicio de sesión con código de un solo uso enviado por email (sin contraseña).
 * Ver docs/SECURITY.md y docs/DECISIONS.md (D-008).
 */
import { getSupabase } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

type AuthLikeError = { message: string; status?: number; code?: string };

/** Mensajes que explican qué pasó y qué hacer, sin jerga. */
export function authErrorMessage(error: AuthLikeError): string {
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase();
  if (error.status === 429 || text.includes('rate limit')) {
    return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a pedir el código.';
  }
  if (text.includes('signups not allowed') || text.includes('signup_disabled') || text.includes('otp_disabled')) {
    return 'Ese correo no tiene cuenta y el registro está cerrado. Usa el correo con el que te registraste.';
  }
  if (text.includes('expired') || text.includes('invalid') || text.includes('otp')) {
    return 'El código no es correcto o ha caducado. Pide uno nuevo.';
  }
  if (text.includes('fetch') || text.includes('network')) {
    return 'No hay conexión con el servidor. Comprueba tu red.';
  }
  return `No se pudo completar: ${error.message}`;
}

export async function sendCode(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'La sincronización no está configurada en esta versión.' };
  const { error } = await sb.auth.signInWithOtp({ email: email.trim() });
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'La sincronización no está configurada en esta versión.' };
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s/g, ''), type: 'email' });
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

/** Cierra la sesión solo en este dispositivo. Los datos locales se conservan. */
export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut({ scope: 'local' });
}
