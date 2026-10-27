/**
 * Contenido COMPILADO: lo que emite scripts/build-content y consume la app.
 * Los campos Markdown ya vienen renderizados a HTML (KaTeX + mhchem incluidos).
 * Los elementos retirados no aparecen aquí.
 */
import type {
  NumericAnswer,
  Objective,
  Provenance,
  SourceEntry,
  SourceRef,
  TextNormalization,
} from './schemas';

export type LessonSummary = {
  id: string;
  title: string;
  estimatedMinutes: number;
  provenance: Provenance;
  objectives: string[];
};

/** Datos mínimos de un ejercicio o tarjeta para progreso y planificación. */
export type ItemRef = { topicId: string; objective: string; revision: number };

export type TopicSummary = {
  id: string;
  title: string;
  description?: string;
  prerequisites: string[];
  estimatedMinutes?: number;
  objectives: Objective[];
  lessons: LessonSummary[];
  exerciseCount: number;
  flashcardCount: number;
};

export type UnitNode = { id: string; title: string; description?: string; topics: TopicSummary[] };

export type SubjectNode = {
  id: string;
  title: string;
  description?: string;
  language: string;
  units: UnitNode[];
};

export type ContentManifest = {
  contentHash: string;
  subjects: SubjectNode[];
  /** topicId → ubicación */
  topicIndex: Record<string, { subjectId: string; unitId: string }>;
  /** lessonId → topicId */
  lessonIndex: Record<string, string>;
  /** Ejercicios activos, en orden del currículo. */
  exerciseIndex: Record<string, ItemRef>;
  /** Flashcards activas, en orden del currículo. */
  flashcardIndex: Record<string, ItemRef>;
};

export type CompiledLesson = {
  id: string;
  title: string;
  objectives: string[];
  estimatedMinutes: number;
  provenance: Provenance;
  revision: number;
  sources: SourceRef[];
  html: string;
};

type CompiledExerciseCommon = {
  id: string;
  objective: string;
  difficulty: number;
  revision: number;
  promptHtml: string;
  explanationHtml: string;
  hintsHtml: string[];
  solutionHtml?: string;
  tags: string[];
};

export type CompiledChoiceOption = {
  id: string;
  textHtml: string;
  correct: boolean;
  misconception?: string;
  feedbackHtml?: string;
};

export type CompiledMultipleChoice = CompiledExerciseCommon & {
  type: 'multiple-choice';
  options: CompiledChoiceOption[];
  shuffle: boolean;
};

export type CompiledNumeric = CompiledExerciseCommon & {
  type: 'numeric';
  answer: NumericAnswer;
};

export type CompiledShortText = CompiledExerciseCommon & {
  type: 'short-text';
  accept: string[];
  normalize: TextNormalization;
  allowSelfGrade: boolean;
};

export type CompiledExercise = CompiledMultipleChoice | CompiledNumeric | CompiledShortText;

export type CompiledFlashcard = {
  id: string;
  objective: string;
  revision: number;
  frontHtml: string;
  backHtml: string;
};

export type TopicContent = {
  id: string;
  lessons: CompiledLesson[];
  exercises: CompiledExercise[];
  flashcards: CompiledFlashcard[];
  /** Solo las fuentes citadas en este tema */
  sources: SourceEntry[];
};
