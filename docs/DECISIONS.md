# Registro de decisiones (ADR ligero)

Cada decisión indica su estado. Para cambiar una decisión, añade una entrada nueva que la sustituya; no reescribas el historial.

| ID | Decisión | Estado | Fecha |
|---|---|---|---|
| D-001 | Arquitectura static-first: Vite + React + TypeScript en GitHub Pages; Supabase como único backend | Aprobada | 2026-10-27 |
| D-002 | Enrutado con `HashRouter` (`/LearningBasics/#/ruta`) | Aprobada (por defecto) | 2026-10-27 |
| D-003 | Contenido en YAML (metadatos, ejercicios, flashcards) + Markdown con frontmatter (lecciones) | Aprobada (por defecto) | 2026-10-27 |
| D-004 | Contenido compilado en build: validación Zod, verificación numérica y render Markdown/KaTeX/mhchem a HTML | Aprobada | 2026-10-27 |
| D-005 | Persistencia local con Dexie (IndexedDB) | Aprobada | 2026-10-27 |
| D-006 | Datos de usuario como log de eventos append-only con UUIDv7; el estado es una proyección derivada | Aprobada | 2026-10-27 |
| D-007 | Repetición espaciada con FSRS vía `ts-fsrs`, detrás de un adaptador propio | Aprobada | 2026-10-27 |
| D-008 | Autenticación por código OTP de email; registro público desactivado tras crear la cuenta del propietario | Aprobada (por defecto) | 2026-10-27 |
| D-009 | Interfaz y contenido de química en español; terminología IUPAC en español | Aprobada (por defecto) | 2026-10-27 |
| D-010 | Repositorio público (requisito de GitHub Pages gratuito). Contenido público; progreso privado en Supabase | Aprobada (por defecto) | 2026-10-27 |
| D-011 | Estilos con CSS Modules + variables CSS; sin framework CSS ni librería de componentes | Aprobada | 2026-10-27 |
| D-012 | Unidades: registro propio basado en vectores de dimensión (sin mathjs) | Aprobada | 2026-10-27 |
| D-013 | El propietario implementa algunas piezas de lógica de 5–10 líneas (dominio, planificador) con tests preparados | Aprobada (por defecto) | 2026-10-27 |
| D-014 | Tests e2e (Playwright): se decide al inicio de la Fase 5 | Pendiente | 2026-10-27 |
| D-015 | TypeScript fijado en 6.0.x (no 7.x) | Aprobada | 2026-10-27 |
| D-016 | Una sola copia de KaTeX en todo el proyecto (`overrides` en package.json) | Aprobada | 2026-10-27 |
| D-017 | Sin fuentes web: tipografías del sistema (serif para leer, sans para la interfaz, mono para datos) | Aprobada | 2026-10-27 |
| D-018 | Las directivas Markdown en línea (`:texto`) se tratan como texto normal; solo existen bloques `:::` | Aprobada | 2026-10-27 |

## Notas

- **D-002**: GitHub Pages no admite reglas de reescritura. `BrowserRouter` requiere el truco de `404.html`, que devuelve estado HTTP 404 en enlaces directos y complica la PWA. Con hash, recargar y abrir enlaces directos funciona sin configuración.
- **D-003**: YAML permite comentarios y texto multilínea (LaTeX legible). No añade dependencias porque el frontmatter ya lo necesita. Se valida en modo estricto para evitar coerciones implícitas.
- **D-006**: la unión de dos logs con IDs únicos siempre es correcta (G-Set). Sincronizar, importar y recuperar fallos se reduce a «unir por `id`».
- **D-015**: `typescript-eslint` aún no admite TypeScript ≥ 6.1. Revisar al actualizar dependencias.
- **D-016**: `rehype-katex` traía su propia KaTeX 0.16. mhchem (`\ce{}`) se registra sobre
  una instancia concreta y el CSS debe coincidir con la versión que genera el HTML; con dos
  copias, `\ce` fallaba y las versiones no cuadraban. El override también eliminó 4 avisos de
  `npm audit`.
- **D-017**: cero dependencias y nada que descargar para funcionar offline (Fase 5). Las
  lecciones usan cifras alineadas (`lining-nums`) porque Georgia usa cifras elzevirianas.
- **D-018**: con directivas en línea, «10:30» o «1:2» se interpretaban como directivas.
- **D-008**: el OTP funciona entre dispositivos y no deja tokens en el fragmento `#` de la URL, que chocaría con `HashRouter`.
