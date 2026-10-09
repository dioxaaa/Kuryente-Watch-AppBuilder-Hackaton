import test from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../server/db.js'
import * as appRepo from '../server/app-repository.js'
import * as repo from '../server/repository.js'
import { meterStatus, meterUsageEvents, scanMeterReadings, METER_DEVICE } from '../server/meter-alerts.js'
import { toViewAlert } from '../src/utils/alerts.js'
import { alertImpact } from '../src/utils/alert-impact.js'
import { buildExplainMessages } from '../server/alert-explainer.js'

const day = n => new Date(Date.UTC(2026, 9, 1 + n, 9)).toISOString()
const steady = [[0, 1000], [1, 1010], [2, 1020], [3, 1030]]

test('meterUsageEvents flags a jump in daily use against the usual level', () => {
  assert.deepEqual(meterUsageEvents(steady.map(([d, kwh]) => ({ readingKwh: kwh, recordedAt: day(d) }))), [])
  const events = meterUsageEvents([...steady, [4, 1045]].map(([d, kwh]) => ({ readingKwh: kwh, recordedAt: day(d) })))
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'usage-jump')
  assert.equal(events[0].severity, 'warning')
  assert.equal(events[0].expectedKwhPerDay, 10)
  assert.equal(events[0].observedKwhPerDay, 15)
  assert.equal(events[0].excessKwh, 5)
  const high = meterUsageEvents([...steady, [4, 1050]].map(([d, kwh]) => ({ readingKwh: kwh, recordedAt: day(d) })))
  assert.equal(high[0].severity, 'high')
})

test('three daily readings are enough, and close readings are merged instead of ignored', () => {
  const read = rows => rows.map(([d, kwh]) => ({ readingKwh: kwh, recordedAt: typeof d === 'number' ? day(d) : d }))
  assert.equal(meterUsageEvents(read([[0, 1000], [1, 1010], [2, 1025]])).length, 1)
  assert.deepEqual(meterUsageEvents(read([[0, 1000], [1, 1010], [2, 1012]])), [])
  const hour = h => new Date(Date.parse(day(2)) + h * 3600000).toISOString()
  assert.deepEqual(meterUsageEvents(read([[0, 1000], [1, 1010], [hour(1), 1011], [hour(2), 1040]])), [])
  const afterDay1 = new Date(Date.parse(day(1)) + 3 * 3600000).toISOString()
  const merged = meterUsageEvents(read([[0, 1000], [1, 1010], [afterDay1, 1012], [2, 1030]]))
  assert.equal(merged.length, 1)
  assert.equal(merged[0].observedKwhPerDay, 20)
})

test('meterStatus says how many more readings are needed', () => {
  const db = openDb(':memory:')
  try {
    assert.equal(meterStatus(db).neededReadings, 2)
    appRepo.createMeterReading(db, { readingKwh: 1000, recordedAt: day(0), notes: '' })
    appRepo.createMeterReading(db, { readingKwh: 1001, recordedAt: new Date(Date.parse(day(0)) + 600000).toISOString(), notes: '' })
    assert.deepEqual(meterStatus(db), { readings: 2, periods: 0, neededReadings: 2, latest: null })
  } finally {
    db.close()
  }
})

test('scanMeterReadings saves one alert per jump and the views describe it', () => {
  const db = openDb(':memory:')
  try {
    for (const [d, kwh] of [...steady, [4, 1050]]) appRepo.createMeterReading(db, { readingKwh: kwh, recordedAt: day(d), notes: '' })
    assert.equal(scanMeterReadings(db).newAlerts, 1)
    const again = scanMeterReadings(db)
    assert.equal(again.newAlerts, 0)
    assert.equal(again.latest.observedKwhPerDay, 20)
    assert.deepEqual(meterStatus(db).latest, { observedKwhPerDay: 20, expectedKwhPerDay: 10, warnAboveKwhPerDay: 12.5, at: day(4) })
    const [saved] = repo.listAlerts(db)
    assert.equal(saved.device, METER_DEVICE)
    const view = toViewAlert(saved, [])
    assert.equal(view.title, 'Household electricity use jumped')
    assert.match(view.description, /20 kWh a day.*usual 10 kWh/)
    const impact = alertImpact(view, [{ name: 'Fridge', category: 'Refrigerator' }], 12)
    assert.equal(impact.appliance, null)
    assert.equal(impact.extraKwh, 10)
    assert.equal(impact.moneyText, '≈ ₱120')
    assert.match(buildExplainMessages(saved)[1].content, /main electricity meter/)
  } finally {
    db.close()
  }
})
