import './style.css';
import { buildStandaloneHtml, getDocumentTitle, slugify } from './export';
import { renderMarkdown } from './markdown';
import { SAMPLE_MARKDOWN } from './sample';

const DRAFT_KEY = 'md-parser-draft';
const THEME_KEY = 'md-parser-theme';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type View = 'preview' | 'html';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const editor = required<HTMLTextAreaElement>('#editor');
const preview = required<HTMLElement>('#preview');
const htmlOutput = required<HTMLElement>('#html-output');
const htmlCode = required<HTMLElement>('#html-output code');
const stats = required<HTMLElement>('#stats');
const toastElement = required<HTMLElement>('#toast');
const dropOverlay = required<HTMLElement>('#drop-overlay');
const themeToggle = required<HTMLButtonElement>('#theme-toggle');
const tabPreview = required<HTMLButtonElement>('#tab-preview');
const tabHtml = required<HTMLButtonElement>('#tab-html');
const copyButton = required<HTMLButtonElement>('#copy-html');
const downloadButton = required<HTMLButtonElement>('#download-html');
const sampleButton = required<HTMLButtonElement>('#load-sample');
const clearButton = required<HTMLButtonElement>('#clear');

let html = '';
let view: View = 'preview';
let renderTimer: number | undefined;
let saveTimer: number | undefined;
let toastTimer: number | undefined;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function updateStats(source: string): void {
  const trimmed = source.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = source.length;
  const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));

  stats.textContent = `${words.toLocaleString()} words · ${characters.toLocaleString()} chars · ${minutes} min read`;
}

function render(source: string): void {
  html = renderMarkdown(source);
  preview.innerHTML = html;
  htmlCode.textContent = html || '<!-- Nothing to render yet -->';
  updateStats(source);
}

function scheduleRender(): void {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => render(editor.value), 60);
}

function persistDraft(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => safeSet(DRAFT_KEY, editor.value), 250);
}

function toast(message: string): void {
  toastElement.textContent = message;
  toastElement.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove('is-visible'), 2200);
}

function setView(next: View): void {
  view = next;
  const isPreview = view === 'preview';

  preview.hidden = !isPreview;
  htmlOutput.hidden = isPreview;
  tabPreview.classList.toggle('is-active', isPreview);
  tabHtml.classList.toggle('is-active', !isPreview);
  tabPreview.setAttribute('aria-selected', String(isPreview));
  tabHtml.setAttribute('aria-selected', String(!isPreview));
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  safeSet(THEME_KEY, theme);
  themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();

  if (!copied) {
    throw new Error('Clipboard write failed');
  }
}

function downloadHtml(): void {
  const title = getDocumentTitle(editor.value);
  const page = buildStandaloneHtml(title, html);
  const blob = new Blob([page], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${slugify(title) || 'markdown-export'}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('HTML download started');
}

function loadSource(source: string): void {
  editor.value = source;
  render(source);
  safeSet(DRAFT_KEY, source);
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function showDropOverlay(): void {
  dropOverlay.hidden = false;
}

function hideDropOverlay(): void {
  dropOverlay.hidden = true;
}

themeToggle.addEventListener('click', () => {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
});

editor.addEventListener('input', () => {
  scheduleRender();
  persistDraft();
});

tabPreview.addEventListener('click', () => setView('preview'));
tabHtml.addEventListener('click', () => setView('html'));

copyButton.addEventListener('click', async () => {
  try {
    await copyText(html);
    toast('HTML copied to clipboard');
  } catch {
    toast('Copy failed — open the HTML tab and copy manually');
  }
});

downloadButton.addEventListener('click', downloadHtml);

sampleButton.addEventListener('click', () => {
  loadSource(SAMPLE_MARKDOWN);
  editor.focus();
  toast('Sample loaded');
});

clearButton.addEventListener('click', () => {
  loadSource('');
  editor.focus();
});

window.addEventListener('dragover', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  showDropOverlay();
});

window.addEventListener('dragleave', (event) => {
  if (event.relatedTarget === null) {
    hideDropOverlay();
  }
});

window.addEventListener('drop', async (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  hideDropOverlay();

  const file = event.dataTransfer?.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_BYTES) {
    toast('File is too large (2 MB maximum)');
    return;
  }

  try {
    loadSource(await file.text());
    toast(`Opened ${file.name}`);
  } catch {
    toast('Could not read that file');
  }
});

const initialSource = safeGet(DRAFT_KEY);
const initial = initialSource !== null ? initialSource : SAMPLE_MARKDOWN;

editor.value = initial;
render(initial);
applyTheme(currentTheme());
setView('preview');

if (view === 'preview') {
  preview.hidden = false;
}
