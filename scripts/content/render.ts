/**
 * Markdown → HTML en tiempo de build: GFM, KaTeX, mhchem y bloques ::: propios.
 * Los problemas (LaTeX inválido, directivas desconocidas, imágenes sin alt o
 * inexistentes) se devuelven para que la validación los trate como errores.
 */
import 'katex/contrib/mhchem';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

/** Bloques ::: admitidos en las lecciones. */
const BLOCKS: Record<string, { tag: string; title: string }> = {
  'worked-example': { tag: 'section', title: 'Ejemplo resuelto' },
  note: { tag: 'aside', title: 'Nota' },
  pitfall: { tag: 'aside', title: 'Error frecuente' },
};

type AnyNode = {
  type: string;
  name?: string;
  tagName?: string;
  children?: AnyNode[];
  properties?: Record<string, unknown>;
  data?: Record<string, unknown>;
  value?: string;
};

export type RenderOptions = {
  /** Fragmento corto (opción, flashcard): quita el <p> envolvente si es único. */
  inline?: boolean;
  /** Traduce el src de una imagen a la URL publicada; devuelve null si no existe. */
  resolveImage?: (src: string) => string | null;
};

export type RenderResult = { html: string; problems: string[] };

export function renderMarkdown(markdown: string, options: RenderOptions = {}): RenderResult {
  const problems: string[] = [];

  const directives = () => (tree: AnyNode) => {
    visit(tree as never, (node: AnyNode, index?: number, parent?: AnyNode) => {
      // No usamos directivas en línea: "10:30" o "1:2" deben quedarse como texto.
      if (node.type === 'textDirective' && parent?.children && index !== undefined) {
        const label = (node.children ?? []).map((c) => c.value ?? '').join('');
        parent.children[index] = { type: 'text', value: `:${node.name}${label ? `[${label}]` : ''}` };
        return;
      }
      if (node.type === 'containerDirective') {
        const block = BLOCKS[node.name ?? ''];
        if (!block) {
          problems.push(`Bloque desconocido ":::${node.name}" (admitidos: ${Object.keys(BLOCKS).join(', ')})`);
          return;
        }
        node.data = { hName: block.tag, hProperties: { className: ['block', `block-${node.name}`] } };
        const first = node.children?.[0];
        if (first?.type === 'paragraph' && first.data?.directiveLabel) {
          first.data = { ...first.data, hProperties: { className: ['block-title'] } };
        } else {
          node.children?.unshift({
            type: 'paragraph',
            data: { hProperties: { className: ['block-title'] } },
            children: [{ type: 'text', value: block.title }],
          });
        }
      } else if (node.type === 'leafDirective') {
        problems.push(`Directiva inesperada "::${node.name}". Los bloques se escriben con ":::".`);
      }
    });
  };

  const images = () => (tree: AnyNode) => {
    visit(tree as never, 'element', (node: AnyNode) => {
      if (node.tagName !== 'img' || !node.properties) return;
      const src = String(node.properties.src ?? '');
      const alt = String(node.properties.alt ?? '').trim();
      if (!alt) problems.push(`Imagen sin texto alternativo: ${src}`);
      const resolved = options.resolveImage?.(src) ?? null;
      if (!resolved) problems.push(`Imagen no encontrada o fuera de assets/: ${src}`);
      else node.properties.src = resolved;
      node.properties.loading = 'lazy';
    });
  };

  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(directives)
    .use(remarkRehype)
    .use(images)
    .use(rehypeKatex, { strict: 'ignore', output: 'htmlAndMathml' })
    .use(rehypeStringify)
    .processSync(markdown);

  for (const message of file.messages) {
    const reason = message.reason ?? String(message);
    const cause = message.cause instanceof Error ? `: ${message.cause.message}` : '';
    problems.push(`${reason}${cause}`);
  }

  let html = String(file).trim();
  if (options.inline) {
    const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
    if (single && !single[1]!.includes('<p>')) html = single[1]!;
  }
  return { html, problems };
}
