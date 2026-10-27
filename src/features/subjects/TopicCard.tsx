import { Link } from 'react-router';
import { ElementTile } from '../../ui/ElementTile';
import type { TopicLocation } from '../content/content';
import styles from './subjects.module.css';

export function TopicCard({ topic, number }: Pick<TopicLocation, 'topic' | 'number'>) {
  const minutes = topic.lessons.reduce((m, l) => m + l.estimatedMinutes, 0);
  return (
    <li>
      <Link to={`/topics/${topic.id}`} className={styles.card}>
        <ElementTile number={number} topicId={topic.id} />
        <span className={styles.cardBody}>
          <span className={styles.cardTitle}>{topic.title}</span>
          <span className={styles.cardMeta}>
            {topic.lessons.length} lecciones · {topic.exerciseCount} ejercicios · ~{minutes} min
          </span>
        </span>
      </Link>
    </li>
  );
}
