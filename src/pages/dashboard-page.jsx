import { ArrowRight, Bell, Clock3, Droplets, Gauge, Plug, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { StatCard } from '../components/stat-card'
import { UsageChart } from '../components/usage-chart'
import { EmptyState } from '../components/empty-state'
import { AssistantWidget } from '../components/assistant-widget'
import { applianceMonthKwh, daysInMonth, formatDate, formatPeso, meterDailyUse, usagePerDay } from '../utils/energy-utils'

export function DashboardPage({ profile, readings, alerts, appliances, rate, onNavigate }) {
  const current = readings.at(-1)
  const previous = readings.at(-2)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const intervalsThisMonth = readings.filter(reading => new Date(reading.recordedAt) >= startOfMonth && reading.usageKwh !== null)
  const monthUsage = intervalsThisMonth.reduce((sum, reading) => sum + reading.usageKwh, 0)
  const pace = meterDailyUse(readings, startOfMonth)
  const projectedKwh = pace ? pace.perDay * daysInMonth() : null
  const chartData = usagePerDay(readings).slice(-7)
  const recentAlerts = alerts.filter(alert => !alert.read && !alert.dismissed).slice(0, 3)
  const rankedAppliances = appliances.map(item => ({ ...item, monthKwh: applianceMonthKwh(item) })).sort((a, b) => b.monthKwh - a.monthKwh)
  const topAppliances = rankedAppliances.slice(0, 4)
  const estimateTotalKwh = rankedAppliances.reduce((sum, item) => sum + item.monthKwh, 0)

  return (
    <>
      <PageTitle
        eyebrow={new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}
        title={`Good day, ${profile.userName}`}
        description={`${profile.householdName} · A clear view of your household energy.`}
        action={<button className="button button-primary" onClick={() => onNavigate('meter')}><Zap size={17} /> Add meter reading</button>}
      />
      <div className="stats-grid" aria-label="Household energy overview">
        <StatCard label="Meter use so far this month" value={intervalsThisMonth.length ? monthUsage.toFixed(1) : '—'} unit={intervalsThisMonth.length ? ' kWh' : ''} note={pace ? `About ${pace.perDay.toFixed(1)} kWh a day from your readings` : intervalsThisMonth.length ? 'Difference between meter readings' : 'Add another reading to calculate use'} icon={Zap} />
        <StatCard label="Bill so far this month" value={intervalsThisMonth.length ? formatPeso(monthUsage * rate) : '—'} note={projectedKwh != null ? <>Projected full month: <strong>{formatPeso(projectedKwh * rate)}</strong> ({projectedKwh.toFixed(0)} kWh)</> : `At ₱${Number(rate).toFixed(2)} / kWh · add readings a day apart to project the month`} icon={Gauge} tone="amber" />
        <StatCard label="Latest meter reading" value={current?.readingKwh.toLocaleString() ?? '—'} unit={current ? ' kWh' : ''} note={current ? `Meter display on ${formatDate(current.recordedAt)}` : 'No reading recorded yet'} icon={Droplets} tone="blue" />
        <StatCard label="Use since previous reading" value={current?.usageKwh != null ? current.usageKwh.toFixed(1) : '—'} unit={current?.usageKwh != null ? ' kWh' : ''} note={previous ? `${formatDate(previous.recordedAt)} to ${formatDate(current.recordedAt)}` : 'Add a second reading to compare'} icon={Clock3} tone="purple" />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Daily use between readings</h2><p>Average kWh per day, from cumulative meter values and their dates</p></div>
            <button className="text-button" onClick={() => onNavigate('history')}>Full history <ArrowRight size={15} /></button>
          </div>
          {chartData.length ? <UsageChart data={chartData} /> : (
            <EmptyState title="Your chart starts with a second reading" description="Record two cumulative meter values and we’ll calculate the energy used between them." action={<button className="button button-secondary" onClick={() => onNavigate('meter')}>Add a reading</button>} />
          )}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent alerts</h2><p>Local usage signals, not diagnoses</p></div><button className="text-button" onClick={() => onNavigate('alerts')}>View all <ArrowRight size={15} /></button></div>
          {recentAlerts.length ? recentAlerts.map(alert => (
            <div className="activity-item" key={alert.id}><span className="activity-icon activity-icon-alert"><Bell size={16} /></span><span><strong>{alert.title}</strong><small>{alert.context}</small></span></div>
          )) : <EmptyState title="No new alerts" description="New local detector signals will appear here." />}
        </section>
      </div>
      <div className="dashboard-grid dashboard-lower-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Appliance estimates</h2><p>Label estimates for 30 days · not measured</p></div><button className="text-button" onClick={() => onNavigate('appliances')}>Manage <ArrowRight size={15} /></button></div>
          {topAppliances.length ? topAppliances.map(item => (
            <div className="activity-item" key={item.id}><span className="activity-icon"><Plug size={16} /></span><span><strong>{item.name}</strong><small>{item.watts} W · {item.hours} hours/day · {item.pattern || 'Daily'} · estimate only</small></span><b>{formatPeso(item.monthKwh * rate)}</b></div>
          )) : <EmptyState title="No appliances added" description="Add appliances to estimate usage from their rating labels." action={<button className="button button-secondary" onClick={() => onNavigate('appliances')}>Add appliance</button>} />}
          {topAppliances.length > 0 && <p className="estimate-total">{rankedAppliances.length > topAppliances.length ? `All ${rankedAppliances.length} appliances` : 'Total'}: about <strong>{estimateTotalKwh.toFixed(0)} kWh</strong> · <strong>{formatPeso(estimateTotalKwh * rate)}</strong> per 30 days. Estimated from labels; your meter bill above is the measured figure.</p>}
        </section>
        <section className="panel assistant-preview">
          <div className="panel-heading"><div><h2>Energy Assistant</h2><p>Ask about your local energy data</p></div><button className="text-button" onClick={() => onNavigate('assistant')}>Open <ArrowRight size={15} /></button></div>
          <p>Get explanations based on saved meter readings, appliances, and local alerts.</p>
          <button className="button button-secondary" onClick={() => onNavigate('assistant')}>Open Energy Assistant</button>
        </section>
      </div>
      <AssistantWidget readings={readings} appliances={appliances} alerts={alerts} rate={rate} household={profile.householdName} />
    </>
  )
}