import { BUILT_IN_MODEL, LocalApiError, builtInChat, builtInStatus, localApi, offlineRecommendation, offlineReply } from './local-api.js'

export class ApiError extends Error {
  constructor(message, { status = 0, unavailable = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.unavailable = unavailable
  }
}

// Set when /api is not a KuryenteWatch server (static hosting, installed app away from home, no network): records then live in this browser.
let localMode = false
let lastProbe = 0
let probing = null
const RECHECK_MS = 30_000
const PROBE_TIMEOUT_MS = 3000
const listeners = new Set()

export const isLocalMode = () => localMode
// Called with the new value whenever the app switches between the server and on-device storage.
export function onModeChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function setLocalMode(next) {
  if (localMode === next) return
  localMode = next
  lastProbe = Date.now()
  for (const listener of listeners) listener(next)
}

const isHealthPayload = payload => Boolean(payload) && typeof payload === 'object' && payload.ok === true

async function serverIsHealthy() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal })
    return response.ok && isHealthPayload(await response.json())
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// Checks whether the real KuryenteWatch server is reachable again and switches back to it when it is.
export function recheckServer() {
  if (!localMode) return Promise.resolve(true)
  probing ??= (async () => {
    lastProbe = Date.now()
    if (await serverIsHealthy()) setLocalMode(false)
    probing = null
    return !localMode
  })()
  return probing
}
export function resetLocalMode() {
  setLocalMode(false)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => recheckServer())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recheckServer() })
}

async function useLocal(path, options) {
  try {
    return await localApi(path, options)
  } catch (error) {
    if (error instanceof LocalApiError) throw new ApiError(error.message, { status: error.status })
    throw error
  }
}

function goLocal(path, options) {
  setLocalMode(true)
  return useLocal(path, options)
}

// When the server or its Ollama model cannot answer, the built-in assistant and on-device OCR answer instead.
function aiFallback(path, body) {
  if (path === '/assistant') return offlineReply(body)
  if (path === '/ai/recommendation') return offlineRecommendation(body)
  if (path === '/assistant/chat') return builtInServerChat(body)
  if (path === '/meter-readings/read-photo' || path === '/appliances/read-label') return useLocal(path, { method: 'POST', body })
  return null
}

// Built-in assistant answering from the server's records (used when the server is up but has no Ollama model).
async function builtInServerChat(body) {
  try {
    return await builtInChat(body, path => api(path))
  } catch (error) {
    if (error instanceof LocalApiError) throw new ApiError(error.message, { status: error.status })
    throw error
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  if (localMode) {
    if (Date.now() - lastProbe > RECHECK_MS) recheckServer()
    return useLocal(path, { method, body })
  }
  if (path === '/assistant/chat' && body?.model === BUILT_IN_MODEL) return builtInServerChat(body)

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return goLocal(path, { method, body })
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    // Every KuryenteWatch route answers JSON, so HTML or an empty body usually means a static host or a proxy with no server behind it.
    if (path === '/health' || !(await serverIsHealthy())) return goLocal(path, { method, body })
    if (response.status >= 500) {
      const fallback = aiFallback(path, body)
      if (fallback) return fallback
    }
    throw new ApiError('The local server returned an invalid response.', { status: response.status, unavailable: response.status >= 500 })
  }
  if (path === '/health' && !isHealthPayload(payload)) return goLocal(path, { method, body })
  if (!response.ok) {
    if (response.status >= 500 || (path === '/meter-readings/read-photo' && response.status === 422)) {
      const fallback = aiFallback(path, body)
      if (fallback) return fallback
    }
    throw new ApiError(payload?.error || `Request failed with status ${response.status}.`, {
      status: response.status,
      unavailable: response.status >= 500,
    })
  }
  if (path === '/assistant/status' && !payload.models?.length) return builtInStatus(payload.error)
  return payload
}

// Support the method-based call sites added with the device and OCR features.
api.get = path => api(path)
api.post = (path, body) => api(path, { method: 'POST', body })
api.put = (path, body) => api(path, { method: 'PUT', body })
api.patch = (path, body) => api(path, { method: 'PATCH', body })
api.del = path => api(path, { method: 'DELETE' })
