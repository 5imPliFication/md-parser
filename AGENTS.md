# AGENTS.md

## Commands

- Node.js 22.12+ (Vite 8 / Vitest 5 requirement); developed on Node 24.
- `npm install` — install dependencies.
- `npm run dev` — Vite dev server.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test` — Vitest in a jsdom environment. Single file: `npx vitest run src/markdown.test.ts`; single test: `npx vitest run -t "removes script tags"`.
- `npm run build` — typecheck, then static output to `dist/`.
- `npm run preview` — serve the production build.
- `npm run check` — typecheck + tests + build; run before committing.

## Architecture

- Vanilla TypeScript + Vite static site, no framework and no backend. `index.html` is the full markup shell and loads `src/main.ts`.
- `src/markdown.ts` is the only rendering path: `marked` (GFM, breaks) then `dompurify`. Never assign raw `marked` output to `innerHTML` or remove the sanitizer/link-attribute hook.
- `src/main.ts` owns DOM wiring and state: tabs, drag-and-drop, clipboard/download, and `localStorage` keys `md-parser-draft` / `md-parser-theme`.
- `src/export.ts` builds the standalone download document. Escape any user-derived value (title) before interpolating it into HTML.
- `src/style.css` contains both app theme and Markdown preview styles. The theme is applied pre-paint by an inline script in `index.html`; keep those theme keys in sync.

## Conventions

- Tests live beside sources as `src/*.test.ts` and import `describe`/`it`/`expect` explicitly from `vitest`; globals are disabled.
- `tsconfig.json` is strict with `verbatimModuleSyntax`; use `import type` for type-only imports.
- `dist/` and `node_modules/` are git-ignored. The deployable artifact is `dist/`.
