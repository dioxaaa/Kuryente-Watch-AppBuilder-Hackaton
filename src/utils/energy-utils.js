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
