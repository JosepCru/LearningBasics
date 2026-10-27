import type { Provenance } from '../../core/content/schemas';
import styles from './lessons.module.css';

const LABELS: Record<Provenance, { text: string; title: string } | null> = {
  'ai-drafted': {
    text: 'Borrador — no verificado',
    title: 'Redactado con ayuda de IA y aún no revisado contra la fuente citada. Contrasta los datos con la fuente.',
  },
  'self-reviewed': { text: 'Revisado', title: 'Revisado por el propietario contra la fuente citada.' },
  verified: null,
};

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const label = LABELS[provenance];
  if (!label) return null;
  return (
    <span className={`${styles.badge} ${provenance === 'ai-drafted' ? styles.badgeDraft : ''}`} title={label.title}>
      {label.text}
    </span>
  );
}
