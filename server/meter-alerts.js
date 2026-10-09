// Alerts from cumulative household meter readings, so the detector works without per-appliance power sensors.
// Compares the average daily use since the previous reading with the household's usual daily use.
import { saveAlerts } from './repository.js'
import { listMeterReadings } from './app-repository.js'

export const METER_DEVICE = 'household-meter'
const DAY_MS = 86400000
const round2 = n => Math.round(n * 100) / 100

// Splits cumulative readings into periods of at least `minDays`; readings closer together are merged into one period.
export function meterPeriods(readings, { minDays = 0.75 } = {}) {
  const sorted = readings
    .map(r => ({ kwh: Number(r.readingKwh), time: Date.parse(r.recordedAt), at: r.recordedAt, reset: Boolean(r.reset ?? r.isReset) }))
    .filter(r => Number.isFinite(r.kwh) && Number.isFinite(r.time))
    .sort((a, b) => a.time - b.time)
  const periods = []
  let start = sorted[0]
  for (const reading of sorted.slice(1)) {
    const days = (reading.time - start.time) / DAY_MS
    if (reading.reset || reading.kwh < start.kwh) { start = reading; continue }
    if (days < minDays) continue
    periods.push({ from: start.at, to: reading.at, days, kwh: reading.kwh - start.kwh })
    start = reading
  }
  return periods
}

// `readings` are { readingKwh, recordedAt } in any order. Returns detector events of type 'usage-jump'.
// Needs at least two periods (3 readings about a day apart): the earlier ones set the usual daily use.
export function meterUsageEvents(readings, { minDays = 0.75, warnRatio = 1.25, highRatio = 1.6, window = 5 } = {}) {
  const intervals = meterPeriods(readings, { minDays })
  const events = []
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i]
    const prior = intervals.slice(Math.max(0, i - window), i)
    const priorDays = prior.reduce((sum, x) => sum + x.days, 0)
    const expected = prior.reduce((sum, x) => sum + x.kwh, 0) / priorDays
    if (expected <= 0) continue
    const observed = current.kwh / current.days
    const ratio = observed / expected
    if (ratio < warnRatio) continue
    events.push({
      type: 'usage-jump',
      severity: ratio >= highRatio ? 'high' : 'warning',
      start: current.to,
      periodStart: current.from,
      end: current.to,
      days: round2(current.days),
      durationMin: Math.round(current.days * 1440),
      usageKwh: round2(current.kwh),
      observedKwhPerDay: round2(observed),
      expectedKwhPerDay: round2(expected),
      ratio: round2(ratio),
      excessKwh: round2((observed - expected) * current.days),
    })
  }
  return events
}

// What the meter check knows so far, so the app can explain why there is or isn't an alert.
export function meterStatus(db) {
  const readings = listMeterReadings(db)
  const periods = meterPeriods(readings)
  const status = { readings: readings.length, periods: periods.length, neededReadings: Math.max(0, 2 - periods.length), latest: null }
  if (periods.length >= 2) {
    const prior = periods.slice(-6, -1)
    const expected = prior.reduce((sum, x) => sum + x.kwh, 0) / prior.reduce((sum, x) => sum + x.days, 0)
    const last = periods.at(-1)
    status.latest = {
      observedKwhPerDay: round2(last.kwh / last.days),
      expectedKwhPerDay: round2(expected),
      warnAboveKwhPerDay: round2(expected * 1.25),
      at: last.to,
    }
  }
  return status
}

// Saves meter alerts. Returns { newAlerts, periods, latest } so the app can explain the result.
export function scanMeterReadings(db) {
  const { periods, latest } = meterStatus(db)
  const events = meterUsageEvents(listMeterReadings(db))
  if (!events.length) return { newAlerts: 0, periods, latest }
  db.prepare(`INSERT OR IGNORE INTO devices (name, label, category, created_at) VALUES (?, 'Household meter', 'Meter', ?)`)
    .run(METER_DEVICE, new Date().toISOString())
  return { newAlerts: saveAlerts(db, METER_DEVICE, events), periods, latest }
}
