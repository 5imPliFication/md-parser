import { describe, expect, it } from 'vitest';
import { buildStandaloneHtml, escapeHtml, getDocumentTitle, slugify } from './export';

describe('escapeHtml', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe('getDocumentTitle', () => {
  it('extracts the first heading and strips inline formatting', () => {
    expect(getDocumentTitle('Intro\n\n# Hello **world**\n\nBody')).toBe('Hello world');
  });

  it('falls back when there is no heading', () => {
    expect(getDocumentTitle('Just text', 'Fallback')).toBe('Fallback');
  });
});

describe('slugify', () => {
  it('creates a URL-safe slug', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('truncates long titles', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(60);
  });
});

describe('buildStandaloneHtml', () => {
  it('escapes the document title', () => {
    const html = buildStandaloneHtml('</title><script>alert(1)</script>', '<p>Body</p>');

    expect(html).not.toContain('</title><script>');
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;');
  });

  it('includes the rendered body', () => {
    const html = buildStandaloneHtml('Title', '<h1>Body</h1>');

    expect(html).toContain('<h1>Body</h1>');
    expect(html).toContain('<!doctype html>');
  });
});
