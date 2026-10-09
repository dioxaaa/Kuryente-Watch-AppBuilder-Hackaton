// Turns one detector alert into a short, friendly explanation using the local Ollama model.
// The prompt is built here from stored data only, so the browser can never inject instructions.
import { getAlert, getSetting, listDevices, saveAlertExplanation } from './repository.js'
import { callOllama, httpError } from './assistant.js'

const WHAT_HAPPENED = {
  'spike': 'a sudden spike: one reading was far above anything this device has drawn before',
  'sustained-high': 'power stayed higher than normal for a long stretch',
  'sustained-low': 'power stayed much lower than normal for a long stretch (the device may not have been running)',
}

const SYSTEM_PROMPT = [
  'You are the KuryenteWatch energy assistant for a Filipino household.',
  'Explain ONE alert from the usage detector in simple, friendly English. Write 3 to 4 short sentences of plain text: no markdown, no bullet points, no headings.',
  'Use only the facts given. Do not invent numbers, brands, or causes.',
  'The detector only sees power readings from one device, so it cannot know the cause. Never say the appliance is broken. Offer likely things to check instead, such as door left open, items just added, a hot room, or a switch or plug.',
  'If an estimated extra cost is given, mention it once, as an estimate.',
  'End with one concrete thing the household can check today.',
].join('\n')

const round = (n, d = 0) => Math.round(Number(n) * 10 ** d) / 10 ** d
const when = iso => String(iso).replace('T', ' ').slice(0, 16)

export function buildExplainMessages(alert, { device, rate } = {}) {
  const name = device?.label || alert.device
  const lines = [
    `Device: ${name}${device?.ratedWatts ? ` (rated about ${round(device.ratedWatts)} W)` : ''}`,
    `What happened: ${WHAT_HAPPENED[alert.type] ?? alert.type}`,
    `When: ${when(alert.start)} to ${when(alert.end ?? alert.start)}${alert.durationMin ? `, about ${round(alert.durationMin)} minutes` : ''}`,
  ]
  if (alert.type === 'spike') lines.push(`Peak reading: ${round(alert.peakWatts)} W`)
  else lines.push(`Average power during the alert: ${round(alert.observedWatts)} W, versus a normal ${round(alert.expectedWatts)} W for this time of day (${round(alert.ratio, 1)}x)`)
  if (alert.excessKwh > 0) {
    lines.push(`Extra energy used: about ${round(alert.excessKwh, 2)} kWh`)
    if (rate > 0) lines.push(`Estimated extra cost: about PHP ${round(alert.excessKwh * rate, 2)} at PHP ${rate} per kWh`)
  }
  lines.push(`Severity: ${alert.severity}`)
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Alert facts:\n${lines.join('\n')}\n\nExplain this alert to the household.` },
  ]
}

// Returns { explanation, model, cached }. The result is saved on the alert so the demo is instant the second time.
// `chat` is injectable so tests do not need a running Ollama.
export async function explainAlert(db, id, { refresh = false, chat = callOllama } = {}) {
  const alert = getAlert(db, id)
  if (!alert) throw httpError(404, 'Alert not found.')
  if (alert.aiExplanation && !refresh) return { explanation: alert.aiExplanation, model: alert.aiModel, cached: true }

  const device = listDevices(db).find(d => d.name === alert.device)
  const rate = Number(getSetting(db, 'preferences', {})?.rate) || 0
  const { reply, model } = await chat(buildExplainMessages(alert, { device, rate }), { temperature: 0.3 })
  const explanation = reply.trim().slice(0, 1200)
  saveAlertExplanation(db, id, explanation, model)
  return { explanation, model, cached: false }
}