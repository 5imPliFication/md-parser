import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import type { RendererObject } from 'marked';
import { Marked } from 'marked';
import { mathExtension } from './math';

const LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  python,
  typescript,
  xml,
};

for (const [name, language] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, language);
}

interface LanguageInfo {
  id: string;
  label: string;
}

const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  java: { id: 'java', label: 'java' },
  javascript: { id: 'javascript', label: 'javascript' },
  js: { id: 'javascript', label: 'javascript' },
  jsx: { id: 'javascript', label: 'javascript' },
  mjs: { id: 'javascript', label: 'javascript' },
  cjs: { id: 'javascript', label: 'javascript' },
  typescript: { id: 'typescript', label: 'typescript' },
  ts: { id: 'typescript', label: 'typescript' },
  tsx: { id: 'typescript', label: 'typescript' },
  python: { id: 'python', label: 'python' },
  py: { id: 'python', label: 'python' },
  bash: { id: 'bash', label: 'bash' },
  sh: { id: 'bash', label: 'bash' },
  shell: { id: 'bash', label: 'bash' },
  zsh: { id: 'bash', label: 'bash' },
  html: { id: 'xml', label: 'html' },
  xhtml: { id: 'xml', label: 'html' },
  svg: { id: 'xml', label: 'svg' },
  xml: { id: 'xml', label: 'xml' },
  css: { id: 'css', label: 'css' },
  c: { id: 'c', label: 'c' },
  h: { id: 'c', label: 'c' },
  cpp: { id: 'cpp', label: 'cpp' },
  'c++': { id: 'cpp', label: 'cpp' },
  cc: { id: 'cpp', label: 'cpp' },
  cxx: { id: 'cpp', label: 'cpp' },
  hpp: { id: 'cpp', label: 'cpp' },
  csharp: { id: 'csharp', label: 'csharp' },
  'c#': { id: 'csharp', label: 'csharp' },
  cs: { id: 'csharp', label: 'csharp' },
  go: { id: 'go', label: 'go' },
  golang: { id: 'go', label: 'go' },
};

function escapeCode(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * DOMPurify's SANITIZE_NAMED_PROPS prefixes every id/name with this, so
 * user content can't clobber DOM globals (a heading "Title" would otherwise
 * become id="title" and be stripped). In-page `#links` are rewritten to match.
 */
export const ID_PREFIX = 'user-content-';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** GitHub-style heading slug; keeps Unicode letters and numbers. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

/** Slug counts for the document being rendered, so duplicates get -1, -2… */
let headingSlugs = new Map<string, number>();

function uniqueSlug(text: string): string {
  const base = slugifyHeading(text) || 'section';
  const seen = headingSlugs.get(base);
  headingSlugs.set(base, (seen ?? -1) + 1);
  return seen === undefined ? base : `${base}-${seen + 1}`;
}

function resolveLanguage(lang: string | undefined): LanguageInfo | undefined {
  const token = lang?.trim().split(/\s+/)[0]?.toLowerCase();
  return token ? LANGUAGE_MAP[token] : undefined;
}

const renderer: RendererObject = {
  // Class marks real task-list boxes (vs raw HTML inputs) so the preview
  // can make them clickable.
  checkbox({ checked }) {
    return `<input class="task-checkbox" ${checked ? 'checked="" ' : ''}disabled="" type="checkbox">`;
  },
  heading({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    const plain = inner
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
    return `<h${depth} id="${uniqueSlug(plain)}">${inner}</h${depth}>\n`;
  },
  code({ text, lang }) {
    const source = text.replace(/\n$/, '');

    // Diagrams render lazily (enhance.ts); until then the source shows as code.
    if (lang?.trim().split(/\s+/)[0]?.toLowerCase() === 'mermaid') {
      return `<div class="${DIAGRAM_CLASS}"><pre><code class="hljs">${escapeCode(source)}</code></pre></div>`;
    }

    const language = resolveLanguage(lang);

    if (!language) {
      return `<pre><code class="hljs">${escapeCode(source)}</code></pre>`;
    }

    const highlighted = hljs.highlight(source, {
      language: language.id,
      ignoreIllegals: true,
    }).value;

    return `<pre><code class="hljs language-${language.label}">${highlighted}</code></pre>`;
  },
};

/**
 * One configured instance per line-break mode. (marked's lexer replaces its
 * defaults wholesale when given options, so the mode can't be a per-call flag.)
 */
const PARSERS = {
  breaks: new Marked({ gfm: true, breaks: true, renderer }, mathExtension),
  paragraphs: new Marked({ gfm: true, breaks: false, renderer }, mathExtension),
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const element = node as Element;

  const href = element.tagName === 'A' ? element.getAttribute('href') : null;

  if (href?.startsWith('#')) {
    // In-page link: point it at the prefixed id and keep it in this page.
    if (href.length > 1 && !href.startsWith(`#${ID_PREFIX}`)) {
      element.setAttribute('href', `#${ID_PREFIX}${href.slice(1)}`);
    }
  } else if (href) {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }

  if (element.tagName === 'IMG') {
    element.setAttribute('loading', 'lazy');
    element.setAttribute('decoding', 'async');
  }
});

/** Wrapper class for ```mermaid blocks awaiting diagram rendering. */
export const DIAGRAM_CLASS = 'mermaid-diagram';

/** Cheap check for content that needs the lazy KaTeX/Mermaid pass. */
export function needsEnhancement(html: string): boolean {
  return /class="(?:math-inline|math-display|mermaid-diagram)"/.test(html);
}

/** Attribute marking the 0-based source line a rendered block starts on. */
export const SOURCE_LINE_ATTR = 'data-source-line';

const FIRST_OPEN_TAG = /^(\s*<[a-zA-Z][\w-]*)/;

/**
 * Renders top-level blocks one at a time (reference links are resolved at
 * lex time, so this is equivalent to a whole-document parse) and stamps each
 * block's first element with its starting source line, for scroll sync.
 */
function parseWithSourceLines(marked: Marked, source: string): string {
  const tokens = marked.lexer(source);
  let line = 0;
  let html = '';

  for (const token of tokens) {
    if (token.type !== 'space') {
      const chunk = marked.parser([token]);
      html += chunk.replace(FIRST_OPEN_TAG, `$1 ${SOURCE_LINE_ATTR}="${line}"`);
    }
    line += token.raw.split('\n').length - 1;
  }

  return html;
}

export interface RenderOptions {
  /** Add `data-source-line` to top-level blocks (preview only; strip before export). */
  sourceLines?: boolean;
  /** Render every single line break as `<br>` (default) instead of GitHub-style paragraphs. */
  breaks?: boolean;
}

export function renderMarkdown(source: string, options: RenderOptions = {}): string {
  headingSlugs = new Map();
  const marked = options.breaks === false ? PARSERS.paragraphs : PARSERS.breaks;
  const raw = options.sourceLines
    ? parseWithSourceLines(marked, source)
    : (marked.parse(source, { async: false }) as string);

  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form'],
    FORBID_ATTR: ['style'],
    SANITIZE_NAMED_PROPS: true,
  });
}
