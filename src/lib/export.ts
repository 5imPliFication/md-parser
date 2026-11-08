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

export function buildDocHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title);

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 2cm; }
  body {
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #24221f;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin: 18pt 0 8pt; }
  h1 { font-size: 22pt; }
  h2 { font-size: 17pt; }
  h3 { font-size: 14pt; }
  a { color: #c24024; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }
  pre {
    background: #f3f0e9;
    border: 1pt solid #d8d2c5;
    padding: 10pt;
    font-family: Consolas, "Courier New", monospace;
    font-size: 9pt;
  }
  .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-section { color: #d73a49; }
  .hljs-string, .hljs-regexp, .hljs-template-tag, .hljs-template-variable { color: #032f62; }
  .hljs-number, .hljs-symbol, .hljs-bullet { color: #005cc5; }
  .hljs-title, .hljs-title.function_, .hljs-title.class_ { color: #6f42c1; }
  .hljs-built_in, .hljs-type { color: #22863a; }
  .hljs-variable, .hljs-params, .hljs-selector-class, .hljs-selector-id,
  .hljs-selector-attr, .hljs-selector-pseudo { color: #e36209; }
  .hljs-attr, .hljs-attribute { color: #005cc5; }
  .hljs-tag, .hljs-name { color: #22863a; }
  .hljs-meta, .hljs-meta .hljs-keyword { color: #e36209; }
  .hljs-addition { color: #22863a; }
  .hljs-deletion { color: #d73a49; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }
  blockquote {
    border-left: 3pt solid #d94f30;
    margin: 12pt 0;
    padding: 4pt 12pt;
    color: #5b564d;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1pt solid #d8d2c5; padding: 4pt 6pt; text-align: left; }
  th { background: #f3f0e9; }
  img { max-width: 100%; }
  hr { border: 0; border-top: 1pt solid #d8d2c5; margin: 18pt 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
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
  code { background: #f0ece2; border-radius: 0; padding: 0.15em 0.35em; font-size: 0.9em; }
  pre { background: #f3f0e9; color: #24221f; border: 1px solid #d8d2c5; padding: 1rem 1.2rem; border-radius: 0; overflow: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-section { color: #d73a49; }
  .hljs-string, .hljs-regexp, .hljs-template-tag, .hljs-template-variable { color: #032f62; }
  .hljs-number, .hljs-symbol, .hljs-bullet { color: #005cc5; }
  .hljs-title, .hljs-title.function_, .hljs-title.class_ { color: #6f42c1; }
  .hljs-built_in, .hljs-type { color: #22863a; }
  .hljs-variable, .hljs-params, .hljs-selector-class, .hljs-selector-id,
  .hljs-selector-attr, .hljs-selector-pseudo { color: #e36209; }
  .hljs-attr, .hljs-attribute { color: #005cc5; }
  .hljs-tag, .hljs-name { color: #22863a; }
  .hljs-meta, .hljs-meta .hljs-keyword { color: #e36209; }
  .hljs-addition { color: #22863a; }
  .hljs-deletion { color: #d73a49; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }
  blockquote { border-left: 4px solid #e75636; margin: 1.5em 0; padding: 0.2em 1.2em; color: #5b564d; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d8d2c5; padding: 0.55em 0.75em; text-align: left; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #d8d2c5; margin: 2.5em 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #171614; color: #eee8dc; }
    a { color: #ff8b6b; }
    code { background: #2a2824; }
    pre { background: #101014; color: #f2f1ee; border-color: #3b3832; }
    .hljs-comment, .hljs-quote { color: #8b949e; }
    .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-section { color: #ff7b72; }
    .hljs-string, .hljs-regexp, .hljs-template-tag, .hljs-template-variable { color: #a5d6ff; }
    .hljs-number, .hljs-symbol, .hljs-bullet { color: #79c0ff; }
    .hljs-title, .hljs-title.function_, .hljs-title.class_ { color: #d2a8ff; }
    .hljs-built_in, .hljs-type { color: #7ee787; }
    .hljs-variable, .hljs-params, .hljs-selector-class, .hljs-selector-id,
    .hljs-selector-attr, .hljs-selector-pseudo { color: #ffa657; }
    .hljs-attr, .hljs-attribute { color: #79c0ff; }
    .hljs-tag, .hljs-name { color: #7ee787; }
    .hljs-meta, .hljs-meta .hljs-keyword { color: #ffa657; }
    .hljs-addition { color: #7ee787; }
    .hljs-deletion { color: #ff7b72; }
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
