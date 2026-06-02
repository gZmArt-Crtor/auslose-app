import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project site: https://<user>.github.io/auslose-app/
export default defineConfig({
  base: '/auslose-app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      workbox: {
        // tesseract.js core/worker is fetched on demand from its CDN; don't fail install on it
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,xlsx,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Auslöse Stundenzettel',
        short_name: 'Auslöse',
        description: 'Stundenzettel & Auslöse-Erfassung mit Excel-Export',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1410',
        theme_color: '#1a1410',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
