// Built-in assistant used when the local Ollama model cannot be reached (deployed site, phone, offline).
// It only states what can be worked out from the household data sent by the widget, so it never invents numbers.
import { alertImpact, kwhText, pesoText } from './alert-impact.js'
import { duration } from './alerts.js'

const peso = n => `₱${Math.round(n).toLocaleString('en-PH')}`
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
    .map(a => ({ ...a, monthlyKwh: num(a.monthlyKwh) ?? ((num(a.watts) ?? 0) * (num(a.hoursPerDay) ?? 0) * 30) / 1000 }))
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

// `context` is what buildAssistantContext() produces. Returns plain text.
export function offlineAnswer(question, context = {}) {
  const q = String(question ?? '').toLowerCase()
  const rate = num(context.rate)
  const list = rankedAppliances(context)
  const mentioned = list.find(a => q.includes(String(a.name).toLowerCase()))

  if (mentioned) return applianceTip({ applianceName: mentioned.name, category: mentioned.category, ratedWatts: mentioned.watts, hoursPerDay: mentioned.hoursPerDay }, rate)
  if (/(most|biggest|largest|highest|pinaka|malaki)/.test(q)) {
    return [biggestSentence(list, rate), list[0] ? tipFor(list[0]) : ''].filter(Boolean).join(' ')
  }
  if (/(save|saving|tip|reduce|lower|tipid|bawas)/.test(q)) {
    const tips = list.slice(0, 3).map(a => `• ${a.name}: ${tipFor(a)}`)
    return tips.length ? `Start with your biggest users:\n${tips.join('\n')}` : `${GENERAL_TIP} Add your appliances to get tips for each one.`
  }
  if (/(bill|high|mahal|taas|cost|bayad)/.test(q)) {
    return [meterSentence(context, rate), list.length ? biggestSentence(list, rate) : '', alertSentence(context)].filter(Boolean).join(' ')
  }
  if (/(use|usage|kwh|consum|reading|meter|konsumo)/.test(q)) return meterSentence(context, rate)
  if (/(alert|unusual|warning)/.test(q)) return alertSentence(context) || 'There are no alerts right now.'
  return [meterSentence(context, rate), list.length ? biggestSentence(list, rate) : '', 'You can ask "Why is my bill high?", "Which appliance uses the most?" or "How can I save electricity?"'].filter(Boolean).join(' ')
}

// Two-sentence tip for one appliance, the same shape as POST /api/ai/recommendation's insight.
export function applianceTip({ applianceName, category, ratedWatts, hoursPerDay }, rate) {
  const name = String(applianceName ?? 'this appliance')
  const dailyKwh = ((num(ratedWatts) ?? 0) * (num(hoursPerDay) ?? 0)) / 1000
  const cost = num(rate) ? `, about ${peso(dailyKwh * 30 * rate)} a month` : ''
  const usage = dailyKwh > 0 ? `Your ${name} uses about ${dailyKwh.toFixed(2)} kWh a day${cost}.` : `Add the hours you use your ${name} each day to estimate its cost.`
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
