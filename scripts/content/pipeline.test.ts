import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from './compile';
import { allTopics, loadContent, type ContentTree } from './load';
import { readLock, runPipeline } from './pipeline';
import { validateTree } from './validate';

const FIXTURES = path.join(import.meta.dirname, '__fixtures__');

function loadValid(): ContentTree {
  const { tree, errors } = loadContent(path.join(FIXTURES, 'valid'));
  expect(errors).toEqual([]);
  return tree;
}

/** Valida el árbol tras aplicarle una modificación; devuelve los mensajes de error. */
function errorsAfter(mutate: (tree: ContentTree) => void, lockedIds: string[] = []): string[] {
  const tree = structuredClone(loadValid());
  mutate(tree);
  return validateTree(tree, { lockedIds, strictLock: false }).errors.map((e) => e.message);
}

const topicA = (tree: ContentTree) => [...allTopics(tree)][0]!.topic;
const topicB = (tree: ContentTree) => [...allTopics(tree)][1]!.topic;

describe('contenido de ejemplo válido', () => {
  it('carga y valida sin errores', () => {
    const result = validateTree(loadValid(), { lockedIds: [], strictLock: false });
    expect(result.errors).toEqual([]);
    expect(result.ids).toContain('demo.a.ex01');
  });

  it('avisa de lecciones en borrador de IA y de IDs sin registrar', () => {
    const { warnings } = validateTree(loadValid(), { lockedIds: [], strictLock: false });
    expect(warnings.map((w) => w.message).join('\n')).toMatch(/borrador de IA.*demo\.b\.l1/);
    expect(warnings.map((w) => w.message).join('\n')).toMatch(/sin registrar en ids\.lock\.json/);
  });

  it('compila: HTML con KaTeX/mhchem, bloques, imágenes y manifiesto', () => {
    const { manifest, topics, assets, errors } = compileContent(loadValid());
    expect(errors).toEqual([]);
    const lesson = topics[0]!.lessons[0]!;
    expect(lesson.html).toContain('class="katex"');
    expect(lesson.html).toContain('block-worked-example');
    expect(lesson.html).toContain('src="generated/content-assets/demo.a/dot.svg"');
    expect(assets).toHaveLength(1);
    expect(topics[1]!.lessons[0]!.html).toContain('10:30');
    expect(manifest.lessonIndex['demo.b.l1']).toBe('demo.b');
    expect(manifest.subjects[0]!.units[0]!.topics[0]!.exerciseCount).toBe(3);
    expect(manifest.contentHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('las opciones de opción múltiple se renderizan en línea (sin <p>)', () => {
    const { topics } = compileContent(loadValid());
    const mc = topics[0]!.exercises.find((e) => e.type === 'multiple-choice')!;
    expect(mc.type === 'multiple-choice' && mc.options[0]!.textHtml.startsWith('<p>')).toBe(false);
  });
});

describe('errores entre archivos', () => {
  it('ID duplicado', () => {
    expect(errorsAfter((t) => (topicA(t).flashcards[0]!.data.id = 'demo.a.ex01'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/ID duplicado "demo\.a\.ex01"/)]),
    );
  });

  it('prerrequisito inexistente', () => {
    expect(errorsAfter((t) => (topicB(t).data.prerequisites = ['demo.zzz']))).toEqual([
      expect.stringMatching(/Prerrequisito inexistente "demo\.zzz"/),
    ]);
  });

  it('ciclo de prerrequisitos', () => {
    expect(errorsAfter((t) => (topicA(t).data.prerequisites = ['demo.b']))).toEqual([
      expect.stringMatching(/Ciclo de prerrequisitos/),
    ]);
  });

  it('objetivo de otro tema', () => {
    expect(errorsAfter((t) => (topicA(t).exercises[0]!.data.objective = 'demo.b.o1'))).toEqual([
      expect.stringMatching(/no pertenece al tema demo\.a/),
    ]);
  });

  it('fuente inexistente', () => {
    expect(errorsAfter((t) => (topicA(t).lessons[0]!.data.sources[0]!.ref = 'nope'))).toEqual([
      expect.stringMatching(/Fuente "nope" no existe/),
    ]);
  });

  it('opción múltiple con dos correctas', () => {
    expect(
      errorsAfter((t) => {
        const ex = topicA(t).exercises[1]!.data;
        if (ex.type === 'multiple-choice') ex.options[0]!.correct = true;
      }),
    ).toEqual([expect.stringMatching(/exactamente una opción correcta \(hay 2\)/)]);
  });

  it('verify no coincide con la respuesta', () => {
    expect(
      errorsAfter((t) => {
        const ex = topicA(t).exercises[0]!.data;
        if (ex.type === 'numeric') ex.answer.value = 20;
      }),
    ).toEqual([expect.stringMatching(/verify da 18\.015.*answer\.value es 20/)]);
  });

  it('verify inválido y unidad desconocida', () => {
    const errors = errorsAfter((t) => {
      const ex = topicA(t).exercises[0]!.data;
      if (ex.type === 'numeric') {
        ex.verify = "molarMass('Xx')";
        ex.answer.unit = 'furlong';
      }
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unidad desconocida "furlong"/),
        expect.stringMatching(/verify no se puede evaluar.*Xx/),
      ]),
    );
  });

  it('borrar un ID publicado rompe la validación; retirarlo no', () => {
    expect(errorsAfter((t) => topicA(t).exercises.pop(), ['demo.a.ex03'])).toEqual([
      expect.stringMatching(/"demo\.a\.ex03" ha desaparecido/),
    ]);
    expect(errorsAfter((t) => (topicA(t).exercises[2]!.data.retired = true), ['demo.a.ex03'])).toEqual([]);
  });

  it('en CI los IDs sin registrar son error', () => {
    const { errors } = validateTree(loadValid(), { lockedIds: [], strictLock: true });
    expect(errors.map((e) => e.message)).toEqual([expect.stringMatching(/sin registrar/)]);
  });
});

describe('errores de render', () => {
  it('LaTeX inválido, bloque desconocido e imagen sin alt', () => {
    const tree = structuredClone(loadValid());
    topicA(tree).lessons[0]!.body = '$\\frac{1}$\n\n:::misterio\nx\n:::\n\n![](../assets/dot.svg)\n\n![x](../assets/no.svg)';
    const messages = compileContent(tree).errors.map((e) => e.message).join('\n');
    expect(messages).toMatch(/KaTeX/);
    expect(messages).toMatch(/Bloque desconocido ":::misterio"/);
    expect(messages).toMatch(/Imagen sin texto alternativo/);
    expect(messages).toMatch(/Imagen no encontrada.*no\.svg/);
  });
});

describe('errores de carga', () => {
  it('YAML mal formado y campos desconocidos', () => {
    const { errors } = loadContent(path.join(FIXTURES, 'invalid'));
    const text = errors.map((e) => `${e.file}: ${e.message}`).join('\n');
    expect(text).toMatch(/broken\/subject\.yaml: YAML inválido/);
    expect(text).toMatch(/demo\/subject\.yaml: .*colour/);
  });
});

describe('contenido real (content/)', () => {
  it('valida sin errores con el lock estricto', () => {
    const result = runPipeline({ lockedIds: readLock(), strictLock: true });
    expect(result.errors).toEqual([]);
  });
});
