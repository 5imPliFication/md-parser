import './styles/main.css';
import {
  buildDocHtml,
  buildStandaloneHtml,
  getDocumentTitle,
  slugify,
} from './lib/export';
import { renderMarkdown } from './lib/markdown';
import { countLines, estimateSize } from './lib/stats';
import { SAMPLE_MARKDOWN } from './data/sample';

const DRAFT_KEY = 'md-parser-draft';
const THEME_KEY = 'md-parser-theme';
const SETTINGS_KEY = 'md-parser-settings';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type View = 'preview' | 'html';
type Layout = 'writing' | 'split' | 'cinematic';
type Theme = 'light' | 'dark';

interface Settings {
  syncScroll: boolean;
  layout: Layout;
}

const DEFAULT_SETTINGS: Settings = {
  syncScroll: true,
  layout: 'split',
};

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const editor = required<HTMLTextAreaElement>('#editor');
const lineNumbers = required<HTMLElement>('#line-numbers');
const preview = required<HTMLElement>('#preview');
const htmlOutput = required<HTMLElement>('#html-output');
const htmlCode = required<HTMLElement>('#html-output code');
const stats = required<HTMLElement>('#stats');
const toastElement = required<HTMLElement>('#toast');
const dropOverlay = required<HTMLElement>('#drop-overlay');
const tabPreview = required<HTMLButtonElement>('#tab-preview');
const tabHtml = required<HTMLButtonElement>('#tab-html');
const copyButton = required<HTMLButtonElement>('#copy-html');
const sampleButton = required<HTMLButtonElement>('#load-sample');
const clearButton = required<HTMLButtonElement>('#clear');
const settingsToggle = required<HTMLButtonElement>('#settings-toggle');
const settingsPanel = required<HTMLElement>('#settings-panel');
const exportToggle = required<HTMLButtonElement>('#export-toggle');
const exportMenu = required<HTMLElement>('#export-menu');
const syncScrollToggle = required<HTMLInputElement>('#sync-scroll');
const themeLight = required<HTMLButtonElement>('#theme-light');
const themeDark = required<HTMLButtonElement>('#theme-dark');
const layoutInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="layout"]'),
);

let html = '';
let view: View = 'preview';
let settings = loadSettings();
let renderTimer: number | undefined;
let saveTimer: number | undefined;
let toastTimer: number | undefined;
let scrollLock: HTMLElement | null = null;
let scrollLockTimer: number | undefined;
let renderedLineCount = 0;

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

