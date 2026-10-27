/**
 * UUIDv7 (RFC 9562): 48 bits de milisegundos + aleatorio. Ordenable por tiempo de
 * creación, y generable sin coordinación en cualquier dispositivo.
 */
type Bytes = Uint8Array<ArrayBuffer>;

export function uuidv7(now: number = Date.now(), random: (bytes: Bytes) => Bytes = defaultRandom): string {
  const bytes = random(new Uint8Array(16));
  const ms = BigInt(now);
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultRandom(bytes: Bytes): Bytes {
  crypto.getRandomValues(bytes);
  return bytes;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
