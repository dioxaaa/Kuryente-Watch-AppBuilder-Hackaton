// Built-in assistant used when the local Ollama model cannot be reached (deployed site, phone, offline).
// It only states what can be worked out from the household data sent by the widget, so it never invents numbers.
import { alertImpact, kwhText, pesoText } from './alert-impact.js'
import { duration } from './alerts.js'

const peso = n => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = value => (Number.isFinite(Number(value)) ? Number(value) : null)

const CATEGORY_TIPS = {
  'Air conditioner': 'Set it to 24–25°C, clean the filter every two weeks, and keep doors and windows closed while it runs.',
  'Refrigerator': 'Keep the door closed, do not overfill it, check that the door seal is tight, and keep it away from the stove and direct sun.',
  'Electric fan': 'Use a lower speed and switch it off when nobody is in the room.',
  'Rice cooker': 'Unplug it after cooking instead of leaving it on "keep warm" for hours.',
  'Television': 'Turn it off at the plug when not watching and lower the screen brightness.',
  'Washing machine': 'Wash full loads and use cold water when you can.',
}
const GENERAL_TIP = 'Unplug it when idle to stop standby power, and use it for fewer hours when you can.'

const tipFor = appliance => CATEGORY_TIPS[appliance?.category] ?? CATEGORY_TIPS[Object.keys(CATEGORY_TIPS).find(key => new RegExp(key.split(' ')[0], 'i').test(appliance?.name ?? ''))] ?? GENERAL_TIP

function rankedAppliances(context) {
  return (Array.isArray(context.appliances) ? context.appliances : [])
    .map(a => ({ ...a, monthlyKwh: num(a.monthlyKwh) ?? ((num(a.watts) ?? 0) * (num(a.hoursPerDay) ?? 0) * (num(a.daysPerMonth) ?? 30)) / 1000 }))
    .filter(a => a.monthlyKwh > 0)
    .sort((a, b) => b.monthlyKwh - a.monthlyKwh)
}

function meterSentence(context, rate) {
  const usage = context.usage
  const daily = num(usage?.recentDailyKwh)
  if (daily === null) return 'Add at least two meter readings so I can see how much your meter says you use per day.'
  const earlier = num(usage.earlierDailyKwh)
  let text = `Your meter shows about ${daily} kWh a day${usage.since ? ` since ${usage.since}` : ''}${rate ? `, around ${peso(daily * 30 * rate)} a month` : ''}.`
  if (earlier) {
    const pct = Math.round(((daily - earlier) / earlier) * 100)
    if (Math.abs(pct) >= 5) text += ` That is ${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than your earlier ${earlier} kWh a day.`
  }
  return text
}

function biggestSentence(list, rate) {
  const total = list.reduce((s, a) => s + a.monthlyKwh, 0)
  const top = list[0]
  if (!top) return 'Add your appliances so I can tell which one uses the most.'
  return `${top.name} is the biggest on your list: about ${Math.round(top.monthlyKwh)} kWh a month (${Math.round((top.monthlyKwh / total) * 100)}% of the estimate)${rate ? `, around ${peso(top.monthlyKwh * rate)}` : ''}.`
}

function alertSentence(context) {
  const alerts = Array.isArray(context.alerts) ? context.alerts : []
  if (!alerts.length) return ''
  const costly = alerts.filter(a => num(a.extraKwh) > 0)
  if (costly.length) {
    const kwh = costly.reduce((s, a) => s + Number(a.extraKwh), 0)
    const pesos = costly.reduce((s, a) => s + (num(a.extraPesos) ?? 0), 0)
    return `The detector also flagged about ${kwh.toFixed(1)} kWh of extra use${pesos > 0 ? ` (about ${peso(pesos)})` : ''}; check the Alerts page.`
  }
  return `There ${alerts.length === 1 ? 'is 1 alert' : `are ${alerts.length} alerts`} worth a look on the Alerts page.`
}

const SUGGEST = 'You can ask "Why is my bill high?", "Which appliance uses the most?", "How can I save electricity?" or "Any alerts?"'

