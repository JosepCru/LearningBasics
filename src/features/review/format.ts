/** "10 min", "3 h", "4 d", "2 meses": cuándo volverá a aparecer la tarjeta. */
export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} d`;
  const months = Math.round(d / 30.4);
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.round((d / 365) * 10) / 10;
  return `${years.toLocaleString('es')} ${years === 1 ? 'año' : 'años'}`;
}
