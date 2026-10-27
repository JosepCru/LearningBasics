/**
 * Convierte el árbol validado en el contenido que consume la app:
 * un manifiesto ligero + un JSON por tema, con el Markdown ya renderizado.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type {
  CompiledExercise,
  CompiledLesson,
  ContentManifest,
  SubjectNode,
  TopicContent,
} from '../../src/core/content/compiled';
import { allTopics, type ContentTree, type Issue } from './load';
import { renderMarkdown } from './render';

export const ASSET_URL_PREFIX = 'generated/content-assets';

export type AssetCopy = { from: string; to: string };

export type CompileResult = {
  manifest: ContentManifest;
  topics: TopicContent[];
  assets: AssetCopy[];
  errors: Issue[];
};

export function compileContent(tree: ContentTree): CompileResult {
  const errors: Issue[] = [];
  const assets = new Map<string, AssetCopy>();
  const topics: TopicContent[] = [];
  const topicIndex: ContentManifest['topicIndex'] = {};
  const lessonIndex: ContentManifest['lessonIndex'] = {};

  for (const { subject, unit, topic } of allTopics(tree)) {
    const topicId = topic.data.id;
    const assetsDir = path.join(topic.dir, 'assets');

    /** Renderiza un campo Markdown; `baseDir` es la carpeta del archivo que lo contiene. */
    const md = (text: string, file: string, baseDir: string, owner: string, inline = false): string => {
      const result = renderMarkdown(text, {
        inline,
        resolveImage: (src) => {
          if (/^[a-z]+:/i.test(src)) return null; // solo imágenes locales
          const abs = path.resolve(baseDir, src);
          if (!abs.startsWith(assetsDir + path.sep) || !existsSync(abs)) return null;
          const url = `${ASSET_URL_PREFIX}/${topicId}/${path.basename(abs)}`;
          assets.set(url, { from: abs, to: url });
          return url;
        },
      });
      for (const p of result.problems) errors.push({ file, message: `${owner}: ${p}` });
      return result.html;
    };

    topicIndex[topicId] = { subjectId: subject.data.id, unitId: unit.data.id };

    const lessons: CompiledLesson[] = topic.lessons
      .filter((l) => !l.data.retired)
      .map(({ file, data, body }) => {
        lessonIndex[data.id] = topicId;
        return {
          id: data.id,
          title: data.title,
          objectives: data.objectives,
          estimatedMinutes: data.estimatedMinutes,
          provenance: data.provenance,
          revision: data.revision,
          sources: data.sources,
          html: md(body, file, path.join(topic.dir, 'lessons'), data.id),
        };
      });

    const exercises: CompiledExercise[] = topic.exercises
      .filter((e) => !e.data.retired)
      .map(({ file, data: ex }) => {
        const m = (text: string, inline = false) => md(text, file, topic.dir, ex.id, inline);
        const common = {
          id: ex.id,
          objective: ex.objective,
          difficulty: ex.difficulty,
          revision: ex.revision,
          promptHtml: m(ex.prompt),
          explanationHtml: m(ex.explanation),
          hintsHtml: ex.hints.map((h) => m(h)),
          ...(ex.solution ? { solutionHtml: m(ex.solution) } : {}),
          tags: ex.tags,
        };
        switch (ex.type) {
          case 'multiple-choice':
            return {
              ...common,
              type: ex.type,
              shuffle: ex.shuffle,
              options: ex.options.map((o) => ({
                id: o.id,
                textHtml: m(o.text, true),
                correct: o.correct ?? false,
                ...(o.misconception ? { misconception: o.misconception } : {}),
                ...(o.feedback ? { feedbackHtml: m(o.feedback) } : {}),
              })),
            };
          case 'numeric':
            return { ...common, type: ex.type, answer: ex.answer };
          case 'short-text':
            return {
              ...common,
              type: ex.type,
              accept: ex.accept,
              normalize: ex.normalize,
              allowSelfGrade: ex.allowSelfGrade,
            };
        }
      });

    const flashcards = topic.flashcards
      .filter((f) => !f.data.retired)
      .map(({ file, data }) => ({
        id: data.id,
        objective: data.objective,
        revision: data.revision,
        frontHtml: md(data.front, file, topic.dir, data.id, true),
        backHtml: md(data.back, file, topic.dir, data.id, true),
      }));

    const citedRefs = new Set(lessons.flatMap((l) => l.sources.map((s) => s.ref)));
    topics.push({
      id: topicId,
      lessons,
      exercises,
      flashcards,
      sources: tree.sources.filter((s) => citedRefs.has(s.id)),
    });
  }

  const contentById = new Map(topics.map((t) => [t.id, t]));
  const subjects: SubjectNode[] = tree.subjects.map((subject) => ({
    id: subject.data.id,
    title: subject.data.title,
    ...(subject.data.description ? { description: subject.data.description } : {}),
    language: subject.data.language,
    units: subject.units.map((unit) => ({
      id: unit.data.id,
      title: unit.data.title,
      ...(unit.data.description ? { description: unit.data.description } : {}),
      topics: unit.topics.map((topic) => {
        const content = contentById.get(topic.data.id)!;
        return {
          id: topic.data.id,
          title: topic.data.title,
          ...(topic.data.description ? { description: topic.data.description } : {}),
          prerequisites: topic.data.prerequisites,
          ...(topic.data.estimatedMinutes ? { estimatedMinutes: topic.data.estimatedMinutes } : {}),
          objectives: topic.data.objectives,
          lessons: content.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            estimatedMinutes: l.estimatedMinutes,
            provenance: l.provenance,
          })),
          exerciseCount: content.exercises.length,
          flashcardCount: content.flashcards.length,
        };
      }),
    })),
  }));

  return {
    manifest: { contentHash: hashDirectory(tree.root), subjects, topicIndex, lessonIndex },
    topics,
    assets: [...assets.values()],
    errors,
  };
}

/** Hash estable del contenido (rutas relativas + bytes), independiente del SO. */
export function hashDirectory(root: string): string {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else {
        hash.update(path.relative(root, abs).split(path.sep).join('/'));
        hash.update(readFileSync(abs));
      }
    }
  };
  walk(root);
  return hash.digest('hex').slice(0, 16);
}
