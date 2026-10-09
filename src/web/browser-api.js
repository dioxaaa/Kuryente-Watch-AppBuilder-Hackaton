// Website build only: runs the KuryenteWatch API and SQLite database inside the visitor's browser.
// Each visitor's data is saved in their own browser (IndexedDB) and never leaves it.
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { setSqlJs } from './sqlite-shim.js'

const DB_KEY = 'kuryentewatch.db'
const AI_OFF = 'AI features need Ollama running on your own computer, so they are not available on the website.'
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const noOllama = () => Promise.reject(new TypeError(AI_OFF))
const noChat = async () => { throw Object.assign(new Error(AI_OFF), { status: 503 }) }

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kuryentewatch', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadBytes() {
  try {
    const store = await openStore()
    return await new Promise(resolve => {
      const request = store.transaction('files').objectStore('files').get(DB_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function saveBytes(bytes) {
  try {
    const store = await openStore()
    store.transaction('files', 'readwrite').objectStore('files').put(bytes, DB_KEY)
  } catch { /* storage unavailable (e.g. private mode); data lasts for this visit only */ }
}

export async function installBrowserApi() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  setSqlJs(SQL, await loadBytes())
  const { openDb } = await import('../../server/db.js')
  const { createApp } = await import('../../server/app.js')
  const db = openDb(':memory:')
  const app = createApp(db, { fetchImpl: noOllama, chat: noChat })

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init)
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    let body
    if (init.body != null) {
      try { body = JSON.parse(init.body) } catch { body = init.body }
    }
    const result = await app.handle({ method, url: url.href, body })
    if (method !== 'GET') saveBytes(db.export())
    if (result.status === 503 && result.body?.error) result.body = { ...result.body, error: AI_OFF }
    return json(result.body ?? null, result.status)
  }
}
