import { Link, useParams } from 'react-router';
import { ElementTile } from '../../ui/ElementTile';
import { NotFoundPage } from '../../ui/NotFoundPage';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { findTopic, topicTitle } from '../content/content';
import { ProvenanceBadge } from './ProvenanceBadge';
import styles from './lessons.module.css';

export function TopicPage() {
  const { topicId = '' } = useParams();
  const loc = findTopic(topicId);
  useDocumentTitle(loc?.topic.title ?? 'No encontrado');
  if (!loc) return <NotFoundPage />;
  const { subject, unit, topic, number } = loc;

  return (
    <article>
      <nav aria-label="Ruta" className={styles.crumbs}>
        <Link to={`/subjects/${subject.id}`}>{subject.title}</Link> <span aria-hidden="true">/</span> {unit.title}
      </nav>

      <header className={styles.topicHeader}>
        <ElementTile number={number} topicId={topic.id} size="lg" />
        <div>
          <h1 className={styles.title}>{topic.title}</h1>
          {topic.description && <p className={styles.lede}>{topic.description}</p>}
        </div>
      </header>

      {topic.prerequisites.length > 0 && (
        <p className={styles.prereq}>
          Conviene haber visto antes:{' '}
          {topic.prerequisites.map((p, i) => (
            <span key={p}>
              {i > 0 && ', '}
              <Link to={`/topics/${p}`}>{topicTitle(p)}</Link>
            </span>
          ))}
        </p>
      )}

      <section aria-labelledby="objectives" className={styles.panel}>
        <h2 id="objectives" className={styles.panelTitle}>
          Al terminar sabrás
        </h2>
        <ul className={styles.objectives}>
          {topic.objectives.map((o) => (
            <li key={o.id}>{o.text}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lessons">
        <h2 id="lessons" className={styles.panelTitle}>
          Lecciones
        </h2>
        <ol className={styles.lessonList}>
          {topic.lessons.map((l) => (
            <li key={l.id}>
              <Link to={`/lessons/${l.id}`} className={styles.lessonLink}>
                <span className={styles.lessonName}>{l.title}</span>
                <span className={styles.lessonMeta}>
                  {l.estimatedMinutes} min <ProvenanceBadge provenance={l.provenance} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.actions}>
        {topic.exerciseCount > 0 ? (
          <Link to={`/practice/${topic.id}`} className="btn btn-primary">
            Practicar · {topic.exerciseCount} ejercicios
          </Link>
        ) : (
          <p className={styles.muted}>Este tema aún no tiene ejercicios.</p>
        )}
        {topic.flashcardCount > 0 && (
          <span className={styles.muted}>{topic.flashcardCount} tarjetas de repaso (disponibles en la próxima versión)</span>
        )}
      </div>
    </article>
  );
}
