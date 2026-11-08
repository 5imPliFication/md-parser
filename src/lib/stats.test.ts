import { describe, expect, it } from 'vitest';
import { countLines, estimateSize } from './stats';

describe('countLines', () => {
  it('returns zero for an empty document', () => {
    expect(countLines('')).toBe(0);
  });

  it('counts logical lines across line endings', () => {
    expect(countLines('one')).toBe(1);
    expect(countLines('one\ntwo')).toBe(2);
    expect(countLines('one\r\ntwo\rthree')).toBe(3);
  });
});

describe('estimateSize', () => {
  it('reports small documents in bytes', () => {
    expect(estimateSize('')).toBe('~0 B');
    expect(estimateSize('hello')).toBe('~5 B');
  });

  it('uses UTF-8 byte length', () => {
    expect(estimateSize('é')).toBe('~2 B');
  });

  it('rounds larger documents to kilobytes and megabytes', () => {
    expect(estimateSize('a'.repeat(1536))).toBe('~1.5 KB');
    expect(estimateSize('a'.repeat(1024 * 1024))).toBe('~1.0 MB');
  });
});
