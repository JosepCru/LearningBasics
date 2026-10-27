/**
 * Intérprete de las expresiones `verify` de los ejercicios numéricos.
 * Deliberadamente pequeño y sin `eval`: solo aritmética, constantes y funciones
 * de la lista blanca. Ver content/CONTENT_GUIDE.md §6.
 *
 * Gramática:
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := '-' unary | power
 *   power   := primary ('^' unary)?
 *   primary := number | string | ident | ident '(' args ')' | '(' expr ')'
 */
import { convert } from '../../src/core/evaluation/units';
import { AVOGADRO } from './atomic-weights';
import { atomicMass, atomicNumber, molarMass } from './formula';

export class VerifyError extends Error {}

type Value = number | string;

const CONSTANTS: Record<string, number> = { NA: AVOGADRO };

const FUNCTIONS: Record<string, { arity: number; fn: (...args: Value[]) => number }> = {
  molarMass: { arity: 1, fn: (f) => molarMass(asString(f)) },
  atomicMass: { arity: 1, fn: (s) => atomicMass(asString(s)) },
  atomicNumber: { arity: 1, fn: (s) => atomicNumber(asString(s)) },
  convert: { arity: 3, fn: (v, from, to) => convert(asNumber(v), asString(from), asString(to)) },
};

function asString(v: Value): string {
  if (typeof v !== 'string') throw new VerifyError('Se esperaba un texto entre comillas');
  return v;
}
function asNumber(v: Value): number {
  if (typeof v !== 'number') throw new VerifyError('Se esperaba un número');
  return v;
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const ws = /^\s+/.exec(rest);
    if (ws) { i += ws[0].length; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (num) { tokens.push({ kind: 'num', value: Number(num[0]) }); i += num[0].length; continue; }
    const str = /^'([^']*)'/.exec(rest);
    if (str) { tokens.push({ kind: 'str', value: str[1]! }); i += str[0].length; continue; }
    const id = /^[A-Za-z_]\w*/.exec(rest);
    if (id) { tokens.push({ kind: 'ident', value: id[0] }); i += id[0].length; continue; }
    if ('+-*/^(),'.includes(rest[0]!)) { tokens.push({ kind: 'op', value: rest[0]! }); i++; continue; }
    throw new VerifyError(`Carácter inesperado "${rest[0]}"`);
  }
  return tokens;
}

export function evaluateVerify(src: string): number {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => { const t = peek(); return t?.kind === 'op' && t.value === v; };
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new VerifyError(`Se esperaba "${v}"`);
    pos++;
  };

  const expr = (): Value => {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = term();
      left = op === '+' ? asNumber(left) + asNumber(right) : asNumber(left) - asNumber(right);
    }
    return left;
  };
  const term = (): Value => {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = unary();
      left = op === '*' ? asNumber(left) * asNumber(right) : asNumber(left) / asNumber(right);
    }
    return left;
  };
  const unary = (): Value => {
    if (isOp('-')) { pos++; return -asNumber(unary()); }
    return power();
  };
  const power = (): Value => {
    const base = primary();
    if (isOp('^')) { pos++; return asNumber(base) ** asNumber(unary()); }
    return base;
  };
  const primary = (): Value => {
    const t = peek();
    if (!t) throw new VerifyError('Expresión incompleta');
    pos++;
    if (t.kind === 'num' || t.kind === 'str') return t.value;
    if (t.kind === 'op' && t.value === '(') {
      const v = expr();
      expectOp(')');
      return v;
    }
    if (t.kind === 'ident') {
      if (isOp('(')) {
        const def = FUNCTIONS[t.value];
        if (!def) throw new VerifyError(`Función desconocida "${t.value}"`);
        pos++;
        const args: Value[] = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) { pos++; args.push(expr()); }
        }
        expectOp(')');
        if (args.length !== def.arity) throw new VerifyError(`${t.value} espera ${def.arity} argumento(s)`);
        return def.fn(...args);
      }
      const c = CONSTANTS[t.value];
      if (c === undefined) throw new VerifyError(`Constante desconocida "${t.value}"`);
      return c;
    }
    throw new VerifyError(`Símbolo inesperado "${t.value}"`);
  };

  const result = expr();
  if (pos !== tokens.length) throw new VerifyError('Sobra texto al final de la expresión');
  const n = asNumber(result);
  if (!Number.isFinite(n)) throw new VerifyError('El resultado no es un número finito');
  return n;
}

/** true si la expresión es solo un número (no verifica nada de forma independiente). */
export function isTrivialVerify(src: string): boolean {
  const tokens = tokenize(src);
  return tokens.every((t) => t.kind === 'num' || (t.kind === 'op' && t.value === '-'));
}
