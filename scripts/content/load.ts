/**
 * Lee content/ y valida cada archivo contra su esquema de autoría.
 * Los archivos inválidos se registran como `Issue` y se omiten; las comprobaciones
 * entre archivos se hacen después en validate.ts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { z } from 'zod';
import {
  Exercise,
  Flashcard,
  LessonFrontmatter,
  SourcesFile,
  SubjectFile,
  TopicFile,
  UnitFile,
  type Exercise as ExerciseT,
  type Flashcard as FlashcardT,
  type LessonFrontmatter as LessonFrontmatterT,
  type SourceEntry,
  type SubjectFile as SubjectFileT,
  type TopicFile as TopicFileT,
  type UnitFile as UnitFileT,
} from '../../src/core/content/schemas';

export type Issue = { file: string; message: string };

export type LoadedLesson = { file: string; data: LessonFrontmatterT; body: string };
export type LoadedItem<T> = { file: string; data: T };

export type LoadedTopic = {
  dir: string;
  file: string;
  data: TopicFileT;
  lessons: LoadedLesson[];
  exercises: LoadedItem<ExerciseT>[];
  flashcards: LoadedItem<FlashcardT>[];
};

export type LoadedUnit = { dir: string; file: string; data: UnitFileT; topics: LoadedTopic[] };
export type LoadedSubject = { dir: string; file: string; data: SubjectFileT; units: LoadedUnit[] };

export type ContentTree = {
  root: string;
  sources: SourceEntry[];
  subjects: LoadedSubject[];
};

export type LoadResult = { tree: ContentTree; errors: Issue[] };

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function loadContent(root: string): LoadResult {
  const errors: Issue[] = [];
  const rel = (p: string) => path.relative(process.cwd(), p).split(path.sep).join('/');

  const readYaml = (file: string): unknown => {
    try {
      return parseYaml(readFileSync(file, 'utf8'), { uniqueKeys: true });
    } catch (e) {
      const msg = e instanceof YAMLParseError ? e.message.split('\n')[0] : String(e);
      errors.push({ file: rel(file), message: `YAML inválido: ${msg}` });
      return undefined;
    }
  };

  const check = <S extends z.ZodType>(file: string, schema: S, raw: unknown, label = ''): z.infer<S> | undefined => {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      const where = [label, ...issue.path.map(String)].filter(Boolean).join('.');
      errors.push({ file: rel(file), message: `${where ? where + ': ' : ''}${issue.message}` });
    }
    return undefined;
  };

  const readList = <S extends z.ZodType>(file: string, schema: S): LoadedItem<z.infer<S>>[] => {
    if (!existsSync(file)) return [];
    const raw = readYaml(file);
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
      errors.push({ file: rel(file), message: 'Debe ser una lista YAML (cada elemento empieza por "- ")' });
      return [];
    }
    return raw.flatMap((item, i) => {
      const label = `[${i}]${item && typeof item === 'object' && 'id' in item ? ` ${String(item.id)}` : ''}`;
      const data = check(file, schema, item, label);
      return data === undefined ? [] : [{ file: rel(file), data }];
    });
  };

  const subdirs = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => statSync(path.join(dir, name)).isDirectory())
          .sort()
          .map((name) => path.join(dir, name))
      : [];

  const sourcesFile = path.join(root, 'sources.yaml');
  const sources = existsSync(sourcesFile) ? (check(sourcesFile, SourcesFile, readYaml(sourcesFile)) ?? []) : [];

  const subjects: LoadedSubject[] = [];
  for (const subjectDir of subdirs(root)) {
    const subjectFile = path.join(subjectDir, 'subject.yaml');
    if (!existsSync(subjectFile)) continue;
    const subject = check(subjectFile, SubjectFile, readYaml(subjectFile));
    if (!subject) continue;

    const units: LoadedUnit[] = [];
    for (const unitDir of subdirs(path.join(subjectDir, 'units'))) {
      const unitFile = path.join(unitDir, 'unit.yaml');
      if (!existsSync(unitFile)) {
        errors.push({ file: rel(unitDir), message: 'Falta unit.yaml' });
        continue;
      }
      const unit = check(unitFile, UnitFile, readYaml(unitFile));
      if (!unit) continue;

      const topics: LoadedTopic[] = [];
      for (const topicDir of subdirs(path.join(unitDir, 'topics'))) {
        const topicFile = path.join(topicDir, 'topic.yaml');
        if (!existsSync(topicFile)) {
          errors.push({ file: rel(topicDir), message: 'Falta topic.yaml' });
          continue;
        }
        const topic = check(topicFile, TopicFile, readYaml(topicFile));
        if (!topic) continue;

        const lessonsDir = path.join(topicDir, 'lessons');
        const lessons: LoadedLesson[] = [];
        const lessonFiles = existsSync(lessonsDir)
          ? readdirSync(lessonsDir).filter((f) => f.endsWith('.md')).sort()
          : [];
        for (const name of lessonFiles) {
          const file = path.join(lessonsDir, name);
          const text = readFileSync(file, 'utf8');
          const fm = FRONTMATTER_RE.exec(text);
          if (!fm) {
            errors.push({ file: rel(file), message: 'Falta el frontmatter YAML (bloque entre líneas ---)' });
            continue;
          }
          let raw: unknown;
          try {
            raw = parseYaml(fm[1]!, { uniqueKeys: true });
          } catch (e) {
            errors.push({ file: rel(file), message: `Frontmatter inválido: ${String(e).split('\n')[0]}` });
            continue;
          }
          const data = check(file, LessonFrontmatter, raw);
          if (data) lessons.push({ file: rel(file), data, body: text.slice(fm[0].length) });
        }

        topics.push({
          dir: topicDir,
          file: rel(topicFile),
          data: topic,
          lessons,
          exercises: readList(path.join(topicDir, 'exercises.yaml'), Exercise),
          flashcards: readList(path.join(topicDir, 'flashcards.yaml'), Flashcard),
        });
      }
      units.push({ dir: unitDir, file: rel(unitFile), data: unit, topics });
    }
    subjects.push({ dir: subjectDir, file: rel(subjectFile), data: subject, units });
  }

  subjects.sort((a, b) => a.data.order - b.data.order);
  return { tree: { root, sources, subjects }, errors };
}

/** Recorre todos los temas del árbol con su asignatura y unidad. */
export function* allTopics(tree: ContentTree) {
  for (const subject of tree.subjects)
    for (const unit of subject.units)
      for (const topic of unit.topics) yield { subject, unit, topic };
}
