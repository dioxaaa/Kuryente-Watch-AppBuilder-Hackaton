// Reads an appliance rating label's OCR text and suggests its specifications.
// These are SUGGESTIONS for the user to confirm: a label shows a rating (a maximum), not measured use.
const BRANDS = [
  'Samsung', 'LG', 'Sony', 'Panasonic', 'Philips', 'Kolin', 'Condura', 'Carrier', 'Hanabishi', 'Imarflex',
  'Midea', 'Haier', 'Whirlpool', 'Toshiba', 'Sharp', 'Xiaomi', 'Anker', 'Apple', 'Asus', 'Acer', 'Dell',
  'Lenovo', 'TCL', 'Hisense', 'Daikin', 'Mitsubishi', 'Fujidenzo', 'Akari', 'Omni', 'Firefly', 'Tefal',
  'Dowell', 'Winland', 'Oppo', 'Vivo', 'Huawei', 'Realme',
]

const toNumber = text => Number(String(text).replace(',', '.'))

// Every "<number> W" / "<number> kW" on the label. "Wh" and words such as "Watt" prefixes are not matched as plain W.
function wattCandidates(text) {
  const found = []
  for (const match of text.matchAll(/(\d{1,5}(?:[.,]\d+)?)\s*(k?)W(?![A-Za-z])/gi)) {
    const value = toNumber(match[1]) * (match[2] ? 1000 : 1)
    if (Number.isFinite(value) && value > 0 && value <= 100000) found.push({ value: Math.round(value * 10) / 10, index: match.index })
  }
  return found
}

// A single printed mains voltage; a voltage range is not treated as one confirmed value.
function mainsVolts(text) {
  for (const match of text.matchAll(/(\d{2,3})(?:\s*[-–~]\s*(\d{2,3}))?\s*V(?![A-Za-z])/gi)) {
    const low = Number(match[1])
    const high = Number(match[2] ?? low)
    if (high < 100) continue
    return { volts: match[2] ? null : low, index: match.index, end: match.index + match[0].length }
  }
  return null
}

function ampsAfter(text, from) {
  const slice = text.slice(from, from + 50)
  const match = slice.match(/(\d{1,3}(?:[.,]\d+)?)\s*A(?![A-Za-z])/i)
  const amps = match ? toNumber(match[1]) : NaN
  return Number.isFinite(amps) && amps > 0 && amps <= 200 ? amps : null
}

export function parseApplianceLabel(rawText) {
  const text = String(rawText ?? '').replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim()
  const watts = wattCandidates(text)
  const mains = mainsVolts(text)
  const amps = mains ? ampsAfter(text, mains.end) : null

  // Prefer a wattage printed near "power", "rated" or "input"; otherwise the largest one (the rating, not a lower setting).
  const labelled = watts.filter(item => /power|rated|input|consumption|watt/i.test(text.slice(Math.max(0, item.index - 30), item.index)))
  const chosen = (labelled.length ? labelled : watts).reduce((best, item) => (!best || item.value > best.value ? item : best), null)

  const ratedWatts = chosen?.value ?? null

  const brand = BRANDS.find(name => new RegExp(`\\b${name}\\b`, 'i').test(text)) ?? null
  const modelMatch = text.match(/\bMODEL(?:\s*(?:NO|NUMBER|#))?\.?\s*[:.]?\s*([A-Z0-9][A-Z0-9\-/]{3,24})/i)

  return {
    watts: ratedWatts,
    source: chosen ? 'label' : null,
    volts: mains?.volts ?? null,
    amps,
    brand,
    model: modelMatch ? modelMatch[1].toUpperCase() : null,
    otherWatts: watts.map(item => item.value).filter(value => value !== ratedWatts),
  }
}

export const hasLabelDetails = parsed => Boolean(parsed && (parsed.watts || parsed.volts || parsed.amps || parsed.brand || parsed.model))