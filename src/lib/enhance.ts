import DOMPurify from 'dompurify';
import type { KatexOptions } from 'katex';
import { DIAGRAM_CLASS } from './markdown';
import { MATH_DISPLAY_CLASS, MATH_INLINE_CLASS } from './math';

/**
 * Lazy math (KaTeX) and diagram (Mermaid) rendering. This module and both
 * libraries are dynamically imported only when a document uses them.
 *
 * - `enhance()` fills placeholders in the live preview. Anything already
 *   loaded/cached is applied synchronously, so re-renders while typing don't
 *   flash raw TeX or diagram source.
 * - `finalizeHtml()` turns placeholder HTML into portable HTML for Copy HTML
 *   and exports: MathML for math (no fonts/CSS needed) and inline SVG.
 */

type Katex = typeof import('katex').default;
type Mermaid = typeof import('mermaid').default;

let katex: Katex | null = null;
let katexLoading: Promise<Katex> | null = null;
let mermaidLoading: Promise<Mermaid> | null = null;

function loadKatex(): Promise<Katex> {
  katexLoading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([module]) => (katex = module.default),
  );
  return katexLoading;
}

function loadMermaid(): Promise<Mermaid> {
  mermaidLoading ??= import('mermaid').then(({ default: instance }) => {
    instance.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      // SVG text labels instead of <foreignObject> HTML, so the output can
      // go through DOMPurify's SVG profile intact.
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    });
    return instance;
  });
  return mermaidLoading;
}

const KATEX_BASE: KatexOptions = { throwOnError: false, strict: 'ignore', trust: false };

function texOf(element: Element): { tex: string; display: boolean } {
  return {
    tex: element.getAttribute('data-tex') ?? element.textContent ?? '',
    display: element.classList.contains(MATH_DISPLAY_CLASS),
  };
}

function renderMathElement(lib: Katex, element: HTMLElement): void {
  const { tex, display } = texOf(element);
  // Keep the source for re-rendering and for exports.
  element.setAttribute('data-tex', tex);
  lib.render(tex, element, { ...KATEX_BASE, displayMode: display });
  element.dataset.rendered = 'true';
}

// Diagram results by source text: sanitized SVG, or an error message.
type DiagramResult = { svg: string } | { error: string };
const diagramCache = new Map<string, DiagramResult>();
const DIAGRAM_CACHE_LIMIT = 50;
let diagramCounter = 0;

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['style'],
  });
}

async function renderDiagram(source: string): Promise<DiagramResult> {
  const cached = diagramCache.get(source);
  if (cached) return cached;

  const lib = await loadMermaid();
  const id = `md-diagram-${++diagramCounter}`;
  let result: DiagramResult;

  try {
    const { svg } = await lib.render(id, source);
    result = { svg: sanitizeSvg(svg) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { error: message.split('\n').slice(0, 6).join('\n') };
  } finally {
    // Mermaid leaves a scratch node behind when rendering fails.
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
  }

  if (diagramCache.size >= DIAGRAM_CACHE_LIMIT) {
    const oldest = diagramCache.keys().next().value;
    if (oldest !== undefined) diagramCache.delete(oldest);
  }
  diagramCache.set(source, result);
  return result;
}

function diagramSourceOf(element: Element): string {
  return element.getAttribute('data-source') ?? element.querySelector('code')?.textContent ?? '';
}

function applyDiagram(element: HTMLElement, result: DiagramResult): void {
  element.setAttribute('data-source', diagramSourceOf(element));
  element.dataset.rendered = 'true';

  if ('svg' in result) {
    element.innerHTML = result.svg;
    element.removeAttribute('data-error');
    return;
  }

  const message = document.createElement('pre');
  message.className = 'diagram-error';
  message.textContent = `Diagram error: ${result.error}`;
  const source = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = diagramSourceOf(element);
  source.append(code);
  element.replaceChildren(message, source);
  element.setAttribute('data-error', 'true');
}

/**
 * Renders math and diagrams inside `root`. Returns null when everything was
 * applied synchronously, or a promise that settles once the rest is done.
 */
export function enhance(root: HTMLElement): Promise<void> | null {
  const math = Array.from(
    root.querySelectorAll<HTMLElement>(`.${MATH_INLINE_CLASS}, .${MATH_DISPLAY_CLASS}`),
  ).filter((element) => element.dataset.rendered !== 'true');
  const diagrams = Array.from(root.querySelectorAll<HTMLElement>(`.${DIAGRAM_CLASS}`)).filter(
    (element) => element.dataset.rendered !== 'true',
  );

  const pending: Promise<void>[] = [];

  if (math.length > 0) {
    if (katex) {
      for (const element of math) renderMathElement(katex, element);
    } else {
      pending.push(
        loadKatex().then((lib) => {
          for (const element of math) {
            if (element.isConnected) renderMathElement(lib, element);
          }
        }),
      );
    }
  }

  const uncached: HTMLElement[] = [];
  for (const element of diagrams) {
    const cached = diagramCache.get(diagramSourceOf(element));
    if (cached) applyDiagram(element, cached);
    else uncached.push(element);
  }

  if (uncached.length > 0) {
    pending.push(
      (async () => {
        // Sequential: mermaid.render isn't safe to run concurrently.
        for (const element of uncached) {
          const result = await renderDiagram(diagramSourceOf(element));
          if (element.isConnected) applyDiagram(element, result);
        }
      })(),
    );
  }

  return pending.length > 0 ? Promise.all(pending).then(() => undefined) : null;
}

/** Placeholder HTML → portable HTML (MathML math, inline SVG diagrams). */
export async function finalizeHtml(html: string): Promise<string> {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  const math = Array.from(
    root.querySelectorAll<HTMLElement>(`.${MATH_INLINE_CLASS}, .${MATH_DISPLAY_CLASS}`),
  );
  if (math.length > 0) {
    const lib = await loadKatex();
    for (const element of math) {
      const { tex, display } = texOf(element);
      element.innerHTML = lib.renderToString(tex, {
        ...KATEX_BASE,
        displayMode: display,
        output: 'mathml',
      });
    }
  }

  for (const element of root.querySelectorAll<HTMLElement>(`.${DIAGRAM_CLASS}`)) {
    const source = diagramSourceOf(element);
    const result = await renderDiagram(source);
    if ('svg' in result) {
      element.innerHTML = result.svg;
    }
    // On error, keep the escaped source block as-is.
  }

  const wrapper = document.createElement('div');
  wrapper.append(root);
  return wrapper.innerHTML;
}
