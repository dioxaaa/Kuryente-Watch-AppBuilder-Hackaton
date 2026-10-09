import test from 'node:test'
import assert from 'node:assert/strict'
import { applianceTip, offlineAnswer } from '../src/utils/offline-assistant.js'
import { buildAssistantContext } from '../src/utils/assistant-context.js'

const context = {
  rate: 12.5,
  usage: { recentDailyKwh: 10, earlierDailyKwh: 8, since: 'Oct 1, 2026' },
  appliances: [
    { name: 'Living room fan', category: 'Electric fan', watts: 60, hoursPerDay: 10, monthlyKwh: 18 },
    { name: 'Bedroom aircon', category: 'Air conditioner', watts: 900, hoursPerDay: 6, monthlyKwh: 162 },
  ],
  alerts: [],
}

test('offline assistant names the biggest appliance with its share and cost', () => {
  const reply = offlineAnswer('Which appliance uses the most?', context)
  assert.match(reply, /Bedroom aircon is the biggest/)
  assert.match(reply, /90% of the estimate/)
  assert.match(reply, /₱2,025/)
})

test('offline assistant explains a high bill from the meter trend', () => {
  const reply = offlineAnswer('Why is my bill high?', context)
  assert.match(reply, /10 kWh a day since Oct 1, 2026/)
  assert.match(reply, /25% higher than your earlier 8 kWh/)
})

test('offline assistant gives per-appliance saving tips and handles empty data', () => {
  assert.match(offlineAnswer('How can I save electricity?', context), /Bedroom aircon: Set it to 24–25°C/)
  assert.match(offlineAnswer('Why is my bill high?', {}), /Add at least two meter readings/)
  assert.match(offlineAnswer('hello', {}), /Why is my bill high/)
})

test('applianceTip returns daily kWh, monthly cost and a category tip', () => {
  assert.equal(applianceTip({ applianceName: 'Rice cooker', category: 'Rice cooker', ratedWatts: 600, hoursPerDay: 1.5 }, 12.5),
    'Your Rice cooker uses about 0.90 kWh a day, about ₱338 a month. Unplug it after cooking instead of leaving it on "keep warm" for hours.')
  assert.match(applianceTip({ applianceName: 'Aircon', ratedWatts: 1000, hoursPerDay: 8 }), /8\.00 kWh a day\. Set it to 24–25°C/)
})

test('buildAssistantContext accepts readings in the server shape', () => {
  const ctx = buildAssistantContext({
    readings: [{ readingKwh: 100, recordedAt: '2026-10-01T00:00:00Z' }, { readingKwh: 140, recordedAt: '2026-10-05T00:00:00Z' }],
    rate: 12.5,
  })
  assert.equal(ctx.latest.kwh, 140)
  assert.equal(ctx.usage.recentDailyKwh, 10)
})
