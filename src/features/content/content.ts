/**
 * Acceso al contenido compilado. El manifiesto (ligero) va en el bundle principal;
 * cada tema se carga bajo demanda como un chunk JSON separado.
 */
import { useEffect, useState } from 'react';
import type { ContentManifest, SubjectNode, TopicContent, TopicSummary, UnitNode } from '../../core/content/compiled';
import manifestJson from '../../generated/content/manifest.json';

export const manifest = manifestJson as unknown as ContentManifest;

const topicLoaders = import.meta.glob<TopicContent>('../../generated/content/topics/*.json', {
  import: 'default',
});

export type TopicLocation = {
  subject: SubjectNode;
  unit: UnitNode;
  topic: TopicSummary;
  /** Posición del tema dentro de la asignatura, empezando en 1. */
  number: number;
};

export function findSubject(subjectId: string): SubjectNode | undefined {
  return manifest.subjects.find((s) => s.id === subjectId);
}

export function topicsOf(subject: SubjectNode): TopicLocation[] {
  let n = 0;
  return subject.units.flatMap((unit) => unit.topics.map((topic) => ({ subject, unit, topic, number: ++n })));
}

export function findTopic(topicId: string): TopicLocation | undefined {
  const where = manifest.topicIndex[topicId];
  const subject = where && findSubject(where.subjectId);
  return subject ? topicsOf(subject).find((t) => t.topic.id === topicId) : undefined;
}

export function topicTitle(topicId: string): string {
  return findTopic(topicId)?.topic.title ?? topicId;
}

const cache = new Map<string, TopicContent>();

export async function loadTopic(topicId: string): Promise<TopicContent> {
  const cached = cache.get(topicId);
  if (cached) return cached;
  const loader = topicLoaders[`../../generated/content/topics/${topicId}.json`];
  if (!loader) throw new Error(`No existe el tema "${topicId}"`);
  const content = await loader();
  cache.set(topicId, content);
  return content;
}

export type TopicState =
  | { status: 'loading' }
  | { status: 'error'; error: Error; retry: () => void }
  | { status: 'ready'; content: TopicContent };

export function useTopicContent(topicId: string | undefined): TopicState {
  const [attempt, setAttempt] = useState(0);
  // El resultado se guarda junto a la clave que lo produjo; al cambiar de tema, el
  // estado se deriva en el render (caché o "cargando") sin setState síncrono.
  const [result, setResult] = useState<{ key: string; state: TopicState } | null>(null);
  const key = `${topicId}#${attempt}`;

  useEffect(() => {
    if (!topicId || cache.has(topicId)) return;
    let cancelled = false;
    loadTopic(topicId).then(
      (content) => !cancelled && setResult({ key, state: { status: 'ready', content } }),
      (error: unknown) =>
        !cancelled &&
        setResult({
          key,
          state: {
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
            retry: () => setAttempt((a) => a + 1),
          },
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [topicId, key]);

  const cached = topicId ? cache.get(topicId) : undefined;
  if (cached) return { status: 'ready', content: cached };
  if (result?.key === key) return result.state;
  return { status: 'loading' };
}
