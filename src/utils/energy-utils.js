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

export const estimateMonthKwh = appliances => appliances.reduce((sum, item) => sum + estimateDailyKwh(item) * 30, 0)

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
    })
  }
  return points
}