# AGENTS.md

## Commands

- Node.js 22.12+ (Vite 8 / Vitest 5 requirement); developed on Node 24.
- `npm install` — install dependencies.
- `npm run dev` — Vite dev server.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test` — Vitest in a jsdom environment. Single file: `npx vitest run src/lib/markdown.test.ts`; single test: `npx vitest run -t "highlights typescript"`.
- `npm run build` — typecheck, then static output to `dist/`.
- `npm run preview` — serve the production build.
- `npm run check` — typecheck + tests + build; run before committing.

## Architecture

- Vanilla TypeScript + Vite static site, no framework and no backend. `index.html` is the full markup shell and loads `src/main.ts`.
- `src/lib/markdown.ts` is the only rendering path: `marked` → `highlight.js` → `dompurify`. Never assign raw `marked` output to `innerHTML` or remove the sanitizer/link-attribute hook.
- Syntax highlighting is core-only `highlight.js`: the 11 supported languages are imported and registered individually, with aliases in `LANGUAGE_MAP`. Add both when adding a language; unknown fences must stay escaped plain text.
- `src/main.ts` owns UI state: tabs, writing/split/cinematic layout, scroll sync, line-number gutter, drag-and-drop, clipboard, and exports. PDF export calls `window.print()` (no PDF libraries); it eager-loads preview images first and sets `document.title` so the saved file is named after the document.
- `src/lib/stats.ts` provides line counting and the approximate UTF-8 size used by the editor footer.
- `src/lib/export.ts` builds the standalone HTML and Word `.doc` documents. Escape any user-derived value (title) before interpolating it into HTML.
- `src/styles/main.css` contains app theme and Markdown preview styles, including syntax token colors. The theme and layout are applied pre-paint by an inline script in `index.html`; keep those variable names in sync.
- PDF output comes from the `@media print` block in `main.css`: it shows only `#preview`, forces light theme tokens regardless of the app theme, and sets page-break rules. Keep its token overrides in sync with `:root` when adding theme variables.

## Local storage keys

- `md-parser-draft` — Markdown source.
- `md-parser-theme` — `light` / `dark`.
- `md-parser-settings` — JSON `{ syncScroll: boolean, layout: "writing" | "split" | "cinematic" }`.

## Conventions

- Visual direction is flat and sharp: no gradients, blur, decorative shadows, rounded corners, or pill-shaped controls. Use hairline borders, mono uppercase labels, and the blue accent (`#2d81ff`).
- Tests live beside sources as `src/lib/*.test.ts` and import `describe`/`it`/`expect` explicitly from `vitest`; globals are disabled.
- `tsconfig.json` is strict with `verbatimModuleSyntax`; use `import type` for type-only imports.
- `dist/` and `node_modules/` are git-ignored. The deployable artifact is `dist/`.
