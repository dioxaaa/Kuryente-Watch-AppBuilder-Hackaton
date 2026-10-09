import test from 'node:test'
import assert from 'node:assert/strict'
import { toViewAlert } from '../src/utils/alerts.js'
import { alertImpact, applianceForAlert, totalImpact, pesoText, kwhText } from '../src/utils/alert-impact.js'
import { billFacts, buildAssistantContext, usageSummary } from '../src/utils/assistant-context.js'
import { buildSystemPrompt } from '../server/assistant.js'

const devices = [{ name: 'refrigerator', label: 'Family refrigerator', category: 'Refrigerator' }]
const appliances = [
  { name: 'Living room fan', category: 'Electric fan', watts: 60, hours: 10 },
  { name: 'Family refrigerator', category: 'Refrigerator', watts: 180, hours: 24 },
]
const high = toViewAlert({ id: 'a', device: 'refrigerator', type: 'sustained-high', start: '2026-10-08T13:10:00', durationMin: 65, observedWatts: 147.6, expectedWatts: 59.1, excessKwh: 0.096, ratio: 2.5, severity: 'high' }, devices)
const spike = toViewAlert({ id: 'b', device: 'refrigerator', type: 'spike', start: '2026-10-08T20:00:00', durationMin: 5, peakWatts: 410, severity: 'warning' }, devices)
const low = toViewAlert({ id: 'c', device: 'refrigerator', type: 'sustained-low', start: '2026-10-08T22:00:00', durationMin: 90, observedWatts: 3, expectedWatts: 55, severity: 'warning' }, devices)

test('an alert links to the appliance with the same name, else the same category', () => {
  assert.equal(applianceForAlert(high, appliances).name, 'Family refrigerator')
  const renamed = { ...high, deviceLabel: 'Kitchen fridge' }
  assert.equal(applianceForAlert(renamed, appliances).name, 'Family refrigerator') // by category
  assert.equal(applianceForAlert({ ...high, deviceLabel: 'x', deviceCategory: null }, appliances), null)
})

test('a sustained-high alert becomes extra kWh and pesos at the household rate', () => {
  const impact = alertImpact(high, appliances, 12.5)
  assert.equal(impact.name, 'Family refrigerator')
  assert.ok(Math.abs(impact.extraPesos - 1.2) < 1e-9)
  assert.equal(impact.moneyText, '≈ ₱1.20')
  assert.match(impact.headline, /Family refrigerator used about 0\.10 kWh more than normal/)
  assert.match(impact.detail, /148 W vs 59 W normal for this hour · 1 h 5 min/)
})

test('spikes and low-power alerts never get an invented cost', () => {
  for (const alert of [spike, low]) {
    const impact = alertImpact(alert, appliances, 12.5)
    assert.equal(impact.extraKwh, 0)
    assert.equal(impact.moneyText, null)
  }
  assert.match(alertImpact(spike, appliances, 12.5).headline, /hit 410 W/)
})

test('totals add up only the measured extra and name the biggest cause', () => {
  const total = totalImpact([high, spike, low], appliances, 10)
  assert.equal(total.count, 3)
  assert.ok(Math.abs(total.extraKwh - 0.096) < 1e-9 && Math.abs(total.extraPesos - 0.96) < 1e-9)
  assert.equal(total.top.name, 'Family refrigerator')
  assert.equal(totalImpact([], appliances, 10).extraPesos, 0)
})

test('money and energy text keep centavos for small amounts', () => {
  assert.equal(pesoText(1.2), '₱1.20')
  assert.equal(pesoText(12.4), '₱12')
  assert.equal(kwhText(0.096), '0.10 kWh')
  assert.equal(kwhText(2.34), '2.3 kWh')
})

const readings = [
  { kwh: 2841, date: '2026-09-10T09:00:00Z' }, { kwh: 2880, date: '2026-09-17T09:00:00Z' },
  { kwh: 2926, date: '2026-09-24T09:00:00Z' }, { kwh: 2985, date: '2026-10-01T09:00:00Z' },
]

test('meter usage compares the latest stretch with the ones before it', () => {
  const u = usageSummary(readings)
  assert.equal(u.recentDailyKwh, 8.4)
  assert.equal(u.earlierDailyKwh, 6.1)
  assert.equal(usageSummary(readings.slice(0, 1)), null)
})

test('bill facts come from real data and say so when data is missing', () => {
  const facts = billFacts({ readings, appliances, alerts: [high], rate: 12.5 })
  const byId = Object.fromEntries(facts.map(f => [f.id, f.text]))
  assert.match(byId.meter, /8\.4 kWh a day.*38% above your earlier average of 6\.1/)
  assert.match(byId.alerts, /0\.10 kWh.*₱1\.20.*Family refrigerator/)
  assert.ok(byId.appliance && byId.coverage)
  const empty = billFacts({ readings: [], appliances: [], alerts: [], rate: 12.5 })
  assert.match(empty[0].text, /Add two meter readings/)
  assert.match(empty.at(-1).text, /not flagged anything/)
})

test('the assistant prompt carries the meter trend and alert cost, as data only', () => {
  const context = buildAssistantContext({ readings, appliances, alerts: [high], rate: 12.5, monthKwh: 336 })
  assert.equal(context.alerts[0].appliance, 'Family refrigerator')
  assert.equal(context.alerts[0].extraPesos, 1.2)
  const prompt = buildSystemPrompt(context)
  assert.match(prompt, /Meter-based use: 8\.4 kWh\/day in the latest period/)
  assert.match(prompt, /Meter-based use earlier: 6\.1 kWh\/day/)
  assert.match(prompt, /Extra energy: about 0\.1 kWh \(about PHP 1\.2\) on Family refrigerator/)
  assert.match(prompt, /why the bill is high/)
  // A browser-supplied string cannot become an instruction: appliance and alert text is clipped to a short field.
  const long = buildSystemPrompt({ alerts: [{ title: 'x'.repeat(500), appliance: 'y'.repeat(500), extraKwh: 1 }] })
  assert.ok(!long.includes('x'.repeat(81)) && !long.includes('y'.repeat(41)))
})
