const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export function getDocumentTitle(source: string, fallback = 'Markdown document'): string {
  const match = source.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
  const title = match?.[1]?.replace(/[*_`~[\]]/g, '').trim();

  return title || fallback;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildStandaloneHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto;
    max-width: 46rem;
    padding: 3rem 1.25rem 5rem;
    background: #fbfaf7;
    color: #24221f;
    font: 17px/1.7 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin: 2.2em 0 0.6em; }
  h1 { font-size: 2.2rem; }
  a { color: #c24024; }
  code, pre {
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  }
  code { background: #f0ece2; border-radius: 4px; padding: 0.15em 0.35em; font-size: 0.9em; }
  pre { background: #24221f; color: #f4efe4; padding: 1rem 1.2rem; border-radius: 10px; overflow: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote { border-left: 4px solid #e75636; margin: 1.5em 0; padding: 0.2em 1.2em; color: #5b564d; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d8d2c5; padding: 0.55em 0.75em; text-align: left; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #d8d2c5; margin: 2.5em 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #171614; color: #eee8dc; }
    a { color: #ff8b6b; }
    code { background: #2a2824; }
    blockquote { color: #b9b2a5; }
    th, td { border-color: #3b3832; }
    hr { border-color: #3b3832; }
  }
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>`;
}
