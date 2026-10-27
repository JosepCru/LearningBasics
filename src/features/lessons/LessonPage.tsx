import { Link, useParams } from 'react-router';
import { Html } from '../../ui/Html';
import { NotFoundPage } from '../../ui/NotFoundPage';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { findTopic, manifest, useTopicContent } from '../content/content';
import { TopicLoadState } from '../content/TopicLoadState';
import { ProvenanceBadge } from './ProvenanceBadge';
import styles from './lessons.module.css';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const topicId = manifest.lessonIndex[lessonId];
  const loc = topicId ? findTopic(topicId) : undefined;
  const summary = loc?.topic.lessons.find((l) => l.id === lessonId);
  const state = useTopicContent(topicId);
  useDocumentTitle(summary?.title ?? 'No encontrado');

  if (!loc || !summary) return <NotFoundPage />;
  const { topic } = loc;

  const index = topic.lessons.findIndex((l) => l.id === lessonId);
  const prev = topic.lessons[index - 1];
  const next = topic.lessons[index + 1];

  const lesson = state.status === 'ready' ? state.content.lessons.find((l) => l.id === lessonId) : undefined;
  const sources = state.status === 'ready' ? state.content.sources : [];

  return (
    <article>
      <nav aria-label="Ruta" className={styles.crumbs}>
        <Link to={`/topics/${topic.id}`}>{topic.title}</Link> <span aria-hidden="true">/</span> Lección{' '}
        {index + 1} de {topic.lessons.length}
      </nav>
      <h1 className={styles.title}>{summary.title}</h1>
      <p className={styles.lessonMeta}>
        {summary.estimatedMinutes} min de lectura <ProvenanceBadge provenance={summary.provenance} />
      </p>

      <TopicLoadState state={state} />

      {lesson && (
        <>
          <Html html={lesson.html} className="prose" />

          <section aria-labelledby="sources" className={styles.sources}>
            <h2 id="sources" className={styles.panelTitle}>
              Fuentes
            </h2>
            <ul>
              {lesson.sources.map((ref) => {
                const s = sources.find((x) => x.id === ref.ref);
                return (
                  <li key={`${ref.ref}-${ref.locator}`}>
                    {s ? (
                      <>
                        {s.authors.join(', ')} ({s.year}). <a href={s.url} rel="noopener noreferrer" target="_blank">
                          <cite>{s.title}</cite>
                        </a>
                        . {s.publisher}. {ref.locator}.{s.license ? ` Licencia: ${s.license}.` : ''}
                      </>
                    ) : (
                      `${ref.ref}: ${ref.locator}`
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <nav aria-label="Lecciones del tema" className={styles.pager}>
        {prev ? (
          <Link to={`/lessons/${prev.id}`} className="btn">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/lessons/${next.id}`} className="btn btn-primary">
            {next.title} →
          </Link>
        ) : topic.exerciseCount > 0 ? (
          <Link to={`/practice/${topic.id}`} className="btn btn-primary">
            Practicar el tema →
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
