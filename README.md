# md-parser

A fast, private Markdown parser that runs entirely in your browser. Paste or drop Markdown, preview the sanitized result, inspect the generated HTML, and export a standalone document. No server, no uploads, no tracking.

## Features

- GitHub Flavored Markdown via `marked` (tables, task lists, strikethrough, autolinks)
- Syntax highlighting for Java, JavaScript, TypeScript, Python, Bash, HTML, CSS, C, C++, C#, and Go
- HTML sanitized with `dompurify` before it reaches the preview
- Line-numbered editor with an approximate UTF-8 file size alongside word, line, and reading-time stats
- Writing, split preview, and cinematic view modes
- Toggleable synchronized scrolling between editor and preview
- Export as Markdown, HTML, PDF, or Word (`.doc`); PDF output is forced to a light document theme
- HTML source view and clipboard copy
- Drag-and-drop `.md` file loading (2 MB limit)
- Local draft and settings persistence via `localStorage`
- Light and dark themes, responsive flat design, print styles

## Development

Requires Node.js 22.12+ (developed on Node 24).

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (jsdom)
npm run build      # typecheck + static build to dist/
npm run preview    # serve the production build
npm run check      # typecheck, tests, and build in sequence
```

Run a single test file or test name:

```bash
npx vitest run src/lib/markdown.test.ts
npx vitest run -t "removes script tags"
```

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Static shell, UI markup, and pre-paint theme bootstrap |
| `src/main.ts` | UI wiring, view modes, draft storage, tabs, drag-and-drop, export actions, PDF generation |
| `src/lib/markdown.ts` | `marked` + `highlight.js` rendering and `dompurify` sanitization |
| `src/lib/export.ts` | Title extraction, slugification, standalone HTML and Word `.doc` builders |
| `src/lib/stats.ts` | Line counting and approximate UTF-8 file size |
| `src/data/sample.ts` | Sample document shown on first visit |
| `src/styles/main.css` | Application theme and Markdown preview styles |
| `src/lib/*.test.ts` | Vitest unit tests |

The build is fully static: `dist/` can be served from any static host (GitHub Pages, Netlify, S3, nginx).

## Security

Rendered Markdown is always sanitized. The app forbids `style` and `form` tags, strips inline `style` attributes, and adds `target="_blank"` plus `rel="noopener noreferrer"` to links. Do not remove the sanitization step when changing the rendering pipeline.

## License

MIT
