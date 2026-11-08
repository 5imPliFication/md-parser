import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings and paragraphs', () => {
    const html = renderMarkdown('# Hello\n\nA paragraph.');

    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<p>A paragraph.</p>');
  });

  it('renders GitHub Flavored Markdown tables', () => {
    const html = renderMarkdown('| Name | Value |\n| --- | --- |\n| A | 1 |');

    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders task list checkboxes', () => {
    const html = renderMarkdown('- [x] Done\n- [ ] Todo');

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('removes script tags and their contents', () => {
    const html = renderMarkdown('<script>alert("xss")</script>\n\nHello');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(');
    expect(html).toContain('<p>Hello</p>');
  });

  it('removes javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
  });

  it('removes inline styles', () => {
    const html = renderMarkdown('<p style="color:red">Styled</p>');

    expect(html).not.toContain('style=');
    expect(html).toContain('Styled');
  });

  it('adds safe attributes to links', () => {
    const html = renderMarkdown('[Example](https://example.com)');

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
