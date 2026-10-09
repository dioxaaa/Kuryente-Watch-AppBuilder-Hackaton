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
    registerSW({ immediate: true, onOfflineReady: () => showToast('Ready to use offline. KuryenteWatch now opens without internet.') })
    prepareOfflinePhotoReading()
  }
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Once the service worker controls the page, fetch the OCR files through it so meter photos can be read offline too.
function prepareOfflinePhotoReading() {
  if (!('serviceWorker' in navigator) || !navigator.onLine) return
  const warm = () => import('./utils/offline-ocr.js').then(m => m.warmOfflineOcr()).catch(() => {})
  if (navigator.serviceWorker.controller) warm()
  else navigator.serviceWorker.addEventListener('controllerchange', warm, { once: true })
}

function showToast(message) {
  const toast = Object.assign(document.createElement('div'), { className: 'offline-toast', role: 'status', textContent: message })
  document.body.append(toast)
  setTimeout(() => toast.remove(), 6000)
}

start()
