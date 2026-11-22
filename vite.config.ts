import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const OUT_DIR = 'dist';

/**
 * Precache only what the page loads up front: every `/assets/...` file that
 * the built index.html references (entry script, CSS, modulepreload links,
 * i.e. the full static import graph). Lazy chunks (KaTeX, Mermaid, fonts)
 * are left to runtime caching so a first visit doesn't download ~4 MB.
 */
function staticAssetsOnly(entries: { url: string; size: number }[]) {
  const html = readFileSync(resolve(OUT_DIR, 'index.html'), 'utf8');
  const referenced = new Set(
    [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((match) => match[1]),
  );
  const manifest = entries.filter(
    (entry) => !entry.url.startsWith('assets/') || referenced.has(entry.url),
  );
  return { manifest, warnings: [] };
}

export default defineConfig({
  build: {
    outDir: OUT_DIR,
    // Mermaid's lazy chunks are large (its optional ELK layout engine is
    // ~1.5 MB minified, core internals ~630 kB). They are only fetched when a
    // document contains a ```mermaid block (ELK only for `layout: elk`), so
    // they don't affect initial load. The main bundle is ~185 kB.
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      // Updates wait for the user ("Reload" toast) so a draft is never
      // interrupted by an automatic reload.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'md-parser — Markdown, parsed locally',
        short_name: 'md-parser',
        description: 'A fast, private Markdown parser that runs entirely in your browser.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f1ee',
        theme_color: '#101014',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Icons and the web manifest are added by the plugin itself.
        globPatterns: ['**/*.{html,js,css}'],
        manifestTransforms: [staticAssetsOnly],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Hashed lazy chunks and fonts: immutable, cache on first use.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-assets',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
