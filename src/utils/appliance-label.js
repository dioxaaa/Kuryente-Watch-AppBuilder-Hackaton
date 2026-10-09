// Turns text read from an appliance rating label into form suggestions: rated watts, model number, brand and category.
// Used by on-device OCR (several noisy readings of one photo are combined) and to check the server vision model's reply.
export const LABEL_CATEGORIES = ['Refrigerator', 'Electric fan', 'Air conditioner', 'Rice cooker', 'Television', 'Washing machine', 'Other']
const MAX_WATTS = 50000

const BRANDS = [
  'Asahi', 'Hanabishi', 'Standard', 'Dowell', 'Kyowa', 'Imarflex', 'Micromatic', 'Fukuda', 'Eureka', 'Union', 'Akari', 'Firefly',
  'Omni', 'Sycat', 'Kolin', 'Koppel', 'Condura', 'Carrier', 'Aircon', 'Fujidenzo', 'Everest', 'Hitachi', 'Toshiba', 'Panasonic',
  'Sharp', 'Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Skyworth', 'Devant', 'Xiaomi', 'Midea', 'Haier', 'Whirlpool', 'Electrolux',
  'Philips', 'Tefal', 'Sanyo', 'Daikin', 'Gree', 'Aux', 'Beko', 'Westinghouse', 'American Home', 'La Germania', 'Hanabishi',
]
const CATEGORY_WORDS = [
  ['Air conditioner', /\b(air ?con(ditioner)?|aircon|inverter split|window type|cooling capacity|btu)\b/i],
  ['Refrigerator', /\b(refrigerator|ref(rigerator)?|freezer|chiller)\b/i],
  ['Washing machine', /\b(washing|washer|twin tub|spin dryer)\b/i],
  ['Rice cooker', /\b(rice cooker|rice)\b/i],
  ['Television', /\b(television|led tv|smart tv|tv)\b/i],
  ['Electric fan', /\b(electric fan|desk fan|stand fan|clip fan|wall fan|ceiling fan|fan)\b/i],
]
const NOT_MODELS = /^(\d+(V|W|HZ|KW|KWH|A|MA)|AC\d*|DC\d*|IP\d+|PS|ICC|PNS|IEC|ISO)$/i

// Rated power: "23W", "1,200 W", "1.2kW", "Rated power: 900 watts". Frequency, volts and kWh are ignored.
export function findWatts(text) {
  const found = []
  for (const match of String(text ?? '').matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k?)\s*(?:W(?:atts?)?)(?![a-z])/gi)) {
    const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1)
    if (value > 0 && value <= MAX_WATTS) found.push(Math.round(value * 10) / 10)
  }
  return found
}

// Model numbers mix letters and digits and usually have a dash: "ML-AJ580-5", "EF-1612", "HRF-210". A "Model:" prefix wins.
export function findModels(text) {
  const source = String(text ?? '')
  const labelled = [...source.matchAll(/\bmodel(?:\s*(?:no\.?|number))?\s*[:.]?\s*([A-Z0-9][A-Z0-9-/.]{2,24})/gi)].map(m => m[1])
  const tokens = source.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g) ?? []
  return [...labelled, ...tokens]
    .map(token => token.replace(/[-/.]+$/, '').toUpperCase())
    .filter(token => token.length >= 4 && /\d/.test(token) && /[A-Z]/.test(token) && !NOT_MODELS.test(token))
}

export const findBrands = text => BRANDS.filter(brand => new RegExp(`\\b${brand.replace(' ', '\\s*')}\\b`, 'i').test(String(text ?? '')))
export const findCategory = text => CATEGORY_WORDS.find(([, words]) => words.test(String(text ?? '')))?.[0] ?? null

const mostCommon = values => {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = null
  for (const [value, count] of counts) {
    const better = !best || count > best.count || (count === best.count && String(value).length > String(best.value).length)
    if (better) best = { value, count }
  }
  return best?.value ?? null
}

// `texts` are readings of the same label (e.g. the photo turned different ways). Values seen most often win.
export function parseLabelTexts(texts) {
  const list = (Array.isArray(texts) ? texts : [texts]).map(text => String(text ?? ''))
  const watts = mostCommon(list.flatMap(findWatts))
  const model = mostCommon(list.flatMap(findModels))
  const brand = mostCommon(list.flatMap(findBrands))
  const category = mostCommon(list.map(findCategory).filter(Boolean)) ?? 'Other'
  if (!watts && !model && !brand) return null
  return labelSuggestion({ watts, model, brand, category })
}

// Normalizes a suggestion (from OCR or the vision model) to the appliance form fields. Missing values are left empty.
export function labelSuggestion({ name, category, brand, model, watts } = {}) {
  const clean = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')
  const w = Number(watts)
  const result = {
    category: LABEL_CATEGORIES.includes(category) ? category : 'Other',
    brand: clean(brand, 60),
    model: clean(model, 60),
    watts: w > 0 && w <= MAX_WATTS ? Math.round(w * 10) / 10 : null,
  }
  const fallbackName = [result.brand, result.category !== 'Other' ? result.category.toLowerCase() : 'appliance', result.model && `(${result.model})`].filter(Boolean).join(' ')
  result.name = clean(name, 80) || fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
  return result
}
