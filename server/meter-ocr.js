// Reads the kWh number from a photo of a household electricity meter, using a local vision model in Ollama.
// The photo is analyzed in memory and never stored. The browser is told to check the number before saving.
import { callOllama, httpError } from './assistant.js'

export const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b'
export const VISION_TIMEOUT_MS = Number(process.env.OLLAMA_VISION_TIMEOUT_MS) || 180000 // the first call loads the model, which is slow
const MAX_BASE64_CHARS = 8_000_000

const PROMPT = [
  'This is a photo of a household electricity meter.',
  'Read the total energy register in kWh: the main row of digits on the display.',
  'Ignore the serial number, voltage, current, date, and any barcode.',
  'If the last digit sits in a separate box or is a different color, it is the decimal part.',
  'Reply with JSON only, in this shape: {"kwh": 1234.5, "digits": "01234.5"}.',
  'Use null for kwh if you cannot read the display clearly. Do not guess.',
].join(' ')

// Turns the model's reply into a number, or null when it is missing or not believable.
export function parseMeterReply(text) {
  let data
  try { data = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) } catch { return null }
  const raw = typeof data?.kwh === 'string' ? data.kwh.replace(/[,\s]/g, '') : data?.kwh
  const kwh = Number(raw)
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(kwh)) return null
  if (!(kwh > 0 && kwh < 10_000_000)) return null
  return { kwh: Math.round(kwh * 100) / 100, digits: typeof data.digits === 'string' ? data.digits.slice(0, 20) : null }
}

// Checks an uploaded photo (base64 or data URL) and returns plain base64 for Ollama.
export function photoBase64(image) {
  const base64 = String(image ?? '').replace(/^data:image\/[\w.+-]+;base64,/, '').replace(/\s/g, '')
  if (!base64) throw httpError(400, 'Choose a photo first.')
  if (base64.length > MAX_BASE64_CHARS) throw httpError(400, 'That photo is too large to read. Try a smaller one.')
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) throw httpError(400, 'That does not look like a valid image.')
  return base64
}

// `image` is a base64 string or data URL. `chat` is injectable so tests do not need Ollama.
export async function readMeterPhoto(image, { chat = callOllama } = {}) {
  const base64 = photoBase64(image)

  const { reply, model } = await chat(
    [{ role: 'user', content: PROMPT, images: [base64] }],
    { temperature: 0, model: VISION_MODEL, format: 'json', timeoutMs: VISION_TIMEOUT_MS },
  )
  const found = parseMeterReply(reply)
  if (!found) throw httpError(422, 'Could not read a kWh number from this photo. Try a closer photo without glare, or type the value in.')
  return { ...found, model }
}