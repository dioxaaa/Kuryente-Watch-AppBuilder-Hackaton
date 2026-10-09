// Glue between the detector engine and the database.
import { learnBaseline, detect, DEFAULT_Z_THRESHOLD } from '../src/engine/index.js'
import { getReadings, saveBaseline, getBaseline, saveAlerts, listDevices, getAlert, alertIdFor, latestReadingTime } from './repository.js'

// Learn a baseline from the readings stored for `device` (optionally within a date range).
export function trainDevice(db, device, range = {}) {
  const baseline = learnBaseline(getReadings(db, device, range))
  saveBaseline(db, baseline)
  return baseline
}

// Score stored readings against the saved baseline and persist the resulting alerts.
export function scanDevice(db, device, range = {}, options = {}) {
  const baseline = getBaseline(db, device)
  if (!baseline) throw new Error(`No baseline for "${device}". Train it first.`)
  const { events } = detect(getReadings(db, device, range), baseline, options)
  return { events, newAlerts: saveAlerts(db, device, events) }
}

// Scans every device that has a baseline, looking only at readings recorded after that baseline was learned.
// Devices without a baseline are skipped (training on data that may already hold a problem would teach it as normal).
export function scanAllDevices(db, options = {}) {
  const devices = [], skipped = []
  for (const { name } of listDevices(db)) {
    const baseline = getBaseline(db, name)
    if (!baseline) { skipped.push({ device: name, reason: 'No baseline yet' }); continue }
    const { events, newAlerts } = scanDevice(db, name, { from: baseline.trainedOn.to }, options)
    devices.push({ device: name, events: events.length, newAlerts })
  }
  return { scanned: devices.length, skipped, newAlerts: devices.reduce((sum, d) => sum + d.newAlerts, 0), devices }
}

// ---------- chart data ----------
// Reading timestamps are wall-clock text with no time zone, so shifting them is done in UTC (same idea as the simulator).
const wallMs = ts => Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(ts) ? ts : `${ts}Z`)
const shiftWall = (ts, minutes) => new Date(wallMs(ts) + minutes * 60000).toISOString().slice(0, 19)
const r1 = n => Math.round(n * 10) / 10
const notFound = message => Object.assign(new Error(message), { status: 404 })

// Everything the device chart needs in one call: readings, the learned "normal band" for each hour, and the
// events the detector flags. It runs the same detect() as a scan, so the chart can never disagree with the alerts.
// Window: around one alert (`alertId`), or an explicit `from`/`to`, or the last `hours` hours of readings.
export function deviceChart(db, device, { from, to, alertId, hours = 24 } = {}) {
  const baseline = getBaseline(db, device)
  if (!baseline) throw notFound(`No baseline for "${device}" yet. Train it first.`)
  const latest = latestReadingTime(db, device)
  if (!latest) throw notFound(`No readings stored for "${device}".`)

  let focus = null
  if (alertId) {
    const alert = getAlert(db, alertId)
    if (!alert || alert.device !== device) throw notFound('Alert not found for this device.')
    focus = { id: alert.id, start: alert.start, end: alert.end ?? alert.start }
    from = shiftWall(focus.start, -360) // show the hours before, so "normal" is visible next to the problem
    to = shiftWall(focus.end, 180)
  }
  to = to ?? latest
  from = from ?? shiftWall(to, -Math.min(168, Math.max(1, Number(hours) || 24)) * 60)

  const info = listDevices(db).find(d => d.name === device)
  const meta = { device, label: info?.label || device, ratedWatts: info?.ratedWatts ?? null, intervalMin: baseline.intervalMin, windowMin: baseline.windowMin, from, to, focus }

  // Read a little before `from` so the 1-hour average is already warmed up at the left edge of the chart.
  const readings = getReadings(db, device, { from: shiftWall(from, -baseline.windowMin), to })
  if (readings.length < 2) return { ...meta, points: [], events: [] }
  const { points, events } = detect(readings, baseline, { zThreshold: DEFAULT_Z_THRESHOLD })

  const rows = points.filter(p => p.timestamp >= from).map(p => {
    const b = baseline.hourly[new Date(p.timestamp).getHours()] // same hour bucket the detector used
    const spread = (DEFAULT_Z_THRESHOLD * b.mad) / 0.6745
    return { t: p.timestamp, watts: p.watts, avg: r1(p.smoothed), low: r1(Math.max(0, b.median - spread)), high: r1(b.median + spread), state: p.state }
  })
  const shown = events
    .filter(e => e.end >= from && e.start <= to)
    .map(e => ({ ...e, id: alertIdFor(device, e) }))
  return { ...meta, points: rows, events: shown }
}
