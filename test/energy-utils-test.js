import test from 'node:test'
import assert from 'node:assert/strict'
import { daysInMonth, meterDailyUse } from '../src/utils/energy-utils.js'

const readings = [
  { recordedAt: '2026-09-28T08:00:00Z', readingKwh: 1000, usageKwh: null },
  { recordedAt: '2026-10-02T08:00:00Z', readingKwh: 1040, usageKwh: 40 },
  { recordedAt: '2026-10-06T08:00:00Z', readingKwh: 1080, usageKwh: 40 },
]

test('meterDailyUse averages the meter use since a date, starting from the reading before it', () => {
  const use = meterDailyUse(readings, new Date('2026-10-01T00:00:00Z'))
  assert.equal(use.kwh, 80)
  assert.equal(use.days, 8)
  assert.equal(use.perDay, 10)
  assert.equal(use.from, '2026-09-28T08:00:00Z')
})

test('meterDailyUse waits until readings span most of a day', () => {
  assert.equal(meterDailyUse([], new Date('2026-10-01')), null)
  assert.equal(meterDailyUse(readings.slice(0, 1), new Date('2026-09-01')), null)
  assert.equal(meterDailyUse([
    { recordedAt: '2026-10-06T08:00:00Z', readingKwh: 1080, usageKwh: null },
    { recordedAt: '2026-10-06T12:00:00Z', readingKwh: 1082, usageKwh: 2 },
  ], new Date('2026-10-01')), null)
  assert.equal(meterDailyUse(readings, new Date('2026-11-01')), null)
})

test('daysInMonth', () => {
  assert.equal(daysInMonth(new Date(2026, 1, 10)), 28)
  assert.equal(daysInMonth(new Date(2026, 9, 10)), 31)
})
