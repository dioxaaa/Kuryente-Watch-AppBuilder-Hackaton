import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } }, // forwards /api calls to the local SQLite server
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
        description: 'A frontend UI prototype for a household energy companion.',
        theme_color: '#123a2d',
        background_color: '#f5f7f4',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
    }),
  ],
})