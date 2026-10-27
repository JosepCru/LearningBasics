import { useState } from 'react';
import { Link } from 'react-router';
import { exportEvents, exportFileName, downloadJson } from '../../data/backup';
import { db } from '../../data/instance';
import { ElementTile } from '../../ui/ElementTile';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { manifest, topicsOf, topicTitle } from '../content/content';
import {
  useAttempts,
  useCardRows,
  useCompletedLessons,
  useEventCount,
  useMastery,
  useNow,
  useOutboxCount,
  useReviewQueue,
} from '../learning/learning';
import { MasteryBadge } from './MasteryBadge';
import styles from './progress.module.css';

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const humanTag = (tag: string) => tag.replace(/-/g, ' ');

export function ProgressPage() {
  useDocumentTitle('Progreso');
  const now = useNow();
  const mastery = useMastery(now);
  const attempts = useAttempts();
  const completed = useCompletedLessons();
  const cards = useCardRows();
  const queue = useReviewQueue(now);

  if (mastery.status === 'loading' || !attempts || !completed || !cards) {
    return <Status kind="loading" title="Calculando tu progreso" />;
  }

  // Los recuentos y errores leen los intentos directamente: siguen funcionando aunque falle el dominio.
  const allLessons = manifest.subjects.flatMap((s) => topicsOf(s).flatMap((t) => t.topic.lessons));
  const totalCards = Object.keys(manifest.flashcardIndex).length;
  const triedExercises = new Set(attempts.map((a) => a.payload.exerciseId).filter((id) => id in manifest.exerciseIndex));
  const mistakes = attempts
    .filter((a) => a.payload.result === 'incorrect' || a.payload.errorTags.length > 0)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <>
      <h1 className={styles.title}>Progreso</h1>

      <dl className={styles.summary}>
        <div>
          <dt>Lecciones leídas</dt>
          <dd>
            {allLessons.filter((l) => completed.has(l.id)).length}
            <small> / {allLessons.length}</small>
          </dd>
        </div>
        <div>
          <dt>Ejercicios practicados</dt>
          <dd>
            {triedExercises.size}
            <small> / {Object.keys(manifest.exerciseIndex).length}</small>
          </dd>
        </div>
        <div>
          <dt>Tarjetas en estudio</dt>
          <dd>
            {cards.length}
            <small> / {totalCards}</small>
          </dd>
        </div>
        <div>
          <dt>Repasos pendientes</dt>
          <dd>{queue ? queue.due.length + queue.fresh.length : '—'}</dd>
        </div>
      </dl>

      {mastery.status === 'error' && (
        <Status kind="error" title="El cálculo de dominio no está disponible">
          <p>
            Tus intentos sí se están guardando. Detalle: <code>{mastery.error.message}</code>
          </p>
        </Status>
      )}

      {manifest.subjects.map((subject) => (
        <section key={subject.id} className={styles.section} aria-labelledby={`p-${subject.id}`}>
          <h2 id={`p-${subject.id}`} className={styles.sectionTitle}>
            {subject.title}
          </h2>
          {topicsOf(subject).map(({ topic, number }) => {
            const read = topic.lessons.filter((l) => completed.has(l.id)).length;
            return (
              <article key={topic.id} className={styles.topic}>
                <header className={styles.topicHeader}>
                  <ElementTile number={number} topicId={topic.id} />
                  <div>
                    <h3 className={styles.topicTitle}>
                      <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
                    </h3>
                    <p className={styles.meta}>
                      {read} de {topic.lessons.length} lecciones leídas
                    </p>
                  </div>
                </header>
                <ul className={styles.objectives}>
                  {topic.objectives.map((o) => {
                    const m = mastery.status === 'ready' ? mastery.byObjective.get(o.id) : undefined;
                    return (
                      <li key={o.id}>
                        <span>{o.text}</span>
                        <span className={styles.objectiveStatus}>
                          {mastery.status === 'ready' && <MasteryBadge mastery={m} />}
                          {m?.repeatedErrors.map((t) => (
                            <span key={t} className={styles.errorTag} title="Error repetido en los últimos 14 días">
                              {humanTag(t)}
                            </span>
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </section>
      ))}

      <section className={styles.section} aria-labelledby="mistakes">
        <h2 id="mistakes" className={styles.sectionTitle}>
          Errores recientes
        </h2>
        {mistakes.length === 0 ? (
          <p className={styles.meta}>Aquí aparecerán los ejercicios en los que te equivoques, para volver a ellos.</p>
        ) : (
          <ul className={styles.mistakes}>
            {mistakes.map((a) => {
              const ref = manifest.exerciseIndex[a.payload.exerciseId];
              return (
                <li key={a.id}>
                  <span className={styles.meta}>{dateFmt.format(a.at)}</span>
                  <span>
                    {ref ? topicTitle(ref.topicId) : a.payload.exerciseId}
                    {a.payload.result === 'correct' && ' (resuelto tras fallar)'}
                  </span>
                  <span>
                    {a.payload.errorTags.map((t) => (
                      <span key={t} className={styles.errorTag}>
                        {humanTag(t)}
                      </span>
                    ))}
                  </span>
                  {ref && <Link to={`/practice/${ref.topicId}`}>Practicar</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DataSection />
    </>
  );
}

function DataSection() {
  const events = useEventCount();
  const pending = useOutboxCount();
  const [message, setMessage] = useState<string | null>(null);

  const exportNow = async () => {
    try {
      const file = await exportEvents(db);
      downloadJson(file, exportFileName());
      setMessage(`Copia descargada con ${file.events.length} registros.`);
    } catch (e) {
      console.error(e);
      setMessage('No se pudo crear la copia. Detalle en la consola del navegador.');
    }
  };

  return (
    <section className={styles.section} aria-labelledby="data">
      <h2 id="data" className={styles.sectionTitle}>
        Tus datos
      </h2>
      <div className={styles.dataBox}>
        <p>
          Tu historial se guarda en este navegador: {events ?? '…'} registros.{' '}
          {pending ? `${pending} pendientes de sincronizar (la sincronización entre dispositivos llega en la próxima fase).` : ''}
        </p>
        <p className={styles.meta}>
          Si borras los datos del sitio o usas modo privado, se pierden. Descarga una copia de vez en cuando.
        </p>
        <button className="btn" onClick={() => void exportNow()}>
          Descargar copia (JSON)
        </button>
        {message && (
          <p role="status" className={styles.meta}>
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
