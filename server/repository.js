// All SQL lives here. Functions take the db as the first argument.
import { randomUUID } from 'node:crypto'
const now = () => new Date().toISOString()

// ---------- devices ----------
export function saveDevice(db, { name, label = null, category = null, ratedWatts = null }) {
  db.prepare(`INSERT INTO devices (name, label, category, rated_watts, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET label=excluded.label, category=excluded.category, rated_watts=excluded.rated_watts`)
    .run(name, label, category, ratedWatts, now())
}
export const listDevices = db =>
  db.prepare('SELECT name, label, category, rated_watts AS ratedWatts, created_at AS createdAt FROM devices ORDER BY name').all()
export const deleteDevice = (db, name) => db.prepare('DELETE FROM devices WHERE name = ?').run(name).changes > 0 // cascades

const ensureDevice = (db, name) =>
  db.prepare('INSERT OR IGNORE INTO devices (name, created_at) VALUES (?, ?)').run(name, now())

// ---------- readings ----------
// readings: [{ timestamp, device, watts }]
export function saveReadings(db, readings) {
  const put = db.prepare('INSERT OR REPLACE INTO readings (device, timestamp, watts) VALUES (?,?,?)')
  db.transaction(rows => {
    for (const device of new Set(rows.map(r => r.device))) ensureDevice(db, device)
    for (const r of rows) put.run(r.device, r.timestamp, r.watts)
  })(readings)
  return readings.length
}
export function getReadings(db, device, { from, to, limit } = {}) {
  return db.prepare(`SELECT device, timestamp, watts FROM readings
    WHERE device = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp LIMIT ?`)
    .all(device, from ?? '', to ?? '\uffff', limit ?? -1)
}
export const latestReadingTime = (db, device) => db.prepare('SELECT MAX(timestamp) t FROM readings WHERE device = ?').get(device)?.t ?? null
export const countReadings = (db, device) => db.prepare('SELECT COUNT(*) n FROM readings WHERE device = ?').get(device).n

// ---------- baselines ----------
export function saveBaseline(db, baseline) {
  ensureDevice(db, baseline.device)
  db.prepare(`INSERT INTO baselines (device, data, updated_at) VALUES (?,?,?)
    ON CONFLICT(device) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`)
    .run(baseline.device, JSON.stringify(baseline), now())
}
export const getBaseline = (db, device) => {
  const row = db.prepare('SELECT data FROM baselines WHERE device = ?').get(device)
  return row ? JSON.parse(row.data) : undefined
}

// ---------- alerts ----------
export const alertIdFor = (device, event) => `${device}|${event.type}|${event.start}`

const rowToAlert = r => ({ ...JSON.parse(r.data), id: r.id, device: r.device, createdAt: r.created_at, read: !!r.read, dismissed: !!r.dismissed, aiExplanation: r.ai_explanation ?? null, aiModel: r.ai_model ?? null })

// Saves detector events as alerts. Re-saving the same event keeps its read/dismissed state.
// Returns how many were NEW.
export function saveAlerts(db, device, events) {
  ensureDevice(db, device)
  const exists = db.prepare('SELECT 1 FROM alerts WHERE id = ?')
  const insert = db.prepare('INSERT INTO alerts (id, device, type, severity, start, data, created_at) VALUES (?,?,?,?,?,?,?)')
  // A re-scan can change an event (for example it ran longer), so an AI explanation is only kept when the event is unchanged.
  const update = db.prepare(`UPDATE alerts SET severity=?,
    ai_explanation = CASE WHEN data = ? THEN ai_explanation ELSE NULL END,
    ai_model = CASE WHEN data = ? THEN ai_model ELSE NULL END,
    data=? WHERE id=?`)
  return db.transaction(evs => {
    let added = 0
    for (const e of evs) {
      const id = alertIdFor(device, e)
      if (exists.get(id)) { const json = JSON.stringify(e); update.run(e.severity ?? null, json, json, json, id) }
      else { insert.run(id, device, e.type, e.severity ?? null, e.start, JSON.stringify(e), now()); added++ }
    }
    return added
  })(events)
}
export function listAlerts(db, { device, includeDismissed = false } = {}) {
  const rows = db.prepare(`SELECT * FROM alerts WHERE (? IS NULL OR device = ?) AND (? = 1 OR dismissed = 0) ORDER BY start DESC`)
    .all(device ?? null, device ?? null, includeDismissed ? 1 : 0)
  return rows.map(rowToAlert)
}
export const getAlert = (db, id) => {
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id)
  return row ? rowToAlert(row) : undefined
}
export const saveAlertExplanation = (db, id, text, model) =>
  db.prepare('UPDATE alerts SET ai_explanation = ?, ai_model = ? WHERE id = ?').run(text, model ?? null, id).changes > 0
