import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { NotFoundPage } from '../../ui/NotFoundPage';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { findTopic, useTopicContent } from '../content/content';
import { TopicLoadState } from '../content/TopicLoadState';
import { recordAttempt } from '../learning/learning';
import { ExerciseCard } from './ExerciseCard';
import type { ExerciseOutcome } from './feedback';
import styles from './practice.module.css';

const newSeed = () => Math.random().toString(36).slice(2);

export function PracticePage() {
  const { topicId = '' } = useParams();
  const loc = findTopic(topicId);
  const state = useTopicContent(loc ? topicId : undefined);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>([]);
  const [seed, setSeed] = useState(newSeed);
  const [saveError, setSaveError] = useState<string | null>(null);
  useDocumentTitle(loc ? `Práctica: ${loc.topic.title}` : 'No encontrado');

  if (!loc) return <NotFoundPage />;
  const header = (
    <nav aria-label="Ruta" className={styles.crumbs}>
      <Link to={`/topics/${topicId}`}>{loc.topic.title}</Link> <span aria-hidden="true">/</span> Práctica
    </nav>
  );

  if (state.status !== 'ready') {
    return (
      <>
        {header}
        <TopicLoadState state={state} />
      </>
    );
  }

  const exercises = state.content.exercises;
  if (exercises.length === 0) {
    return (
      <>
        {header}
        <Status kind="empty" title="Este tema aún no tiene ejercicios" />
      </>
    );
  }

  const restart = () => {
    setIndex(0);
    setOutcomes([]);
    setSeed(newSeed());
  };

  if (index >= exercises.length) {
    const count = (o: ExerciseOutcome) => outcomes.filter((x) => x === o).length;
    return (
      <>
        {header}
        <section className={styles.summary} aria-labelledby="summary-title">
          <h1 id="summary-title" className={styles.summaryTitle}>
            Práctica terminada
          </h1>
          <dl className={styles.summaryStats}>
            <div>
              <dt>Bien a la primera, sin ayuda</dt>
              <dd>{count('correct-unaided')}</dd>
            </div>
            <div>
              <dt>Bien con pistas o varios intentos</dt>
              <dd>{count('correct-with-help')}</dd>
            </div>
            <div>
              <dt>Sin resolver</dt>
              <dd>{count('not-solved')}</dd>
            </div>
          </dl>
          <p className={styles.summaryNote}>
            {saveError ?? 'Guardado en este dispositivo. Puedes ver la evolución en Progreso.'}
          </p>
          <div className={styles.controls}>
            <button className="btn btn-primary" onClick={restart}>
              Practicar otra vez
            </button>
            <Link to={`/topics/${topicId}`} className="btn">
              Volver al tema
            </Link>
          </div>
        </section>
      </>
    );
  }

  const exercise = exercises[index]!;
  return (
    <>
      {header}
      <div className={styles.progress}>
        <span>
          Ejercicio {index + 1} de {exercises.length}
        </span>
        <progress value={index} max={exercises.length} aria-label="Progreso de la práctica" />
      </div>
      <ExerciseCard
        key={`${seed}-${exercise.id}`}
        exercise={exercise}
        seed={seed}
        isLast={index === exercises.length - 1}
        onDone={(outcome, attempt) => {
          recordAttempt(attempt).catch((e: unknown) => {
            console.error(e);
            setSaveError('No se pudo guardar algún intento en este dispositivo (¿almacenamiento lleno o modo privado?).');
          });
          setOutcomes((o) => [...o, outcome]);
          setIndex((i) => i + 1);
        }}
      />
      {saveError && (
        <p role="alert" className={styles.summaryNote}>
          {saveError}
        </p>
      )}
    </>
  );
}
