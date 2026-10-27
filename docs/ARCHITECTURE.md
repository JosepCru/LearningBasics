# Arquitectura

Plataforma personal de aprendizaje, local-first, desplegada como sitio estático en
`https://josepcru.github.io/LearningBasics/`. Ver decisiones en [DECISIONS.md](DECISIONS.md).

## Vista general

```
┌──────────────────────── Repositorio ───────────────────────────┐
│ /content (YAML + MD) ─► scripts/build-content ─► JSON tipado   │
│                          (Zod + verificación numérica)         │
│ /src (React + TS) ───────┴─► Vite build ─► GitHub Pages        │
│ GitHub Actions: validate → test → build → deploy               │
└────────────────────────────────────────────────────────────────┘
                 Navegador (cualquier dispositivo, PWA)
┌────────────────────────────────────────────────────────────────┐
│ UI (React) ── lee ──► Proyecciones (Dexie liveQuery)           │
│    └─ escribe evento ──► IndexedDB: events + outbox            │
│                             │  sync engine                     │
└─────────────────────────────┼──────────────────────────────────┘
                              ▼
            Supabase: Auth (OTP email) + Postgres `events` (RLS)
```

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Build | Vite, `base: '/LearningBasics/'` | Rápido, estándar, soporta subruta de Pages |
| UI | React + TypeScript (strict) | Requisito; tipado de extremo a extremo |
| Enrutado | `HashRouter` (react-router) | Sobrevive recargas y enlaces directos en Pages |
| Validación | Zod | Un esquema → tipo TS + validación en build y en runtime |
| Contenido | YAML + Markdown → JSON/HTML en build | Sin parser Markdown ni motor KaTeX en el cliente |
| Render matemático | remark/rehype + KaTeX + mhchem (en build) | Fórmulas químicas `\ce{H2O}` y LaTeX |
| Persistencia | Dexie | Migraciones versionadas, `useLiveQuery` |
| Repetición espaciada | `ts-fsrs` tras `core/scheduling` | Algoritmo documentado, mantenido, aislado de la UI |
| Backend | Supabase (Auth + Postgres + RLS) | Único servicio; sin servidor propio |
| PWA | `vite-plugin-pwa` (Workbox) | Instalable, precache de app y contenido |
| Tests | Vitest, fake-indexeddb, Testing Library, pgTAP | Unidades, persistencia, componentes, RLS |
| Estilos | CSS Modules + variables CSS | Temas claro/oscuro sin dependencias |

Todas las versiones quedan fijadas en `package-lock.json`.

## Estructura de carpetas

```
LearningBasics/
├─ content/                  # contenido educativo (ver content/CONTENT_GUIDE.md)
├─ src/
│  ├─ core/                  # dominio puro: sin React, Dexie ni Supabase
│  │  ├─ content/            # esquemas Zod y tipos del contenido compilado
│  │  ├─ evaluation/         # evaluadores: multiple-choice, numeric, units, short-text
│  │  ├─ scheduling/         # adaptador FSRS
│  │  ├─ mastery/            # estimación de dominio
│  │  ├─ planner/            # plan diario
│  │  └─ events/             # esquemas de eventos y proyecciones (reducers)
│  ├─ data/                  # Dexie: db, repositorios, outbox, export/import
│  ├─ sync/                  # cliente Supabase, motor de sincronización
│  ├─ features/              # dashboard, lessons, practice, review, progress, settings, auth
│  ├─ ui/                    # componentes compartidos, tema, layout
│  └─ app/                   # router, providers, main.tsx
├─ scripts/                  # build-content, validate-content, chem/ (fórmulas, pesos atómicos)
├─ supabase/                 # config.toml, migrations/, tests/ (pgTAP)
├─ docs/
└─ .github/workflows/
```

### Reglas de dependencia

```
features ─► ui, core, data, sync
sync     ─► core, data
data     ─► core
core     ─► (nada del proyecto salvo core)
scripts  ─► core  (los mismos esquemas Zod validan en build)
```

