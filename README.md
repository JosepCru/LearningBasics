# LearningBasics

Plataforma personal de aprendizaje: lecciones, ejercicios con corrección automática,
flashcards con repetición espaciada (FSRS) y un plan diario de 60 minutos.
Funcionará sin conexión y sincronizará el progreso entre dispositivos.

- **Web**: https://josepcru.github.io/LearningBasics/
- **Primera asignatura**: Química. Después: Física, Inglés, Chino mandarín, Programación.

## Estado

**Fase 1 completada**: aplicación web, sistema de contenido, lecciones y ejercicios de
química (3 temas, 9 lecciones, 28 ejercicios, 20 flashcards). El progreso **todavía no se
guarda**; llega en la Fase 2. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Puesta en marcha (desarrollo local)

Requisitos: [Node.js](https://nodejs.org/) 24.15 o superior (LTS) y Git.

```bash
git clone https://github.com/JosepCru/LearningBasics.git
cd LearningBasics
npm install
npm run dev
```

Abre http://localhost:5173/LearningBasics/ en el navegador. Los cambios en `src/` se ven al
instante; si cambias `content/`, para y vuelve a lanzar `npm run dev` (el contenido se
compila al arrancar).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila el contenido y arranca el servidor de desarrollo |
| `npm run validate-content` | Valida `content/` (esquemas, referencias, respuestas numéricas, IDs) |
| `npm run validate-content -- --update-lock` | Igual, y registra los IDs nuevos en `content/ids.lock.json` |
| `npm test` | Ejecuta todos los tests (Vitest) |
| `npm run lint` | Revisa el código con ESLint (incluidas las reglas entre capas) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` en local para probar el build |

## Añadir contenido

Lee [content/CONTENT_GUIDE.md](content/CONTENT_GUIDE.md). Resumen del flujo:

1. Edita o crea archivos en `content/`.
2. `npm run validate-content` hasta que no haya errores.
3. Si añadiste elementos nuevos: `npm run validate-content -- --update-lock`.
4. Commit de `content/` **y** de `content/ids.lock.json`.

## Despliegue en GitHub Pages

El despliegue es automático con GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)):
en cada push a `main` se valida el contenido, se pasan lint, tipos y tests, se compila y,
**solo si todo pasa**, se publica.

Configuración inicial (una sola vez):

1. En GitHub, abre el repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Haz push a `main`. El progreso se ve en la pestaña **Actions**; al terminar, la web
   queda en https://josepcru.github.io/LearningBasics/.

En los pull requests se ejecutan las mismas comprobaciones, pero no se despliega.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, capas, estructura de carpetas, pipeline de contenido |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registro de decisiones |
| [docs/SYNC.md](docs/SYNC.md) | Persistencia local y sincronización (Fases 2–3) |
| [docs/SECURITY.md](docs/SECURITY.md) | Supabase, RLS, claves públicas y secretas |
| [docs/MASTERY.md](docs/MASTERY.md) | Cómo se estimará el dominio |
| [docs/PLANNER.md](docs/PLANNER.md) | Cómo se construirá el plan diario |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases, criterios de aceptación y limitaciones |
| [content/CONTENT_GUIDE.md](content/CONTENT_GUIDE.md) | Cómo escribir y validar contenido |

## Sobre el contenido

Las lecciones actuales están **redactadas con ayuda de IA y no verificadas**: la app lo
indica con la etiqueta «Borrador — no verificado». Las respuestas numéricas sí se comprueban
automáticamente con cálculos independientes (masas molares desde pesos atómicos IUPAC,
conversiones de unidades). Fuente principal: OpenStax *Chemistry 2e* (CC BY-NC-SA 4.0).

## Privacidad

El repositorio es público y contiene solo código y contenido educativo. El progreso
personal vivirá en tu navegador (IndexedDB) y en tu proyecto Supabase, protegido por
Row Level Security. Nunca se commitean credenciales ni progreso.
