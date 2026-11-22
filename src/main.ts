import './styles/main.css';
import {
  buildDocHtml,
  buildStandaloneHtml,
  getDocumentTitle,
  slugify,
} from './lib/export';
import { SOURCE_LINE_ATTR, renderMarkdown } from './lib/markdown';
import type { ScrollMap } from './lib/scrollmap';
import { buildScrollMap, invertScrollMap, mapScroll } from './lib/scrollmap';
import { countLines, estimateSize } from './lib/stats';
import { SAMPLE_MARKDOWN } from './data/sample';
import type { Edit } from './lib/editing';
import { continueList, indent, outdent, toggleWrap } from './lib/editing';
import { FILE_ACCEPT, checkFile, looksBinary } from './lib/files';

const DRAFT_KEY = 'md-parser-draft';
const THEME_KEY = 'md-parser-theme';
const SETTINGS_KEY = 'md-parser-settings';

type View = 'preview' | 'html';
type Layout = 'writing' | 'split' | 'cinematic';
type Theme = 'light' | 'dark';
type ThemeChoice = Theme | 'system';

interface Settings {
  syncScroll: boolean;
  layout: Layout;
  wrap: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  syncScroll: true,
  layout: 'split',
  wrap: true,
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
const openButton = required<HTMLButtonElement>('#open-file');
const fileInput = required<HTMLInputElement>('#file-input');
const sampleButton = required<HTMLButtonElement>('#load-sample');
const clearButton = required<HTMLButtonElement>('#clear');
const settingsToggle = required<HTMLButtonElement>('#settings-toggle');
const settingsPanel = required<HTMLElement>('#settings-panel');
const exportToggle = required<HTMLButtonElement>('#export-toggle');
const exportMenu = required<HTMLElement>('#export-menu');
const syncScrollToggle = required<HTMLInputElement>('#sync-scroll');
const wrapToggle = required<HTMLInputElement>('#wrap-lines');
const themeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]'),
);
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const layoutInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="layout"]'),
);

let html = '';
let view: View = 'preview';
let settings = loadSettings();
let themeChoice: ThemeChoice = 'system';
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
      wrap: parsed.wrap !== false,
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
  document.documentElement.dataset.wrap = settings.wrap ? 'on' : 'off';
  editor.wrap = settings.wrap ? 'soft' : 'off';
  syncScrollToggle.checked = settings.syncScroll;
  wrapToggle.checked = settings.wrap;

  for (const input of layoutInputs) {
    input.checked = input.value === settings.layout;
  }

  scrollLock = null;
  invalidateScrollMap();

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

const SOURCE_LINE_MARKER = new RegExp(`(<[a-zA-Z][\\w-]*) ${SOURCE_LINE_ATTR}="\\d+"`, 'g');

function render(source: string): void {
  const previewHtml = renderMarkdown(source, { sourceLines: true });
  preview.innerHTML = previewHtml;
  // Copy/export get clean HTML without the scroll-sync markers.
  html = previewHtml.replace(SOURCE_LINE_MARKER, '$1');
  invalidateScrollMap();
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

interface ToastAction {
  label: string;
  run: () => void;
}

function hideToast(): void {
  window.clearTimeout(toastTimer);
  toastElement.classList.remove('is-visible', 'has-action');
}

function toast(message: string, action?: ToastAction): void {
  const text = document.createElement('span');
  text.textContent = message;
  toastElement.replaceChildren(text);
  toastElement.classList.toggle('has-action', Boolean(action));

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      hideToast();
      action.run();
    });
    toastElement.append(button);
  }

  toastElement.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, action ? 6000 : 2200);
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
    invalidateScrollMap();
    window.requestAnimationFrame(() => syncScroll(editor, preview));
  }
}

