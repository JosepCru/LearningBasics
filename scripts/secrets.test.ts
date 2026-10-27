import { describe, expect, it } from 'vitest';
import { scanText } from './secrets';

const jwt = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'c2lnbmF0dXJlLXByb2JhYmxl'].join('.');

describe('scanText', () => {
  it('acepta la clave anon (pública por diseño)', () => {
    expect(scanText(`const key = "${jwt({ role: 'anon', iss: 'supabase' })}"`)).toEqual([]);
    expect(scanText('const key = "sb_publishable_abcdefghijklmnop"')).toEqual([]);
  });

  it('detecta la clave service_role, las sb_secret_ y las claves privadas', () => {
    expect(scanText(`x="${jwt({ role: 'service_role', iss: 'supabase' })}"`)).toEqual(['JWT con role "service_role"']);
    expect(scanText('k="sb_secret_abcdefghijklmnop"')).toEqual(['clave secreta de Supabase (sb_secret_…)']);
    expect(scanText('-----BEGIN PRIVATE KEY-----\nabc')).toEqual(['clave privada (PEM)']);
  });
});
