import { useParams } from 'react-router';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { NotFoundPage } from '../../ui/NotFoundPage';
import { findSubject, topicsOf } from '../content/content';
import { TopicCard } from './TopicCard';
import styles from './subjects.module.css';

export function SubjectPage() {
  const { subjectId = '' } = useParams();
  const subject = findSubject(subjectId);
  useDocumentTitle(subject?.title ?? 'No encontrado');
  if (!subject) return <NotFoundPage />;

  const topics = topicsOf(subject);
  return (
    <>
      <h1 className={styles.pageTitle}>{subject.title}</h1>
      {subject.description && <p className={styles.lede}>{subject.description}</p>}
      {subject.units.map((unit) => (
        <section key={unit.id} className={styles.section} aria-labelledby={`u-${unit.id}`}>
          <h2 id={`u-${unit.id}`} className={styles.sectionTitle}>
            {unit.title}
          </h2>
          {unit.description && <p className={styles.sectionLede}>{unit.description}</p>}
          <ul className={styles.grid}>
            {topics
              .filter((t) => t.unit.id === unit.id)
              .map((t) => (
                <TopicCard key={t.topic.id} topic={t.topic} number={t.number} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
