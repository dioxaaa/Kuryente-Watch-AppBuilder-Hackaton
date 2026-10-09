// What the assistant (and the "Why is my bill high?" card) knows about the household.
// Built in one place so the chat bubble, the card and the plain-facts list always agree.
import { alertImpact, kwhText, pesoText, totalImpact } from './alert-impact.js'
import { applianceMonthKwh, formatDate, usageFromReadings, usedDaysPer30 } from './energy-utils.js'

const round1 = n => Math.round(n * 10) / 10
const round2 = n => Math.round(n * 100) / 100

// Meter-based use: the latest stretch between readings versus the average of the stretches before it.
export function usageSummary(readings) {
  const normalized = readings.map(reading => ({
    ...reading,
    kwh: reading.kwh ?? reading.readingKwh,
    date: reading.date ?? reading.recordedAt,
    reset: reading.reset ?? reading.isReset,
  }))
  const latestReset = normalized.reduce((index, reading, current) => reading.reset ? current : index, -1)
  const points = usageFromReadings(normalized.slice(latestReset < 0 ? 0 : latestReset))
  if (!points.length) return null
  const latest = points[points.length - 1]
  const earlier = points.slice(0, -1)
  const earlierDailyKwh = earlier.length ? round1(earlier.reduce((s, p) => s + p.usage, 0) / earlier.length) : null
  return { recentDailyKwh: latest.usage, earlierDailyKwh, since: formatDate(latest.from) }
}

// Sent to /api/assistant. Numbers only: the server writes the prompt, so the browser can never inject instructions.
export function buildAssistantContext({ readings = [], appliances = [], alerts = [], rate, monthKwh } = {}) {
  readings = readings.map(r => ({ ...r, kwh: r.kwh ?? r.readingKwh, date: r.date ?? r.recordedAt, reset: r.reset ?? r.isReset }))
  const latest = readings[readings.length - 1]
  const previous = latest?.reset ? undefined : readings[readings.length - 2]
  return {
    rate,
    monthKwh,
    latest: latest && { kwh: latest.kwh, date: latest.date, source: latest.source },
    previousKwh: previous?.kwh,
    usage: usageSummary(readings) ?? undefined,
    appliances: appliances.map(a => ({
      name: a.name,
      category: a.category,
      watts: a.watts,
      hoursPerDay: a.hours,
      pattern: a.pattern ?? 'Daily',
      daysPerMonth: Math.round(usedDaysPer30(a.pattern) * 10) / 10,
      monthlyKwh: Math.round(applianceMonthKwh(a) * 10) / 10,
    })),
    alerts: alerts.slice(0, 5).map(a => {
      const impact = alertImpact(a, appliances, rate)
      return { title: a.title, context: a.context, detail: a.description, appliance: impact.appliance?.name, extraKwh: round2(impact.extraKwh), extraPesos: round2(impact.extraPesos) }
    }),
  }
}

// Plain facts for the card. Always available, even when the local AI is off.
// Each is { id, kind, text }. Only things that can be worked out from the data are listed.
export function billFacts({ readings = [], appliances = [], alerts = [], rate } = {}) {
  const facts = []
  const usage = usageSummary(readings)
  const meterMonthKwh = usage ? usage.recentDailyKwh * 30 : null

  if (!usage) {
    facts.push({ id: 'meter', kind: 'meter', muted: true, text: 'Add two meter readings and this will show how much your meter says you use per day.' })
  } else {
    const monthly = pesoText(usage.recentDailyKwh * 30 * rate)
    const { recentDailyKwh: recent, earlierDailyKwh: earlier } = usage
    if (earlier === null) facts.push({ id: 'meter', kind: 'meter', text: `Your meter shows ${recent} kWh a day since ${usage.since}, about ${monthly} a month at ₱${rate.toFixed(2)}/kWh.` })
    else {
      const pct = earlier > 0 ? Math.round(((recent - earlier) / earlier) * 100) : 0
      const trend = Math.abs(pct) < 5 ? `about the same as your earlier ${earlier} kWh a day` : `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} your earlier average of ${earlier} kWh a day`
      const more = pct >= 5 ? `, roughly ${pesoText((recent - earlier) * 30 * rate)} more a month than before` : ''
      facts.push({ id: 'meter', kind: 'meter', text: `Your meter shows ${recent} kWh a day since ${usage.since}, ${trend}. That is about ${monthly} a month${more}.` })
    }
  }

  const monthly = appliances.map(a => ({ a, kwh: applianceMonthKwh(a) }))
  const total = monthly.reduce((s, i) => s + i.kwh, 0)
  const biggest = monthly.reduce((best, i) => (!best || i.kwh > best.kwh ? i : best), null)
  if (biggest && total > 0) {
    facts.push({ id: 'appliance', kind: 'appliance', text: `${biggest.a.name} is the biggest on your list: about ${Math.round(biggest.kwh)} kWh a month (${Math.round((biggest.kwh / total) * 100)}% of the estimate), around ${pesoText(biggest.kwh * rate)}.` })
    if (meterMonthKwh > 0) {
      const coverage = total / meterMonthKwh
      if (coverage < 0.7) facts.push({ id: 'coverage', kind: 'appliance', text: `Your appliance list explains only about ${Math.round(coverage * 100)}% of what the meter shows, so something may be missing from it.` })
      else if (coverage > 1.3) facts.push({ id: 'coverage', kind: 'appliance', text: `Your appliance list adds up to ${Math.round(coverage * 100)}% of what the meter shows. Rated watts × hours usually overestimates, so check the hours on the biggest items.` })
    }
  }

  const impact = totalImpact(alerts, appliances, rate)
  if (impact.extraKwh > 0) facts.push({ id: 'alerts', kind: 'alert', text: `The detector flagged about ${kwhText(impact.extraKwh)} of extra use (≈ ${pesoText(impact.extraPesos)})${impact.top ? `, mostly on ${impact.top.name}` : ''}.` })
  else if (impact.count) facts.push({ id: 'alerts', kind: 'alert', text: `${impact.count} alert${impact.count === 1 ? '' : 's'} to look at, but no extra cost could be measured from them.` })
  else facts.push({ id: 'alerts', kind: 'alert', muted: true, text: 'The detector has not flagged anything unusual on your devices.' })
  return facts
}