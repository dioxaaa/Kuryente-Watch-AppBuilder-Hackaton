import { LocalApiError, PHOTO_MESSAGE, localApi, offlineRecommendation, offlineReply } from './local-api.js'

export class ApiError extends Error {
  constructor(message, { status = 0, unavailable = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.unavailable = unavailable
  }
}

// Set when /api is not a KuryenteWatch server (static hosting, no network): records then live in this browser.
let localMode = false
export const isLocalMode = () => localMode

async function useLocal(path, options) {
  try {
    return await localApi(path, options)
  } catch (error) {
    if (error instanceof LocalApiError) throw new ApiError(error.message, { status: error.status })
    throw error
  }
}

// When the server or its Ollama model cannot answer, the built-in assistant answers from the household data instead.
function aiFallback(path, body) {
  if (path === '/assistant') return offlineReply(body)
  if (path === '/ai/recommendation') return offlineRecommendation(body)
  if (path === '/meter-readings/read-photo') throw new ApiError(PHOTO_MESSAGE, { status: 503, unavailable: true })
  return null
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  if (localMode) return useLocal(path, { method, body })
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    })
  } catch {
    if (path === '/health') {
      localMode = true
      return useLocal(path, { method, body })
    }
    const fallback = aiFallback(path, body)
    if (fallback) return fallback
    throw new ApiError('The local KuryenteWatch server is unavailable. Start the server to access your SQLite data.', { unavailable: true })
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    if (path === '/health') {
      localMode = true
      return useLocal(path, { method, body })
    }
    if (response.status >= 500) {
      const fallback = aiFallback(path, body)
      if (fallback) return fallback
    }
    throw new ApiError('The local server returned an invalid response.', { status: response.status, unavailable: response.status >= 500 })
  }
  if (!response.ok) {
    if (response.status >= 500) {
      const fallback = aiFallback(path, body)
      if (fallback) return fallback
    }
    throw new ApiError(payload.error || `Request failed with status ${response.status}.`, {
      status: response.status,
      unavailable: response.status >= 500,
    })
  }
  return payload
}

// Support the method-based call sites added with the device and OCR features.
api.get = path => api(path)
api.post = (path, body) => api(path, { method: 'POST', body })
api.put = (path, body) => api(path, { method: 'PUT', body })
api.patch = (path, body) => api(path, { method: 'PATCH', body })
api.del = path => api(path, { method: 'DELETE' })
