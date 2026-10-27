# LearningBasics

Plataforma personal de aprendizaje: lecciones, ejercicios con corrección automática,
flashcards con repetición espaciada (FSRS) y un plan diario de 60 minutos.
Funciona sin conexión y sincroniza el progreso entre dispositivos.

- **Web**: https://josepcru.github.io/LearningBasics/ *(disponible desde la Fase 1)*
- **Primera asignatura**: Química. Después: Física, Inglés, Chino mandarín, Programación.

## Estado

**Fase 0 completada**: arquitectura y especificación. Aún no hay código de aplicación.
Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, capas, estructura de carpetas, pipeline de contenido |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registro de decisiones |
| [docs/SYNC.md](docs/SYNC.md) | Persistencia local y sincronización |
| [docs/SECURITY.md](docs/SECURITY.md) | Supabase, RLS, claves públicas y secretas |
| [docs/MASTERY.md](docs/MASTERY.md) | Cómo se estima el dominio |
| [docs/PLANNER.md](docs/PLANNER.md) | Cómo se construye el plan diario |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases y criterios de aceptación |
| [content/CONTENT_GUIDE.md](content/CONTENT_GUIDE.md) | Cómo escribir y validar contenido |

## Puesta en marcha

*Se completará en la Fase 1* (requisitos, `npm install`, `npm run dev`,
`npm run validate-content`, `npm test`, `npm run build`).

## Despliegue

*Se completará en las Fases 1 y 3* (GitHub Pages con Actions; configuración de Supabase).

## Privacidad

El repositorio es público y contiene solo código y contenido educativo. El progreso
personal vive en tu navegador (IndexedDB) y en tu proyecto Supabase, protegido por
Row Level Security. Nunca se commitean credenciales ni progreso.
