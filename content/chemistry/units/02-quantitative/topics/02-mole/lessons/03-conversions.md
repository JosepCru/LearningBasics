---
id: chem.mole.l3
title: "Conversiones: masa ↔ moles ↔ partículas"
objectives: [chem.mole.o3]
estimatedMinutes: 12
sources:
  - ref: openstax-chem2e
    locator: "Sec. 3.1 Formula Mass and the Mole Concept"
provenance: ai-drafted
revision: 1
---

## Objetivo

Resolver problemas que pasan de gramos a moles y a número de partículas, en cualquier dirección.

## El mapa

El mol es el centro de todas las conversiones:

| De → a | Operación | Factor |
|---|---|---|
| masa → moles | dividir entre $M$ | $\dfrac{1\ \text{mol}}{M\ \text{g}}$ |
| moles → masa | multiplicar por $M$ | $\dfrac{M\ \text{g}}{1\ \text{mol}}$ |
| moles → entidades | multiplicar por $N_A$ | $\dfrac{6.022 \times 10^{23}}{1\ \text{mol}}$ |
| entidades → moles | dividir entre $N_A$ | $\dfrac{1\ \text{mol}}{6.022 \times 10^{23}}$ |

$$m \;\xrightleftharpoons[\times M]{\div M}\; n \;\xrightleftharpoons[\div N_A]{\times N_A}\; N$$

No hay atajo directo de gramos a partículas: **siempre se pasa por los moles**.

:::worked-example[Moles en 10.0 g de NaCl]
$M(\ce{NaCl}) = 22.99 + 35.45 = 58.44\ \text{g/mol}$

$$n = 10.0\ \cancel{\text{g}} \times \frac{1\ \text{mol}}{58.44\ \cancel{\text{g}}} = 0.171\ \text{mol}$$
:::

:::worked-example[Moléculas en 1.00 g de agua]
1. $M(\ce{H2O}) = 2(1.008) + 16.00 = 18.02\ \text{g/mol}$
2. $n = 1.00 / 18.02 = 0.0555\ \text{mol}$
3. $N = 0.0555 \times 6.022 \times 10^{23} = 3.34 \times 10^{22}$ moléculas
:::

:::pitfall
Si te piden **átomos** y tienes moléculas, multiplica por el número de esos átomos en la fórmula. 0.100 mol de $\ce{H2O}$ contienen $0.200$ mol de átomos de H.
:::

## Estrategia

1. Identifica qué te dan y qué te piden.
2. Si hace falta, calcula la masa molar.
3. Pasa a moles.
4. Desde los moles, ve a la magnitud pedida.
5. Comprueba que las unidades se cancelan y que el orden de magnitud es razonable.

## Resumen

- Masa ↔ moles: con la masa molar $M$.
- Moles ↔ entidades: con $N_A$.
- El mol es siempre el paso intermedio.
