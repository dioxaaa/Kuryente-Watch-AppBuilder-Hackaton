// Turns an alert saved by the server (a detector event) into what the Alerts page and dashboard show.
const whenFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export const formatWhen = value => whenFormat.format(new Date(value))

const humanize = name => {
  const text = String(name || 'Device').replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const TITLES = {
  'spike': label => `Sudden power spike on ${label.toLowerCase()}`,
  'sustained-high': label => `${label} stayed above its normal draw`,
  'sustained-low': label => `${label} drew much less power than usual`,
}

const duration = minutes => {
  const m = Math.round(Number(minutes) || 0)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

// `devices` is the list from /api/devices, used to show friendly names such as "Family refrigerator".
export function toViewAlert(raw, devices = []) {
  const label = devices.find(d => d.name === raw.device)?.label || humanize(raw.device)
  const title = (TITLES[raw.type] ?? (name => `Unusual usage on ${name.toLowerCase()}`))(label)
  const length = raw.type === 'spike' ? '' : ` · ${duration(raw.durationMin)}`
  return {
    id: raw.id,
    device: raw.device,
    type: raw.type,
    title,
    context: `${label} · ${formatWhen(raw.start)}${length}`,
    description: raw.explanation ?? '',
    severity: raw.severity === 'high' ? 'high' : 'warning',
    happenedAt: new Date(raw.start),
    read: !!raw.read,
    dismissed: !!raw.dismissed,
    aiExplanation: raw.aiExplanation ?? null,
    aiModel: raw.aiModel ?? null,
  }
}