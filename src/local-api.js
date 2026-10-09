// Browser-only stand-in for the KuryenteWatch server, used when /api is not reachable
// (static hosting, a phone away from the home computer, or no network). Data lives in IndexedDB on this device.
import Dexie from 'dexie'
import { applianceTip, offlineAnswer } from './utils/offline-assistant.js'
import { buildAssistantContext } from './utils/assistant-context.js'

const db = new Dexie('kuryentewatch')
db.version(1).stores({ kv: 'key', readings: 'id, recordedAt', appliances: 'id' })

const DEFAULT_SETTINGS = { ratePerKwh: 12.5, compact: false, weeklySummary: true }
const DEFAULT_APPLIANCES = [
  { name: 'Family refrigerator', category: 'Refrigerator', ratedWatts: 180, hoursPerDay: 24 },
  { name: 'Living room fan', category: 'Electric fan', ratedWatts: 60, hoursPerDay: 10 },
  { name: 'Bedroom air conditioner', category: 'Air conditioner', ratedWatts: 900, hoursPerDay: 6 },
  { name: 'Rice cooker', category: 'Rice cooker', ratedWatts: 600, hoursPerDay: 1.5 },
]
export const BUILT_IN_MODEL = 'Built-in assistant'

const now = () => new Date().toISOString()
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const getKv = async (key, fallback) => (await db.kv.get(key))?.value ?? fallback
const setKv = (key, value) => db.kv.put({ key, value })

export class LocalApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
const fail = (message, status) => { throw new LocalApiError(message, status) }

