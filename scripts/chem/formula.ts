import { ATOMIC_WEIGHTS } from './atomic-weights';

export class FormulaError extends Error {}

/**
 * Cuenta los átomos de una fórmula química.
 * Admite paréntesis/corchetes anidados y unidades separadas por `·`, `*` o `.`
 * con coeficiente inicial: `Ca(OH)2`, `Al2(SO4)3`, `CuSO4·5H2O`.
 * No interpreta cargas: para iones, escribe la fórmula sin carga.
 */
export function parseFormula(formula: string): Map<string, number> {
  const text = formula.replace(/\s+/g, '');
  if (text === '') throw new FormulaError('Fórmula vacía');
  const total = new Map<string, number>();
  for (const part of text.split(/[·*.]/)) {
    const coef = /^\d+/.exec(part);
    const multiplier = coef ? Number(coef[0]) : 1;
    const body = coef ? part.slice(coef[0].length) : part;
    if (body === '') throw new FormulaError(`Parte vacía en "${formula}"`);
    addInto(total, parseGroup(body, formula), multiplier);
  }
  return total;
}

function parseGroup(text: string, original: string): Map<string, number> {
  let pos = 0;
  const readCount = (): number => {
    const m = /^\d+/.exec(text.slice(pos));
    if (!m) return 1;
    pos += m[0].length;
    return Number(m[0]);
  };

  const parseSequence = (closing?: string): Map<string, number> => {
    const counts = new Map<string, number>();
    while (pos < text.length) {
      const ch = text[pos]!;
      if (ch === '(' || ch === '[') {
        pos++;
        const inner = parseSequence(ch === '(' ? ')' : ']');
        addInto(counts, inner, readCount());
      } else if (ch === ')' || ch === ']') {
        if (ch !== closing) throw new FormulaError(`Paréntesis desbalanceado en "${original}"`);
        pos++;
        return counts;
      } else {
        const m = /^[A-Z][a-z]?/.exec(text.slice(pos));
        if (!m) throw new FormulaError(`Carácter inesperado "${ch}" en "${original}"`);
        const symbol = m[0];
        if (!ATOMIC_WEIGHTS[symbol]) throw new FormulaError(`Elemento desconocido "${symbol}" en "${original}"`);
        pos += symbol.length;
        addInto(counts, new Map([[symbol, 1]]), readCount());
      }
    }
    if (closing) throw new FormulaError(`Falta "${closing}" en "${original}"`);
    return counts;
  };

  return parseSequence();
}

function addInto(target: Map<string, number>, source: Map<string, number>, times: number): void {
  for (const [el, n] of source) target.set(el, (target.get(el) ?? 0) + n * times);
}

/** Masa molar en g/mol a partir de pesos atómicos estándar. */
export function molarMass(formula: string): number {
  let sum = 0;
  for (const [el, n] of parseFormula(formula)) sum += ATOMIC_WEIGHTS[el]!.weight * n;
  return sum;
}

function element(symbol: string) {
  const entry = ATOMIC_WEIGHTS[symbol];
  if (!entry) throw new FormulaError(`Elemento desconocido "${symbol}"`);
  return entry;
}

export const atomicMass = (symbol: string): number => element(symbol).weight;
export const atomicNumber = (symbol: string): number => element(symbol).z;
