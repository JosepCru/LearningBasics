# Hoja de ruta

Cada fase termina con: tests relevantes, build de producción, resumen de lo completado,
limitaciones conocidas, checklist de prueba manual, documentación actualizada y commit.
No se empieza una fase hasta que la anterior está probada y explicada.

| Fase | Estado |
|---|---|
| 0 — Arquitectura y especificación | ✅ Completada |
| 1 — Shell, sistema de contenido, lecciones y ejercicios de química | Pendiente |
| 2 — Persistencia local, historial, flashcards y progreso | Pendiente |
| 3 — Autenticación Supabase y sincronización | Pendiente |
| 4 — Dashboard diario, plan de estudio y temporizador | Pendiente |
| 5 — PWA, offline, backup/restore, accesibilidad y endurecimiento | Pendiente |

## Fase 0 — Arquitectura y especificación

**Entregables**: `docs/` (ARCHITECTURE, DECISIONS, SYNC, SECURITY, MASTERY, PLANNER,
ROADMAP), `content/CONTENT_GUIDE.md`, README inicial, `.gitignore`.

**Aceptación**: propuesta revisada y aprobada por el propietario.

## Fase 1 — Shell, contenido, lecciones y ejercicios

**Alcance**
- Proyecto Vite + React + TypeScript strict, ESLint con reglas de dependencia entre capas.
- `HashRouter`; layout responsive; tema claro/oscuro (preferencia del sistema + manual).
- Esquemas Zod en `core/content`; `scripts/build-content` y `validate-content`.
- Intérprete de `verify`, parser de fórmulas y tabla de pesos atómicos.
- Registro de unidades y evaluadores: multiple-choice, numérico, unidades, texto corto.
- Lecciones con KaTeX + mhchem, ejemplos resueltos, objetivos, prerrequisitos y fuentes.
- Pistas progresivas; solución tras el primer intento.
- Contenido: T1 (materia, átomos, iones), T4 (unidades y razonamiento cuantitativo),
  T5 (mol, masa molar, Avogadro); ~8 ejercicios y 6–8 flashcards por tema (las flashcards
  se muestran a partir de la Fase 2).
- GitHub Actions: typecheck, lint, validate-content, tests, build, deploy a Pages.

**Aceptación**
- [ ] Recargar una URL profunda en Pages muestra la vista correcta.
- [ ] Un contenido inválido de ejemplo (fixture) hace fallar `validate-content` con mensaje claro.
- [ ] Tests de tolerancia relativa/absoluta, conversión de unidades, coma decimal y unidad ausente.
- [ ] Todos los `verify` del contenido pasan.
- [ ] KaTeX y mhchem se ven bien en móvil y escritorio, claro y oscuro.
- [ ] El deploy solo ocurre si todos los checks pasan.

## Fase 2 — Persistencia, historial, flashcards y progreso

**Alcance**: Dexie con migraciones; log de eventos; proyecciones; FSRS (`ts-fsrs`);
sesión de repaso; vista de progreso por asignatura/tema/objetivo; dominio según
MASTERY.md; exportación JSON.

**Aceptación**
- [ ] Recargar o cerrar la app conserva intentos, repasos y progreso.
- [ ] `rebuildProjections()` reproduce exactamente el estado incremental.
- [ ] Tests de FSRS con fechas fijas (adaptador).
- [ ] Tests de dominio con los casos de MASTERY.md.
- [ ] Test de migración Dexie con datos de ejemplo.
- [ ] La exportación produce un archivo válido según el esquema.

## Fase 3 — Supabase y sincronización

**Alcance**: migraciones SQL; RLS; tests pgTAP; login OTP; outbox; motor de sync;
indicador de estado; cuarentena; importación con fusión.

**Aceptación**
- [ ] Tests pgTAP de RLS pasan en CI.
- [ ] Tests de sync de SYNC.md pasan.
- [ ] Prueba manual: dos navegadores, uno offline, convergen al reconectar.
- [ ] Ningún secreto en el bundle (comprobación en CI).

## Fase 4 — Dashboard, plan diario y temporizador

**Alcance**: plan diario (PLANNER.md); dashboard con plan, tiempo estudiado, repasos
vencidos, lección recomendada, temas débiles, errores recientes, progreso y estado de
sincronización; temporizador por tiempo activo.

**Aceptación**
- [ ] Tests del planificador de PLANNER.md.
- [ ] El tiempo estudiado excluye pestaña oculta e inactividad.
- [ ] Todos los estados (vacío, cargando, offline, error) del dashboard visibles.

## Fase 5 — PWA, offline y endurecimiento

**Alcance**: `vite-plugin-pwa`; aviso de nueva versión; offline completo; flujo de
backup/restore; auditoría de accesibilidad (axe + teclado); CSP; decisión sobre e2e.

**Aceptación**
- [ ] Instalable en Android, iOS y escritorio.
- [ ] Funciona en modo avión tras la primera carga.
- [ ] Navegación completa con teclado; sin violaciones axe graves.
- [ ] Restaurar un backup en un navegador limpio recupera todo el progreso.
