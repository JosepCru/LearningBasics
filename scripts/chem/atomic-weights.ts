/**
 * Pesos atómicos estándar abreviados (5 cifras significativas o la precisión que
 * permite el intervalo), en g/mol.
 *
 * Fuente: IUPAC/CIAAW, "Standard atomic weights" (tabla abreviada, revisión 2021+),
 * https://www.ciaaw.org/atomic-weights.htm
 * Para elementos con intervalo (H, Li, B, C, N, O, Mg, Si, S, Cl, Br, Tl) se usa el
 * valor convencional/abreviado.
 *
 * Solo se incluyen los elementos que el contenido necesita o es probable que necesite
 * pronto. Añadir uno: entrada nueva + comprobar contra la fuente.
 */
export const ATOMIC_WEIGHTS: Readonly<Record<string, { z: number; weight: number }>> = {
  H: { z: 1, weight: 1.008 },
  He: { z: 2, weight: 4.0026 },
  Li: { z: 3, weight: 6.94 },
  Be: { z: 4, weight: 9.0122 },
  B: { z: 5, weight: 10.81 },
  C: { z: 6, weight: 12.011 },
  N: { z: 7, weight: 14.007 },
  O: { z: 8, weight: 15.999 },
  F: { z: 9, weight: 18.998 },
  Ne: { z: 10, weight: 20.18 },
  Na: { z: 11, weight: 22.99 },
  Mg: { z: 12, weight: 24.305 },
  Al: { z: 13, weight: 26.982 },
  Si: { z: 14, weight: 28.085 },
  P: { z: 15, weight: 30.974 },
  S: { z: 16, weight: 32.06 },
  Cl: { z: 17, weight: 35.45 },
  Ar: { z: 18, weight: 39.95 },
  K: { z: 19, weight: 39.098 },
  Ca: { z: 20, weight: 40.078 },
  Ti: { z: 22, weight: 47.867 },
  Cr: { z: 24, weight: 51.996 },
  Mn: { z: 25, weight: 54.938 },
  Fe: { z: 26, weight: 55.845 },
  Co: { z: 27, weight: 58.933 },
  Ni: { z: 28, weight: 58.693 },
  Cu: { z: 29, weight: 63.546 },
  Zn: { z: 30, weight: 65.38 },
  Br: { z: 35, weight: 79.904 },
  Kr: { z: 36, weight: 83.798 },
  Ag: { z: 47, weight: 107.87 },
  Sn: { z: 50, weight: 118.71 },
  I: { z: 53, weight: 126.9 },
  Ba: { z: 56, weight: 137.33 },
  Au: { z: 79, weight: 196.97 },
  Hg: { z: 80, weight: 200.59 },
  Pb: { z: 82, weight: 207.2 },
  U: { z: 92, weight: 238.03 },
};

/** Constante de Avogadro, valor exacto desde la redefinición del SI (2019), mol⁻¹. */
export const AVOGADRO = 6.02214076e23;
