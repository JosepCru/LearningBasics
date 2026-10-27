# Estimación de dominio

> Es una **heurística interpretable**, no una medida científica del conocimiento. Sirve
> para orientar la práctica (qué repasar, qué está flojo), no para certificar nada.

## Unidad de medida

El dominio se calcula **por objetivo de aprendizaje** y se agrega por tema (media de sus
objetivos con evidencia) y por asignatura.

## Evidencia

Cada evento `attempt` no anulado aporta evidencia al objetivo de su ejercicio.

### Puntuación por intento (valores iniciales, ajustables)

| Resultado | Puntuación |
|---|---|
| Correcto sin pistas ni solución | 1.0 |
| Correcto tras pistas | 0.6 |
| Correcto autoevaluado (texto corto) | 0.8 |
| Incorrecto, o solución vista antes de responder | 0.0 |

### Peso por intento

```
peso = decaimiento(edad) × bonusRetención × factorRevisión
decaimiento(edad)  = 0.5 ^ (edadEnDías / 21)          # vida media 21 días
bonusRetención     = 1.5 si el intento ocurre ≥ 1 día después del primer intento del objetivo, si no 1.0
factorRevisión     = 0 si exerciseRevision < revisión actual con cambio de respuesta, si no 1
```

### Puntuación del objetivo

```
puntuación = Σ(peso × puntuaciónIntento) / Σ(peso)
evidencias = número de intentos con peso > 0
```

Los **errores repetidos** (≥ 2 intentos incorrectos con la misma etiqueta de
*misconception* en los últimos 14 días) no alteran la puntuación, pero marcan el objetivo
como "débil" para el planificador y aparecen en "Errores recientes".

## Bandas mostradas

| Banda | Condición |
|---|---|
| Sin datos | < 3 evidencias |
| Iniciado | puntuación < 0.5 |
| En desarrollo | 0.5 ≤ puntuación < 0.8 |
| Consolidado | puntuación ≥ 0.8 |
| Retenido | Consolidado **y** al menos un acierto sin ayuda ≥ 7 días después del primer intento |

La UI muestra la banda y el número de evidencias ("Consolidado · 9 intentos"), nunca un
porcentaje con decimales.

## Por qué así

- **Decaimiento**: el rendimiento reciente predice mejor el actual que el de hace meses.
- **Bonus de retención**: acertar al día siguiente demuestra más que acertar tres veces
  seguidas en la misma sesión.
- **Penalizar pistas parcialmente**: llegar con ayuda es aprendizaje, pero no autonomía.
- **Umbral de evidencias**: con 1–2 intentos cualquier estimación es ruido.

## Tests requeridos (Fase 2)

- Sin intentos → "Sin datos".
- Tres aciertos sin ayuda el mismo día → "Consolidado", no "Retenido".
- Acierto sin ayuda 8 días después → "Retenido".
- Intentos antiguos pesan menos que recientes (casos numéricos explícitos).
- Intentos anulados con `void` no cuentan.
- Intentos de una revisión con respuesta corregida no cuentan.

Los parámetros (vida media, puntuaciones, umbrales) viven en un único objeto de
configuración para poder ajustarlos y documentar cada cambio aquí.