function loadThemeChoice(): ThemeChoice {
  const stored = safeGet(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice;
  return systemDark.matches ? 'dark' : 'light';
}

/** Applies a theme choice; only an explicit click should persist it. */
function applyTheme(choice: ThemeChoice, persist = false): void {
  themeChoice = choice;
  document.documentElement.dataset.theme = resolveTheme(choice);

  if (persist) {
    safeSet(THEME_KEY, choice);
  }

  for (const button of themeButtons) {
    const active = button.dataset.themeChoice === choice;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

// Scroll sync maps positions block by block: each rendered block knows its
// source line, so the editor and preview line up at every heading, code
// block and image, not just proportionally. The map is rebuilt lazily after
// anything that moves content (render, resize, wrap, images, <details>).
let scrollMap: ScrollMap | null = null;

function invalidateScrollMap(): void {
  scrollMap = null;
}

function paddingTop(element: HTMLElement): number {
  return parseFloat(getComputedStyle(element).paddingTop) || 0;
}

const MIRROR_STYLES = [
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'tabSize',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
] as const;

/** Top offset (content coordinates) of each given 0-based line in the editor. */
function editorLineTops(lines: readonly number[]): number[] {
  const style = getComputedStyle(editor);

  if (!settings.wrap) {
    const lineHeight = parseFloat(style.lineHeight) || 20;
    return lines.map((line) => paddingTop(editor) + line * lineHeight);
  }

  // Wrapped lines have no fixed height, so measure in a hidden mirror that
  // wraps exactly like the textarea, with a marker at each wanted line.
  const mirror = document.createElement('div');
  for (const name of MIRROR_STYLES) {
    mirror.style[name] = style[name];
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    width: `${editor.clientWidth}px`,
    border: '0',
  });

  const wanted = new Set(lines);
  const markers = new Map<number, HTMLElement>();
  const sourceLines = editor.value.split('\n');
  let pending = '';

  sourceLines.forEach((text, index) => {
    if (wanted.has(index)) {
      mirror.append(pending);
      pending = '';
      const marker = document.createElement('span');
      markers.set(index, marker);
      mirror.append(marker);
    }
    pending += index < sourceLines.length - 1 ? `${text}\n` : text;
  });
  mirror.append(pending);

  document.body.append(mirror);
  const tops = lines.map((line) => markers.get(line)?.offsetTop ?? 0);
  mirror.remove();
  return tops;
}

function getScrollMap(): ScrollMap {
  if (scrollMap) return scrollMap;

  const blocks = Array.from(preview.querySelectorAll<HTMLElement>(`[${SOURCE_LINE_ATTR}]`));
  const lines = blocks.map((block) => Number(block.getAttribute(SOURCE_LINE_ATTR)));
  const previewTop = preview.getBoundingClientRect().top - preview.scrollTop;
  const previewPad = paddingTop(preview);
  const editorPad = paddingTop(editor);

  // Scroll positions that put each block / its source line at the top edge.
  const previewAnchors = blocks.map(
    (block) => block.getBoundingClientRect().top - previewTop - previewPad,
  );
  const editorAnchors = editorLineTops(lines).map((top) => top - editorPad);

  scrollMap = buildScrollMap(
    editorAnchors,
    previewAnchors,
    editor.scrollHeight - editor.clientHeight,
    preview.scrollHeight - preview.clientHeight,
  );
  return scrollMap;
}

function syncScroll(source: HTMLElement, target: HTMLElement): void {
  if (!settings.syncScroll || settings.layout !== 'split' || view !== 'preview') {
    return;
  }

  if (scrollLock === target) {
    return;
  }

  scrollLock = source;

  const map = getScrollMap();
  target.scrollTop = mapScroll(
    source.scrollTop,
    source === editor ? map : invertScrollMap(map),
  );

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

async function loadPreviewImages(timeoutMs = 3000): Promise<void> {
  const images = Array.from(preview.querySelectorAll('img'));
  if (images.length === 0) return;

  for (const image of images) {
    image.loading = 'eager';
  }

  await Promise.race([
    Promise.allSettled(images.map((image) => image.decode())),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

async function exportPdf(): Promise<void> {
  if (!editor.value.trim()) {
    toast('Nothing to export yet');
    return;
  }

  // The preview must hold the latest source, even mid-debounce.
  window.clearTimeout(renderTimer);
  render(editor.value);
  await loadPreviewImages();

  // Browsers use document.title as the default "Save as PDF" filename.
  const appTitle = document.title;
  document.title = exportBaseName();
  window.addEventListener(
    'afterprint',
    () => {
      document.title = appTitle;
    },
    { once: true },
  );

  toast('Choose "Save as PDF" in the print dialog');
  window.print();
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
    // Move focus into the panel: the selected option if there is one.
    panel
      .querySelector<HTMLElement>('input:checked, button, input')
      ?.focus();
  }
}

/** Closes an open popover and returns focus to its toggle button. */
function dismissPopover(): boolean {
  const open = [
    { button: settingsToggle, panel: settingsPanel },
    { button: exportToggle, panel: exportMenu },
  ].find(({ panel }) => !panel.hidden);

  if (!open) return false;

  closePopovers();
  open.button.focus();
  return true;
}

function setSource(source: string): void {
  // Replace the text as an edit (not by assigning .value) so the textarea's
  // own undo history survives and Ctrl+Z can bring the old draft back.
  editor.focus();
  editor.select();
  const edited =
    source === ''
      ? document.execCommand('delete')
      : document.execCommand('insertText', false, source);

  if (!edited || editor.value !== source) {
    editor.value = source;
  }

  editor.setSelectionRange(0, 0);
  editor.scrollTop = 0;
  window.clearTimeout(renderTimer);
  window.clearTimeout(saveTimer);
  render(source);
  safeSet(DRAFT_KEY, source);
}

/** Replaces the whole draft, offering Undo when non-empty work would be lost. */
function replaceSource(source: string, message: string): void {
  const previous = editor.value;
  if (previous === source) {
    toast(message);
    return;
  }

  setSource(source);

  if (!previous.trim()) {
    toast(message);
    return;
  }

  toast(message, {
    label: 'Undo',
    run: () => {
      setSource(previous);
      toast('Restored previous draft');
    },
  });
}

async function openFile(file: File): Promise<void> {
  const check = checkFile(file);
  if (!check.ok) {
    toast(
      check.reason === 'size'
        ? 'File is too large (2 MB maximum)'
        : `${file.name} is not a Markdown or text file`,
    );
    return;
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    toast('Could not read that file');
    return;
  }

  if (looksBinary(content)) {
    toast(`${file.name} is not a Markdown or text file`);
    return;
  }

  replaceSource(content, `Opened ${file.name}`);
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

// Tabbing out of an open popover closes that popover (only that one, so
// moving focus into another menu's freshly opened panel keeps it open).
for (const { button, panel } of [
  { button: settingsToggle, panel: settingsPanel },
  { button: exportToggle, panel: exportMenu },
]) {
  const menu = button.closest<HTMLElement>('.menu');
  menu?.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (!panel.hidden && next instanceof Node && !menu.contains(next)) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dismissPopover()) {
    event.preventDefault();
  }
});

wrapToggle.addEventListener('change', () => {
  settings.wrap = wrapToggle.checked;
  applySettings();
  updateLineNumbers();
  toast(settings.wrap ? 'Line wrap on' : 'Line wrap off');
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

for (const button of themeButtons) {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themeChoice as ThemeChoice, true);
  });
}

systemDark.addEventListener('change', () => {
  if (themeChoice === 'system') {
    applyTheme('system');
  }
});

/** Applies an edit as a native one so it lands in the textarea's undo stack. */
function applyEdit(edit: Edit): void {
  editor.setSelectionRange(edit.start, edit.end);
  let edited = true;

  if (edit.text) {
    edited = document.execCommand('insertText', false, edit.text);
  } else if (edit.start !== edit.end) {
    edited = document.execCommand('delete');
  }

  if (!edited) {
    editor.setRangeText(edit.text, edit.start, edit.end);
    editor.dispatchEvent(new Event('input'));
  }

  editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

// After Escape, the next Tab moves focus out of the editor instead of
// indenting, so keyboard users are never trapped in the textarea.
let tabReleased = false;

editor.addEventListener('keydown', (event) => {
  if (event.isComposing) return;

  const { value, selectionStart: start, selectionEnd: end } = editor;
  const mod = event.ctrlKey || event.metaKey;
  let edit: Edit | null = null;
  let handled = false;

  if (event.key === 'Escape') {
    tabReleased = true;
    return;
  }

  if (event.key === 'Tab' && !mod && !event.altKey) {
    if (tabReleased) {
      tabReleased = false;
      return;
    }
    edit = event.shiftKey ? outdent(value, start, end) : indent(value, start, end);
    handled = true;
  } else if (event.key === 'Enter' && !mod && !event.shiftKey && !event.altKey) {
    edit = continueList(value, start, end);
    handled = edit !== null;
  } else if (mod && !event.altKey && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === 'b' || key === 'i') {
      edit = toggleWrap(value, start, end, key === 'b' ? '**' : '*');
      handled = true;
    }
  }

  tabReleased = false;

  if (handled) {
    event.preventDefault();
    if (edit) applyEdit(edit);
  }
});

document.addEventListener('keydown', (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 's'
  ) {
    event.preventDefault();
    exportMarkdown();
  }
});

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

// Anything that changes where content sits invalidates the scroll map.
new ResizeObserver(invalidateScrollMap).observe(editor);
new ResizeObserver(invalidateScrollMap).observe(preview);
preview.addEventListener('load', invalidateScrollMap, true);
preview.addEventListener('toggle', invalidateScrollMap, true);
void document.fonts?.ready.then(invalidateScrollMap);

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
  replaceSource(SAMPLE_MARKDOWN, 'Sample loaded');
});

