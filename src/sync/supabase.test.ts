import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth';
import { classifyError } from './supabase';

describe('classifyError', () => {
  it.each([
    [{ message: 'TypeError: Failed to fetch' }, 0, 'network'],
    [{ message: 'fetch failed' }, 0, 'network'],
    [{ message: 'JWT expired', code: 'PGRST303' }, 401, 'auth'],
    [{ message: 'No suitable key', code: 'PGRST301' }, 401, 'auth'],
    [{ message: 'new row violates row-level security policy', code: '42501' }, 403, 'rejected'],
    [{ message: 'violates check constraint', code: '23514' }, 400, 'rejected'],
    [{ message: 'too many requests' }, 429, 'server'],
    [{ message: 'upstream error' }, 503, 'server'],
  ])('%o con estado %i → %s', (error, status, kind) => {
    expect(classifyError(error, status).kind).toBe(kind);
  });
});

describe('authErrorMessage', () => {
  it.each([
    [{ message: 'Email rate limit exceeded', status: 429 }, 'Demasiados intentos'],
    [{ message: 'Signups not allowed for otp', status: 422 }, 'registro está cerrado'],
    [{ message: 'Token has expired or is invalid', status: 403, code: 'otp_expired' }, 'ha caducado'],
    [{ message: 'Failed to fetch' }, 'No hay conexión'],
  ])('%o', (error, text) => {
    expect(authErrorMessage(error)).toContain(text);
  });
});
