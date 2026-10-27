import type { NumericAnswer, Tolerance } from '../content/schemas';
import { fail, ok, type EvaluationResult } from './types';
import { convertValue, isDimensionless, parseUnit, sameDimensions, UnitError, type Unit } from './units';

export type ParsedNumber = { value: number; unitText: string };

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁻': '-', '⁺': '+', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

const NUMBER_RE =
  /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*[eE]\s*([+-]?\d+)|\s*[x×*·⋅]\s*10\s*\^?\s*([+-]?\d+))?\s*(.*)$/;

/**
 * Separa número y unidad de lo que escribe el usuario.
 * Acepta coma o punto decimal y notación científica: `6.02e23`, `6,02 × 10^23`,
 * `6.02·10²³`, `1,5 mol`, `-3.2 kJ`. Una coma con punto presente se trata como
 * separador de miles (`1,234.5`).
 */
export function parseNumericInput(raw: string): ParsedNumber | null {
  let text = raw.trim().replace(/−/g, '-');
  if (text === '') return null;
  // Exponentes en superíndice tras "10": 10²³ → 10^23
  text = text.replace(/10([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, sup: string) =>
    '10^' + [...sup].map((c) => SUPERSCRIPT_DIGITS[c]).join(''),
  );
  const numericPart = /^[^A-Za-z°µμÅ]*/.exec(text)?.[0] ?? '';
  const normalizedNumber = numericPart.includes('.')
    ? numericPart.replace(/,/g, '')
    : numericPart.replace(/,/g, '.');
  text = normalizedNumber + text.slice(numericPart.length);

  const m = NUMBER_RE.exec(text);
  if (!m) return null;
  const mantissa = Number(m[1]);
  const exponent = m[2] ?? m[3];
  const value = exponent !== undefined ? mantissa * 10 ** Number(exponent) : mantissa;
  if (!Number.isFinite(value)) return null;
  return { value, unitText: (m[4] ?? '').trim() };
}

export function withinTolerance(actual: number, expected: number, tolerance: Tolerance): boolean {
  // Pequeño margen para errores de coma flotante en las conversiones.
  const epsilon = 1e-12 * Math.max(Math.abs(expected), 1e-300);
  const diff = Math.abs(actual - expected);
  if ('relative' in tolerance) return diff <= tolerance.relative * Math.abs(expected) + epsilon;
  return diff <= tolerance.absolute + epsilon;
}

function tryParseUnit(text: string): Unit | null {
  try {
    return parseUnit(text);
  } catch (e) {
    if (e instanceof UnitError) return null;
    throw e;
  }
}

export function evaluateNumeric(answer: NumericAnswer, input: string): EvaluationResult {
  const parsed = parseNumericInput(input);
  if (!parsed) return fail('unparseable');

  const compare = (value: number) => withinTolerance(value, answer.value, answer.tolerance);

  // Respuesta adimensional (p. ej. número de entidades)
  if (!answer.unit) {
    if (parsed.unitText) {
      const userUnit = tryParseUnit(parsed.unitText);
      // Palabras como "moléculas" o "átomos" no son unidades: se ignoran.
      if (userUnit && !isDimensionless(userUnit)) {
        return fail('unexpected-unit', { valueMatches: compare(parsed.value) });
      }
    }
    return compare(parsed.value) ? ok() : fail('wrong-value');
  }

  const expectedUnit = parseUnit(answer.unit);
  const requireUnit = answer.requireUnit ?? true;

  if (!parsed.unitText) {
    if (requireUnit) return fail('missing-unit', { valueMatches: compare(parsed.value) });
    return compare(parsed.value) ? ok() : fail('wrong-value');
  }

  const userUnit = tryParseUnit(parsed.unitText);
  if (!userUnit) return fail('unknown-unit');
  if (!sameDimensions(userUnit, expectedUnit)) return fail('wrong-dimension');

  const sameUnit = userUnit.factor === expectedUnit.factor && userUnit.offset === expectedUnit.offset;
  if (sameUnit) return compare(parsed.value) ? ok() : fail('wrong-value');

  const converted = convertValue(parsed.value, userUnit, expectedUnit);
  if (!answer.acceptEquivalentUnits) {
    return fail('wrong-unit', { valueMatches: compare(converted) });
  }
  return compare(converted) ? ok('correct-equivalent-unit') : fail('wrong-value');
}
