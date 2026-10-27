import { Link } from 'react-router';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { manifest, topicsOf } from '../content/content';
import { useCompletedLessons, useNow, useReviewQueue } from '../learning/learning';
import { TopicCard } from './TopicCard';
import styles from './subjects.module.css';

/** Lo inmediato: la siguiente lección sin leer y los repasos. El plan diario completo llega en la Fase 4. */
function TodayPanel() {
  const completed = useCompletedLessons();
  const queue = useReviewQueue(useNow());
  if (!completed || !queue) return <p className={styles.lede}>&nbsp;</p>;

  const next = manifest.subjects
    .flatMap((s) => topicsOf(s).flatMap((t) => t.topic.lessons.map((lesson) => ({ lesson, topic: t.topic }))))
    .find(({ lesson }) => !completed.has(lesson.id));
  const reviews = queue.due.length + queue.fresh.length;

  return (
    <div className={styles.today}>
      {next ? (
        <Link to={`/lessons/${next.lesson.id}`} className={styles.todayItem}>
          <span className={styles.todayLabel}>Siguiente lección</span>
          <span className={styles.todayMain}>{next.lesson.title}</span>
          <span className={styles.cardMeta}>
            {next.topic.title} · {next.lesson.estimatedMinutes} min
          </span>
        </Link>
      ) : (
        <div className={styles.todayItem}>
          <span className={styles.todayLabel}>Lecciones</span>
          <span className={styles.todayMain}>Has leído todas las lecciones disponibles</span>
        </div>
      )}
      <Link to="/review" className={styles.todayItem}>
        <span className={styles.todayLabel}>Repaso</span>
        <span className={styles.todayMain}>{reviews > 0 ? `${reviews} ${reviews === 1 ? 'tarjeta' : 'tarjetas'}` : 'Al día'}</span>
        <span className={styles.cardMeta}>
          {reviews > 0 ? 'Unos minutos de recuerdo activo' : 'No hay tarjetas pendientes ahora'}
        </span>
      </Link>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle('');

  if (manifest.subjects.length === 0) {
    return (
      <Status kind="empty" title="Todavía no hay asignaturas">
        <p>Añade contenido en la carpeta content/ siguiendo CONTENT_GUIDE.md.</p>
      </Status>
    );
  }

  return (
    <>
      <h1 className={styles.pageTitle}>Qué estudiar</h1>
      <TodayPanel />
      {manifest.subjects.map((subject) => (
        <section key={subject.id} className={styles.section} aria-labelledby={`s-${subject.id}`}>
          <h2 id={`s-${subject.id}`} className={styles.sectionTitle}>
            <Link to={`/subjects/${subject.id}`}>{subject.title}</Link>
          </h2>
          <ul className={styles.grid}>
            {topicsOf(subject).map((t) => (
              <TopicCard key={t.topic.id} topic={t.topic} number={t.number} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
