import { describe, expect, it } from 'vitest';
import { molarMass, parseFormula, FormulaError } from './formula';
import { evaluateVerify, isTrivialVerify, VerifyError } from './verify-expr';

describe('parseFormula', () => {
  it('cuenta átomos simples', () => {
    expect(Object.fromEntries(parseFormula('H2O'))).toEqual({ H: 2, O: 1 });
  });
  it('resuelve paréntesis anidados', () => {
    expect(Object.fromEntries(parseFormula('Al2(SO4)3'))).toEqual({ Al: 2, S: 3, O: 12 });
    expect(Object.fromEntries(parseFormula('Ca(OH)2'))).toEqual({ Ca: 1, O: 2, H: 2 });
  });
  it('admite hidratos con coeficiente', () => {
    expect(Object.fromEntries(parseFormula('CuSO4·5H2O'))).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
  });
  it('distingue mayúsculas: Co (cobalto) frente a CO', () => {
    expect(Object.fromEntries(parseFormula('Co'))).toEqual({ Co: 1 });
    expect(Object.fromEntries(parseFormula('CO'))).toEqual({ C: 1, O: 1 });
  });
  it('rechaza elementos desconocidos y paréntesis desbalanceados', () => {
    expect(() => parseFormula('Xx2')).toThrow(FormulaError);
    expect(() => parseFormula('Ca(OH2')).toThrow(FormulaError);
    expect(() => parseFormula('CaOH)2')).toThrow(FormulaError);
  });
});

describe('molarMass', () => {
  // Valores de referencia calculados a mano con los pesos de atomic-weights.ts
  it.each([
    ['H2O', 18.015],
    ['CO2', 44.009],
    ['NaCl', 58.44],
    ['C6H12O6', 180.156],
  ])('%s ≈ %f g/mol', (formula, expected) => {
    expect(molarMass(formula)).toBeCloseTo(expected, 2);
  });
});

describe('evaluateVerify', () => {
  it('respeta la precedencia y el menos unario', () => {
    expect(evaluateVerify('2 + 3 * 4')).toBe(14);
    expect(evaluateVerify('(2 + 3) * 4')).toBe(20);
    expect(evaluateVerify('-2 ^ 2')).toBe(-4);
    expect(evaluateVerify('2 ^ -1')).toBe(0.5);
    expect(evaluateVerify('1.5e3 / 3')).toBe(500);
  });
  it('usa funciones y constantes químicas', () => {
    expect(evaluateVerify("10.0 / molarMass('NaCl')")).toBeCloseTo(0.1711, 4);
    expect(evaluateVerify('0.5 * NA')).toBeCloseTo(3.011e23, -20);
    expect(evaluateVerify("convert(2.5, 'km', 'm')")).toBeCloseTo(2500, 9);
    expect(evaluateVerify("atomicMass('C')")).toBe(12.011);
    expect(evaluateVerify("37 - atomicNumber('Cl')")).toBe(20);
  });
  it('rechaza código no permitido', () => {
    expect(() => evaluateVerify('process.exit()')).toThrow(VerifyError);
    expect(() => evaluateVerify('foo(1)')).toThrow(VerifyError);
    expect(() => evaluateVerify('1 +')).toThrow(VerifyError);
    expect(() => evaluateVerify('1 / 0')).toThrow(VerifyError);
  });
  it('detecta verify triviales', () => {
    expect(isTrivialVerify('44.01')).toBe(true);
    expect(isTrivialVerify("molarMass('CO2')")).toBe(false);
  });
});
