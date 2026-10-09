// Rules for a new meter reading. Shared by the form (browser) and the API (server) so they always agree.
// A household meter only counts up, so a reading must fit between the readings taken just before and after it.
// A reading marked `reset` (new or replaced meter) starts over: it is not compared with the older readings.

const time = value => new Date(value).getTime()

// The reading taken just before `date` and the one just after it. `readings` can be in any order.
export function neighborsAt(readings, date) {
  const t = time(date)
  const sorted = readings.slice().sort((a, b) => time(a.date) - time(b.date))
  let before = null
  let after = null
  for (const r of sorted) {
    if (time(r.date) <= t) before = r
    else { after = r; break }
  }
  return { before, after }
}

// Returns a readable error message, or null when the reading is fine.
export function checkReading(readings, { kwh, date, reset = false }) {
  if (reset) return null
  const { before, after } = neighborsAt(readings, date)
  if (before && kwh < before.kwh) {
    return `This is lower than your earlier reading (${before.kwh.toLocaleString()} kWh). Check the value, or choose “new or replaced meter” if your meter was changed.`
  }
  if (after && !after.reset && kwh > after.kwh) {
    return `This is higher than your later reading (${after.kwh.toLocaleString()} kWh). Check the value and the date.`
  }
  return null
}