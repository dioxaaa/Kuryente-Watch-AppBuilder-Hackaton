// Checks a meter reading from the form and returns only the fields we store.
const httpError = (status, message) => Object.assign(new Error(message), { status })

export function cleanMeterReading(raw) {
  const r = raw ?? {}
  const kwh = Number(r.kwh)
  if (!(kwh > 0 && kwh < 10_000_000)) throw httpError(400, 'Meter reading must be a number greater than zero.')
  const when = new Date(r.date)
  if (Number.isNaN(when.getTime())) throw httpError(400, 'Choose a valid date and time for this reading.')
  const id = typeof r.id === 'string' && r.id.length <= 80 ? r.id : undefined
  const source = r.source === undefined ? 'Manual entry' : String(r.source).slice(0, 30)
  return { id, kwh, date: when.toISOString(), source }
}