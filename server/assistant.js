// Talks to a local Ollama server. Nothing leaves the machine.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000

export const httpError = (status, message) => Object.assign(new Error(message), { status })
const clip = (value, max) => String(value ?? '').slice(0, max)
const num = value => (Number.isFinite(Number(value)) ? Number(value) : null)

// The system prompt is built here on the server, so the browser can only send data, never instructions.
function buildSystemPrompt(ctx = {}) {
  const lines = [
    'You are the KuryenteWatch energy assistant for a Filipino household.',
    'Explain electricity usage in simple, friendly language. Keep answers short (3-5 sentences).',
    'Reply in the same language the user writes in (English or Taglish).',
    'Only use the household data below. If the data is not enough, say so instead of guessing.',
    'Appliance numbers are estimates from rated watts. Alerts listed come from a usage detector that only sees power readings, so never claim to diagnose faults; suggest what to check instead.',
    '',
    'Household data:',
  ]
  const rate = num(ctx.rate)
  if (rate !== null) lines.push(`- Electricity rate: PHP ${rate} per kWh`)
  const month = num(ctx.monthKwh)
  if (month !== null) lines.push(`- Estimated usage this month: ${month} kWh`)
  if (ctx.latest) lines.push(`- Latest meter reading: ${num(ctx.latest.kwh)} kWh on ${clip(ctx.latest.date, 30)} (${clip(ctx.latest.source, 20)})`)
  if (num(ctx.previousKwh) !== null) lines.push(`- Previous meter reading: ${num(ctx.previousKwh)} kWh`)
  if (Array.isArray(ctx.appliances)) {
    lines.push('- Appliances (estimated monthly use):')
    for (const a of ctx.appliances.slice(0, 20)) {
      lines.push(`  * ${clip(a.name, 40)} (${clip(a.category, 30)}): ${num(a.watts)} W, ${num(a.hoursPerDay)} h/day, about ${num(a.monthlyKwh)} kWh/month`)
    }
  }
  if (Array.isArray(ctx.alerts) && ctx.alerts.length) {
    lines.push('- Current alerts:')
    for (const a of ctx.alerts.slice(0, 5)) lines.push(`  * ${clip(a.title, 80)} (${clip(a.context, 120)})${a.detail ? `: ${clip(a.detail, 240)}` : ''}`)
  }
  return lines.join('\n')
}

// Sends chat messages to the local Ollama server and returns { reply, model }.
export async function callOllama(messages, { temperature = 0.4 } = {}) {
  let res
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, options: { temperature } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw httpError(503, 'The AI assistant is offline. Start Ollama (run "ollama serve") and try again.')
  }

  if (res.status === 404) throw httpError(503, `The model "${OLLAMA_MODEL}" is not installed. Run: ollama pull ${OLLAMA_MODEL}`)
  if (!res.ok) throw httpError(502, 'The AI assistant could not answer right now. Please try again.')

  const data = await res.json()
  const reply = data?.message?.content?.trim()
  if (!reply) throw httpError(502, 'The AI assistant returned an empty answer. Please try again.')
  return { reply, model: OLLAMA_MODEL }
}

export async function askAssistant({ question, history, context } = {}) {
  const text = clip(question, 500).trim()
  if (!text) throw httpError(400, 'Please type a question.')

  const past = (Array.isArray(history) ? history : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-6)
    .map(m => ({ role: m.role, content: clip(m.content, 1000) }))

  const messages = [{ role: 'system', content: buildSystemPrompt(context) }, ...past, { role: 'user', content: text }]

  return callOllama(messages)
}