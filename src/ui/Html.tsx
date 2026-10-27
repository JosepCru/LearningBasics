import type { ElementType } from 'react';

type Props = { html: string; as?: ElementType; className?: string; id?: string };

/**
 * Inserta HTML generado en build desde content/ (Markdown propio del repositorio,
 * renderizado por scripts/content/render.ts). Nunca se usa con texto del usuario.
 */
export function Html({ html, as: Tag = 'div', className, id }: Props) {
  return <Tag className={className} id={id} dangerouslySetInnerHTML={{ __html: html }} />;
}
