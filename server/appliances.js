// Checks an appliance from the form and returns only the fields we store.
const httpError = (status, message) => Object.assign(new Error(message), { status })

export const APPLIANCE_CATEGORIES = ['Refrigerator', 'Electric fan', 'Air conditioner', 'Rice cooker', 'Television', 'Washing machine', 'Other']
export const APPLIANCE_PATTERNS = ['Daily', 'Weekdays', 'Weekends', 'Occasional']
const MAX_WATTS = 50000

// Throws a 400 with a readable message when something is wrong.
export function cleanAppliance(raw) {
  const r = raw ?? {}
  const name = String(r.name ?? '').trim()
  if (!name || name.length > 80) throw httpError(400, 'Appliance name is required (up to 80 characters).')
  const category = r.category ?? 'Other'
  if (!APPLIANCE_CATEGORIES.includes(category)) throw httpError(400, `Category must be one of: ${APPLIANCE_CATEGORIES.join(', ')}.`)
  const watts = Number(r.watts)
  if (!(watts > 0 && watts <= MAX_WATTS)) throw httpError(400, `Rated watts must be greater than 0 and at most ${MAX_WATTS}.`)
  const hours = Number(r.hours)
  if (!(hours > 0 && hours <= 24)) throw httpError(400, 'Hours used per day must be greater than 0 and at most 24.')
  const pattern = r.pattern ?? 'Daily'
  if (!APPLIANCE_PATTERNS.includes(pattern)) throw httpError(400, `Usage pattern must be one of: ${APPLIANCE_PATTERNS.join(', ')}.`)
  const brand = String(r.brand ?? '').trim()
  const model = String(r.model ?? '').trim()
  if (brand.length > 60 || model.length > 60) throw httpError(400, 'Brand and model can be up to 60 characters.')
  return { name, category, watts, hours, pattern, brand, model }
}