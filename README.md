# md-parser

A fast, private Markdown parser that runs entirely in your browser. Paste or drop Markdown, preview the sanitized result, inspect the generated HTML, and export a standalone document. No server, no uploads, no tracking.

## Features

- GitHub Flavored Markdown via `marked` (tables, task lists, strikethrough, autolinks)
- HTML sanitized with `dompurify` before it reaches the preview
- Live preview with word, character, and reading-time stats
- HTML source view, clipboard copy, and standalone HTML download
- Drag-and-drop `.md` file loading (2 MB limit)
- Local draft persistence via `localStorage`
- Light and dark themes, responsive layout, print styles

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
npx vitest run src/markdown.test.ts
npx vitest run -t "removes script tags"
```

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Static shell, UI markup, and pre-paint theme bootstrap |
| `src/main.ts` | UI wiring, draft storage, tabs, drag-and-drop, export actions |
| `src/markdown.ts` | `marked` configuration and `dompurify` sanitization |
| `src/export.ts` | Title extraction, slugification, standalone HTML builder |
| `src/sample.ts` | Sample document shown on first visit |
| `src/style.css` | Application theme and Markdown preview styles |
| `src/*.test.ts` | Vitest unit tests |

The build is fully static: `dist/` can be served from any static host (GitHub Pages, Netlify, S3, nginx).

## Security

Rendered Markdown is always sanitized. The app forbids `style` and `form` tags, strips inline `style` attributes, and adds `target="_blank"` plus `rel="noopener noreferrer"` to links. Do not remove the sanitization step when changing the rendering pipeline.

## License

MIT
