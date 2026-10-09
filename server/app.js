import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as appRepo from './app-repository.js'
import * as repo from './repository.js'
import { trainDevice, scanDevice } from './service.js'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const categories = new Set(['Refrigerator', 'Electric fan', 'Air conditioner', 'Rice cooker', 'Television', 'Washing machine', 'Other'])
const patterns = new Set(['Daily', 'Weekdays', 'Weekends', 'Occasional'])

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Request body must be a JSON object.')
  return body
}

function requiredText(value, label, maxLength = 80) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`)
  const text = value.trim()
  if (text.length > maxLength) fail(`${label} must be ${maxLength} characters or fewer.`)
  return text
}

function positiveNumber(value, label, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0 || number > max) fail(`${label} must be a number greater than zero and no more than ${max}.`)
  return number
}

function validateProfile(body) {
  const input = objectBody(body)
  return {
    userName: requiredText(input.userName, 'User name', 80),
    householdName: requiredText(input.householdName, 'Household name', 100),
  }
}

function validateAppliance(body) {
  const input = objectBody(body)
  const name = requiredText(input.name, 'Appliance name', 100)
  const category = requiredText(input.category, 'Category', 40)
  if (!categories.has(category)) fail('Choose a supported appliance category.')
  const usagePattern = input.usagePattern === undefined ? 'Daily' : requiredText(input.usagePattern, 'Usage pattern', 20)
  if (!patterns.has(usagePattern)) fail('Choose a supported usage pattern.')
  const hoursPerDay = positiveNumber(input.hoursPerDay, 'Hours per day', 24)
  const optionalText = (value, label) => value === undefined ? '' : (typeof value === 'string' && value.length <= 100 ? value.trim() : fail(`${label} must be 100 characters or fewer.`))
  return {
    name,
    category,
    ratedWatts: positiveNumber(input.ratedWatts, 'Rated watts', 100000),
    hoursPerDay,
    usagePattern,
    brand: optionalText(input.brand, 'Brand'),
    model: optionalText(input.model, 'Model'),
  }
}

function validateRecordedAt(value) {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) fail('A valid ISO 8601 recordedAt date is required.')
  return new Date(value).toISOString()
}

function alertView(alert) {
  const title = alert.title ?? String(alert.type ?? 'Energy alert').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  const message = alert.message ?? alert.explanation ?? 'A local usage rule flagged an unusual reading pattern.'
  return {
    ...alert,
    title,
    message,
    severity: alert.severity ?? 'info',
    createdAt: alert.createdAt ?? alert.start,
    read: Boolean(alert.read),
    is_read: Boolean(alert.is_read ?? alert.read),
    dismissed: Boolean(alert.dismissed),
  }
}

export function createApp(db) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '10mb' }))

  const wrap = fn => (req, res, next) => {
    try {
      const result = fn(req, res)
      if (result !== undefined && !res.headersSent) res.json(result)
    } catch (error) {
      next(error)
    }
  }
  const range = query => {
    let limit
    if (query.limit !== undefined) {
      limit = Number(query.limit)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100000) fail('limit must be an integer from 1 to 100000.')
    }
    return { from: query.from, to: query.to, limit }
  }

  app.get('/api/health', wrap(() => {
    db.prepare('SELECT 1').get()
    return { ok: true, local: true, database: 'ready' }
  }))

  app.get('/api/profile', wrap(() => ({ profile: appRepo.getProfile(db) })))
  app.post('/api/profile', wrap(req => {
    const profile = appRepo.createProfile(db, validateProfile(req.body))
    return { profile, created: true }
  }))
  app.put('/api/profile', wrap(req => ({ profile: appRepo.updateProfile(db, validateProfile(req.body)) })))
  app.delete('/api/profile', wrap(() => ({ reset: appRepo.resetProfile(db), retainedRecords: true })))

  // Household meter readings are cumulative kWh values. Legacy device power
  // samples remain available through the existing device-specific endpoint.
  app.get('/api/readings', wrap(() => appRepo.listMeterReadings(db)))
  app.post('/api/readings', wrap((req, res) => {
    if (Array.isArray(req.body)) {
      const invalid = req.body.find(row => !row || typeof row.device !== 'string' || !row.device.trim() || typeof row.timestamp !== 'string' || Number.isNaN(Date.parse(row.timestamp)) || !Number.isFinite(row.watts))
      if (invalid) fail('Each device reading requires a device name, valid timestamp, and finite watts value.')
      return { saved: repo.saveReadings(db, req.body) }
    }
    const body = objectBody(req.body)
    const reading = appRepo.createMeterReading(db, {
      readingKwh: positiveNumber(body.readingKwh, 'Meter reading', 1000000000),
      recordedAt: validateRecordedAt(body.recordedAt),
      notes: body.notes === undefined ? '' : typeof body.notes === 'string' && body.notes.length <= 500 ? body.notes.trim() : fail('Notes must be 500 characters or fewer.'),
    })
    res.status(201)
    return { reading }
  }))

  app.get('/api/appliances', wrap(() => appRepo.listAppliances(db)))
  app.post('/api/appliances', wrap((req, res) => {
    const appliance = appRepo.createAppliance(db, validateAppliance(req.body))
    res.status(201)
    return { appliance }
  }))
  app.put('/api/appliances/:id', wrap(req => {
    const id = requiredText(req.params.id, 'Appliance ID', 80)
    const appliance = appRepo.updateAppliance(db, id, validateAppliance(req.body))
    if (!appliance) fail('Appliance not found.', 404)
    return { appliance }
  }))
  app.delete('/api/appliances/:id', wrap(req => {
    const id = requiredText(req.params.id, 'Appliance ID', 80)
    const deleted = appRepo.deleteAppliance(db, id)
    if (!deleted) fail('Appliance not found.', 404)
    return { deleted: true }
  }))

  app.get('/api/devices', wrap(() => repo.listDevices(db)))
  app.post('/api/devices', wrap(req => {
    const input = objectBody(req.body)
    repo.saveDevice(db, {
      name: requiredText(input.name, 'Device name', 100),
      label: input.label === undefined ? null : requiredText(input.label, 'Device label', 100),
      category: input.category === undefined ? null : requiredText(input.category, 'Device category', 50),
      ratedWatts: input.ratedWatts === undefined ? null : positiveNumber(input.ratedWatts, 'Rated watts', 100000),
    })
    return { ok: true }
  }))
  app.delete('/api/devices/:name', wrap(req => {
    const name = requiredText(req.params.name, 'Device name', 100)
    const deleted = repo.deleteDevice(db, name)
    if (!deleted) fail('Device not found.', 404)
    return { deleted: true }
  }))
  app.get('/api/devices/:name/readings', wrap(req => {
    const name = requiredText(req.params.name, 'Device name', 100)
    return repo.getReadings(db, name, range(req.query))
  }))
  app.post('/api/devices/:name/train', wrap(req => {
    const name = requiredText(req.params.name, 'Device name', 100)
    return trainDevice(db, name, range(objectBody(req.body ?? {})))
  }))
  app.post('/api/devices/:name/scan', wrap(req => {
    const name = requiredText(req.params.name, 'Device name', 100)
    const body = objectBody(req.body ?? {})
    return scanDevice(db, name, range(body), body.options)
  }))
  app.get('/api/devices/:name/baseline', wrap(req => {
    const baseline = repo.getBaseline(db, requiredText(req.params.name, 'Device name', 100))
    if (!baseline) fail('No baseline yet.', 404)
    return baseline
  }))

  app.get('/api/alerts', wrap(req => {
    const device = req.query.device === undefined ? undefined : requiredText(req.query.device, 'Device name', 100)
    return repo.listAlerts(db, { device, includeDismissed: req.query.includeDismissed === 'true' }).map(alertView)
  }))
  app.get('/api/alerts/unread-count', wrap(() => ({ count: repo.unreadAlertCount(db) })))
  app.patch('/api/alerts/:id', wrap(req => {
    const body = objectBody(req.body)
    const readValue = body.is_read ?? body.read
    if (readValue !== undefined && typeof readValue !== 'boolean') fail('read must be a boolean.')
    if (body.dismissed !== undefined && typeof body.dismissed !== 'boolean') fail('dismissed must be a boolean.')
    if (readValue === undefined && body.dismissed === undefined) fail('Provide read or dismissed to update.')
    const updated = repo.updateAlert(db, req.params.id, { read: readValue, dismissed: body.dismissed })
    if (!updated) fail('Alert not found.', 404)
    return { updated: true }
  }))

  app.get('/api/settings', wrap(() => appRepo.getAppSettings(db)))
  app.put('/api/settings', wrap(req => {
    const body = objectBody(req.body)
    const allowed = ['ratePerKwh', 'compact', 'weeklySummary', 'userName', 'householdName']
    const unknown = Object.keys(body).find(key => !allowed.includes(key))
    if (unknown) fail(`Unknown setting: ${unknown}.`)
    const values = {}
    const hasProfileUpdate = body.userName !== undefined || body.householdName !== undefined
    if (hasProfileUpdate) {
      values.userName = requiredText(body.userName, 'User name', 80)
      values.householdName = requiredText(body.householdName, 'Household name', 100)
    }
    const settings = {}
    if (body.ratePerKwh !== undefined) settings.ratePerKwh = positiveNumber(body.ratePerKwh, 'Electricity rate', 1000)
    for (const key of ['compact', 'weeklySummary']) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') fail(`${key} must be a boolean.`)
        settings[key] = body[key]
      }
    }
    if (!Object.keys(settings).length && !hasProfileUpdate) fail('Provide at least one setting to update.')
    return db.transaction(() => ({
      settings: Object.keys(settings).length ? appRepo.updateAppSettings(db, settings) : appRepo.getAppSettings(db),
      profile: hasProfileUpdate ? appRepo.updateProfile(db, values) : appRepo.getProfile(db),
    }))()
  }))
  // Retain the detector's original per-key settings API.
  app.get('/api/settings/:key', wrap(req => ({ value: repo.getSetting(db, requiredText(req.params.key, 'Setting key', 100), null) })))
  app.put('/api/settings/:key', wrap(req => {
    const body = objectBody(req.body)
    if (!Object.hasOwn(body, 'value')) fail('A value field is required.')
    repo.setSetting(db, requiredText(req.params.key, 'Setting key', 100), body.value)
    return { ok: true }
  }))

  app.delete('/api/data', wrap(req => {
    if (req.body?.confirm !== 'DELETE ALL LOCAL DATA') fail('Explicit confirmation is required: send { "confirm": "DELETE ALL LOCAL DATA" }.')
    repo.clearAllData(db)
    return { ok: true }
  }))

  const distPath = path.join(appRoot, 'dist')
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath, { index: false, fallthrough: true, setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache')
    } }))
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(distPath, 'index.html'))
      return next()
    })
  }

  app.use((req, res) => res.status(404).json({ error: 'API route not found.' }))
  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) ? error.status : error.code?.startsWith('SQLITE_CONSTRAINT') ? 409 : 500
    if (status >= 500) console.error('[api] Request failed:', error.message)
    const message = error.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ? 'A record already exists with this identifier or timestamp.'
      : status >= 500
        ? 'A local database error occurred. No changes were reported as successful.'
        : error.message
    res.status(status).json({ error: message })
  })

  return app
}