const TOPICS = [
  { words: /(aircon|air ?con|\bac\b|a\/c)/, category: 'Air conditioner' },
  { words: /(\bref\b|fridge|refrigerator|ref\b)/, category: 'Refrigerator' },
  { words: /(\bfan\b|electric ?fan|bentilador)/, category: 'Electric fan' },
  { words: /(rice ?cooker|kaldero)/, category: 'Rice cooker' },
  { words: /(\btv\b|television)/, category: 'Television' },
  { words: /(washing|laundry|labada)/, category: 'Washing machine' },
]

function topicAnswer(topic, list, rate) {
  const own = list.find(a => a.category === topic.category || new RegExp(topic.category.split(' ')[0], 'i').test(a.name))
  if (own) return applianceTip({ applianceName: own.name, category: own.category, ratedWatts: own.watts, hoursPerDay: own.hoursPerDay, daysPerMonth: own.daysPerMonth }, rate)
  return `${CATEGORY_TIPS[topic.category]} Add it to your appliances to see what it costs you each month.`
}

function lastReply(history) {
  const items = Array.isArray(history) ? history : []
  for (let i = items.length - 1; i >= 0; i--) if (items[i]?.role === 'assistant' && !items[i].error) return String(items[i].content ?? '')
  return ''
}

// `context` is what buildAssistantContext() produces; `history` is the earlier chat ({ role, content }). Returns plain text.
export function offlineAnswer(question, context = {}, history = []) {
  const reply = pickAnswer(question, context)
  if (reply && reply === lastReply(history) && !reply.startsWith('Sorry')) return `That is still the latest from your saved data. ${SUGGEST}`
  return reply
}

function pickAnswer(question, context) {
  const q = String(question ?? '').toLowerCase().trim()
  const words = q.match(/[a-z0-9₱]+/g) ?? []
  const rate = num(context.rate)
  const list = rankedAppliances(context)
  const mentioned = list.find(a => q.includes(String(a.name).toLowerCase()))
  const topic = TOPICS.find(t => t.words.test(q))

  if (mentioned) return applianceTip({ applianceName: mentioned.name, category: mentioned.category, ratedWatts: mentioned.watts, hoursPerDay: mentioned.hoursPerDay, daysPerMonth: mentioned.daysPerMonth }, rate)
  if (/^(thanks|thank you|thank u|ty|thx|salamat|tnx)\b/.test(q)) return `You're welcome! ${SUGGEST}`
  if (words.length <= 4 && /^(hi|hello|hey|yo|hoy|good (morning|afternoon|evening)|kumusta|musta|magandang)\b/.test(q)) {
    return `Hi! I answer from your saved meter readings, appliances and alerts, and I work without internet. ${SUGGEST}`
  }
  if (/(help|what can you|ano.*(kaya|pwede)|how (do|does) (you|this) work)/.test(q)) {
    return `I can tell you your daily use and monthly estimate, which appliance costs the most, saving tips for each appliance, and what the alerts mean. ${SUGGEST}`
  }
  if (/(most|biggest|largest|highest|pinaka|malaki)/.test(q)) {
    return [biggestSentence(list, rate), list[0] ? tipFor(list[0]) : ''].filter(Boolean).join(' ')
  }
  if (topic) return topicAnswer(topic, list, rate)
  if (/(save|saving|tip|reduce|lower|tipid|bawas)/.test(q)) {
    const tips = list.slice(0, 3).map(a => `• ${a.name}: ${tipFor(a)}`)
    return tips.length ? `Start with your biggest users:\n${tips.join('\n')}` : `${GENERAL_TIP} Add your appliances to get tips for each one.`
  }
  if (/(rate|per kwh|price|presyo|singil)/.test(q)) {
    return rate ? `Your rate is set to ₱${rate.toFixed(2)} per kWh. You can change it in Settings to match your latest bill.` : 'Set your rate per kWh in Settings so I can estimate costs.'
  }
  if (/(bill|high|mahal|taas|cost|bayad|month|buwan)/.test(q)) {
    return [meterSentence(context, rate), list.length ? biggestSentence(list, rate) : '', alertSentence(context)].filter(Boolean).join(' ')
  }
  if (/(use|usage|kwh|consum|reading|meter|konsumo|today|daily|day)/.test(q)) return meterSentence(context, rate)
  if (/(alert|unusual|warning|problem|spike|jump)/.test(q)) return alertSentence(context) || 'There are no alerts right now.'
  if (words.length <= 2 || !/[a-z]{3}/.test(q)) return `Sorry, I didn't get that. ${SUGGEST}`
  return [meterSentence(context, rate), list.length ? biggestSentence(list, rate) : '', SUGGEST].filter(Boolean).join(' ')
}

