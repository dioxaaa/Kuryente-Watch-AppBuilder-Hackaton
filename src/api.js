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

// Support the method-based call sites added with the device and OCR features.
api.get = path => api(path)
api.post = (path, body) => api(path, { method: 'POST', body })
api.put = (path, body) => api(path, { method: 'PUT', body })
api.patch = (path, body) => api(path, { method: 'PATCH', body })
api.del = path => api(path, { method: 'DELETE' })
