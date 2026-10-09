// Glue between the detector engine and the database.
import { learnBaseline, detect } from '../src/engine/index.js'
import { getReadings, saveBaseline, getBaseline, saveAlerts } from './repository.js'

// Learn a baseline from the readings stored for `device` (optionally within a date range).
export function trainDevice(db, device, range = {}) {
  const baseline = learnBaseline(getReadings(db, device, range))
  saveBaseline(db, baseline)
  return baseline
}

// Score stored readings against the saved baseline and persist the resulting alerts.
export function scanDevice(db, device, range = {}, options = {}) {
  const baseline = getBaseline(db, device)
  if (!baseline) throw Object.assign(new Error(`No baseline for "${device}". Train it first.`), { status: 400 })
  const { events } = detect(getReadings(db, device, range), baseline, options)
  return { events, newAlerts: saveAlerts(db, device, events) }
}