function loadSettings(): Settings {
  const raw = safeGet(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const layout: Layout =
      parsed.layout === 'writing' || parsed.layout === 'cinematic'
        ? parsed.layout
        : 'split';

    return {
      syncScroll: parsed.syncScroll !== false,
      layout,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(): void {
  safeSet(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings(persist = true): void {
  document.documentElement.dataset.layout = settings.layout;
  syncScrollToggle.checked = settings.syncScroll;

  for (const input of layoutInputs) {
    input.checked = input.value === settings.layout;
  }

  scrollLock = null;

  if (persist) {
    saveSettings();
  }

  if (settings.layout === 'split' && view === 'preview') {
    window.requestAnimationFrame(() => syncScroll(editor, preview));
  }
}

function updateStats(source: string): void {
  const trimmed = source.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = source.length;
  const lines = countLines(source);
  const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));

  stats.textContent = `${words.toLocaleString()} words · ${characters.toLocaleString()} chars · ${estimateSize(source)} · ${lines.toLocaleString()} lines · ${minutes} min read`;
}

function updateLineNumbers(source = editor.value): void {
  const lines = Math.max(1, countLines(source));

  if (lines !== renderedLineCount) {
    renderedLineCount = lines;
    lineNumbers.textContent = Array.from(
      { length: lines },
      (_, index) => index + 1,
    ).join('\n');
    lineNumbers.style.setProperty('--digits', String(Math.max(2, String(lines).length)));
  }

  lineNumbers.scrollTop = editor.scrollTop;
}

function render(source: string): void {
  html = renderMarkdown(source);
  preview.innerHTML = html;
  htmlCode.textContent = html || '<!-- Nothing to render yet -->';
  updateStats(source);
  updateLineNumbers(source);
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

  if (isPreview) {
    window.requestAnimationFrame(() => syncScroll(editor, preview));
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  safeSet(THEME_KEY, theme);
  themeLight.classList.toggle('is-active', theme === 'light');
  themeDark.classList.toggle('is-active', theme === 'dark');
  themeLight.setAttribute('aria-pressed', String(theme === 'light'));
  themeDark.setAttribute('aria-pressed', String(theme === 'dark'));
}

function syncScroll(source: HTMLElement, target: HTMLElement): void {
  if (!settings.syncScroll || settings.layout !== 'split' || view !== 'preview') {
    return;
  }

  if (scrollLock === target) {
    return;
  }

  scrollLock = source;

  const sourceMax = source.scrollHeight - source.clientHeight;
  const targetMax = target.scrollHeight - target.clientHeight;

  if (sourceMax > 0 && targetMax > 0) {
    target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
  }

  if (target === editor) {
    lineNumbers.scrollTop = editor.scrollTop;
  }

  window.clearTimeout(scrollLockTimer);
  scrollLockTimer = window.setTimeout(() => {
    scrollLock = null;
  }, 120);
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

function exportBaseName(): string {
  return slugify(getDocumentTitle(editor.value)) || 'markdown-export';
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportMarkdown(): void {
  downloadFile(`${exportBaseName()}.md`, editor.value, 'text/markdown;charset=utf-8');
  toast('Markdown downloaded');
}

function exportHtml(): void {
  const title = getDocumentTitle(editor.value);
  downloadFile(
    `${exportBaseName()}.html`,
    buildStandaloneHtml(title, html),
    'text/html;charset=utf-8',
  );
  toast('HTML downloaded');
}

function exportDoc(): void {
  const title = getDocumentTitle(editor.value);
  downloadFile(
    `${exportBaseName()}.doc`,
    `\ufeff${buildDocHtml(title, html)}`,
    'application/msword;charset=utf-8',
  );
  toast('Word document downloaded');
}

async function exportPdf(): Promise<void> {
  if (!editor.value.trim()) {
    toast('Nothing to export yet');
    return;
  }

  const originalLabel = exportToggle.textContent;
  exportToggle.disabled = true;
  exportToggle.textContent = 'Exporting…';
  toast('Preparing PDF…');

  try {
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    const container = document.createElement('div');
    const clone = preview.cloneNode(true) as HTMLElement;

    container.className = 'pdf-export';
    clone.removeAttribute('id');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-labelledby');
    clone.removeAttribute('hidden');
    container.append(clone);
    document.body.append(container);

    let canvas: HTMLCanvasElement;

    try {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
    } finally {
      container.remove();
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const pixelsPerPoint = canvas.width / contentWidth;
    const pageContentHeight = Math.floor(contentHeight * pixelsPerPoint);

    let offset = 0;
    let pageIndex = 0;

    while (offset < canvas.height) {
      const sliceHeight = Math.min(pageContentHeight, canvas.height - offset);
      const pageCanvas = document.createElement('canvas');
      const context = pageCanvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create the PDF canvas');
      }

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(
        canvas,
        0,
        offset,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        margin,
        margin,
        contentWidth,
        sliceHeight / pixelsPerPoint,
      );

      offset += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(`${exportBaseName()}.pdf`);
    toast('PDF downloaded');
  } catch (error) {
    console.error(error);
    toast('PDF export failed');
  } finally {
    exportToggle.disabled = false;
    exportToggle.textContent = originalLabel;
  }
}

function closePopovers(): void {
  settingsPanel.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');
  exportMenu.hidden = true;
  exportToggle.setAttribute('aria-expanded', 'false');
}

function togglePopover(button: HTMLButtonElement, panel: HTMLElement): void {
  const shouldOpen = panel.hidden;
  closePopovers();

  if (shouldOpen) {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }
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

settingsToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePopover(settingsToggle, settingsPanel);
});

exportToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePopover(exportToggle, exportMenu);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest('.menu')) {
    return;
  }
  closePopovers();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePopovers();
  }
});

syncScrollToggle.addEventListener('change', () => {
  settings.syncScroll = syncScrollToggle.checked;
  saveSettings();
  toast(settings.syncScroll ? 'Scroll sync enabled' : 'Scroll sync disabled');
});

for (const input of layoutInputs) {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    settings.layout = input.value as Layout;
    applySettings();
    toast(
      settings.layout === 'writing'
        ? 'Writing mode'
        : settings.layout === 'cinematic'
          ? 'Cinematic mode'
          : 'Preview mode',
    );
  });
}

themeLight.addEventListener('click', () => applyTheme('light'));
themeDark.addEventListener('click', () => applyTheme('dark'));

editor.addEventListener('input', () => {
  updateLineNumbers();
  scheduleRender();
  persistDraft();
});

editor.addEventListener(
  'scroll',
  () => {
    lineNumbers.scrollTop = editor.scrollTop;
    syncScroll(editor, preview);
  },
  { passive: true },
);
preview.addEventListener('scroll', () => syncScroll(preview, editor), { passive: true });

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

exportMenu.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const item = target.closest<HTMLButtonElement>('[data-export]');
  if (!item) return;

  closePopovers();

  switch (item.dataset.export) {
    case 'md':
      exportMarkdown();
      break;
    case 'html':
      exportHtml();
      break;
    case 'pdf':
      void exportPdf();
      break;
    case 'doc':
      exportDoc();
      break;
  }
});

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
applySettings(false);
applyTheme(currentTheme());
setView('preview');
