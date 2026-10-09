import { useMemo, useState } from 'react'
import { Bell, BellRing, Check, CheckCheck, Clock3, Info, ShieldAlert, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { formatDate } from '../utils/energy-utils'

export function AlertsPage({ alerts, onUpdate, onToast }) {
  const [filter, setFilter] = useState('All alerts')
  const visible = useMemo(() => alerts.filter(alert => filter === 'All alerts' || (filter === 'Unread' ? !alert.read : alert.read)), [alerts, filter])
  function update(alert, patch, message) {
    onUpdate(alert.id, patch)
    if (message) onToast(message)
  }
  const unread = alerts.filter(alert => !alert.read).length
  return (
    <>
      <PageTitle eyebrow="HOUSEHOLD NOTIFICATIONS" title="Alerts & reminders" description="A calm place for usage notes and meter-reading reminders." action={<button className="button button-secondary" disabled={!unread} onClick={() => alerts.filter(alert => !alert.read).forEach(alert => onUpdate(alert.id, { read: true }))}><CheckCheck size={16} /> Mark all read</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>Demo alerts only.</strong> Unusual usage signals are not a diagnosis of a faulty appliance.</span></div>
      <section className="panel alerts-panel">
        <div className="alerts-toolbar"><div className="filter-tabs alert-tabs">{['All alerts', 'Unread', 'Read'].map(item => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}{item === 'Unread' && unread > 0 && <span className="tab-count">{unread}</span>}</button>)}</div><span className="muted-copy">{visible.length} alerts</span></div>
        {visible.length ? <div className="alert-list">{visible.map(alert => {
          const Icon = alert.severity === 'high' ? ShieldAlert : alert.severity === 'info' ? Clock3 : BellRing
          return <article className={`alert-card ${!alert.read ? 'alert-unread' : ''}`} key={alert.id}><span className={`alert-icon alert-icon-${alert.severity}`}><Icon size={19} /></span><div className="alert-content"><div className="alert-title-row"><h3>{alert.title}</h3><span className={`badge ${alert.severity === 'high' ? 'badge-danger' : alert.severity === 'warning' ? 'badge-warning' : 'badge-neutral'}`}>{alert.severity}</span>{!alert.read && <span className="unread-label"><i /> New</span>}</div><span className="alert-context">{alert.context}</span><p>{alert.description}</p><div className="alert-meta"><span><Clock3 size={13} /> {formatDate(alert.createdAt)}</span><span className="badge badge-demo">DEMO</span></div></div><div className="alert-actions">{!alert.read && <button className="icon-button" onClick={() => update(alert, { read: true }, 'Alert marked as read.')} aria-label="Mark as read"><Check size={16} /></button>}<button className="icon-button" onClick={() => update(alert, { dismissed: true }, 'Alert dismissed for this demo session.')} aria-label="Dismiss alert"><X size={17} /></button></div></article>
        })}</div> : <EmptyState title={filter === 'Unread' ? 'All caught up' : 'No alerts here'} description={filter === 'Unread' ? 'You have read all the alerts in this demo.' : 'Try another filter to see your demo alerts.'} action={<Bell size={18} className="empty-action-icon" />} />}
      </section>
    </>
  )
}
