import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import { demoAlerts, demoAppliances, demoReadings } from './data/demo-data'
import { AlertsPage } from './pages/alerts-page'
import { AdminPage } from './pages/admin-page'
import { AppliancesPage } from './pages/appliances-page'
import { DashboardPage } from './pages/dashboard-page'
import { HistoryPage } from './pages/history-page'
import { MeterPage } from './pages/meter-page'
import { SettingsPage } from './pages/settings-page'

const pageTitles = {
  dashboard: 'Dashboard',
  meter: 'Scan my meter',
  appliances: 'My appliances',
  history: 'Energy history',
  alerts: 'Alerts',
  settings: 'Settings',
  admin: 'About this demo',
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [readings, setReadings] = useState(demoReadings)
  const [appliances, setAppliances] = useState(demoAppliances)
  const [alerts, setAlerts] = useState(demoAlerts)
  const [settings, setSettings] = useState({ rate: 12.5, household: 'Casa de Santos', compact: false, weeklySummary: true })
  const [toast, setToast] = useState('')
  const unreadCount = alerts.filter(alert => !alert.read && !alert.dismissed).length
  const title = pageTitles[activePage]

  const toastMessage = message => {
    setToast(message)
    window.clearTimeout(window.toastTimer)
    window.toastTimer = window.setTimeout(() => setToast(''), 3400)
  }
  const navigate = page => {
    setActivePage(page === 'about' ? 'admin' : page)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const page = useMemo(() => {
    switch (activePage) {
      case 'meter':
        return <MeterPage readings={readings} rate={Number(settings.rate) || 0} onSave={reading => setReadings(items => [...items, reading].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))} onToast={toastMessage} />
      case 'appliances':
        return <AppliancesPage appliances={appliances} onAdd={appliance => setAppliances(items => [...items, { ...appliance, id: `custom-${Date.now()}` }])} onUpdate={appliance => setAppliances(items => items.map(item => item.id === appliance.id ? appliance : item))} onDelete={id => setAppliances(items => items.filter(item => item.id !== id))} rate={Number(settings.rate) || 0} onToast={toastMessage} />
      case 'history':
        return <HistoryPage readings={readings} onToast={toastMessage} />
      case 'alerts':
        return <AlertsPage alerts={alerts.filter(alert => !alert.dismissed)} onUpdate={(id, changes) => setAlerts(items => items.map(item => item.id === id ? { ...item, ...changes } : item))} onToast={toastMessage} />
      case 'settings':
        return <SettingsPage settings={settings} onSave={setSettings} onToast={toastMessage} />
      case 'admin':
        return <AdminPage onNavigate={navigate} />
      default:
        return <DashboardPage readings={readings} alerts={alerts.filter(alert => !alert.dismissed)} appliances={appliances} rate={Number(settings.rate) || 0} onNavigate={navigate} />
    }
  }, [activePage, readings, appliances, alerts, settings])

  return (
    <div className="app-shell">
      <AppSidebar activePage={activePage} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} alertCount={unreadCount} />
      <div className="app-main">
        <AppHeader title={title} unreadCount={unreadCount} onMenu={() => setMobileOpen(true)} onAlerts={() => navigate('alerts')} onProfile={() => navigate('settings')} />
        <main className="main-content" key={activePage}>{page}</main>
        <footer className="app-footer"><span>© 2026 KuryenteWatch</span><span><i /> Demo environment · Changes reset on refresh</span><button onClick={() => navigate('admin')}>About this prototype</button></footer>
      </div>
      {toast && <div className="toast" role="status"><span><span className="toast-check">✓</span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </div>
  )
}
