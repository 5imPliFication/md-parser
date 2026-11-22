import { describe, expect, it } from 'vitest';
import { needsEnhancement, renderMarkdown } from './markdown';

describe('math syntax', () => {
  it('renders inline math as an escaped placeholder', () => {
    expect(renderMarkdown('Area $a < b^2$ here')).toContain(
      '<span class="math-inline">a &lt; b^2</span>',
    );
  });

  it('renders $$ blocks as display math', () => {
    expect(renderMarkdown('$$\n\\frac{a}{b}\n$$')).toContain(
      '<div class="math-display">\\frac{a}{b}</div>',
    );
    expect(renderMarkdown('$$E = mc^2$$')).toContain('<div class="math-display">E = mc^2</div>');
  });

  it('leaves prices and escaped dollars alone', () => {
    expect(renderMarkdown('It costs $5 and $10.')).not.toContain('math-');
    expect(renderMarkdown('Use \\$x$ literally')).not.toContain('math-');
    expect(renderMarkdown('Spaced $ x $ is text')).not.toContain('math-');
  });

  it('ignores dollars inside code', () => {
    expect(renderMarkdown('`$x$`')).not.toContain('math-');
    expect(renderMarkdown('```\n$$\nx\n$$\n```')).not.toContain('math-');
  });

  it('keeps math inside lists and with source lines', () => {
    const html = renderMarkdown('- item $x$\n\n$$\ny\n$$', { sourceLines: true });
    expect(html).toContain('<span class="math-inline">x</span>');
    expect(html).toMatch(/<div data-source-line="2" class="math-display">y<\/div>|<div class="math-display" data-source-line="2">y<\/div>/);
  });

  it('cannot inject HTML through TeX', () => {
    const html = renderMarkdown('$<img src=x onerror=alert(1)>$');
    expect(html).not.toContain('<img');
  });
});

describe('mermaid fences', () => {
  it('render a diagram placeholder with escaped source', () => {
    const html = renderMarkdown('```mermaid\ngraph TD\n  A-->B<br>\n```');
    expect(html).toContain('<div class="mermaid-diagram"><pre><code class="hljs">graph TD');
    expect(html).toContain('A--&gt;B&lt;br&gt;');
  });
});

describe('needsEnhancement', () => {
  it('detects math and diagrams only', () => {
    expect(needsEnhancement(renderMarkdown('$x$'))).toBe(true);
    expect(needsEnhancement(renderMarkdown('```mermaid\ngraph TD\n```'))).toBe(true);
    expect(needsEnhancement(renderMarkdown('# plain'))).toBe(false);
  });
});