export function updateAlert(db, id, { read, dismissed }) {
  const sets = [], args = []
  if (read !== undefined) { sets.push('read = ?'); args.push(read ? 1 : 0) }
  if (dismissed !== undefined) { sets.push('dismissed = ?'); args.push(dismissed ? 1 : 0) }
  if (!sets.length) return false
  return db.prepare(`UPDATE alerts SET ${sets.join(', ')} WHERE id = ?`).run(...args, id).changes > 0
}
export const unreadAlertCount = db => db.prepare('SELECT COUNT(*) n FROM alerts WHERE read = 0 AND dismissed = 0').get().n

// ---------- appliances ----------
const rowToAppliance = r => ({
  id: r.id, name: r.name, category: r.category, watts: r.watts, hours: r.hours, pattern: r.pattern,
  brand: r.brand ?? '', model: r.model ?? '', sample: !!r.sample, createdAt: r.created_at, updatedAt: r.updated_at,
})
export const getAppliance = (db, id) => {
  const row = db.prepare('SELECT * FROM appliances WHERE id = ?').get(id)
  return row ? rowToAppliance(row) : undefined
}
export const listAppliances = db => db.prepare('SELECT * FROM appliances ORDER BY created_at, rowid').all().map(rowToAppliance)
export function addAppliance(db, a, { sample = false } = {}) {
  const id = randomUUID()
  db.prepare(`INSERT INTO appliances (id, name, category, watts, hours, pattern, brand, model, sample, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, a.name, a.category, a.watts, a.hours, a.pattern, a.brand || null, a.model || null, sample ? 1 : 0, now(), now())
  return getAppliance(db, id)
}
// Editing a built-in example makes it the user's own, so it is no longer labeled as a sample.
export function updateAppliance(db, id, a) {
  const changed = db.prepare(`UPDATE appliances SET name=?, category=?, watts=?, hours=?, pattern=?, brand=?, model=?, sample=0, updated_at=? WHERE id=?`)
    .run(a.name, a.category, a.watts, a.hours, a.pattern, a.brand || null, a.model || null, now(), id).changes
  return changed ? getAppliance(db, id) : undefined
}
export const deleteAppliance = (db, id) => db.prepare('DELETE FROM appliances WHERE id = ?').run(id).changes > 0

// ---------- household meter readings (what the user types in from the meter) ----------
const rowToMeterReading = r => ({ id: r.id, kwh: r.kwh, date: r.recorded_at, source: r.source, reset: !!r.is_reset })
export const listMeterReadings = db =>
  db.prepare('SELECT * FROM meter_readings ORDER BY recorded_at, rowid').all().map(rowToMeterReading)
export function addMeterReading(db, { id = randomUUID(), kwh, date, source = 'Manual entry', reset = false }) {
  // INSERT OR IGNORE keeps a retried one-time import from creating duplicates
  db.prepare('INSERT OR IGNORE INTO meter_readings (id, kwh, recorded_at, source, created_at, is_reset) VALUES (?,?,?,?,?,?)')
    .run(id, kwh, date, source, now(), reset ? 1 : 0)
  return rowToMeterReading(db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(id))
}
export const deleteMeterReading = (db, id) => db.prepare('DELETE FROM meter_readings WHERE id = ?').run(id).changes > 0

// ---------- settings ----------
export const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value))
export const getSetting = (db, key, fallback) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? JSON.parse(row.value) : fallback
}

// ---------- wipe everything ----------
export function clearAllData(db) {
  db.transaction(() => { for (const t of ['alerts', 'baselines', 'readings', 'devices', 'appliances', 'meter_readings', 'settings']) db.exec(`DELETE FROM ${t}`) })()
}