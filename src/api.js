export class ApiError extends Error {
  constructor(message, { status = 0, unavailable = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.unavailable = unavailable
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
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
    throw new ApiError('The local KuryenteWatch server is unavailable. Start the server to access your SQLite data.', { unavailable: true })
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('The local server returned an invalid response.', { status: response.status, unavailable: response.status >= 500 })
  }
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed with status ${response.status}.`, {
      status: response.status,
      unavailable: response.status >= 500,
    })
  }
  return payload
}
// Small helper for the local KuryenteWatch API (see server/app.js).
// In development, Vite forwards /api to the server on port 3001 (see vite.config.ts).
const offlineError = () => Object.assign(new Error('Cannot reach the local server. Start it with: npm run server'), { offline: true })

async function request(method, path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw offlineError()
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (!data.error && res.status >= 500) throw offlineError() // Vite's proxy answers 5xx when nothing is listening
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: path => request('DELETE', path),
}
