import styles from './ElementTile.module.css';

type Props = {
  /** Posición del tema en el currículo de la asignatura (orden real). */
  number: number;
  topicId: string;
  size?: 'sm' | 'lg';
};

/** "Símbolo" del tema: iniciales del último segmento de su ID (chem.mole → Mo). */
export function topicSymbol(topicId: string): string {
  const slug = topicId.split('.').at(-1) ?? topicId;
  const letters = slug.replace(/[^a-z]/g, '');
  return (letters.charAt(0).toUpperCase() + letters.charAt(1)).slice(0, 2);
}

export function ElementTile({ number, topicId, size = 'sm' }: Props) {
  return (
    <span className={`${styles.tile} ${size === 'lg' ? styles.lg : ''}`} aria-hidden="true">
      <span className={styles.number}>{number}</span>
      <span className={styles.symbol}>{topicSymbol(topicId)}</span>
    </span>
  );
}
