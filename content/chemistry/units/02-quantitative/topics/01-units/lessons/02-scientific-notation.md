---
id: chem.units.l2
title: Notación científica y cifras significativas
objectives: [chem.units.o2, chem.units.o3]
estimatedMinutes: 12
sources:
  - ref: openstax-chem2e
    locator: "Sec. 1.5 Measurement Uncertainty, Accuracy, and Precision"
  - ref: openstax-chem2e
    locator: "Sec. 1.6 Mathematical Treatment of Measurement Results"
provenance: ai-drafted
revision: 1
---

## Objetivo

Escribir números muy grandes o muy pequeños en notación científica, operar con ellos y redondear con un número razonable de cifras.

## Notación científica

Un número se escribe como $a \times 10^{n}$, con $1 \le a < 10$ y $n$ entero:

- $602\,000\,000 = 6.02 \times 10^{8}$
- $0.00045 = 4.5 \times 10^{-4}$

Para **multiplicar**, multiplica las mantisas y **suma** los exponentes. Para **dividir**, divide las mantisas y **resta** los exponentes:

$$(3.0 \times 10^{4}) \times (2.0 \times 10^{-2}) = 6.0 \times 10^{2}$$

$$\frac{8.0 \times 10^{6}}{2.0 \times 10^{2}} = 4.0 \times 10^{4}$$

:::note
En esta aplicación puedes responder `6.0e2`, `6,0 × 10^2` o `600`: todas valen.
:::

## Cifras significativas

Las **cifras significativas** son los dígitos de una medida que se conocen con fiabilidad, más el primero que es incierto.

Reglas para contarlas:

1. Los dígitos distintos de cero siempre cuentan: 4.56 → 3 cifras.
2. Los ceros entre dígitos cuentan: 1.07 → 3.
3. Los ceros **a la izquierda** no cuentan, porque solo sitúan la coma: 0.0045 → 2.
4. Los ceros **a la derecha después de la coma decimal** sí cuentan: 4.50 → 3; 0.00450 → 3.

:::worked-example[Contar cifras]
- $0.00450$: los tres primeros ceros no cuentan; 4, 5 y el 0 final sí → **3 cifras**.
- $2.0 \times 10^{3}$: la notación científica lo deja claro → **2 cifras**.
:::

## Cifras en los cálculos

- **Multiplicación y división**: el resultado lleva tantas cifras significativas como el dato que tenga **menos**. $1.20 \times 25.0 = 30.0$ (3 cifras).
- **Suma y resta**: el resultado lleva tantos **decimales** como el dato que tenga menos decimales. $12.11 + 0.3 = 12.4$.

Redondea solo al final del cálculo, no en los pasos intermedios.

## Resumen

- Notación científica: $a \times 10^{n}$ con $1 \le a < 10$.
- Al multiplicar, se suman los exponentes; al dividir, se restan.
- Los ceros a la izquierda no son significativos; los finales tras la coma, sí.
