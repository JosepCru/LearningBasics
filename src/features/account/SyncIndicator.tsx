import { Link } from 'react-router';
import { useNow, useSyncState } from '../learning/learning';
import styles from './account.module.css';
import { syncSummary } from './syncText';

/** Estado de sincronización siempre visible en la cabecera; lleva a la página de cuenta. */
export function SyncIndicator() {
  const sync = useSyncState();
  const now = useNow(30_000);
  const { text, tone } = syncSummary(sync.phase, sync.pending, sync.storedLastSuccessAt, now);
  return (
    <Link to="/account" className={`${styles.indicator} ${styles[`tone-${tone}`]}`} title={sync.lastError ?? text}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.indicatorText}>{text}</span>
    </Link>
  );
}