// Two-sentence tip for one appliance, the same shape as POST /api/ai/recommendation's insight.
export function applianceTip({ applianceName, category, ratedWatts, hoursPerDay, daysPerMonth }, rate) {
  const name = String(applianceName ?? 'this appliance')
  const dailyKwh = ((num(ratedWatts) ?? 0) * (num(hoursPerDay) ?? 0)) / 1000
  const usedDays = num(daysPerMonth) ?? 30
  const cost = num(rate) ? `, about ${peso(dailyKwh * usedDays * rate)} a month` : ''
  const usage = dailyKwh > 0 ? `Your ${name} uses about ${dailyKwh.toFixed(2)} kWh ${usedDays === 30 ? 'a day' : 'on the days you use it'}${cost}.` : `Add the hours you use your ${name} each day to estimate its cost.`
  return `${usage} ${tipFor({ name, category })}`
}

const watts = n => `${Math.round(Number(n) || 0)} W`
const days = n => (Number(n) >= 1.5 ? `the last ${Math.round(Number(n))} days` : 'the last day')

// Plain-language explanation of one alert (as shaped by toViewAlert), used when the local AI cannot answer.
export function offlineExplanation(alert, { appliances = [], rate } = {}) {
  const impact = alertImpact(alert, appliances, rate)
  const extra = impact.extraKwh > 0 ? ` That is about ${kwhText(impact.extraKwh)} extra${impact.extraPesos > 0 ? `, roughly ${pesoText(impact.extraPesos)} at your rate` : ''}.` : ''

  if (alert.type === 'usage-jump') {
    const top = rankedAppliances({ appliances: appliances.map(a => ({ ...a, hoursPerDay: a.hoursPerDay ?? a.hours })) }).slice(0, 2).map(a => a.name)
    const check = top.length ? `your biggest users first: ${top.join(' and ')}` : 'big users first, such as an air conditioner, refrigerator or water heater'
    return `Your whole household used about ${alert.observedKwhPerDay} kWh a day over ${days(alert.days)}, versus your usual ${alert.expectedKwhPerDay} kWh a day (${alert.ratio}× normal).${extra} The meter cannot tell which appliance caused it, so check ${check}. Today, make sure nothing was left running, like an aircon on all night.`
  }
  const tip = tipFor({ name: impact.appliance?.name ?? alert.deviceLabel, category: impact.appliance?.category ?? alert.deviceCategory })
  if (alert.type === 'spike') {
    return `${impact.name} briefly reached ${watts(alert.peakWatts)}, far above anything it has drawn before. A single spike does not mean it is broken. If it keeps happening, check the plug and cord, and what was switched on at that moment.`
  }
  if (alert.type === 'sustained-low') {
    return `${impact.name} drew about ${watts(alert.observedWatts)} for ${duration(alert.durationMin)}, versus a normal ${watts(alert.expectedWatts)}. It may have been switched off or not running properly. Check today that it is plugged in and working.`
  }
  return `${impact.name} drew about ${watts(alert.observedWatts)} for ${duration(alert.durationMin)}, versus a normal ${watts(alert.expectedWatts)} for that time of day.${extra} The detector cannot see the cause, so check for a door left open, a hot room, or something newly plugged in. ${tip}`
}