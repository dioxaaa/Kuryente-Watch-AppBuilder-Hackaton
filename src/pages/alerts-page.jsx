import { useMemo, useState } from 'react'
import { Bell, BellRing, Gauge, Check, CheckCheck, ChevronDown, ChevronUp, Clock3, Info, LineChart, RefreshCw, ScanSearch, ShieldAlert, Sparkles, X, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { DeviceChart } from '../components/device-chart'
import { formatWhen } from '../utils/alerts'
import { alertImpact } from '../utils/alert-impact'

function AiExplanation({ alert, onExplain }) {
  const [state, setState] = useState({ loading: false, error: '' })

  async function run(refresh) {
    setState({ loading: true, error: '' })
    try {
      await onExplain(alert.id, refresh)
      setState({ loading: false, error: '' })
    } catch (error) {
      setState({ loading: false, error: error.message || 'The explanation could not be generated.' })
    }
  }

  if (state.loading) {
    return <div className="ai-box ai-box-loading" role="status" aria-live="polite"><Sparkles size={14} /><span>Asking the local AI…</span><span className="ai-dots"><i /><i /><i /></span></div>
  }

  return (
    <div className="ai-wrap">
      {alert.aiExplanation ? (
        <div className="ai-box">
          <div className="ai-box-head"><Sparkles size={13} /><strong>AI explanation</strong><small>{alert.aiModel ? `${alert.aiModel} · ` : ''}runs locally</small></div>
          <p>{alert.aiExplanation}</p>
          <button className="text-button ai-again" onClick={() => run(true)}><RefreshCw size={12} /> Explain again</button>
        </div>
      ) : (
        <button className="button button-secondary button-small ai-button" onClick={() => run(false)}><Sparkles size={14} /> Explain with AI</button>
      )}
      {state.error && <p className="ai-error" role="alert">{state.error}</p>}
    </div>
  )
}

function MeterCheck({ status }) {
  if (!status) return null
  const { latest } = status
  const text = latest
    ? <><strong>Meter check is on.</strong> Your usual use is {latest.expectedKwhPerDay} kWh/day and your latest is {latest.observedKwhPerDay} kWh/day. You get an alert above {latest.warnAboveKwhPerDay} kWh/day.</>
    : <><strong>Meter check is learning.</strong> {status.readings === 0
      ? 'Save 3 meter readings, each about a day apart, to turn on alerts.'
      : `Add ${status.neededReadings} more reading${status.neededReadings === 1 ? '' : 's'}, each about a day after the last one. Readings less than 18 hours apart are combined.`}</>
  return <div className="demo-banner meter-check" role="status"><Gauge size={16} /><span>{text}</span></div>
}

export function AlertsPage({ meterCheck, alerts, appliances = [], rate = 0, loaded, offline, onUpdate, onExplain, onScan, onToast }) {
  const [filter, setFilter] = useState('All alerts')
  const [chartOpen, setChartOpen] = useState(() => new Set())
  const [scanning, setScanning] = useState(false)
  const visible = useMemo(
    () => alerts.filter(alert => filter === 'All alerts' || (filter === 'Unread' ? !alert.read : alert.read)),
    [alerts, filter],
  )
  const unread = alerts.filter(alert => !alert.read).length

  function toggleChart(id) {
    setChartOpen(open => {
      const next = new Set(open)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function update(alert, changes, message) {
    if (await onUpdate(alert.id, changes) && message) onToast(message)
  }

  async function markAllRead() {
    const unreadAlerts = alerts.filter(alert => !alert.read)
    const results = await Promise.all(unreadAlerts.map(alert => onUpdate(alert.id, { read: true })))
    if (results.every(Boolean) && unreadAlerts.length) onToast('All alerts marked as read.')
  }

  async function scan() {
    setScanning(true)
    try {
      await onScan()
    } finally {
      setScanning(false)
    }
  }

  const emptyState = filter === 'Unread' && alerts.length
    ? { title: 'All caught up', description: 'You have read all your alerts.' }
    : filter === 'Read' && alerts.length
      ? { title: 'No read alerts yet', description: 'Alerts you mark as read will appear here.' }
      : offline
        ? { title: 'Can’t reach the local server', description: 'Start it with npm run server, then open this page again.' }
        : !loaded
          ? { title: 'Loading alerts…', description: 'Checking the local database.' }
          : { title: 'Nothing unusual found', description: 'Alerts come from your meter readings. Save at least 3 readings, each about a day apart, and you will be warned when daily use jumps 25% or more above your usual.' }

  return (
    <>
      <PageTitle
        eyebrow="HOUSEHOLD NOTIFICATIONS"
        title="Alerts"
        description="Unusual usage found by the local detector, with an optional explanation from the on-device AI."
        action={<div className="title-actions">
          <button className="button button-primary" disabled={scanning || offline} onClick={scan}><ScanSearch size={16} /> {scanning ? 'Scanning…' : 'Scan now'}</button>
          <button className="button button-secondary" disabled={!unread} onClick={markAllRead}><CheckCheck size={16} /> Mark all read</button>
        </div>}
      />
      <div className="demo-banner"><Info size={16} /><span><strong>Signals, not diagnoses.</strong> An unusual reading does not confirm that an appliance is faulty.</span></div>
      <MeterCheck status={meterCheck} />
      <section className="panel alerts-panel">
        <div className="alerts-toolbar">
          <div className="filter-tabs alert-tabs" role="group" aria-label="Filter alerts">
            {['All alerts', 'Unread', 'Read'].map(item => (
              <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)} aria-pressed={filter === item}>
                {item}{item === 'Unread' && unread > 0 && <span className="tab-count">{unread}</span>}
              </button>
            ))}
          </div>
          <span className="muted-copy">{visible.length} alerts</span>
        </div>
        {visible.length ? (
          <div className="alert-list">
            {visible.map(alert => {
              const Icon = alert.severity === 'high' ? ShieldAlert : alert.severity === 'info' ? Info : BellRing
              const impact = alertImpact(alert, appliances, rate)
              return (
                <article className={`alert-card ${!alert.read ? 'alert-unread' : ''}`} key={alert.id}>
                  <span className={`alert-icon alert-icon-${alert.severity}`}><Icon size={19} /></span>
                  <div className="alert-content">
                    <div className="alert-title-row">
                      <h3>{alert.title}</h3>
                      <span className={`badge ${alert.severity === 'high' ? 'badge-danger' : alert.severity === 'warning' ? 'badge-warning' : 'badge-neutral'}`}>{alert.severity}</span>
                      {!alert.read && <span className="unread-label"><i /> New</span>}
                    </div>
                    <span className="alert-context">{alert.context}</span>
                    {impact.moneyText && <span className="alert-impact"><Zap size={12} /> {impact.name} · about {impact.extraKwh < 1 ? impact.extraKwh.toFixed(2) : impact.extraKwh.toFixed(1)} kWh extra · <b>{impact.moneyText}</b></span>}
                    <p>{alert.description}</p>
                    {alert.type !== 'usage-jump' && <button className="text-button alert-chart-toggle" aria-expanded={chartOpen.has(alert.id)} onClick={() => toggleChart(alert.id)}>
                      <LineChart size={13} /> {chartOpen.has(alert.id) ? 'Hide chart' : 'Show on chart'} {chartOpen.has(alert.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>}
                    {chartOpen.has(alert.id) && <DeviceChart device={alert.device} alertId={alert.id} compact />}
                    <AiExplanation alert={alert} onExplain={onExplain} />
                    <div className="alert-meta"><span><Clock3 size={13} /> {formatWhen(alert.happenedAt)}</span></div>
                  </div>
                  <div className="alert-actions">
                    {!alert.read && <button className="icon-button" onClick={() => update(alert, { read: true }, 'Alert marked as read.')} aria-label="Mark as read"><Check size={16} /></button>}
                    <button className="icon-button" onClick={() => update(alert, { dismissed: true, read: true }, 'Alert dismissed.')} aria-label="Dismiss alert"><X size={17} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState title={emptyState.title} description={emptyState.description} action={<Bell size={18} className="empty-action-icon" />} />
        )}
      </section>
    </>
  )
}