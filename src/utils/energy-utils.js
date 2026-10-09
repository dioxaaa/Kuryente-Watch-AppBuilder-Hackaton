export const estimateDailyKwh = appliance => (Number(appliance.watts) * Number(appliance.hours)) / 1000

export const formatPeso = amount =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)

export const formatDate = date =>
  new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

export const getReadingDelta = (current, previous) => Number(current) - Number(previous)


export const initialsOf = name => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || 'H').slice(0, 2)).toUpperCase()
}

// Days an appliance runs in a 30-day month for each usage pattern. "Occasional" is taken as about 8 days a month.
export const USED_DAYS_PER_30 = { Daily: 30, Weekdays: (30 * 5) / 7, Weekends: (30 * 2) / 7, Occasional: 8 }
export const usedDaysPer30 = pattern => USED_DAYS_PER_30[pattern] ?? 30

// kWh over 30 days, counting only the days the usage pattern says the appliance runs.
export const applianceMonthKwh = appliance => estimateDailyKwh(appliance) * usedDaysPer30(appliance.pattern ?? appliance.usagePattern)

// Average kWh per calendar day (comparable with the meter), which is lower than kWh per day of use for non-daily patterns.
export const applianceAverageDailyKwh = appliance => applianceMonthKwh(appliance) / 30

export const estimateMonthKwh = appliances => appliances.reduce((sum, item) => sum + applianceMonthKwh(item), 0)

// One point per stretch between two meter readings, as average kWh per day so stretches of different length compare fairly.
// `readings` are oldest first ({ recordedAt, usageKwh }); `usageKwh` is null for the first reading or a new meter, which are skipped.
// Stretches under an hour are left out as too short to average, like usageFromReadings.
export function usagePerDay(readings) {
  const points = []
  for (let i = 1; i < readings.length; i++) {
    const to = new Date(readings[i].recordedAt)
    const from = new Date(readings[i - 1].recordedAt)
    const days = (to - from) / 86400000
    const kwh = readings[i].usageKwh
    if (kwh == null || !(days >= 1 / 24)) continue
    points.push({ id: readings[i].id ?? readings[i].recordedAt, to, from, days, kwh, perDay: kwh / days })
  }
  // Label each bar with its end date; add the time when two bars would share a date.
  const dateLabel = date => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date)
  const counts = points.reduce((map, point) => map.set(dateLabel(point.to), (map.get(dateLabel(point.to)) ?? 0) + 1), new Map())
  return points.map(point => ({
    ...point,
    day: counts.get(dateLabel(point.to)) > 1 ? `${dateLabel(point.to)}, ${new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(point.to)}` : dateLabel(point.to),
    usage: Number(point.perDay.toFixed(2)),
  }))
}

// Average kWh per day between each pair of consecutive meter readings (the real usage the readings show).
// Readings must be sorted oldest first. Pairs closer than an hour apart are skipped as too noisy to average.
export function usageFromReadings(readings) {
  const points = []
  for (let i = 1; i < readings.length; i++) {
    const days = (new Date(readings[i].date) - new Date(readings[i - 1].date)) / 86400000
    const used = readings[i].kwh - readings[i - 1].kwh
    if (days < 1 / 24 || used < 0 || readings[i].reset) continue
    points.push({
      day: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(readings[i].date)),
      usage: Number((used / days).toFixed(1)),
      date: new Date(readings[i].date),
      from: new Date(readings[i - 1].date), // when this stretch started
    })
  }
  return points
}

// kWh the meter recorded since `since`, counted from the reading just before it, plus the average per day.
// Readings are oldest first ({ recordedAt, usageKwh }). Null until the readings span most of a day.
export function meterDailyUse(readings, since) {
  const start = readings.findIndex(reading => new Date(reading.recordedAt) >= since)
  if (start === -1) return null
  const from = readings[Math.max(start - 1, 0)]
  const kwh = readings.slice(Math.max(start, 1)).reduce((sum, reading) => sum + (reading.usageKwh ?? 0), 0)
  const days = (new Date(readings.at(-1).recordedAt) - new Date(from.recordedAt)) / 86400000
  if (days < 0.75) return null
  return { kwh, days, perDay: kwh / days, from: from.recordedAt }
}

export const daysInMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()