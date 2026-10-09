import { useMemo, useState } from 'react'
import { Bell, BellRing, Check, CheckCheck, Clock3, Info, ShieldAlert, X } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { EmptyState } from '../components/empty-state'
import { formatDate } from '../utils/energy-utils'

export function AlertsPage({ alerts, onUpdate, onToast }) {
  const [filter, setFilter] = useState('All alerts')
  const visible = useMemo(() => alerts.filter(alert => filter === 'All alerts' || (filter === 'Unread' ? !alert.read : alert.read)), [alerts, filter])
  const unread = alerts.filter(alert => !alert.read).length

  async function update(alert, patch, message) {
    const saved = await onUpdate(alert.id, patch)
    if (saved && message) onToast(message)
  }
  async function markAllRead() {
    const unreadAlerts = alerts.filter(alert => !alert.read)
    const results = await Promise.all(unreadAlerts.map(alert => onUpdate(alert.id, { read: true })))
    if (results.every(Boolean) && unreadAlerts.length) onToast('All alerts marked as read.')
  }

  return (
    <>
      <PageTitle eyebrow="LOCAL USAGE MONITORING" title="Alerts & reminders" description="Rule-based usage signals from the locally stored appliance readings." action={<button className="button button-secondary" disabled={!unread} onClick={markAllRead}><CheckCheck size={16} /> Mark all read</button>} />
      <div className="demo-banner"><Info size={16} /><span><strong>Local rule detection, not AI.</strong> Unusual readings are signals only and do not diagnose faulty appliances.</span></div>
      <section className="panel alerts-panel">
        <div className="alerts-toolbar"><div className="filter-tabs alert-tabs">{['All alerts', 'Unread', 'Read'].map(item => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}{item === 'Unread' && unread > 0 && <span className="tab-count">{unread}</span>}</button>)}</div><span className="muted-copy">{visible.length} alerts</span></div>
        {visible.length ? <div className="alert-list">{visible.map(alert => {
          const Icon = alert.severity === 'high' ? ShieldAlert : alert.severity === 'low' ? Info : BellRing
          return <article className={`alert-card ${!alert.read ? 'alert-unread' : ''}`} key={alert.id}><span className={`alert-icon alert-icon-${alert.severity === 'high' ? 'high' : 'warning'}`}><Icon size={19} /></span><div className="alert-content"><div className="alert-title-row"><h3>{alert.title}</h3><span className={`badge ${alert.severity === 'high' ? 'badge-danger' : 'badge-warning'}`}>{alert.severity || 'notice'}</span>{!alert.read && <span className="unread-label"><i /> New</span>}</div><span className="alert-context">{alert.device || 'Household'} · local rule signal</span><p>{alert.message || alert.explanation}</p><div className="alert-meta"><span><Clock3 size={13} /> {formatDate(alert.createdAt)}</span><span className="badge badge-success">LOCAL</span></div></div><div className="alert-actions">{!alert.read && <button className="icon-button" onClick={() => update(alert, { read: true }, 'Alert marked as read in SQLite.')} aria-label="Mark as read"><Check size={16} /></button>}<button className="icon-button" onClick={() => update(alert, { dismissed: true, read: true }, 'Alert dismissed from the local alert list.')} aria-label="Dismiss alert"><X size={17} /></button></div></article>
        })}</div> : <EmptyState title={filter === 'Unread' ? 'All caught up' : 'No alerts yet'} description={filter === 'Unread' ? 'You have read all locally stored alerts.' : 'Local rule-based alerts will appear here when the detector finds an unusual pattern.'} action={<Bell size={18} className="empty-action-icon" />} />}
      </section>
    </>
  )
}
