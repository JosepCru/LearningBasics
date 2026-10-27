/**
 * Esquemas de AUTORÍA: describen los archivos de content/ tal como se escriben.
 * Ver content/CONTENT_GUIDE.md. Todos son estrictos: un campo desconocido es un error.
 */
import { z } from 'zod';

/** `chem`, `chem.mole`, `chem.mole.ex03`, `openstax-chem2e` */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
export const Id = z.string().regex(ID_PATTERN, 'ID inválido: usa minúsculas, dígitos, guiones y puntos');

const NonEmpty = z.string().trim().min(1, 'no puede estar vacío');
const PositiveInt = z.int().positive();

const Retirement = {
  retired: z.boolean().optional(),
  retiredReason: z.string().optional(),
};

export const Provenance = z.enum(['ai-drafted', 'self-reviewed', 'verified']);
export type Provenance = z.infer<typeof Provenance>;

export const Language = z.enum(['es', 'en', 'zh']);

export const SourceEntry = z.strictObject({
  id: Id,
  title: NonEmpty,
  authors: z.array(NonEmpty).min(1),
  publisher: NonEmpty,
  year: z.int().min(1000).max(3000),
  url: z.url(),
  license: z.string().optional(),
});
export const SourcesFile = z.array(SourceEntry);
export type SourceEntry = z.infer<typeof SourceEntry>;

export const SubjectFile = z.strictObject({
  id: Id,
  title: NonEmpty,
  order: z.int(),
  description: z.string().optional(),
  language: Language,
});
export type SubjectFile = z.infer<typeof SubjectFile>;

export const UnitFile = z.strictObject({
  id: Id,
  title: NonEmpty,
  description: z.string().optional(),
});
export type UnitFile = z.infer<typeof UnitFile>;

export const Objective = z.strictObject({ id: Id, text: NonEmpty });
export type Objective = z.infer<typeof Objective>;

export const TopicFile = z.strictObject({
  id: Id,
  title: NonEmpty,
  description: z.string().optional(),
  prerequisites: z.array(Id).default([]),
  estimatedMinutes: PositiveInt.optional(),
  objectives: z.array(Objective).min(1),
});
export type TopicFile = z.infer<typeof TopicFile>;

export const SourceRef = z.strictObject({ ref: Id, locator: NonEmpty });
export type SourceRef = z.infer<typeof SourceRef>;

export const LessonFrontmatter = z.strictObject({
  id: Id,
  title: NonEmpty,
  objectives: z.array(Id).min(1),
  estimatedMinutes: PositiveInt,
  sources: z.array(SourceRef).min(1, 'toda lección cita al menos una fuente'),
  provenance: Provenance,
  revision: PositiveInt,
  ...Retirement,
});
export type LessonFrontmatter = z.infer<typeof LessonFrontmatter>;

const ExerciseCommon = {
  id: Id,
  objective: Id,
  difficulty: z.int().min(1).max(5),
  revision: PositiveInt,
  prompt: NonEmpty,
  explanation: NonEmpty,
  hints: z.array(NonEmpty).default([]),
  solution: z.string().optional(),
  tags: z.array(z.string()).default([]),
  ...Retirement,
};

export const ChoiceOption = z.strictObject({
  id: z.string().regex(/^[a-z]$/, 'id de opción: una letra minúscula'),
  text: NonEmpty,
  correct: z.boolean().optional(),
  misconception: Id.optional(),
  feedback: z.string().optional(),
});

export const MultipleChoiceExercise = z.strictObject({
  ...ExerciseCommon,
  type: z.literal('multiple-choice'),
  options: z.array(ChoiceOption).min(2).max(6),
  shuffle: z.boolean().default(true),
});

export const Tolerance = z.union([
  z.strictObject({ relative: z.number().positive().max(0.5) }),
  z.strictObject({ absolute: z.number().nonnegative() }),
]);
export type Tolerance = z.infer<typeof Tolerance>;

export const NumericAnswer = z.strictObject({
  value: z.number(),
  unit: z.string().trim().min(1).optional(),
  tolerance: Tolerance,
  acceptEquivalentUnits: z.boolean().default(true),
  requireUnit: z.boolean().optional(),
});
export type NumericAnswer = z.infer<typeof NumericAnswer>;

export const NumericExercise = z.strictObject({
  ...ExerciseCommon,
  type: z.literal('numeric'),
  answer: NumericAnswer,
  verify: NonEmpty,
});

export const TextNormalization = z.strictObject({
  case: z.boolean().default(true),
  accents: z.boolean().default(true),
  whitespace: z.boolean().default(true),
});
export type TextNormalization = z.infer<typeof TextNormalization>;

export const ShortTextExercise = z.strictObject({
  ...ExerciseCommon,
  type: z.literal('short-text'),
  accept: z.array(NonEmpty).min(1),
  normalize: TextNormalization.default({ case: true, accents: true, whitespace: true }),
  allowSelfGrade: z.boolean().default(false),
});

export const Exercise = z.discriminatedUnion('type', [
  MultipleChoiceExercise,
  NumericExercise,
  ShortTextExercise,
]);
export type Exercise = z.infer<typeof Exercise>;
export const ExercisesFile = z.array(Exercise);

export const Flashcard = z.strictObject({
  id: Id,
  objective: Id,
  front: NonEmpty,
  back: NonEmpty,
  revision: PositiveInt.default(1),
  ...Retirement,
});
export type Flashcard = z.infer<typeof Flashcard>;
export const FlashcardsFile = z.array(Flashcard);

export const IdsLock = z.strictObject({
  version: z.literal(1),
  ids: z.array(Id),
});
export type IdsLock = z.infer<typeof IdsLock>;
