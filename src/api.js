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
  del: path => request('DELETE', path),
}