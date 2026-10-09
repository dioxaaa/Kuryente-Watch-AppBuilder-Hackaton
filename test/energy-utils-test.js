import test from 'node:test'
import assert from 'node:assert/strict'
import { applianceAverageDailyKwh, applianceMonthKwh, daysInMonth, meterDailyUse, usagePerDay, usedDaysPer30 } from '../src/utils/energy-utils.js'

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

test('usage pattern changes the monthly estimate', () => {
  const fan = { watts: 60, hours: 8 } // 0.48 kWh on a day of use
  assert.equal(applianceMonthKwh({ ...fan, pattern: 'Daily' }).toFixed(2), '14.40')
  assert.equal(applianceMonthKwh(fan).toFixed(2), '14.40') // no pattern means daily
  assert.equal(applianceMonthKwh({ ...fan, pattern: 'Weekdays' }).toFixed(2), '10.29') // 150/7 days
  assert.equal(applianceMonthKwh({ ...fan, pattern: 'Weekends' }).toFixed(2), '4.11') // 60/7 days
  assert.equal(applianceMonthKwh({ ...fan, pattern: 'Occasional' }).toFixed(2), '3.84') // 8 days
  assert.equal(usedDaysPer30('Unknown'), 30)
  assert.equal(applianceAverageDailyKwh({ ...fan, pattern: 'Occasional' }).toFixed(3), '0.128')
})

test('usagePerDay divides each stretch by its real length so uneven gaps compare fairly', () => {
  const points = usagePerDay([
    { recordedAt: '2026-10-01T08:00:00Z', readingKwh: 1000, usageKwh: null },
    { recordedAt: '2026-10-02T08:00:00Z', readingKwh: 1010, usageKwh: 10 }, // 1 day
    { recordedAt: '2026-10-05T08:00:00Z', readingKwh: 1040, usageKwh: 30 }, // 3 days
  ])
  assert.equal(points.length, 2)
  assert.equal(points[0].usage, 10)
  assert.equal(points[1].usage, 10) // 30 kWh over 3 days is the same pace, not triple
  assert.equal(points[1].kwh, 30)
  assert.equal(points[1].days, 3)
  assert.equal(points[1].from.toISOString(), '2026-10-02T08:00:00.000Z')
})

test('usagePerDay skips a new meter and stretches under an hour', () => {
  const points = usagePerDay([
    { recordedAt: '2026-10-01T08:00:00Z', readingKwh: 1000, usageKwh: null },
    { recordedAt: '2026-10-01T08:20:00Z', readingKwh: 1001, usageKwh: 1 },
    { recordedAt: '2026-10-03T08:00:00Z', readingKwh: 5, usageKwh: null }, // meter replaced
  ])
  assert.deepEqual(points, [])
})

test('usagePerDay labels same-day bars with their time', () => {
  const points = usagePerDay([
    { recordedAt: '2026-10-01T00:00:00Z', readingKwh: 1000, usageKwh: null },
    { recordedAt: '2026-10-01T06:00:00Z', readingKwh: 1002, usageKwh: 2 },
    { recordedAt: '2026-10-01T12:00:00Z', readingKwh: 1004, usageKwh: 2 },
  ])
  assert.notEqual(points[0].day, points[1].day)
})