Se aplican con `eslint no-restricted-imports`. Así, evaluación, planificación, dominio
y proyecciones se testean como funciones puras, sin navegador.

## Separación de responsabilidades

| Responsabilidad | Dónde | Notas |
|---|---|---|
| Contenido educativo | `content/`, `core/content` | Inmutable en runtime; identificado por IDs estables |
| Progreso e historial | `core/events`, `data/` | Eventos append-only + proyecciones |
| Planificación SRS | `core/scheduling` | Recibe historial de repasos, devuelve estado y vencimiento |
| Evaluación | `core/evaluation` | `evaluate(exercise, response) → EvaluationResult` |
| Auth y sync | `sync/` | Nunca bloquea la UI; ver [SYNC.md](SYNC.md) |
| UI | `features/`, `ui/` | Lee proyecciones, emite eventos |
| Validación y tests | `scripts/`, `*.test.ts`, `supabase/tests` | CI bloquea el deploy si fallan |

## Pipeline de contenido

1. `scripts/build-content.ts` recorre `content/<subject>/units/*/topics/*`.
2. Parsea YAML y frontmatter; valida con los esquemas de `core/content` (modo estricto).
3. Comprueba integridad referencial, ciclos, `ids.lock.json`, unidades y `alt` de imágenes.
4. Evalúa cada expresión `verify` y la compara con `answer.value` dentro de la tolerancia.
5. Renderiza Markdown (GFM, KaTeX, mhchem, bloques `:::worked-example`) a HTML.
6. Emite `src/generated/content/manifest.json` (árbol ligero) y un JSON por tema,
   cargado bajo demanda. Incluye un hash de contenido para invalidar cachés. Las imágenes
   se copian a `public/generated/content-assets/<topicId>/`. Ambas carpetas se regeneran
   en cada build y no se versionan.

`npm run validate-content` ejecuta los pasos 1–5 sin escribir nada (salvo el lock con
`--update-lock`).

Código: `scripts/content/` (`load` → `validate` → `compile`, orquestados por `pipeline`),
`scripts/chem/` (fórmulas, pesos atómicos, intérprete de `verify`).

Como el enrutado usa hash, la ruta del documento es siempre `/LearningBasics/`; por eso las
URLs relativas de imágenes (`generated/...`) funcionan en cualquier página.

## Tipos de interacción extensibles

Los tipos de ejercicio son una unión discriminada por `type`. Añadir contenido de un tipo
existente no requiere código. Un tipo nuevo de interacción (p. ej. escritura de hanzi,
audio) toca cuatro sitios, y TypeScript señala los que falten:

1. Esquema de autoría en `src/core/content/schemas.ts` (y añadirlo a `Exercise`).
2. Tipo compilado en `src/core/content/compiled.ts` y su conversión en `scripts/content/compile.ts`.
3. Evaluador en `src/core/evaluation/` y su caso en `evaluate()` (`index.ts`).
4. Interfaz de respuesta en `src/features/practice/ExerciseCard.tsx`.

Con tres tipos, una unión con `switch` exhaustivo es más simple que un registro dinámico;
si los tipos crecen, se puede extraer un registro.

## Modelo de eventos

Ver [SYNC.md](SYNC.md) para el esquema completo. Tipos: `attempt`, `review`,
`session_segment`, `lesson`, `setting`, `void`. Proyecciones locales reconstruibles:
`cardStates`, `masteryByObjective`, `lessonProgress`, `dailyTotals`, `settings`.

## Estados de la UI

Cada vista contempla: cargando, vacío, sin conexión, error y contenido. El indicador de
sincronización es global y siempre visible.

## Documentos relacionados

- [SYNC.md](SYNC.md): persistencia local y sincronización
- [SECURITY.md](SECURITY.md): modelo de seguridad
- [MASTERY.md](MASTERY.md): estimación de dominio
- [PLANNER.md](PLANNER.md): plan diario
- [ROADMAP.md](ROADMAP.md): fases y criterios de aceptación
- [../content/CONTENT_GUIDE.md](../content/CONTENT_GUIDE.md): guía de contenido
