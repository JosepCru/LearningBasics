import { describe, expect, it } from 'vitest';
import type { NumericAnswer } from '../content/schemas';
import { evaluateChoice, shuffledOrder } from './choice';
import { evaluateNumeric, parseNumericInput, withinTolerance } from './numeric';
import { evaluateShortText, normalizeText } from './short-text';
import { convert, parseUnit, UnitError } from './units';

describe('unidades', () => {
  it.each([
    [1, 'kg', 'g', 1000],
    [250, 'mL', 'L', 0.25],
    [1, 'dm3', 'L', 1],
    [1, 'cm³', 'mL', 1],
    [44.01, 'g/mol', 'kg/mol', 0.04401],
    [1, 'g·mol^-1', 'g/mol', 1],
    [1, 'g mol-1', 'g/mol', 1],
    [1, 'atm', 'kPa', 101.325],
    [760, 'mmHg', 'atm', 1],
    [0.5, 'M', 'mol/L', 0.5],
    [10, 'mM', 'mol/L', 0.01],
    [25, '°C', 'K', 298.15],
    [300, 'K', '°C', 26.85],
    [1, 'kcal', 'kJ', 4.184],
    [2, 'h', 'min', 120],
    [1, 'µg', 'mg', 0.001],
    [1, 'μg', 'mg', 0.001],
    [1, 'J/(mol·K)', 'J/(mol K)', 1],
  ])('%f %s = %f %s', (value, from, to, expected) => {
    expect(convert(value, from, to)).toBeCloseTo(expected, 9);
  });

  it('distingue min (minuto) de m (metro)', () => {
    expect(convert(1, 'min', 's')).toBe(60);
    expect(convert(1, 'mm', 'm')).toBeCloseTo(0.001, 12);
  });

  it('rechaza unidades desconocidas y combinaciones inválidas', () => {
    expect(() => parseUnit('furlong')).toThrow(UnitError);
    expect(() => parseUnit('°C/s')).toThrow(UnitError);
    expect(() => convert(1, 'g', 'mol')).toThrow(UnitError);
  });
});

describe('parseNumericInput', () => {
  it.each([
    ['44.01', 44.01, ''],
    ['44,01 g/mol', 44.01, 'g/mol'],
    ['-3.5 kJ', -3.5, 'kJ'],
    ['−3.5 kJ', -3.5, 'kJ'],
    ['6.02e23', 6.02e23, ''],
    ['6,02E23 moléculas', 6.02e23, 'moléculas'],
    ['6.02 × 10^23', 6.02e23, ''],
    ['6.02x10^-3 mol', 6.02e-3, 'mol'],
    ['6,02·10²³', 6.02e23, ''],
    ['6.02 * 10^23 átomos', 6.02e23, 'átomos'],
    ['1,234.5 g', 1234.5, 'g'],
    ['.5 L', 0.5, 'L'],
  ])('"%s" → %f [%s]', (input, value, unit) => {
    const parsed = parseNumericInput(input);
    expect(parsed).not.toBeNull();
    expect(parsed!.value).toBeCloseTo(value, 6 - Math.log10(Math.abs(value) || 1));
    expect(parsed!.unitText).toBe(unit);
  });

  it.each(['', 'abc', 'g/mol', '--3'])('"%s" no es un número', (input) => {
    expect(parseNumericInput(input)).toBeNull();
  });
});

describe('withinTolerance', () => {
  it('tolerancia relativa', () => {
    expect(withinTolerance(44.2, 44.01, { relative: 0.005 })).toBe(true);
    expect(withinTolerance(44.3, 44.01, { relative: 0.005 })).toBe(false);
  });
  it('tolerancia absoluta, incluido el cero', () => {
    expect(withinTolerance(0.004, 0, { absolute: 0.005 })).toBe(true);
    expect(withinTolerance(0.006, 0, { absolute: 0.005 })).toBe(false);
  });
  it('el límite exacto cuenta como dentro', () => {
    expect(withinTolerance(1.01, 1, { relative: 0.01 })).toBe(true);
  });
});

