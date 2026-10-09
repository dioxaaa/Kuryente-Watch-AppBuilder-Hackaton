import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'

async function start() {
  // The website build (npm run build:web) runs the API and SQLite in the browser instead of a local server.
  if (import.meta.env.MODE === 'web') {
    const { installBrowserApi } = await import('./web/browser-api.js')
    await installBrowserApi()
    // Reload into the newest version as soon as it has downloaded, so visitors are never stuck on an old copy.
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

start()
