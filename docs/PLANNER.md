# Plan diario

> Las asignaciones de tiempo son **valores por defecto ajustables**, no reglas científicas.

## Principio

El plan es una función pura:

```ts
plan(state: LearnerState, today: LocalDate, settings: PlannerSettings): DailyPlan
```

No se guarda una cola de tareas: el plan se **recalcula** cada vez. Saltarse días no
acumula elementos de plan; solo cambia el estado (más repasos vencidos), y el plan se
adapta a él.

## Ajustes por defecto

| Ajuste | Valor |
|---|---|
| Objetivo diario | 60 min |
| Repasos (flashcards) | hasta 20 min |
| Material nuevo | ~25 min |
| Práctica en temas débiles | ~15 min |
| Tope de repasos por día | 120 tarjetas |
| Umbral de atraso | si los repasos vencidos superan 2 días de tope, se pausa el material nuevo |

Las estimaciones de duración usan la mediana de `durationMs` de tu historial; sin
historial, valores por defecto (10 s por tarjeta, 90 s por ejercicio, `estimatedMinutes`
de la lección).

## Algoritmo

1. **Repasos**: tarjetas vencidas ordenadas por menor retrievability FSRS (las más en
   riesgo de olvido primero), recortadas por tiempo y por tope.
2. **Material nuevo**: siguiente lección cuyo tema tenga todos los prerrequisitos en banda
   ≥ "En desarrollo", en orden del currículo. Se omite si hay atraso de repasos.
3. **Práctica débil**: objetivos marcados como débiles (ver MASTERY.md) o en banda
   "Iniciado", ejercicios no acertados recientemente.
4. Tiempo sobrante de una categoría vacía se reparte a las demás.

## Tras días sin estudiar

- No se intenta recuperar todo de golpe: el tope diario se mantiene.
- Las tarjetas más en riesgo se repasan primero; el resto se reparte en los días
  siguientes.
- El material nuevo se pausa hasta que los repasos vencidos bajen del umbral.

## Tiempo estudiado

Se mide por tiempo **activo**: la sesión se pausa con la pestaña oculta o tras 2 minutos
sin interacción. Se registra como eventos `session_segment`.

## Tests requeridos (Fase 4)

- Estado vacío → solo material nuevo.
- 3 días sin estudiar con 300 tarjetas vencidas → respeta el tope; sin material nuevo.
- El plan nunca supera el objetivo diario + 10 %.
- Prerrequisitos sin dominio → la lección no se recomienda.
- Mismo estado y fecha → mismo plan (determinismo).