describe('evaluateNumeric', () => {
  const molar: NumericAnswer = {
    value: 44.01,
    unit: 'g/mol',
    tolerance: { relative: 0.005 },
    acceptEquivalentUnits: true,
  };

  it('acepta el valor con la unidad esperada', () => {
    expect(evaluateNumeric(molar, '44.01 g/mol')).toMatchObject({ correct: true, feedback: 'correct' });
    expect(evaluateNumeric(molar, '44 g/mol')).toMatchObject({ correct: true });
  });
  it('acepta unidades equivalentes y lo indica', () => {
    expect(evaluateNumeric(molar, '0.04401 kg/mol')).toMatchObject({
      correct: true,
      feedback: 'correct-equivalent-unit',
    });
  });
  it('exige la unidad, pero informa si el valor era correcto', () => {
    expect(evaluateNumeric(molar, '44.01')).toMatchObject({
      correct: false,
      feedback: 'missing-unit',
      valueMatches: true,
    });
  });
  it('detecta dimensión incorrecta y unidad desconocida', () => {
    expect(evaluateNumeric(molar, '44.01 g')).toMatchObject({ feedback: 'wrong-dimension' });
    expect(evaluateNumeric(molar, '44.01 foo')).toMatchObject({ feedback: 'unknown-unit' });
  });
  it('rechaza valores fuera de tolerancia', () => {
    expect(evaluateNumeric(molar, '28.01 g/mol')).toMatchObject({ correct: false, feedback: 'wrong-value' });
  });
  it('con acceptEquivalentUnits=false exige la unidad exacta', () => {
    const strict = { ...molar, acceptEquivalentUnits: false };
    expect(evaluateNumeric(strict, '0.04401 kg/mol')).toMatchObject({
      correct: false,
      feedback: 'wrong-unit',
      valueMatches: true,
    });
  });
  it('requireUnit=false permite omitir la unidad', () => {
    expect(evaluateNumeric({ ...molar, requireUnit: false }, '44.01')).toMatchObject({ correct: true });
  });

  describe('respuestas adimensionales', () => {
    const count: NumericAnswer = {
      value: 3.011e23,
      tolerance: { relative: 0.01 },
      acceptEquivalentUnits: true,
    };
    it('ignora palabras que no son unidades', () => {
      expect(evaluateNumeric(count, '3.01 × 10^23 moléculas')).toMatchObject({ correct: true });
    });
    it('rechaza unidades con dimensión', () => {
      expect(evaluateNumeric(count, '3.011e23 g')).toMatchObject({ feedback: 'unexpected-unit', valueMatches: true });
    });
  });

  it('texto ilegible', () => {
    expect(evaluateNumeric(molar, 'cuarenta')).toMatchObject({ feedback: 'unparseable' });
  });
});

describe('evaluateChoice', () => {
  const spec = {
    options: [
      { id: 'a', correct: false, misconception: 'charge-sign' },
      { id: 'b', correct: true },
      { id: 'c', correct: false },
    ],
  };
  it('marca la correcta', () => {
    expect(evaluateChoice(spec, 'b')).toMatchObject({ correct: true, errorTags: [] });
  });
  it('devuelve la etiqueta de misconception del distractor', () => {
    expect(evaluateChoice(spec, 'a')).toMatchObject({ correct: false, errorTags: ['charge-sign'] });
    expect(evaluateChoice(spec, 'c')).toMatchObject({ correct: false, errorTags: [] });
  });
  it('opción inexistente', () => {
    expect(evaluateChoice(spec, 'z')).toMatchObject({ correct: false, feedback: 'unparseable' });
  });
  it('el barajado es determinista y conserva los elementos', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = shuffledOrder(items, 'chem.x.ex01');
    expect(shuffledOrder(items, 'chem.x.ex01')).toEqual(first);
    expect([...first].sort()).toEqual(items);
  });
});

describe('texto corto', () => {
  const lenient = { case: true, accents: true, whitespace: true };
  it('normaliza mayúsculas, tildes, espacios y puntuación final', () => {
    expect(normalizeText('  El   Neutrón. ', lenient)).toBe('el neutron');
  });
  it('acepta variantes normalizadas', () => {
    const spec = { accept: ['neutrón'], normalize: lenient };
    expect(evaluateShortText(spec, 'Neutron')).toMatchObject({ correct: true });
    expect(evaluateShortText(spec, 'protón')).toMatchObject({ correct: false, feedback: 'no-match' });
    expect(evaluateShortText(spec, '   ')).toMatchObject({ feedback: 'unparseable' });
  });
  it('case=false distingue CO de Co', () => {
    const spec = { accept: ['CO'], normalize: { ...lenient, case: false } };
    expect(evaluateShortText(spec, 'CO')).toMatchObject({ correct: true });
    expect(evaluateShortText(spec, 'Co')).toMatchObject({ correct: false });
  });
});
