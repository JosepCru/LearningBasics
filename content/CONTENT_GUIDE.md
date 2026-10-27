# Guía de contenido

Todo el contenido educativo vive en `content/` y se versiona en Git. Añadir asignaturas,
unidades, temas, lecciones, ejercicios o flashcards **no requiere tocar código** salvo que
necesites un tipo de interacción nuevo.

> Estado: especificación (Fase 0). Los esquemas se implementan en `src/core/content` en la
> Fase 1; si algo difiere, el código Zod manda y esta guía se actualiza.

## Índice

1. [Jerarquía y estructura de carpetas](#1-jerarquía-y-estructura-de-carpetas)
2. [Identificadores](#2-identificadores)
3. [Esquemas por tipo de contenido](#3-esquemas-por-tipo-de-contenido)
4. [Cómo añadir cada elemento](#4-cómo-añadir-cada-elemento)
5. [Validar el contenido](#5-validar-el-contenido)
6. [Respuestas numéricas y su verificación](#6-respuestas-numéricas-y-su-verificación)
7. [Fuentes, citas y procedencia](#7-fuentes-citas-y-procedencia)
8. [No romper contenido existente](#8-no-romper-contenido-existente)
9. [Estilo de redacción](#9-estilo-de-redacción)

---

## 1. Jerarquía y estructura de carpetas

```
Asignatura → Unidad → Tema → Lección / Ejercicio / Flashcard
```

```
content/
├─ CONTENT_GUIDE.md
├─ sources.yaml                         # bibliografía global
├─ ids.lock.json                        # IDs publicados (lo gestiona el validador)
└─ chemistry/
   ├─ subject.yaml
   └─ units/
      └─ 01-foundations/
         ├─ unit.yaml
         └─ topics/
            └─ 01-matter-atoms/
               ├─ topic.yaml
               ├─ lessons/
               │  ├─ 01-matter.md
               │  └─ 02-atoms.md
               ├─ exercises.yaml
               ├─ flashcards.yaml
               └─ assets/
                  └─ isotopes.svg
```

- Los prefijos numéricos de carpetas (`01-`) solo fijan el **orden**; no forman parte del ID.
- `exercises.yaml` y `flashcards.yaml` son opcionales.

## 2. Identificadores

- Formato: minúsculas, dígitos y guiones, separados por puntos.
  - Asignatura: `chem`
  - Tema: `chem.mole`
  - Objetivo: `chem.mole.o2`
  - Lección: `chem.mole.l2`
  - Ejercicio: `chem.mole.ex03`
  - Flashcard: `chem.mole.fc01`
- Se escriben **explícitamente** en cada archivo; nunca se derivan de la ruta. Puedes mover
  o renombrar carpetas sin perder progreso.
- Son **permanentes**: tu historial se guarda por ID. Ver [§8](#8-no-romper-contenido-existente).
- Los temas tienen ID único global (`chem.mole`), no anidado por unidad, para poder
  reorganizar unidades sin romper nada.

## 3. Esquemas por tipo de contenido

Convenciones: campos obligatorios en **negrita**. Los campos desconocidos son **error**
(modo estricto). Texto con `md` admite Markdown + KaTeX + mhchem.

### 3.1 `subject.yaml`

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem` |
| **title** | string | "Química" |
| **order** | int | Orden en la lista de asignaturas |
| description | string | Una o dos frases |
| **language** | `es` \| `en` \| `zh` … | Idioma principal del contenido |

### 3.2 `unit.yaml`

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem.u1` |
| **title** | string | |
| description | string | |

### 3.3 `topic.yaml`

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem.mole` |
| **title** | string | |
| **objectives** | lista de `{id, text}` | Objetivos de aprendizaje, observables ("Calcular…", "Distinguir…") |
| prerequisites | lista de IDs de tema | Deben existir; sin ciclos |
| estimatedMinutes | int | Tiempo total orientativo |
| description | string | |

```yaml
id: chem.mole
title: El mol, la masa molar y la constante de Avogadro
prerequisites: [chem.matter-atoms, chem.units]
estimatedMinutes: 45
objectives:
  - id: chem.mole.o1
    text: Relacionar cantidad de sustancia (mol) y número de entidades usando N_A.
  - id: chem.mole.o2
    text: Calcular la masa molar de un compuesto a partir de su fórmula.
```

### 3.4 Lección (`lessons/*.md`)

Frontmatter YAML + cuerpo Markdown.

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem.mole.l2` |
| **title** | string | |
| **objectives** | lista de IDs de objetivo | Del mismo tema |
| **estimatedMinutes** | int | 5–15 recomendado |
| **sources** | lista de `{ref, locator}` | `ref` existe en `sources.yaml`; `locator` = capítulo/sección/página |
| **provenance** | `ai-drafted` \| `self-reviewed` \| `verified` | Ver [§7](#7-fuentes-citas-y-procedencia) |
| **revision** | int ≥ 1 | Se incrementa con cambios de significado |

Cuerpo:

- Markdown con tablas (GFM).
- Matemáticas: `$...$` en línea, `$$...$$` en bloque.
- Química: `$\ce{H2SO4}$`, `$\ce{Na+}$`, `$\ce{2H2 + O2 -> 2H2O}$` (mhchem).
- Imágenes: `![texto alternativo obligatorio](../assets/isotopes.svg)`.
- Bloques especiales:

```markdown
:::worked-example Masa molar del agua
1. Identifica los átomos: 2 H y 1 O.
2. $M = 2(1.008) + 16.00 = 18.02\ \text{g/mol}$
:::

:::note
La masa molar tiene el mismo valor numérico que la masa fórmula en u.
:::
```

Estructura recomendada: objetivo → idea central → ejemplo resuelto → errores frecuentes
→ resumen de 2–3 líneas.

### 3.5 Ejercicios (`exercises.yaml`)

Campos comunes:

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem.mole.ex03` |
| **type** | `multiple-choice` \| `numeric` \| `short-text` | |
| **objective** | ID de objetivo | Del mismo tema |
| **difficulty** | int 1–5 | 1 = recordar, 3 = aplicar, 5 = problema de varios pasos |
| **revision** | int ≥ 1 | |
| **prompt** | md | Enunciado |
| **explanation** | md | Por qué la respuesta es correcta |
| hints | lista de md | Progresivas: de orientación general a casi la solución |
| solution | md | Solución desarrollada; se muestra tras un intento |
| tags | lista de string | Temas transversales |
| retired / retiredReason | bool / string | Ver [§8](#8-no-romper-contenido-existente). También válido en lecciones y flashcards |

#### `multiple-choice`

| Campo | Tipo | Descripción |
|---|---|---|
| **options** | lista de `{id, text, correct?, misconception?, feedback?}` | 2–6 opciones, exactamente una `correct: true` |
| shuffle | bool | Por defecto `true` |

`misconception` etiqueta el error conceptual que delata un distractor; alimenta
"Errores recientes" y la detección de temas débiles.

```yaml
- id: chem.matter-atoms.ex02
  type: multiple-choice
  objective: chem.matter-atoms.o3
  difficulty: 1
  revision: 1
  prompt: "¿Cuál de estas especies es un anión?"
  options:
    - { id: a, text: "$\\ce{Na+}$", misconception: charge-sign }
    - { id: b, text: "$\\ce{Cl-}$", correct: true }
    - { id: c, text: "$\\ce{Ne}$",  misconception: neutral-as-ion }
  explanation: "Un anión tiene carga negativa: ha ganado electrones."
```

#### `numeric`

| Campo | Tipo | Descripción |
|---|---|---|
| **answer.value** | número | Valor de referencia |
| answer.unit | string | Unidad esperada (registro de unidades); omitir si es adimensional |
| **answer.tolerance** | `{relative}` o `{absolute}` | P. ej. `{ relative: 0.005 }` = ±0,5 % |
| answer.acceptEquivalentUnits | bool | Por defecto `true`: `0.04401 kg/mol` vale por `44.01 g/mol` |
| answer.requireUnit | bool | Por defecto `true` si hay `unit` |
| **verify** | string | Expresión de verificación independiente (ver [§6](#6-respuestas-numéricas-y-su-verificación)) |

```yaml
- id: chem.mole.ex03
  type: numeric
  objective: chem.mole.o2
  difficulty: 2
  revision: 1
  prompt: "Calcula la masa molar del $\\ce{CO2}$."
  answer:
    value: 44.01
    unit: g/mol
    tolerance: { relative: 0.005 }
  verify: "molarMass('CO2')"
  hints:
    - "Suma las masas atómicas de cada átomo de la fórmula."
    - "C ≈ 12.01 g/mol; O ≈ 16.00 g/mol; hay dos átomos de O."
  solution: "$12.01 + 2(16.00) = 44.01\\ \\text{g/mol}$"
  explanation: "La masa molar es la suma de las masas atómicas multiplicadas por sus subíndices."
```

#### `short-text`

| Campo | Tipo | Descripción |
|---|---|---|
| **accept** | lista de string | Respuestas aceptadas |
| normalize | `{case, accents, whitespace}` | Por defecto los tres `true` |
| allowSelfGrade | bool | Si no coincide, mostrar la respuesta modelo y permitir "Era correcta" |

**Limitaciones explícitas**: compara texto normalizado, no entiende sinónimos, paráfrasis
ni errores tipográficos. Úsalo para respuestas de una o pocas palabras con formas
cerradas (nombres, símbolos). Enumera variantes válidas en `accept`. Las autoevaluaciones
se registran como tales y pesan menos en el dominio.

### 3.6 Flashcards (`flashcards.yaml`)

| Campo | Tipo | Descripción |
|---|---|---|
| **id** | string | `chem.mole.fc01` |
| **objective** | ID de objetivo | |
| **front** | md | Pregunta / pista de recuerdo |
| **back** | md | Respuesta |
| revision | int | Por defecto 1 |

```yaml
- id: chem.mole.fc01
  objective: chem.mole.o1
  front: "Valor de la constante de Avogadro"
  back: "$N_A = 6.02214076\\times10^{23}\\ \\text{mol}^{-1}$ (exacto desde 2019)"
```

Una flashcard = un hecho. Formula el anverso como pregunta de recuerdo activo, no como
frase para releer.

### 3.7 `sources.yaml`

| Campo | Tipo |
|---|---|
| **id** | string (`openstax-chem2e`) |
| **title** | string |
| **authors** | lista |
| **publisher** | string |
| **year** | int |
| **url** | URL |
| license | string |

## 4. Cómo añadir cada elemento

En todos los casos termina con `npm run validate-content`.

**Asignatura**
1. Crea `content/<carpeta>/subject.yaml` con un `id` nuevo.
2. Crea al menos una unidad con un tema.

**Unidad**
1. Crea `content/<asignatura>/units/NN-nombre/unit.yaml`.

**Tema**
1. Crea `topics/NN-nombre/topic.yaml` con objetivos y prerrequisitos.
2. Añade al menos una lección.

**Lección**
1. Crea `lessons/NN-nombre.md` con frontmatter completo.
2. Cita fuentes con `locator` concreto.
3. Marca `provenance` con honestidad.

**Ejercicio**
1. Añade una entrada a `exercises.yaml` con un `id` nuevo (no reutilices IDs retirados).
2. Si es numérico, escribe `verify`.
3. Escribe al menos una pista y la explicación.

**Flashcard**
1. Añade una entrada a `flashcards.yaml`.

**Imagen**
1. Guárdala en `assets/` (SVG o PNG/WebP optimizado, < 200 KB).
2. Referénciala con texto alternativo descriptivo.

## 5. Validar el contenido

```bash
npm run validate-content
```

Comprueba:

| Comprobación | Nivel |
|---|---|
| Esquema Zod estricto de cada archivo | Error |
| IDs únicos y con formato válido | Error |
| Prerrequisitos, objetivos, `sources.ref` e imágenes existen | Error |
| Sin ciclos en prerrequisitos | Error |
| IDs de `ids.lock.json` siguen existiendo o están retirados | Error |
| `verify` coincide con `answer.value` dentro de la tolerancia | Error |
| Unidades conocidas | Error |
| Imágenes con `alt` | Error |
| Exactamente una opción correcta en multiple-choice | Error |
| Lecciones `ai-drafted` | Aviso (listadas) |
| Ejercicios numéricos con `verify` trivial (solo un número) | Aviso |

CI ejecuta el mismo comando; si falla, no se despliega.

## 6. Respuestas numéricas y su verificación

**Objetivo**: no depender de una única fuente para la clave de respuesta (ni humana ni
generada por IA).

`verify` es una expresión que el validador evalúa con un intérprete propio. Admite:

- Números, `+ - * / ^`, paréntesis.
- `molarMass('fórmula')`: masa molar calculada con un parser de fórmulas y la tabla de
  pesos atómicos estándar (IUPAC) de `scripts/chem/`, en g/mol. Acepta paréntesis e
  hidratos sencillos: `Ca(OH)2`, `CuSO4·5H2O`.
- `atomicMass('Símbolo')`.
- Constantes: `NA` (6.02214076e23 mol⁻¹, exacta).
- `convert(valor, 'unidadOrigen', 'unidadDestino')`.

Ejemplos:

```yaml
verify: "molarMass('CO2')"                       # masa molar
verify: "10.0 / molarMass('NaCl')"               # moles en 10.0 g de NaCl
verify: "0.250 * NA"                             # entidades en 0.250 mol
verify: "convert(2.5, 'km', 'm')"                # conversión
```

Reglas:

- `verify` debe **calcular**, no copiar el número de `answer.value`.
- Para problemas de varios pasos, encadena la expresión completa.
- **Tolerancia**: usa `relative` para magnitudes calculadas (0.5 %–1 % cubre redondeos de
  masas atómicas); `absolute` solo cuando el valor puede ser 0 o el redondeo es fijo.
- Si la tolerancia depende de cifras significativas, indícalo en el enunciado
  ("con 3 cifras significativas").
- Si un problema no puede expresarse en `verify`, añade un test en
  `scripts/chem/verify.test.ts` con el cálculo independiente y una nota en el ejercicio.

## 7. Fuentes, citas y procedencia

- Toda lección cita al menos una fuente de `sources.yaml` con un `locator` concreto
  (capítulo y sección). **Comprueba la sección en la fuente** antes de citarla; no la
  copies de memoria ni de una respuesta de IA.
- No inventes citas. Si no encuentras la fuente de una afirmación, reescríbela o elimínala.
- Fuentes preferentes: OpenStax (CC BY 4.0), IUPAC (pesos atómicos, nomenclatura),
  NIST/CODATA (constantes), BIPM (SI).
- Respeta licencias: con CC BY puedes adaptar citando; no copies párrafos largos de fuentes
  sin licencia abierta.

Campo `provenance`:

| Valor | Significado | La app muestra |
|---|---|---|
| `ai-drafted` | Redactado o generado con IA, sin revisión humana | "Borrador — no verificado" |
| `self-reviewed` | Revisado por ti contra la fuente citada | "Revisado" |
| `verified` | Revisado por una persona con dominio de la materia | — |

Ningún contenido generado por IA se marca como `verified` automáticamente.

## 8. No romper contenido existente

Tu progreso se guarda por ID. Por eso:

- **Nunca reutilices** un ID para otro contenido.
- **No borres** un elemento con ID publicado: márcalo como retirado:

  ```yaml
  - id: chem.mole.ex07
    retired: true
    retiredReason: "Enunciado ambiguo; sustituido por ex11"
  ```

  Los elementos retirados no se muestran, pero el historial sigue siendo válido.
- **Corregir una errata** de redacción: edita sin cambiar `revision`.
- **Cambiar la respuesta o el significado**: incrementa `revision`. Los intentos antiguos
  dejan de contar para el dominio, pero se conservan.
- `ids.lock.json` lo actualiza el validador con `npm run validate-content -- --update-lock`;
  commitéalo junto al contenido nuevo.

## 9. Estilo de redacción

- Calidad antes que cantidad: una lección corta y correcta vale más que tres largas.
- Español neutro, terminología IUPAC en español. Primera mención de un término clave en
  **negrita** con su equivalente en inglés entre paréntesis cuando ayude a leer fuentes.
- Decimales con punto en fórmulas y respuestas numéricas (la app acepta coma o punto al
  responder).
- Unidades con espacio fino: `$18.02\ \text{g/mol}$`.
- Prefiere ejercicios de respuesta construida (numéricos, texto) a los de reconocimiento
  (opción múltiple) cuando el objetivo lo permita.