const text = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required.`)
  if (value.trim().length > max) fail(`${label} must be ${max} characters or fewer.`)
  return value.trim()
}
const positive = (value, label, max) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > max) fail(`${label} must be a number greater than zero and no more than ${max}.`)
  return n
}

async function seedAppliances() {
  if (await getKv('appliancesSeeded', false)) return
  const timestamp = now()
  await db.appliances.bulkPut(DEFAULT_APPLIANCES.map(a => ({ ...a, id: newId(), usagePattern: 'Daily', brand: '', model: '', isSample: true, createdAt: timestamp, updatedAt: timestamp })))
  await setKv('appliancesSeeded', true)
}

async function listReadings() {
  const rows = await db.readings.orderBy('recordedAt').toArray()
  return rows.map((row, i) => ({
    ...row,
    usageKwh: row.reset || !i ? null : row.readingKwh - rows[i - 1].readingKwh,
  }))
}

async function listAppliances() {
  await seedAppliances()
  return (await db.appliances.toArray()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

function cleanAppliance(body = {}) {
  return {
    name: text(body.name, 'Appliance name', 100),
    category: text(body.category, 'Category', 40),
    ratedWatts: positive(body.ratedWatts, 'Rated watts', 100000),
    hoursPerDay: positive(body.hoursPerDay, 'Hours per day', 24),
    usagePattern: body.usagePattern || 'Daily',
    brand: String(body.brand ?? '').trim().slice(0, 100),
    model: String(body.model ?? '').trim().slice(0, 100),
  }
}

async function saveProfile(body = {}, { create }) {
  const existing = await getKv('profile', null)
  if (create && existing) fail('A profile already exists on this device.', 409)
  if (!create && !existing) fail('No profile exists on this device yet.', 404)
  const timestamp = now()
  const profile = {
    id: 1,
    householdId: 1,
    createdAt: existing?.createdAt ?? timestamp,
    ...existing,
    userName: text(body.userName, 'User name', 80),
    householdName: text(body.householdName, 'Household name', 100),
    updatedAt: timestamp,
  }
  await setKv('profile', profile)
  return profile
}

// Mirrors the server routes the app uses. Returns the JSON payload the server would send.
export async function localApi(path, { method = 'GET', body } = {}) {
  const [route] = path.split('?')
  const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await getKv('settings', {})) })

  if (route === '/health') return { ok: true, local: true, database: 'browser' }
  if (route === '/profile') {
    if (method === 'GET') return { profile: await getKv('profile', null) }
    if (method === 'POST') return { profile: await saveProfile(body, { create: true }), created: true }
    if (method === 'PUT') return { profile: await saveProfile(body, { create: false }) }
    if (method === 'DELETE') {
      const existed = Boolean(await getKv('profile', null))
      await db.kv.delete('profile')
      return { reset: existed, retainedRecords: true }
    }
  }
  if (route === '/settings') {
    if (method === 'GET') return settings()
    if (method === 'PUT') {
      const next = await settings()
      if (body?.ratePerKwh !== undefined) next.ratePerKwh = positive(body.ratePerKwh, 'Electricity rate', 1000)
      for (const key of ['compact', 'weeklySummary']) if (typeof body?.[key] === 'boolean') next[key] = body[key]
      await setKv('settings', next)
      const profile = body?.userName !== undefined || body?.householdName !== undefined
        ? await saveProfile(body, { create: false })
        : await getKv('profile', null)
      return { settings: next, profile }
    }
  }
  if (route === '/readings') {
    if (method === 'GET') return listReadings()
    if (method === 'POST') {
      const readingKwh = positive(body?.readingKwh, 'Meter reading', 1e9)
      if (Number.isNaN(Date.parse(body?.recordedAt))) fail('A valid ISO 8601 recordedAt date is required.')
      const recordedAt = new Date(body.recordedAt).toISOString()
      const rows = await listReadings()
      const before = rows.filter(r => r.recordedAt < recordedAt).at(-1)
      const after = rows.find(r => r.recordedAt > recordedAt)
      const reset = body.reset === true
      if (!reset && before && readingKwh < before.readingKwh) fail(`Reading must be at least ${before.readingKwh} kWh, the preceding meter value.`)
      if (!reset && after && !after.reset && readingKwh > after.readingKwh) fail(`Reading must not exceed ${after.readingKwh} kWh, the next meter value.`)
      const reading = { id: newId(), readingKwh, recordedAt, notes: String(body.notes ?? '').trim().slice(0, 500), reset, createdAt: now() }
      await db.readings.put(reading)
      return { reading: { ...reading, usageKwh: reset || !before ? null : readingKwh - before.readingKwh } }
    }
  }
  if (route === '/appliances') {
    if (method === 'GET') return listAppliances()
    if (method === 'POST') {
      const timestamp = now()
      const appliance = { ...cleanAppliance(body), id: newId(), isSample: false, createdAt: timestamp, updatedAt: timestamp }
      await db.appliances.put(appliance)
      return { appliance }
    }
  }
  const applianceMatch = route.match(/^\/appliances\/([^/]+)$/)
  if (applianceMatch) {
    const id = decodeURIComponent(applianceMatch[1])
    const existing = await db.appliances.get(id)
    if (!existing) fail('Appliance not found.', 404)
    if (method === 'PUT') {
      const appliance = { ...existing, ...cleanAppliance(body), updatedAt: now() }
      await db.appliances.put(appliance)
      return { appliance }
    }
    if (method === 'DELETE') {
      await db.appliances.delete(id)
      return { deleted: true }
    }
  }
  // Device power monitoring needs the home server; on this device there are no devices or detector alerts.
  if (route === '/alerts' || route === '/devices') return []
  if (route === '/scan') return { scanned: 0, skipped: [], newAlerts: 0, devices: [] }
  if (route === '/alerts/meter-status') return null
  if (route === '/assistant' && method === 'POST') return offlineReply(body)
  if (route === '/assistant/status') return builtInStatus()
  if (route === '/assistant/chat' && method === 'POST') return builtInChat(body, next => localApi(next))
  if (route === '/ai/recommendation' && method === 'POST') return offlineRecommendation(body, (await settings()).ratePerKwh)
  if (route === '/meter-readings/read-photo' && method === 'POST') return readPhoto(body)
  fail('This feature needs the KuryenteWatch server on your home computer.', 404)
}

export function builtInStatus(error) {
  return { available: true, local: true, models: [BUILT_IN_MODEL], defaultModel: BUILT_IN_MODEL, ...(error && { error }) }
}

// Assistant page chat answered on this device. `load` reads household records from wherever they live (IndexedDB or the server).
export async function builtInChat(body = {}, load) {
  const message = text(body.message, 'Message', 2000)
  const [readings, appliances, alerts, { ratePerKwh }] = await Promise.all([
    load('/readings'),
    load('/appliances'),
    load('/alerts').catch(() => []),
    load('/settings'),
  ])
  const context = buildAssistantContext({
    readings,
    appliances: appliances.map(a => ({ ...a, watts: a.ratedWatts ?? a.watts, hours: a.hoursPerDay ?? a.hours })),
    alerts,
    rate: ratePerKwh,
  })
  return { reply: offlineAnswer(message, context, body.history), model: BUILT_IN_MODEL }
}

// Tesseract is loaded only when a photo is read, so it does not slow down opening the app.
export async function readPhoto(body = {}) {
  const { readMeterPhotoOnDevice } = await import('./utils/offline-ocr.js')
  try {
    return await readMeterPhotoOnDevice(body.image)
  } catch (error) {
    throw new LocalApiError(error.message, error.status || 422)
  }
}

export function offlineReply(body = {}) {
  const question = String(body.question ?? '').trim()
  if (!question) fail('Please type a question.')
  return { reply: offlineAnswer(question, body.context ?? {}, body.history), model: BUILT_IN_MODEL }
}

export function offlineRecommendation(body = {}, rate) {
  if (!body.applianceName || !body.ratedWatts) fail('Missing appliance name or rated watts.')
  return { success: true, appliance: String(body.applianceName).slice(0, 100), insight: applianceTip(body, rate) }
}
