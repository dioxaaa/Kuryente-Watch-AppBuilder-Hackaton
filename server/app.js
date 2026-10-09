// REST API over the local SQLite database. Runs on this machine only.
import express from 'express'
import * as repo from './repository.js'
import { trainDevice, scanDevice, scanAllDevices, deviceChart } from './service.js'
import { askAssistant } from './assistant.js'
import { explainAlert } from './alert-explainer.js'
import { readMeterPhoto } from './meter-ocr.js'
import { cleanAppliance } from './appliances.js'
import { cleanMeterReading } from './meter-readings.js'
import { checkReading } from '../src/utils/meter-check.js'
// `chat` can be replaced in tests so they do not need a running Ollama.
export function createApp(db, { chat } = {}) {
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
  app.post('/api/scan', wrap(() => scanAllDevices(db)))
  // Readings + learned normal band + flagged events for one device, ready to draw. ?alertId=… centres it on an alert; else ?hours=24.
  app.get('/api/devices/:name/chart', wrap(req => deviceChart(db, req.params.name, { from: req.query.from, to: req.query.to, alertId: req.query.alertId, hours: req.query.hours })))
  app.get('/api/devices/:name/baseline', wrap(req => {
    const b = repo.getBaseline(db, req.params.name)
    if (!b) { const e = new Error('No baseline yet.'); e.status = 404; throw e }
    return b
  }))

  // alerts
  app.get('/api/alerts', wrap(req => repo.listAlerts(db, { device: req.query.device, includeDismissed: req.query.includeDismissed === 'true' })))
  app.get('/api/alerts/unread-count', wrap(() => ({ count: repo.unreadAlertCount(db) })))
  app.patch('/api/alerts/:id', wrap(req => ({ updated: repo.updateAlert(db, req.params.id, req.body) })))
  // Plain-language explanation of one alert from the local AI. Cached on the alert; { "refresh": true } asks again.
  app.post('/api/alerts/:id/explain', async (req, res) => {
    try { res.json(await explainAlert(db, req.params.id, { refresh: req.body?.refresh === true, chat })) }
    catch (err) { res.status(err.status || 500).json({ error: err.message }) }
  })

  // appliances
  const notFound = () => Object.assign(new Error('Appliance not found.'), { status: 404 })
  app.get('/api/appliances', wrap(() => repo.listAppliances(db)))
  app.post('/api/appliances', wrap(req => repo.addAppliance(db, cleanAppliance(req.body))))
  app.put('/api/appliances/:id', wrap(req => repo.updateAppliance(db, req.params.id, cleanAppliance(req.body)) ?? (() => { throw notFound() })()))
  app.delete('/api/appliances/:id', wrap(req => ({ deleted: repo.deleteAppliance(db, req.params.id) })))

  // household meter readings
  app.get('/api/meter-readings', wrap(() => repo.listMeterReadings(db)))
  app.post('/api/meter-readings', wrap(req => {
    const reading = cleanMeterReading(req.body)
    const problem = checkReading(repo.listMeterReadings(db), reading)
    if (problem) throw new Error(problem)
    return repo.addMeterReading(db, reading)
  }))
  // Reads the kWh value from a meter photo with the local vision model. Nothing is saved: the person confirms first.
  app.post('/api/meter-readings/read-photo', async (req, res) => {
    try { res.json(await readMeterPhoto(req.body?.image, { chat })) }
    catch (err) { res.status(err.status || 500).json({ error: err.message }) }
  })
  app.delete('/api/meter-readings/:id', wrap(req => ({ deleted: repo.deleteMeterReading(db, req.params.id) })))

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