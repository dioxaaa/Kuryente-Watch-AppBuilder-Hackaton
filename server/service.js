// Glue between the detector engine and the database.
import { learnBaseline, detect } from '../src/engine/index.js'
import { getReadings, saveBaseline, getBaseline, saveAlerts, listDevices } from './repository.js'

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