// Reads an appliance rating label photo with the local Ollama vision model and suggests the appliance form fields.
// The photo is analyzed in memory and never stored. The person checks the suggestion before saving.
import { callOllama, httpError } from './assistant.js'
import { VISION_MODEL, VISION_TIMEOUT_MS, photoBase64 } from './meter-ocr.js'
import { LABEL_CATEGORIES, labelSuggestion } from '../src/utils/appliance-label.js'

const PROMPT = [
  'This is a photo of a household appliance or its rating label (it may be sideways).',
  'Identify the appliance and read the label.',
  `Reply with JSON only, in this shape: {"name": "Desk clip fan", "category": "Electric fan", "brand": "Sycat", "model": "ML-AJ580-5", "watts": 23}.`,
  `category must be one of: ${LABEL_CATEGORIES.join(', ')}.`,
  'watts is the rated power input in watts (convert kW to W). Ignore volts, hertz, amps and kWh.',
  'Use null for anything you cannot read clearly. Do not guess.',
].join(' ')

export function parseLabelReply(text) {
  let data
  try { data = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const watts = typeof data.watts === 'string' ? data.watts.replace(/[,\sWw]/g, '') : data.watts
  const found = labelSuggestion({ ...data, watts })
  return found.watts || found.model || found.brand ? found : null
}

// `chat` is injectable so tests do not need Ollama.
export async function readApplianceLabel(image, { chat = callOllama } = {}) {
  const base64 = photoBase64(image)
  const { reply, model } = await chat(
    [{ role: 'user', content: PROMPT, images: [base64] }],
    { temperature: 0, model: VISION_MODEL, format: 'json', timeoutMs: VISION_TIMEOUT_MS },
  )
  const found = parseLabelReply(reply)
  if (!found) throw httpError(422, 'Could not read the rated watts or model from this label. Try a closer, sharper photo, or type the details manually.')
  return { ...found, engine: model }
}
