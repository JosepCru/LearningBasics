# Persistencia local y sincronización

Diseño local-first: la app funciona completa sin red. IndexedDB y Supabase **no** se
sincronizan solos; lo hace el motor descrito aquí.

## Principios

1. Toda acción del usuario es un **evento inmutable** con `id` UUIDv7 generado en el cliente
   en el momento de crearlo.
2. El estado visible (tarjetas FSRS, dominio, progreso, ajustes) es una **proyección**
   derivada de los eventos; puede reconstruirse desde cero.
3. Sincronizar = unir conjuntos de eventos por `id`. La unión es conmutativa, asociativa e
   idempotente: el orden de llegada y los reintentos no cambian el resultado.
4. Nunca se borra ni modifica un evento. "Deshacer" es un evento `void` compensatorio.

## Esquema de eventos

```ts
type EventBase = {
  id: string;              // UUIDv7
  userId: string;          // auth.uid(); 'local' antes de iniciar sesión (ver abajo)
  deviceId: string;        // aleatorio, persistido por instalación
  type: 'attempt' | 'review' | 'session_segment' | 'lesson' | 'setting' | 'void';
  clientCreatedAt: string; // ISO 8601
  schemaVersion: 1;
  payload: ...;            // según type
};
```

| type | payload |
|---|---|
| `attempt` | `exerciseId, exerciseRevision, response, result ('correct'\|'incorrect'), hintsUsed, solutionViewedBefore, selfGraded, errorTags[], durationMs` |
| `review` | `cardId, rating (1–4), reviewedAt, durationMs` |
| `session_segment` | `startedAt, endedAt, activeMs, activity ('lesson'\|'practice'\|'review')` |
| `lesson` | `lessonId, action ('opened'\|'completed')` |
| `setting` | `key, value` |
| `void` | `targetEventId, reason` |

Cada payload tiene su esquema Zod en `core/events`. Un evento con `schemaVersion`
desconocido se conserva pero se ignora en las proyecciones (compatibilidad hacia delante).

## IndexedDB (Dexie)

| Tabla | Clave | Contenido |
|---|---|---|
| `events` | `id` | Todos los eventos (locales y recibidos) |
| `outbox` | `eventId` | Eventos pendientes de subir + `attempts`, `nextAttemptAt`, `lastError` |
| `quarantine` | `eventId` | Eventos rechazados por el servidor (4xx de validación) |
| `syncState` | singleton | `cursor` (último `seq`), `lastSuccessAt`, `lastError`, `status` |
| `meta` | clave | `deviceId`, `contentHash`, `dbVersion` |
| proyecciones | varias | `cardStates`, `masteryByObjective`, `lessonProgress`, `dailyTotals`, `settings` |

- Crear un evento y su entrada en `outbox` ocurre en **una sola transacción**.
- Las proyecciones se actualizan incrementalmente; `rebuildProjections()` las recalcula
  desde `events` (tras migraciones o importaciones grandes).
- Al arrancar se llama a `navigator.storage.persist()`.
- Las migraciones de Dexie se versionan y se testean (v_n → v_n+1 con datos reales de prueba).

### Antes de iniciar sesión

Los eventos se crean con `userId: 'local'`. Al iniciar sesión por primera vez se
reasignan al `auth.uid()` en una transacción local antes de subir nada. Si en un
dispositivo se inicia sesión con una cuenta distinta a la de eventos ya subidos, la app
pide confirmación y no mezcla datos.

## Motor de sincronización (`src/sync`)

### Disparadores

Arranque, evento `online`, `visibilitychange` a visible, 3 s después de la última escritura
(debounce) y cada 5 minutos mientras la app esté abierta.

### Exclusión

`navigator.locks.request('learningbasics-sync', ...)` garantiza un único ciclo activo entre
pestañas del mismo navegador. Dentro de una pestaña, una bandera evita ciclos solapados.

### Ciclo

