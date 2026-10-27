import { BAND_LABELS, type ObjectiveMastery } from '../../core/mastery/mastery';
import styles from './progress.module.css';

/** Banda de dominio + número de evidencias. Nunca un porcentaje: ver docs/MASTERY.md. */
export function MasteryBadge({ mastery }: { mastery: ObjectiveMastery | undefined }) {
  const band = mastery?.band ?? 'no-data';
  const evidence = mastery?.evidence ?? 0;
  const title = `${BAND_LABELS[band]} · ${evidence} ${evidence === 1 ? 'intento' : 'intentos'}`;
  return (
    <span className={`${styles.band} ${styles[`band-${band}`]}`} title={title}>
      {BAND_LABELS[band]}
      {evidence > 0 && <span className={styles.evidence}> · {evidence}</span>}
    </span>
  );
}
