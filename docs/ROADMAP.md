# Hoja de ruta

Cada fase termina con: tests relevantes, build de producción, resumen de lo completado,
limitaciones conocidas, checklist de prueba manual, documentación actualizada y commit.
No se empieza una fase hasta que la anterior está probada y explicada.

| Fase | Estado |
|---|---|
| 0 — Arquitectura y especificación | ✅ Completada |
| 1 — Shell, sistema de contenido, lecciones y ejercicios de química | ✅ Completada |
| 2 — Persistencia local, historial, flashcards y progreso | ✅ Completada |
| 3 — Autenticación Supabase y sincronización | 🟡 Código completo; falta configurar Supabase y la prueba con dos dispositivos |
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
- [x] Recargar una URL profunda muestra la vista correcta (comprobado en local y en Pages).
- [x] Contenido inválido (fixtures) hace fallar la validación con mensaje claro.
- [x] Tests de tolerancia relativa/absoluta, conversión de unidades, coma decimal y unidad ausente.
- [x] Todos los `verify` del contenido pasan (28/28).
- [x] KaTeX y mhchem se ven bien en móvil (375 px) y escritorio, claro y oscuro.
- [x] El workflow solo despliega si todos los checks pasan (primer despliegue correcto el 2026-10-27).

**Limitaciones conocidas**
- El progreso no se guarda: recargar reinicia la práctica (Fase 2).
- Las flashcards están en el contenido pero aún no se muestran (Fase 2).
- Las 9 lecciones son borradores de IA sin revisar contra la fuente.
- Al cambiar `content/` con `npm run dev` en marcha, hay que reiniciarlo.
- Texto corto: solo coincidencia normalizada (sin sinónimos ni erratas).
- Sin cifras significativas en la corrección: se evalúa por tolerancia.
- Sin PWA ni modo offline todavía (Fase 5).

## Fase 2 — Persistencia, historial, flashcards y progreso

**Alcance**: Dexie con migraciones; log de eventos; proyecciones; FSRS (`ts-fsrs`);
sesión de repaso; vista de progreso por asignatura/tema/objetivo; dominio según
MASTERY.md; exportación JSON.

**Aceptación**
- [x] Recargar o cerrar la app conserva intentos, repasos y progreso (test + navegador).
- [x] `rebuildProjections()` reproduce exactamente el estado incremental.
- [x] Tests de FSRS con fechas fijas, orden de llegada indiferente y determinismo con fuzz.
- [x] Tests de dominio con los casos de MASTERY.md.
- [~] Migraciones Dexie: test de persistencia al cerrar y reabrir. El test v1 → v2 se escribirá con el primer cambio de esquema (hoy solo existe la v1).
- [x] La exportación produce un archivo válido según el esquema.

**Limitaciones conocidas**
- Un ejercicio abandonado a medias (sin pulsar «Siguiente») no se registra.
- La importación llega en la Fase 3, junto con la fusión de varios dispositivos.
- Dominio, lecciones leídas y cola de repaso se calculan en memoria desde los eventos.
- Bundle principal: 164 kB gzip (antes 92) por Dexie, Zod y ts-fsrs.
- El botón de descarga de la copia no se probó en el navegador (sí en tests unitarios).
- Límite de 10 tarjetas nuevas al día fijo hasta el plan diario (Fase 4).

## Fase 3 — Supabase y sincronización

**Alcance**: migraciones SQL; RLS; tests pgTAP; login OTP; outbox; motor de sync;
indicador de estado; cuarentena; importación con fusión.

**Aceptación**
- [ ] Tests pgTAP de RLS pasan en CI (escritos; se ejecutan en el primer push).
- [x] Tests de sync de SYNC.md pasan (servidor simulado).
- [ ] Prueba manual: dos navegadores, uno offline, convergen al reconectar (requiere el proyecto Supabase).
- [x] Ningún secreto en el bundle (`npm run check-secrets` en CI).
- [x] Importación con vista previa, copia previa automática y fusión segura.
- [x] Migración de la base local v1 → v2 con test.

**Limitaciones conocidas**
- El flujo de inicio de sesión no se ha probado contra un Supabase real todavía.
- No hay botón para desvincular un dispositivo de una cuenta.
- La importación en el navegador se probó hasta la vista previa; aplicar la importación está cubierto por tests unitarios.
- El código del correo depende de editar la plantilla «Magic Link» en Supabase (DEPLOY.md).

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
