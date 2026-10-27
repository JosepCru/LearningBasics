import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { CompiledExercise } from '../../core/content/compiled';
import { evaluate, type EvaluationResult, type ExerciseResponse } from '../../core/evaluation';
import type { AttemptPayload } from '../../core/events/schemas';
import { shuffledOrder } from '../../core/evaluation/choice';
import { Html } from '../../ui/Html';
import { feedbackMessage, type ExerciseOutcome } from './feedback';
import styles from './practice.module.css';

type Props = {
  exercise: CompiledExercise;
  /** Semilla de la sesión para barajar opciones de forma estable. */
  seed: string;
  /** Se llama al pulsar "Siguiente", con el resumen del intento para guardarlo. */
  onDone: (outcome: ExerciseOutcome, attempt: AttemptPayload) => void;
  isLast: boolean;
};

export function ExerciseCard({ exercise, seed, onDone, isLast }: Props) {
  const [startedAt] = useState(() => Date.now());
  const [text, setText] = useState('');
  const [optionId, setOptionId] = useState<string | null>(null);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [lastResponse, setLastResponse] = useState('');
  const [hintsShown, setHintsShown] = useState(0);
  const [solutionShown, setSolutionShown] = useState(false);
  const [selfGraded, setSelfGraded] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const last = results.at(-1);
  const solved = Boolean(last?.correct) || selfGraded;
  const attempted = results.length > 0;
  const finished = solved || solutionShown;
  const ids = `ex-${exercise.id.replace(/\./g, '-')}`;

  // Al resolver, llevar el foco a "Siguiente": Enter para comprobar, Enter para seguir.
  useEffect(() => {
    if (finished) nextRef.current?.focus();
  }, [finished]);

  const options = useMemo(() => {
    if (exercise.type !== 'multiple-choice') return [];
    return exercise.shuffle ? shuffledOrder(exercise.options, `${seed}:${exercise.id}`) : exercise.options;
  }, [exercise, seed]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (solved) return;
    const response: ExerciseResponse =
      exercise.type === 'multiple-choice'
        ? { type: 'multiple-choice', optionId: optionId ?? '' }
        : { type: exercise.type, text };
    const result = evaluate(exercise, response);
    // Una respuesta vacía o ilegible no cuenta como intento.
    if (result.feedback === 'unparseable' && !attempted) {
      setResults([result]);
      return;
    }
    if (result.feedback !== 'unparseable') {
      setLastResponse(response.type === 'multiple-choice' ? response.optionId : response.text.trim().slice(0, 500));
    }
    setResults((r) => [...r.filter((x) => x.feedback !== 'unparseable'), result]);
  };

  const realAttempts = results.filter((r) => r.feedback !== 'unparseable');

  const outcome = (): ExerciseOutcome => {
    if (!solved) return 'not-solved';
    const unaided = realAttempts.length === 1 && hintsShown === 0 && !solutionShown && !selfGraded;
    return unaided ? 'correct-unaided' : 'correct-with-help';
  };

  const attemptPayload = (): AttemptPayload => ({
    exerciseId: exercise.id,
    exerciseRevision: exercise.revision,
    objectiveId: exercise.objective,
    result: solved ? 'correct' : 'incorrect',
    tries: realAttempts.length,
    hintsUsed: hintsShown,
    solutionViewed: solutionShown,
    selfGraded,
    feedback: realAttempts.map((r) => r.feedback),
    errorTags: [...new Set(realAttempts.flatMap((r) => r.errorTags))],
    lastResponse,
    durationMs: Math.max(0, Math.round(Date.now() - startedAt)),
  });

  const selectedOption = exercise.type === 'multiple-choice' ? exercise.options.find((o) => o.id === optionId) : undefined;
  const feedbackTone = !last ? '' : last.correct || selfGraded ? styles.good : last.feedback === 'unparseable' ? styles.info : styles.bad;

  return (
    <article className={styles.card} aria-labelledby={`${ids}-prompt`}>
      <Html html={exercise.promptHtml} className={`prose ${styles.prompt}`} id={`${ids}-prompt`} />

      <form onSubmit={submit} className={styles.form}>
        {exercise.type === 'multiple-choice' ? (
          <fieldset className={styles.options} disabled={solved} aria-labelledby={`${ids}-prompt`}>
            {options.map((o) => {
              const state =
                solved && o.correct ? styles.optionCorrect : !solved && last && !last.correct && o.id === optionId && last.feedback !== 'unparseable' ? styles.optionWrong : '';
              return (
                <label key={o.id} className={`${styles.option} ${state}`}>
                  <input
                    type="radio"
                    name={ids}
                    value={o.id}
                    checked={optionId === o.id}
                    onChange={() => setOptionId(o.id)}
                    aria-labelledby={`${ids}-opt-${o.id}`}
                  />
                  <Html as="span" html={o.textHtml} className={styles.optionText} id={`${ids}-opt-${o.id}`} />
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className={styles.field}>
            <label htmlFor={`${ids}-input`} className={styles.fieldLabel}>
              {exercise.type === 'numeric'
                ? exercise.answer.unit
                  ? 'Tu respuesta (número y unidad)'
                  : 'Tu respuesta (solo el número)'
                : 'Tu respuesta'}
            </label>
            <input
              id={`${ids}-input`}
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              readOnly={solved}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={
                exercise.type === 'numeric' ? (exercise.answer.unit ? 'p. ej. 1.25 g' : 'p. ej. 6.02e23') : ''
              }
              aria-describedby={`${ids}-feedback`}
            />
          </div>
        )}

        <div className={styles.controls}>
          {!solved && (
            <button type="submit" className="btn btn-primary">
              {attempted ? 'Volver a comprobar' : 'Comprobar'}
            </button>
          )}
          {!finished && hintsShown < exercise.hintsHtml.length && (
            <button type="button" className="btn btn-quiet" onClick={() => setHintsShown((n) => n + 1)}>
              Ver pista {hintsShown + 1} de {exercise.hintsHtml.length}
            </button>
          )}
          {!finished && realAttempts.length > 0 && (
            <button type="button" className="btn btn-quiet" onClick={() => setSolutionShown(true)}>
              Ver solución
            </button>
          )}
        </div>
      </form>

      <div id={`${ids}-feedback`} role="status" aria-live="polite" className={`${styles.feedback} ${feedbackTone}`}>
        {last && (
          <>
            <p className={styles.feedbackTitle}>{selfGraded ? 'Marcada como correcta.' : feedbackMessage(exercise, last)}</p>
            {!last.correct && selectedOption?.feedbackHtml && <Html html={selectedOption.feedbackHtml} className="prose" />}
          </>
        )}
      </div>

      {exercise.type === 'short-text' && exercise.allowSelfGrade && last?.feedback === 'no-match' && !finished && (
        <div className={styles.selfGrade}>
          <p>
            Respuesta de referencia: <strong>{exercise.accept[0]}</strong>. ¿Tu respuesta decía lo mismo con otras palabras?
          </p>
          <button type="button" className="btn" onClick={() => setSelfGraded(true)}>
            Mi respuesta era correcta
          </button>
        </div>
      )}

      {hintsShown > 0 && (
        <ol className={styles.hints} aria-label="Pistas">
          {exercise.hintsHtml.slice(0, hintsShown).map((h, i) => (
            <li key={i}>
              <Html html={h} className="prose" />
            </li>
          ))}
        </ol>
      )}

      {finished && (
        <div className={styles.reveal}>
          {(solutionShown || solved) && exercise.solutionHtml && (
            <section>
              <h3 className={styles.revealTitle}>Solución</h3>
              <Html html={exercise.solutionHtml} className="prose" />
            </section>
          )}
          {solutionShown && !solved && exercise.type === 'short-text' && (
            <p>
              Respuesta de referencia: <strong>{exercise.accept[0]}</strong>
            </p>
          )}
          <section>
            <h3 className={styles.revealTitle}>Por qué</h3>
            <Html html={exercise.explanationHtml} className="prose" />
          </section>
          <button ref={nextRef} type="button" className="btn btn-primary" onClick={() => onDone(outcome(), attemptPayload())}>
            {isLast ? 'Ver resumen' : 'Siguiente ejercicio'}
          </button>
        </div>
      )}
    </article>
  );
}
