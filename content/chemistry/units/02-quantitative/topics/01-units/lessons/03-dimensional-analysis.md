---
id: chem.units.l3
title: Análisis dimensional
objectives: [chem.units.o4]
estimatedMinutes: 10
sources:
  - ref: openstax-chem2e
    locator: "Sec. 1.6 Mathematical Treatment of Measurement Results"
provenance: ai-drafted
revision: 1
---

## Objetivo

Convertir cualquier medida de una unidad a otra multiplicando por factores de conversión y comprobando que las unidades se cancelan.

## Factores de conversión

Una equivalencia como $1\ \text{km} = 1000\ \text{m}$ da lugar a dos fracciones que valen 1:

$$\frac{1000\ \text{m}}{1\ \text{km}} \qquad \frac{1\ \text{km}}{1000\ \text{m}}$$

Multiplicar por 1 no cambia la cantidad, pero sí la unidad. Se elige la fracción que tiene **la unidad que quieres eliminar en el denominador**.

:::worked-example[De kilómetros a metros]
$$2.5\ \cancel{\text{km}} \times \frac{1000\ \text{m}}{1\ \cancel{\text{km}}} = 2500\ \text{m}$$
:::

## Cadenas de factores

Si no conoces una equivalencia directa, encadena varias:

:::worked-example[De horas a segundos]
$$1.5\ \cancel{\text{h}} \times \frac{60\ \cancel{\text{min}}}{1\ \cancel{\text{h}}} \times \frac{60\ \text{s}}{1\ \cancel{\text{min}}} = 5400\ \text{s}$$
:::

## Unidades compuestas

El método funciona igual con unidades como la densidad. Para pasar $1.00\ \text{g/mL}$ a $\text{kg/m}^3$:

$$1.00\ \frac{\cancel{\text{g}}}{\cancel{\text{mL}}} \times \frac{1\ \text{kg}}{1000\ \cancel{\text{g}}} \times \frac{10^{6}\ \cancel{\text{mL}}}{1\ \text{m}^3} = 1.00 \times 10^{3}\ \text{kg/m}^3$$

($1\ \text{m}^3 = 1000\ \text{L} = 10^{6}\ \text{mL}$.)

:::pitfall
Si al final las unidades no se cancelan como esperabas, has puesto un factor al revés. Revisa las unidades antes de mirar el número.
:::

## La densidad como factor de conversión

La densidad relaciona masa y volumen: $\rho = m / V$. Puedes usarla como factor para pasar de volumen a masa:

$$25.0\ \cancel{\text{mL}} \times \frac{1.20\ \text{g}}{1\ \cancel{\text{mL}}} = 30.0\ \text{g}$$

## Resumen

- Un factor de conversión es una fracción que vale 1.
- La unidad que quieres eliminar va en el denominador.
- Si las unidades se cancelan bien, el planteamiento es correcto.
