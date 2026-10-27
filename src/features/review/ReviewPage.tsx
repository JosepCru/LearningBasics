import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { previewDue, type Rating } from '../../core/scheduling/fsrs';
import { REVIEW_DEFAULTS } from '../../core/scheduling/queue';
import { Html } from '../../ui/Html';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { manifest, topicTitle, useTopicContent } from '../content/content';
import { TopicLoadState } from '../content/TopicLoadState';
import { recordReview, useCardRows, useNow, useReviewQueue } from '../learning/learning';
import { formatInterval } from './format';
import styles from './review.module.css';

const RATINGS: { value: Rating; label: string; key: string }[] = [
  { value: 1, label: 'Otra vez', key: '1' },
  { value: 2, label: 'Difícil', key: '2' },
  { value: 3, label: 'Bien', key: '3' },
  { value: 4, label: 'Fácil', key: '4' },
];

export function ReviewPage() {
  useDocumentTitle('Repaso');
  const now = useNow();
  const queue = useReviewQueue(now);
  const [session, setSession] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);

  if (!queue) return <Status kind="loading" title="Preparando el repaso" />;

  if (!session) {
    const total = queue.due.length + queue.fresh.length;
    return (
      <section className={styles.intro}>
        <h1 className={styles.title}>Repaso</h1>
        {total > 0 ? (
          <>
            <p className={styles.lede}>
              {queue.due.length} {queue.due.length === 1 ? 'tarjeta vencida' : 'tarjetas vencidas'} y {queue.fresh.length}{' '}
              {queue.fresh.length === 1 ? 'nueva' : 'nuevas'}. Primero las que más riesgo tienes de olvidar.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSession([...queue.due, ...queue.fresh]);
                setIndex(0);
                setRatings([]);
              }}
            >
              Empezar repaso · {total}
            </button>
          </>
        ) : (
          <Status kind="empty" title="No tienes repasos pendientes">
            {queue.locked > 0 && (
              <p>
                {queue.locked} tarjetas se desbloquean al marcar como leídas sus lecciones.{' '}
                <Link to="/">Ir a las lecciones</Link>
              </p>
            )}
            {queue.waitingNew > 0 && (
              <p>
                {queue.waitingNew} tarjetas nuevas esperan a mañana: se introducen como máximo {REVIEW_DEFAULTS.newPerDay} al día
                para que los repasos no se acumulen.
              </p>
            )}
            {queue.locked === 0 && queue.waitingNew === 0 && <p>Vuelve más tarde: las tarjetas vencerán según las vayas recordando.</p>}
          </Status>
        )}
        <p className={styles.help}>
          Cómo funciona: piensa la respuesta antes de darle la vuelta y valora con sinceridad cuánto te ha costado. El
          algoritmo (FSRS) programa la siguiente aparición según tu respuesta.
        </p>
      </section>
    );
  }

  if (index >= session.length) {
    const count = (r: Rating) => ratings.filter((x) => x === r).length;
    return (
      <section className={styles.intro}>
        <h1 className={styles.title}>Repaso terminado</h1>
        <dl className={styles.stats}>
          {RATINGS.map((r) => (
            <div key={r.value}>
              <dt>{r.label}</dt>
              <dd>{count(r.value)}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.help}>Guardado en este dispositivo.</p>
        <button className="btn" onClick={() => setSession(null)}>
          Volver al repaso
        </button>
      </section>
    );
  }

  const cardId = session[index]!;
  return (
    <ReviewCard
      key={cardId}
      cardId={cardId}
      position={index + 1}
      total={session.length}
      onRated={(r) => {
        setRatings((x) => [...x, r]);
        setIndex((i) => i + 1);
      }}
    />
  );
}

type CardProps = { cardId: string; position: number; total: number; onRated: (r: Rating) => void };

function ReviewCard({ cardId, position, total, onRated }: CardProps) {
  const ref = manifest.flashcardIndex[cardId];
  const state = useTopicContent(ref?.topicId);
  const rows = useCardRows();
  const [shownAt] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealRef = useRef<HTMLButtonElement>(null);

  const card = state.status === 'ready' ? state.content.flashcards.find((f) => f.id === cardId) : undefined;
  const current = rows?.find((r) => r.cardId === cardId)?.state;
  const intervals = useMemo(() => {
    if (!revealed) return null;
    const now = new Date();
    const due = previewDue(current, now);
    return Object.fromEntries(RATINGS.map((r) => [r.value, formatInterval(due[r.value].getTime() - now.getTime())]));
  }, [revealed, current]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (busy || !ref) return;
      setBusy(true);
      try {
        const now = new Date();
        await recordReview({
          cardId,
          cardRevision: ref.revision,
          rating,
          reviewedAt: now.toISOString(),
          durationMs: Math.max(0, Math.round(now.getTime() - shownAt)),
        });
        onRated(rating);
      } catch (e) {
        console.error(e);
        setError('No se pudo guardar el repaso en este dispositivo. Vuelve a intentarlo.');
        setBusy(false);
      }
    },
    [busy, ref, cardId, shownAt, onRated],
  );

  useEffect(() => {
    revealRef.current?.focus();
  }, [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        void rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, rate]);

  if (!ref) return <Status kind="error" title={`La tarjeta ${cardId} ya no existe en el contenido`} />;
  if (state.status !== 'ready') return <TopicLoadState state={state} />;
  if (!card) return <Status kind="error" title={`La tarjeta ${cardId} ya no existe en el contenido`} />;

  return (
    <section aria-label="Tarjeta de repaso">
      <div className={styles.progress}>
        <span>
          {position} de {total}
        </span>
        <span className={styles.topic}>{topicTitle(ref.topicId)}</span>
        {!current && <span className={styles.newTag}>Nueva</span>}
      </div>

      <div className={styles.card}>
        <Html html={card.frontHtml} className={`prose ${styles.front}`} />
        {revealed && (
          <>
            <hr className={styles.divider} />
            <Html html={card.backHtml} className={`prose ${styles.back}`} />
          </>
        )}
      </div>

      <div className={styles.actions} aria-live="polite">
        {!revealed ? (
          <button ref={revealRef} className="btn btn-primary" onClick={() => setRevealed(true)}>
            Mostrar respuesta
          </button>
        ) : (
          <div className={styles.ratings} role="group" aria-label="¿Cuánto te ha costado recordarlo?">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                className={`btn ${r.value === 3 ? 'btn-primary' : ''}`}
                disabled={busy}
                onClick={() => void rate(r.value)}
                aria-keyshortcuts={r.key}
              >
                <span>{r.label}</span>
                <span className={styles.interval}>{intervals?.[r.value]}</span>
              </button>
            ))}
          </div>
        )}
        <p className={styles.keys}>
          {revealed ? 'Teclas 1–4 para valorar.' : 'Espacio o Enter para mostrar la respuesta.'}
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
