/**
 * Eventos de usuario: inmutables, con ID UUIDv7 generado en el cliente.
 * El estado visible (tarjetas, dominio, progreso) es una proyección de estos eventos.
 * Ver docs/SYNC.md.
 */
import { z } from 'zod';
import { UUID_RE } from './uuid';

const Iso = z.iso.datetime({ offset: true });
const ContentId = z.string().min(1).max(200);

export const AttemptPayload = z.strictObject({
  exerciseId: ContentId,
  exerciseRevision: z.int().positive(),
  /** Objetivo del ejercicio en el momento del intento (desnormalizado a propósito). */
  objectiveId: ContentId,
  result: z.enum(['correct', 'incorrect']),
  /** Respuestas comprobadas antes de terminar (las ilegibles no cuentan). */
  tries: z.int().nonnegative(),
  hintsUsed: z.int().nonnegative(),
  solutionViewed: z.boolean(),
  selfGraded: z.boolean(),
  /** Códigos de feedback de cada intento, en orden. */
  feedback: z.array(z.string()).max(50),
  errorTags: z.array(z.string()).max(50),
  /** Última respuesta dada, tal como se escribió. */
  lastResponse: z.string().max(500),
  durationMs: z.int().nonnegative(),
});
export type AttemptPayload = z.infer<typeof AttemptPayload>;

export const ReviewPayload = z.strictObject({
  cardId: ContentId,
  cardRevision: z.int().positive(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: Iso,
  durationMs: z.int().nonnegative(),
});
export type ReviewPayload = z.infer<typeof ReviewPayload>;

export const SessionSegmentPayload = z.strictObject({
  startedAt: Iso,
  endedAt: Iso,
  activeMs: z.int().nonnegative(),
  activity: z.enum(['lesson', 'practice', 'review']),
});

export const LessonPayload = z.strictObject({
  lessonId: ContentId,
  action: z.enum(['opened', 'completed']),
});
export type LessonPayload = z.infer<typeof LessonPayload>;

export const SettingPayload = z.strictObject({
  key: z.string().min(1).max(100),
  value: z.json(),
});

export const VoidPayload = z.strictObject({
  targetEventId: z.string().regex(UUID_RE),
  reason: z.string().max(500),
});

const base = {
  id: z.string().regex(UUID_RE),
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  clientCreatedAt: Iso,
  schemaVersion: z.literal(1),
};

export const AppEvent = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('attempt'), payload: AttemptPayload }),
  z.strictObject({ ...base, type: z.literal('review'), payload: ReviewPayload }),
  z.strictObject({ ...base, type: z.literal('session_segment'), payload: SessionSegmentPayload }),
  z.strictObject({ ...base, type: z.literal('lesson'), payload: LessonPayload }),
  z.strictObject({ ...base, type: z.literal('setting'), payload: SettingPayload }),
  z.strictObject({ ...base, type: z.literal('void'), payload: VoidPayload }),
]);
export type AppEvent = z.infer<typeof AppEvent>;
export type EventType = AppEvent['type'];
export type EventOf<T extends EventType> = Extract<AppEvent, { type: T }>;
export type PayloadOf<T extends EventType> = EventOf<T>['payload'];

/** Elimina los eventos anulados por un evento `void` (y los propios `void`). */
export function withoutVoided(events: readonly AppEvent[]): AppEvent[] {
  const voided = new Set(events.filter((e) => e.type === 'void').map((e) => e.payload.targetEventId));
  return events.filter((e) => e.type !== 'void' && !voided.has(e.id));
}

export const ExportFile = z.strictObject({
  format: z.literal('learningbasics-export'),
  version: z.literal(1),
  exportedAt: Iso,
  events: z.array(AppEvent),
});
export type ExportFile = z.infer<typeof ExportFile>;
