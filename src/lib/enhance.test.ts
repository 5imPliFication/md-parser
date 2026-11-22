import { describe, expect, it } from 'vitest';
import { enhance, finalizeHtml } from './enhance';
import { renderMarkdown } from './markdown';

describe('finalizeHtml', () => {
  it('turns math placeholders into MathML for exports', async () => {
    const html = await finalizeHtml(renderMarkdown('Inline $x^2$ and\n\n$$\n\\frac{a}{b}\n$$'));
    expect(html).toContain('<math');
    expect(html).toContain('<mfrac>');
    expect(html).not.toContain('katex-html');
  });

  it('leaves documents without math unchanged in content', async () => {
    const source = renderMarkdown('# Title\n\nText');
    expect(await finalizeHtml(source)).toBe(source);
  });

  it('shows invalid TeX as an error instead of throwing', async () => {
    const html = await finalizeHtml(renderMarkdown('$\\frac{a$'));
    expect(html).toContain('katex-error');
  });
});

describe('enhance', () => {
  it('renders math into the preview and marks it rendered', async () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown('Inline $x^2$');
    await enhance(root);
    const math = root.querySelector<HTMLElement>('.math-inline');
    expect(math?.dataset.rendered).toBe('true');
    expect(math?.getAttribute('data-tex')).toBe('x^2');
    expect(math?.querySelector('.katex')).not.toBeNull();
  });

  it('is synchronous once KaTeX is loaded', () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown('Again $y$');
    expect(enhance(root)).toBeNull();
    expect(root.querySelector('.katex')).not.toBeNull();
  });
});
