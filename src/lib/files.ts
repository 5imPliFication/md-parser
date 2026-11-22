export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Extensions offered by the file picker and accepted regardless of MIME type. */
export const TEXT_EXTENSIONS = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkd',
  '.mkdn',
  '.mdx',
  '.txt',
  '.text',
];

/** Value for the file input's `accept` attribute. */
export const FILE_ACCEPT = [...TEXT_EXTENSIONS, 'text/markdown', 'text/plain'].join(',');

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/**
 * Decides from name and MIME type whether a file is worth reading as text.
 * Browsers often report `.md` with an empty type, so the extension wins;
 * extensionless files such as `README` are allowed and content-checked later.
 */
export function isTextFileCandidate(name: string, type: string): boolean {
  const extension = extensionOf(name);
  if (TEXT_EXTENSIONS.includes(extension)) return true;
  if (type.startsWith('text/')) return true;
  return extension === '' && type === '';
}

/** Binary data read as text almost always contains NUL characters. */
export function looksBinary(content: string): boolean {
  return content.includes('\u0000');
}

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: 'type' | 'size' };

export function checkFile(file: Pick<File, 'name' | 'type' | 'size'>): FileCheck {
  if (!isTextFileCandidate(file.name, file.type)) return { ok: false, reason: 'type' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}
