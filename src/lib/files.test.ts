import { describe, expect, it } from 'vitest';
import {
  FILE_ACCEPT,
  MAX_FILE_BYTES,
  checkFile,
  isTextFileCandidate,
  looksBinary,
} from './files';

describe('isTextFileCandidate', () => {
  it('accepts Markdown and text extensions even with an empty MIME type', () => {
    expect(isTextFileCandidate('notes.md', '')).toBe(true);
    expect(isTextFileCandidate('NOTES.MARKDOWN', '')).toBe(true);
    expect(isTextFileCandidate('todo.txt', '')).toBe(true);
    expect(isTextFileCandidate('page.mdx', 'application/octet-stream')).toBe(true);
  });

  it('accepts any text/* MIME type', () => {
    expect(isTextFileCandidate('data.csv', 'text/csv')).toBe(true);
    expect(isTextFileCandidate('doc', 'text/markdown')).toBe(true);
  });

  it('allows extensionless files with no type, like README', () => {
    expect(isTextFileCandidate('README', '')).toBe(true);
  });

  it('rejects binary files', () => {
    expect(isTextFileCandidate('photo.png', 'image/png')).toBe(false);
    expect(isTextFileCandidate('report.pdf', 'application/pdf')).toBe(false);
    expect(isTextFileCandidate('archive.zip', '')).toBe(false);
    expect(isTextFileCandidate('program', 'application/x-executable')).toBe(false);
  });

  it('treats dotfiles as extensionless', () => {
    expect(isTextFileCandidate('.notes', '')).toBe(true);
  });
});

describe('looksBinary', () => {
  it('flags content containing NUL characters', () => {
    expect(looksBinary('\u0089PNG\r\n\u001a\n\u0000\u0000')).toBe(true);
  });

  it('passes ordinary text, including non-ASCII', () => {
    expect(looksBinary('# Tiêu đề\n\nHello 👋')).toBe(false);
  });
});

describe('checkFile', () => {
  it('rejects the wrong type before considering size', () => {
    expect(checkFile({ name: 'big.png', type: 'image/png', size: MAX_FILE_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'type',
    });
  });

  it('rejects text files over the size limit', () => {
    expect(checkFile({ name: 'big.md', type: '', size: MAX_FILE_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'size',
    });
  });

  it('accepts a text file at the limit', () => {
    expect(checkFile({ name: 'ok.md', type: '', size: MAX_FILE_BYTES })).toEqual({ ok: true });
  });
});

describe('FILE_ACCEPT', () => {
  it('lists extensions and Markdown MIME types for the file picker', () => {
    expect(FILE_ACCEPT).toContain('.md');
    expect(FILE_ACCEPT).toContain('text/markdown');
  });
});