clearButton.addEventListener('click', () => {
  replaceSource('', 'Draft cleared');
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
  if (file) {
    await openFile(file);
  }
});

fileInput.accept = FILE_ACCEPT;

openButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  // Reset so picking the same file again still fires "change".
  fileInput.value = '';
  if (file) {
    await openFile(file);
  }
});

// Keep tabs in step. Theme and settings follow silently; a draft edited in
// another tab is offered (not forced) so typing here is never overwritten.
let externalDraft: string | null = null;
let externalDraftOffered = false;

function offerExternalDraft(): void {
  if (externalDraft === null || externalDraftOffered) return;
  if (document.visibilityState !== 'visible') return;
  if (externalDraft === editor.value) {
    externalDraft = null;
    return;
  }

  externalDraftOffered = true;

  toast('Draft changed in another tab', {
    label: 'Load',
    run: () => {
      if (externalDraft !== null) {
        replaceSource(externalDraft, 'Loaded draft from other tab');
      }
      externalDraft = null;
    },
  });
}

window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage) return;

  if (event.key === THEME_KEY || event.key === null) {
    applyTheme(loadThemeChoice());
  }

  if (event.key === SETTINGS_KEY || event.key === null) {
    settings = loadSettings();
    applySettings(false);
  }

  if (event.key === DRAFT_KEY && event.newValue !== null) {
    externalDraft = event.newValue;
    externalDraftOffered = false;
    offerExternalDraft();
  }
});

document.addEventListener('visibilitychange', offerExternalDraft);

// Collapsed <details> would print only their summary, so expand them for the
// print (Export → PDF or Ctrl+P) and restore the reader's state afterwards.
let detailsOpenedForPrint: HTMLDetailsElement[] = [];

window.addEventListener('beforeprint', () => {
  detailsOpenedForPrint = Array.from(
    preview.querySelectorAll<HTMLDetailsElement>('details:not([open])'),
  );
  for (const details of detailsOpenedForPrint) {
    details.open = true;
  }
});

window.addEventListener('afterprint', () => {
  for (const details of detailsOpenedForPrint) {
    details.open = false;
  }
  detailsOpenedForPrint = [];
});

const initialSource = safeGet(DRAFT_KEY);
const initial = initialSource !== null ? initialSource : SAMPLE_MARKDOWN;

editor.value = initial;
render(initial);
applySettings(false);
applyTheme(loadThemeChoice());
setView('preview');
