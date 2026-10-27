import type { ReactNode } from 'react';
import styles from './Status.module.css';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  children?: ReactNode;
};

/** Estados de carga, error y vacío con el mismo aspecto en toda la app. */
export function Status({ kind, title, children }: Props) {
  return (
    <div className={`${styles.status} ${styles[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      <p className={styles.title}>{title}</p>
      {children}
    </div>
  );
}
