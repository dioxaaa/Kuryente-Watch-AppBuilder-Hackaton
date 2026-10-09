// Minimal in-browser stand-in for Express, used only by the website build (vite --mode web).
function compile(path) {
  const keys = []
  const pattern = path.replace(/\/:([A-Za-z_]+)/g, (_, key) => { keys.push(key); return '/([^/]+)' })
  return { re: new RegExp(`^${pattern}/?$`), keys }
}

export default function express() {
  const stack = []
  const add = method => (path, ...fns) => {
    if (typeof path === 'function') { fns = [path, ...fns]; path = null }
    const route = path ? compile(path) : null
    fns.forEach(fn => stack.push({ method, route, fn }))
  }
  const app = { use: add(null), get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE'), disable() {}, set() {}, listen() {} }

  app.handle = ({ method, url, body }) => new Promise(resolve => {
    const u = new URL(url, window.location.origin)
    const req = { method, path: u.pathname, url: u.pathname + u.search, query: Object.fromEntries(u.searchParams), body, params: {}, headers: {}, get() {} }
    const headers = {}
    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) { this.statusCode = code; return this },
      setHeader(key, value) { headers[key.toLowerCase()] = value },
      set(key, value) { headers[key.toLowerCase()] = value; return this },
      json(payload) {
        if (!this.headersSent) { this.headersSent = true; resolve({ status: this.statusCode, body: payload }) }
        return this
      },
      send(payload) { return this.json(payload) },
      end() { return this.json(null) },
      sendFile() { return this.status(404).json({ error: 'Not found.' }) },
    }
    let index = 0
    const next = error => {
      while (index < stack.length) {
        const layer = stack[index++]
        if (layer.method && layer.method !== method) continue
        if (layer.route) {
          const match = layer.route.re.exec(req.path)
          if (!match) continue
          req.params = Object.fromEntries(layer.route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]))
        }
        const handlesError = layer.fn.length === 4
        if (Boolean(error) !== handlesError) continue
        try {
          const result = error ? layer.fn(error, req, res, next) : layer.fn(req, res, next)
          if (result && typeof result.catch === 'function') result.catch(next)
        } catch (err) {
          next(err)
        }
        return
      }
      if (!res.headersSent) resolve({ status: error ? 500 : 404, body: { error: error ? error.message : 'API route not found.' } })
    }
    next()
  })
  return app
}

express.json = () => (_req, _res, next) => next()
express.static = () => (_req, _res, next) => next()
