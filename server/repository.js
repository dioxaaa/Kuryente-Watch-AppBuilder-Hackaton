// All SQL lives here. Functions take the db as the first argument.
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

const rowToAlert = r => ({ ...JSON.parse(r.data), id: r.id, device: r.device, createdAt: r.created_at, read: !!r.read, dismissed: !!r.dismissed })

// Saves detector events as alerts. Re-saving the same event keeps its read/dismissed state.
// Returns how many were NEW.
export function saveAlerts(db, device, events) {
  ensureDevice(db, device)
  const exists = db.prepare('SELECT 1 FROM alerts WHERE id = ?')
  const insert = db.prepare('INSERT INTO alerts (id, device, type, severity, start, data, created_at) VALUES (?,?,?,?,?,?,?)')
  const update = db.prepare('UPDATE alerts SET severity=?, data=? WHERE id=?')
  return db.transaction(evs => {
    let added = 0
    for (const e of evs) {
      const id = alertIdFor(device, e)
      if (exists.get(id)) update.run(e.severity ?? null, JSON.stringify(e), id)
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
export function updateAlert(db, id, { read, dismissed }) {
  const sets = [], args = []
  if (read !== undefined) { sets.push('read = ?'); args.push(read ? 1 : 0) }
  if (dismissed !== undefined) { sets.push('dismissed = ?'); args.push(dismissed ? 1 : 0) }
  if (!sets.length) return false
  return db.prepare(`UPDATE alerts SET ${sets.join(', ')} WHERE id = ?`).run(...args, id).changes > 0
}
export const unreadAlertCount = db => db.prepare('SELECT COUNT(*) n FROM alerts WHERE read = 0 AND dismissed = 0').get().n

// ---------- settings ----------
export const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value))
export const getSetting = (db, key, fallback) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? JSON.parse(row.value) : fallback
}

// ---------- wipe everything ----------
export function clearAllData(db) {
  db.transaction(() => { for (const t of ['alerts', 'baselines', 'readings', 'devices', 'settings']) db.exec(`DELETE FROM ${t}`) })()
}