```
1. si no hay sesión válida → estado 'signed-out', fin
2. PUSH: mientras haya outbox elegible (nextAttemptAt <= ahora):
     lote = 200 más antiguos
     upsert en `events` con onConflict 'id', ignoreDuplicates
     éxito → borrar esos eventId de outbox (una transacción)
     fallo → clasificar (ver tabla) y salir del bucle
3. PULL: select events where seq > cursor - MARGEN order by seq limit 1000 (paginado)
     insertar en local los que no existan; actualizar proyecciones
     cursor = máximo seq recibido
4. syncState.lastSuccessAt = ahora
```

- **Idempotencia del push**: el `id` existe antes del primer intento; reenviar un lote ya
  aceptado no crea duplicados.
- **Margen del pull** (`MARGEN = 500`): `seq` lo asigna una secuencia de Postgres, pero
  las transacciones pueden confirmarse fuera de orden. Releer un solape y deduplicar por
  `id` evita perder eventos sin coordinación adicional.

### Clasificación de errores

| Error | Acción | Estado visible |
|---|---|---|
| Sin red / timeout / 5xx / 429 | Backoff exponencial con jitter: 2 s, 4 s, … máx. 5 min | "Sin conexión" o "Reintentando…" |
| 401 / sesión caducada | Pausar sync; pedir iniciar sesión | "Inicia sesión para sincronizar" |
| 4xx de validación / constraint | Mover el evento a `quarantine`; seguir con el resto | "1 cambio no se pudo sincronizar · Ver" |
| Error inesperado del cliente | Registrar en `syncState.lastError`; reintentar con backoff | "Error de sincronización · Reintentar" |

Los fallos parciales son seguros: cada lote es atómico en el servidor y el outbox se
limpia solo después del éxito. Un corte entre ambos solo provoca un reenvío idempotente.

## Resolución de conflictos

| Entidad | Regla |
|---|---|
| Intentos, sesiones, lecciones | Sin conflicto: unión de eventos |
| Repasos FSRS | Los repasos de todos los dispositivos se ordenan por `(reviewedAt, id)` y se reproducen en el scheduler. El estado de la tarjeta nunca se sincroniza |
| Ajustes | Last-writer-wins **por clave**, ordenado por `(clientCreatedAt, deviceId)` |
| Correcciones | Evento `void`; las proyecciones ignoran el evento anulado |

**Limitación conocida**: con relojes muy desfasados entre dispositivos, el orden de dos
ajustes cambiados casi a la vez puede no ser el esperado. Impacto bajo y documentado.

## Exportación e importación

```json
{
  "format": "learningbasics-export",
  "version": 1,
  "exportedAt": "2026-10-27T10:00:00Z",
  "events": [ ... ]
}
```

- **Exportar**: todos los eventos (incluidos `quarantine` y `outbox`).
- **Importar**:
  1. Validar con Zod (formato, versión, cada evento).
  2. Mostrar vista previa: eventos nuevos, ya existentes, inválidos.
  3. Crear automáticamente una exportación previa.
  4. Unir por `id` y encolar los nuevos en `outbox`.
  5. Reconstruir proyecciones.
- Importar nunca borra datos. Reimportar el mismo archivo no cambia nada.

## Crecimiento a largo plazo

Estimación: ~100–200 eventos/día → decenas de MB en 5 años. Mitigación prevista si hace
falta (fuera del alcance inicial): eventos `snapshot` periódicos de proyecciones para
acelerar la primera sincronización de un dispositivo nuevo.

## Tests requeridos (Fase 3)

- Offline → online sube todo el outbox exactamente una vez.
- Reintento tras fallo a mitad de lote no duplica.
- Dos dispositivos simulados con repasos concurrentes convergen al mismo estado.
- Pull con transacciones fuera de orden (simulado) no pierde eventos.
- Evento rechazado va a cuarentena y no bloquea el resto.
- Importación: idempotente, nunca borra, rechaza archivos inválidos.
