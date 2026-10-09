import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const web = (file: string) => fileURLToPath(new URL(`./src/web/${file}`, import.meta.url))

export default defineConfig(({ mode }) => ({
  // `--mode web` builds the public website: the API and SQLite run in the visitor's browser (see src/web).
  ...(mode === 'web' && {
    resolve: {
      alias: [
        { find: /^express$/, replacement: web('express-shim.js') },
        { find: /^better-sqlite3$/, replacement: web('sqlite-shim.js') },
        { find: /^node:fs$/, replacement: web('node-fs.js') },
        { find: /^node:path$/, replacement: web('node-path.js') },
        { find: /^node:url$/, replacement: web('node-url.js') },
        { find: /^node:crypto$/, replacement: web('node-crypto.js') },
      ],
    },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  }),
  // host 0.0.0.0 lets other devices on the LAN open the UI; /api is still proxied to the API on this machine's loopback.
  server: { host: '0.0.0.0', proxy: { '/api': 'http://127.0.0.1:3001' } }, // forwards /api calls to the local SQLite server
  preview: { host: '0.0.0.0', proxy: { '/api': 'http://127.0.0.1:3001' } }, // same for npm run preview
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/d3-')) return 'charts-d3'
          if (id.includes('/node_modules/recharts/')) return 'charts-vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'KuryenteWatch — The Local Energy Detective',
        short_name: 'KuryenteWatch',
        description: 'A local-first household energy companion for meter readings and usage estimates.',
        theme_color: '#123a2d',
        background_color: '#f5f7f4',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: [mode === 'web' ? '**/*.{js,css,html,svg,webmanifest,wasm,woff2}' : '**/*.{js,css,html,svg,webmanifest}'] },
    }),
  ],
}))
