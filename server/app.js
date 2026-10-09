// REST API over the local SQLite database. Runs on this machine only.
import express from 'express'
import * as repo from './repository.js'
import { trainDevice, scanDevice } from './service.js'
import { askAssistant } from './assistant.js'
export function createApp(db) {
  const app = express()
  app.use(express.json({ limit: '50mb' })) // large CSV-sized imports

  const wrap = fn => (req, res) => {
    try { res.json(fn(req, res) ?? { ok: true }) }
    catch (err) { res.status(err.status || 400).json({ error: err.message }) }
  }
  const range = q => ({ from: q.from, to: q.to, limit: q.limit ? Number(q.limit) : undefined })

  app.get('/api/health', wrap(() => ({ ok: true, local: true })))

  // devices
  app.get('/api/devices', wrap(() => repo.listDevices(db)))
  app.post('/api/devices', wrap(req => { repo.saveDevice(db, req.body); return { ok: true } }))
  app.delete('/api/devices/:name', wrap(req => ({ deleted: repo.deleteDevice(db, req.params.name) })))

  // readings
  app.post('/api/readings', wrap(req => {
    if (!Array.isArray(req.body)) throw new Error('Body must be an array of { timestamp, device, watts }.')
    const bad = req.body.find(r => !r.device || !r.timestamp || !Number.isFinite(r.watts))
    if (bad) throw new Error(`Invalid reading: ${JSON.stringify(bad)}`)
    return { saved: repo.saveReadings(db, req.body) }
  }))
  app.get('/api/devices/:name/readings', wrap(req => repo.getReadings(db, req.params.name, range(req.query))))

  // train / scan
  app.post('/api/devices/:name/train', wrap(req => trainDevice(db, req.params.name, range(req.body ?? {}))))
  app.post('/api/devices/:name/scan', wrap(req => scanDevice(db, req.params.name, range(req.body ?? {}), req.body?.options)))
  app.get('/api/devices/:name/baseline', wrap(req => {
    const b = repo.getBaseline(db, req.params.name)
    if (!b) { const e = new Error('No baseline yet.'); e.status = 404; throw e }
    return b
  }))

  // alerts
  app.get('/api/alerts', wrap(req => repo.listAlerts(db, { device: req.query.device, includeDismissed: req.query.includeDismissed === 'true' })))
  app.get('/api/alerts/unread-count', wrap(() => ({ count: repo.unreadAlertCount(db) })))
  app.patch('/api/alerts/:id', wrap(req => ({ updated: repo.updateAlert(db, req.params.id, req.body) })))

  // settings
  app.get('/api/settings/:key', wrap(req => ({ value: repo.getSetting(db, req.params.key, null) })))
  app.put('/api/settings/:key', wrap(req => { repo.setSetting(db, req.params.key, req.body.value); return { ok: true } }))
    // AI assistant (local Ollama)
  app.post('/api/assistant', async (req, res) => {
    try { res.json(await askAssistant(req.body ?? {})) }
    catch (err) { res.status(err.status || 500).json({ error: err.message }) }
  })
  // wipe
  app.delete('/api/data', wrap(() => { repo.clearAllData(db); return { ok: true } }))

  return app
}