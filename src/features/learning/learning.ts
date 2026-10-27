/**
 * Estado de aprendizaje derivado de los eventos locales, para la interfaz.
 * Lectura: hooks reactivos (se actualizan solos al escribir). Escritura: funciones record*.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import type { AttemptPayload, LessonPayload, ReviewPayload } from '../../core/events/schemas';
import { withoutVoided } from '../../core/events/schemas';
import type { AttemptRecord } from '../../core/mastery/attempt';
import { computeMastery, type ObjectiveMastery } from '../../core/mastery/mastery';
import { buildReviewQueue, type ReviewQueue } from '../../core/scheduling/queue';
import type { CardRow } from '../../data/db';
import { appendEvent } from '../../data/events';
import { db } from '../../data/instance';
import { manifest } from '../content/content';

/* ---------- Escritura ---------- */

export const recordAttempt = (p: AttemptPayload) => appendEvent(db, 'attempt', p);
export const recordReview = (p: ReviewPayload) => appendEvent(db, 'review', p);
export const recordLesson = (p: LessonPayload) => appendEvent(db, 'lesson', p);

/* ---------- Lectura ---------- */

/** "Ahora", refrescado cada minuto para que los vencimientos se actualicen solos. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Intentos no anulados. undefined mientras carga. */
export function useAttempts(): AttemptRecord[] | undefined {
  return useLiveQuery(async () => {
    const events = await db.events.where('type').anyOf('attempt', 'void').toArray();
    return withoutVoided(events).flatMap((e) =>
      e.type === 'attempt' ? [{ id: e.id, at: new Date(e.clientCreatedAt), payload: e.payload }] : [],
    );
  });
}

export function useCompletedLessons(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const events = await db.events.where('type').anyOf('lesson', 'void').toArray();
    return new Set(
      withoutVoided(events).flatMap((e) => (e.type === 'lesson' && e.payload.action === 'completed' ? [e.payload.lessonId] : [])),
    );
  });
}

export function useCardRows(): CardRow[] | undefined {
  return useLiveQuery(() => db.cardStates.toArray());
}

export function useOutboxCount(): number | undefined {
  return useLiveQuery(() => db.outbox.count());
}

export function useEventCount(): number | undefined {
  return useLiveQuery(() => db.events.count());
}

/** Objetivos de cada lección, a partir del manifiesto. */
const lessonObjectives = new Map(
  manifest.subjects.flatMap((s) => s.units.flatMap((u) => u.topics.flatMap((t) => t.lessons.map((l) => [l.id, l.objectives] as const)))),
);

export function unlockedObjectives(completed: ReadonlySet<string>): Set<string> {
  return new Set([...completed].flatMap((id) => lessonObjectives.get(id) ?? []));
}

export type MasteryState =
  | { status: 'loading' }
  | { status: 'ready'; byObjective: Map<string, ObjectiveMastery>; attempts: AttemptRecord[] }
  | { status: 'error'; error: Error };

export function useMastery(now: Date): MasteryState {
  const attempts = useAttempts();
  return useMemo((): MasteryState => {
    if (!attempts) return { status: 'loading' };
    try {
      const byObjective = computeMastery(attempts, {
        now,
        currentRevision: (id) => manifest.exerciseIndex[id]?.revision,
      });
      return { status: 'ready', byObjective, attempts };
    } catch (e) {
      return { status: 'error', error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [attempts, now]);
}

export function useReviewQueue(now: Date): ReviewQueue | undefined {
  const rows = useCardRows();
  const completed = useCompletedLessons();
  return useMemo(() => {
    if (!rows || !completed) return undefined;
    const dayStart = startOfLocalDay(now).toISOString();
    return buildReviewQueue({
      cards: Object.entries(manifest.flashcardIndex).map(([id, ref]) => ({ id, objective: ref.objective })),
      states: new Map(rows.map((r) => [r.cardId, r.state])),
      unlockedObjectives: unlockedObjectives(completed),
      introducedToday: rows.filter((r) => r.firstReviewAt >= dayStart).length,
      now,
    });
  }, [rows, completed, now]);
}
