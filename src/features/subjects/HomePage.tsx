import { Link } from 'react-router';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { manifest, topicsOf } from '../content/content';
import { TopicCard } from './TopicCard';
import styles from './subjects.module.css';

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
      <p className={styles.lede}>
        Elige un tema. El plan diario, los repasos y tu progreso se añadirán en las próximas versiones.
      </p>
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
