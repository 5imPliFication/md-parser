import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings and paragraphs', () => {
    const html = renderMarkdown('# Hello\n\nA paragraph.');

    expect(html).toContain('<h1 id="user-content-hello">Hello</h1>');
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

describe('code highlighting', () => {
  const samples = [
    ['java', 'public class Main {}'],
    ['javascript', 'const answer = 42;'],
    ['typescript', 'const answer: number = 42;'],
    ['python', 'def main():\n    return 1'],
    ['bash', 'echo "hello"'],
    ['html', '<div class="box">Hello</div>'],
    ['css', '.box { color: red; }'],
    ['c', 'int main(void) { return 0; }'],
    ['cpp', 'int main() { return 0; }'],
    ['csharp', 'public class Main {}'],
    ['go', 'func main() {}'],
  ] as const;

  it.each(samples)('highlights %s fences', (language, code) => {
    const html = renderMarkdown(`\`\`\`${language}\n${code}\n\`\`\``);

    expect(html).toContain(`class="hljs language-${language}"`);
    expect(html).toContain('hljs-');
  });

  it('supports common aliases', () => {
    const html = renderMarkdown('```ts\nconst answer: number = 42;\n```');

    expect(html).toContain('class="hljs language-typescript"');
  });

  it('leaves unknown languages as escaped plain text', () => {
    const html = renderMarkdown('```unknown\n<script>alert(1)</script>\n```');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('hljs-');
  });
});

describe('language aliases', () => {
  it.each([
    ['js', 'const answer = 42;', 'javascript'],
    ['ts', 'const answer: number = 42;', 'typescript'],
    ['sh', 'echo "hello"', 'bash'],
    ['c++', 'int main() { return 0; }', 'cpp'],
    ['c#', 'public class Main {}', 'csharp'],
    ['golang', 'func main() {}', 'go'],
  ] as const)('maps %s to %s', (alias, code, expected) => {
    const html = renderMarkdown(`\`\`\`${alias}\n${code}\n\`\`\``);

    expect(html).toContain(`class="hljs language-${expected}"`);
  });
});

describe('highlighted code safety', () => {
  it('escapes HTML inside highlighted fences', () => {
    const html = renderMarkdown('```html\n<script>alert(1)</script>\n```');

    expect(html).toContain('&lt;');
    expect(html).not.toContain('<script>');
  });
});

describe('renderMarkdown with source lines', () => {
  const source = [
    '# Title', // 0
    '', // 1
    'Paragraph one', // 2
    'continues here.', // 3
    '', // 4
    '', // 5
    '- a', // 6
    '- b', // 7
    '', // 8
    '```ts', // 9
    'const x = 1;', // 10
    '```', // 11
    '', // 12
    '[ref]: https://example.com', // 13
    '', // 14
    'See [ref].', // 15
  ].join('\n');

  it('stamps each top-level block with its starting line', () => {
    const html = renderMarkdown(source, { sourceLines: true });
    const lines = [...html.matchAll(/<(\w+) data-source-line="(\d+)"/g)].map(
      ([, tag, line]) => `${tag}:${line}`,
    );

    expect(lines).toEqual(['h1:0', 'p:2', 'ul:6', 'pre:9', 'p:15']);
  });

  it('renders the same document as the plain path apart from the markers', () => {
    const marked = renderMarkdown(source, { sourceLines: true });
    expect(marked.replace(/ data-source-line="\d+"/g, '')).toBe(renderMarkdown(source));
  });

  it('still resolves reference links and sanitizes HTML', () => {
    const html = renderMarkdown(`${source}\n\n<img src=x onerror="alert(1)">`, {
      sourceLines: true,
    });
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('onerror');
  });

  it('leaves the plain output free of markers', () => {
    expect(renderMarkdown(source)).not.toContain('data-source-line');
  });
});

describe('heading anchors', () => {
  it('gives headings prefixed GitHub-style ids', () => {
    const html = renderMarkdown('# Hello **World**!\n\n## Tiêu đề 2');
    expect(html).toContain('<h1 id="user-content-hello-world">');
    expect(html).toContain('<h2 id="user-content-tiêu-đề-2">');
  });

  it('keeps ids that collide with document properties', () => {
    expect(renderMarkdown('## Title\n\n## Links')).toContain('id="user-content-title"');
    expect(renderMarkdown('## Links')).toContain('id="user-content-links"');
  });

  it('numbers duplicate headings and resets per document', () => {
    const html = renderMarkdown('## Notes\n\n## Notes\n\n## Notes');
    expect(html).toContain('id="user-content-notes"');
    expect(html).toContain('id="user-content-notes-1"');
    expect(html).toContain('id="user-content-notes-2"');
    expect(renderMarkdown('## Notes')).toContain('id="user-content-notes"');
  });

  it('numbers duplicates across blocks when rendering with source lines', () => {
    const html = renderMarkdown('## A\n\ntext\n\n## A', { sourceLines: true });
    expect(html).toContain('id="user-content-a-1"');
  });

  it('decodes entities before slugging', () => {
    expect(renderMarkdown('## Q&A `<tips>`')).toContain('id="user-content-qa-tips"');
  });

  it('rewrites in-page links to the prefixed ids and keeps them in the page', () => {
    const html = renderMarkdown('[Jump](#title)');
    expect(html).toContain('href="#user-content-title"');
    expect(html).not.toContain('target=');
  });

  it('leaves already prefixed and external links alone', () => {
    expect(renderMarkdown('[x](#user-content-a)')).toContain('href="#user-content-a"');
    expect(renderMarkdown('[x](https://a.dev/#b)')).toContain('target="_blank"');
  });
});

describe('line breaks option', () => {
  const source = 'first line\nsecond line';

  it('renders single line breaks as <br> by default', () => {
    expect(renderMarkdown(source)).toContain('first line<br>second line');
  });

  it('joins lines into one paragraph GitHub-style when breaks is false', () => {
    const html = renderMarkdown(source, { breaks: false });
    expect(html).not.toContain('<br>');
    expect(html).toContain('<p>first line\nsecond line</p>');
  });

  it('applies to the source-line path and keeps the custom renderer', () => {
    const html = renderMarkdown(`## Head\n\n${source}\n\n- [ ] task`, {
      sourceLines: true,
      breaks: false,
    });
    expect(html).not.toContain('<br>');
    expect(html).toContain('id="user-content-head"');
    expect(html).toContain('class="task-checkbox"');
  });

  it('honours an explicit trailing-backslash break either way', () => {
    expect(renderMarkdown('a\\\nb', { breaks: false })).toContain('<br>');
  });
});
