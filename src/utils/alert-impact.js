// Connects a detector alert to one of the household's appliances and to money.
// Pure functions, so they are easy to test and the dashboard, Alerts page and assistant all tell the same story.
import { duration } from './alerts.js'
import { formatPeso } from './energy-utils.js'

const norm = value => String(value ?? '').trim().toLowerCase()
const watts = n => (Number.isFinite(Number(n)) && Number(n) > 0 ? `${Math.round(Number(n))} W` : 'an unknown level')

export const kwhText = n => `${n < 1 ? n.toFixed(2) : n.toFixed(1)} kWh`
// formatPeso rounds to whole pesos, which would turn ₱1.20 into ₱1. Small amounts keep their centavos.
export const pesoText = n => (n > 0 && n < 10 ? `₱${n.toFixed(2)}` : formatPeso(n))

// The appliance a device reading belongs to: same name first, then the same category (Refrigerator, Electric fan, ...).
export function applianceForAlert(alert, appliances = []) {
  const byName = name => name && appliances.find(a => norm(a.name) === norm(name))
  const category = norm(alert.deviceCategory)
  return byName(alert.deviceLabel) || byName(alert.device) || (category && appliances.find(a => norm(a.category) === category)) || null
}

// What an alert means for the household: who, how much extra energy, how many pesos.
// Only "stayed high" alerts have a measured extra amount. Spikes and low-power alerts get no invented cost.
export function alertImpact(alert, appliances, rate) {
  const wholeHome = alert.type === 'usage-jump'
  const appliance = wholeHome ? null : applianceForAlert(alert, appliances)
  const name = wholeHome ? 'Your household' : appliance?.name || alert.deviceLabel || 'This device'
  const extraKwh = alert.type === 'sustained-high' || wholeHome ? Number(alert.excessKwh) || 0 : 0
  const extraPesos = extraKwh * (Number(rate) || 0)
  let headline, detail
  if (wholeHome) {
    headline = `${name} used about ${kwhText(extraKwh)} more than usual`
    detail = `${alert.observedKwhPerDay} kWh/day vs your usual ${alert.expectedKwhPerDay} kWh/day since the previous meter reading`
  } else if (alert.type === 'spike') {
    headline = `${name} hit ${watts(alert.peakWatts)}, far above anything it has drawn before`
    detail = 'A one-off peak. No extra cost is estimated for a spike.'
  } else if (alert.type === 'sustained-low') {
    headline = `${name} drew less power than normal`
    detail = `${watts(alert.observedWatts)} vs ${watts(alert.expectedWatts)} normal for this hour · ${duration(alert.durationMin)}. Worth checking it is running.`
  } else {
    headline = extraKwh > 0 ? `${name} used about ${kwhText(extraKwh)} more than normal` : `${name} stayed above its normal draw`
    detail = `${watts(alert.observedWatts)} vs ${watts(alert.expectedWatts)} normal for this hour · ${duration(alert.durationMin)}`
  }
  return { appliance, name, extraKwh, extraPesos, moneyText: extraKwh > 0 && extraPesos > 0 ? `≈ ${pesoText(extraPesos)}` : null, headline, detail }
}

export function totalImpact(alerts, appliances, rate) {
  const all = alerts.map(alert => ({ alert, ...alertImpact(alert, appliances, rate) }))
  const costly = all.filter(item => item.extraKwh > 0)
  const top = costly.reduce((best, item) => (!best || item.extraKwh > best.extraKwh ? item : best), null)
  return { count: alerts.length, extraKwh: costly.reduce((s, i) => s + i.extraKwh, 0), extraPesos: costly.reduce((s, i) => s + i.extraPesos, 0), top }
}