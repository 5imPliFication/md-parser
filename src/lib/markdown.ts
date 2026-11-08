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
import { marked } from 'marked';

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

function resolveLanguage(lang: string | undefined): LanguageInfo | undefined {
  const token = lang?.trim().split(/\s+/)[0]?.toLowerCase();
  return token ? LANGUAGE_MAP[token] : undefined;
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const source = text.replace(/\n$/, '');
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
  },
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const element = node as Element;

  if (element.tagName === 'A' && element.getAttribute('href')) {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }

  if (element.tagName === 'IMG') {
    element.setAttribute('loading', 'lazy');
    element.setAttribute('decoding', 'async');
  }
});

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;

  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form'],
    FORBID_ATTR: ['style'],
  });
}
