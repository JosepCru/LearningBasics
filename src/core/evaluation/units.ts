/**
 * Registro de unidades basado en vectores de dimensión (masa, longitud, tiempo,
 * cantidad de sustancia, temperatura). Cubre lo que necesita la química introductoria;
 * para añadir una unidad basta con una entrada en BASE_UNITS.
 */

/** [M, L, T, N, Θ] */
export type Dimensions = readonly [number, number, number, number, number];

export type Unit = {
  /** valor_SI = valor × factor + offset */
  factor: number;
  offset: number;
  dims: Dimensions;
};

type BaseUnit = { factor: number; dims: Dimensions; prefixable: boolean; offset?: number };

const D = (m = 0, l = 0, t = 0, n = 0, th = 0): Dimensions => [m, l, t, n, th];
const DIMENSIONLESS = D();

const ATM_PA = 101325;

const BASE_UNITS: Record<string, BaseUnit> = {
  g: { factor: 1e-3, dims: D(1), prefixable: true },
  u: { factor: 1.66053906892e-27, dims: D(1), prefixable: false },
  Da: { factor: 1.66053906892e-27, dims: D(1), prefixable: true },
  m: { factor: 1, dims: D(0, 1), prefixable: true },
  'Å': { factor: 1e-10, dims: D(0, 1), prefixable: false },
  L: { factor: 1e-3, dims: D(0, 3), prefixable: true },
  l: { factor: 1e-3, dims: D(0, 3), prefixable: true },
  s: { factor: 1, dims: D(0, 0, 1), prefixable: true },
  min: { factor: 60, dims: D(0, 0, 1), prefixable: false },
  h: { factor: 3600, dims: D(0, 0, 1), prefixable: false },
  mol: { factor: 1, dims: D(0, 0, 0, 1), prefixable: true },
  M: { factor: 1e3, dims: D(0, -3, 0, 1), prefixable: true }, // mol/L
  K: { factor: 1, dims: D(0, 0, 0, 0, 1), prefixable: false },
  '°C': { factor: 1, offset: 273.15, dims: D(0, 0, 0, 0, 1), prefixable: false },
  J: { factor: 1, dims: D(1, 2, -2), prefixable: true },
  cal: { factor: 4.184, dims: D(1, 2, -2), prefixable: true },
  Pa: { factor: 1, dims: D(1, -1, -2), prefixable: true },
  bar: { factor: 1e5, dims: D(1, -1, -2), prefixable: false },
  atm: { factor: ATM_PA, dims: D(1, -1, -2), prefixable: false },
  mmHg: { factor: ATM_PA / 760, dims: D(1, -1, -2), prefixable: false },
  Torr: { factor: ATM_PA / 760, dims: D(1, -1, -2), prefixable: false },
  torr: { factor: ATM_PA / 760, dims: D(1, -1, -2), prefixable: false },
};

const PREFIXES: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  'µ': 1e-6, // signo micro U+00B5
  'μ': 1e-6, // letra griega mu U+03BC
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
};

const SUPERSCRIPTS: Record<string, string> = {
  '⁻': '-', '⁺': '+', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

export class UnitError extends Error {}

function lookupSymbol(symbol: string): BaseUnit | undefined {
  const exact = BASE_UNITS[symbol];
  if (exact) return exact;
  // Prefijo de 1 carácter + unidad base prefijable (mL, kg, µmol, kPa…)
  for (let cut = 1; cut < symbol.length; cut++) {
    const prefix = PREFIXES[symbol.slice(0, cut)];
    const base = BASE_UNITS[symbol.slice(cut)];
    if (prefix !== undefined && base?.prefixable) {
      return { factor: prefix * base.factor, dims: base.dims, prefixable: false };
    }
  }
  return undefined;
}

function normalizeUnitText(text: string): string {
  return text
    .trim()
    .replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => '^' + [...s].map((c) => SUPERSCRIPTS[c]).join(''))
    .replace(/−/g, '-')
    .replace(/º/g, '°')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*[·⋅*]\s*/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Convierte texto de unidad en un `Unit`.
 * Admite: `g/mol`, `g·mol^-1`, `g mol-1`, `mol/L`, `cm3`, `cm³`, `J/(mol K)`, `°C`.
 * Todo lo que va tras una `/` está en el denominador: `a/b c` = a/(b·c).
 */
export function parseUnit(text: string): Unit {
  const normalized = normalizeUnitText(text);
  if (normalized === '') throw new UnitError('Unidad vacía');

  const [numerator = '', ...rest] = normalized.split('/');
  const denominator = rest.join(' ').replace(/[()]/g, ' ');
  const factors: { token: string; sign: 1 | -1 }[] = [
    ...splitTokens(numerator).map((token) => ({ token, sign: 1 as const })),
    ...splitTokens(denominator).map((token) => ({ token, sign: -1 as const })),
  ];
  if (factors.length === 0) throw new UnitError(`Unidad vacía: "${text}"`);

  let factor = 1;
  let offset = 0;
  const dims = [0, 0, 0, 0, 0];
  for (const { token, sign } of factors) {
    const match = /^([^\d^+-]+)\^?([+-]?\d+)?$/.exec(token);
    if (!match) throw new UnitError(`No entiendo "${token}"`);
    const symbol = match[1]!;
    const exponent = (match[2] ? Number(match[2]) : 1) * sign;
    const base = lookupSymbol(symbol);
    if (!base) throw new UnitError(`Unidad desconocida: "${symbol}"`);
    if (base.offset !== undefined) {
      if (factors.length !== 1 || exponent !== 1) {
        throw new UnitError(`"${symbol}" solo puede usarse sola; usa K en unidades compuestas`);
      }
      offset = base.offset;
    }
    factor *= base.factor ** exponent;
    base.dims.forEach((d, i) => (dims[i]! += d * exponent));
  }
  return { factor, offset, dims: dims as unknown as Dimensions };
}

function splitTokens(part: string): string[] {
  return part.split(' ').map((t) => t.trim()).filter(Boolean);
}

export function sameDimensions(a: Unit, b: Unit): boolean {
  return a.dims.every((d, i) => d === b.dims[i]);
}

export function isDimensionless(u: Unit): boolean {
  return sameDimensions(u, { factor: 1, offset: 0, dims: DIMENSIONLESS });
}

export function convertValue(value: number, from: Unit, to: Unit): number {
  if (!sameDimensions(from, to)) throw new UnitError('Dimensiones incompatibles');
  const si = value * from.factor + from.offset;
  return (si - to.offset) / to.factor;
}

export function convert(value: number, fromText: string, toText: string): number {
  return convertValue(value, parseUnit(fromText), parseUnit(toText));
}

export function isKnownUnit(text: string): boolean {
  try {
    parseUnit(text);
    return true;
  } catch {
    return false;
  }
}
