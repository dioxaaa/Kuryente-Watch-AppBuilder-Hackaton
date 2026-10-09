import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, isLocalMode } from './api'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import { ErrorMessage } from './components/error-message'
import { LoadingState } from './components/loading-state'
import { SetupPage } from './pages/setup-page'
import { AlertsPage } from './pages/alerts-page'
import { AppliancesPage } from './pages/appliances-page'
import { DashboardPage } from './pages/dashboard-page'
import { HistoryPage } from './pages/history-page'
import { MeterPage } from './pages/meter-page'
import { SettingsPage } from './pages/settings-page'
import { AdminPage } from './pages/admin-page'
import { toViewAlert } from './utils/alerts'

const pageTitles = {
  dashboard: 'Dashboard',
  meter: 'Add a meter reading',
  appliances: 'My appliances',
  history: 'Energy history',
  alerts: 'Alerts',
  settings: 'Profile & settings',
  admin: 'About this installation',
}

const sortReadings = rows => rows.slice().sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt))
const toApplianceView = appliance => ({
  ...appliance,
  watts: appliance.ratedWatts ?? appliance.watts,
  hours: appliance.hoursPerDay ?? appliance.hours,
  pattern: appliance.usagePattern ?? appliance.pattern,
  isSample: appliance.isSample ?? appliance.sample,
})

export default function App() {
  const [mode, setMode] = useState('loading')
  const [activePage, setActivePage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [backendError, setBackendError] = useState('')
  const [backendConnected, setBackendConnected] = useState(false)
  const [localMode, setLocalMode] = useState(false)
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine)
  const [profile, setProfile] = useState(null)
  const [readings, setReadings] = useState([])
  const [appliances, setAppliances] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const [settings, setSettings] = useState({ ratePerKwh: 12.5, compact: false, weeklySummary: true })
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState('success')
  const toastTimer = useRef(null)
  const unreadCount = alerts.filter(alert => !alert.read && !alert.dismissed).length

  const showToast = useCallback((message, kind = 'success') => {
    setToast(message)
    setToastKind(kind)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 4200)
  }, [])

  const reportFailure = useCallback(error => {
    showToast(error.message || 'The request could not be completed.', 'error')
    if (error.unavailable) {
      setBackendConnected(false)
      setBackendError(error.message)
    }
  }, [showToast])

  const loadWorkspace = useCallback(async ({ initial = false } = {}) => {
    if (initial) setMode('loading')
    setBackendError('')
    try {
      await api('/health')
      setBackendConnected(true)
      setLocalMode(isLocalMode())
      const [{ profile: savedProfile }, savedSettings] = await Promise.all([api('/profile'), api('/settings')])
      setSettings(savedSettings)
      setProfile(savedProfile)
      if (!savedProfile) {
        setReadings([])
        setAppliances([])
        setAlerts([])
        setMode('setup')
        return
      }
      const [savedReadings, savedAppliances, savedAlerts, devices] = await Promise.all([
        api('/readings'),
        api('/appliances'),
        api('/alerts'),
        api('/devices'),
      ])
      setReadings(savedReadings)
      setAppliances(savedAppliances.map(toApplianceView))
      setAlerts(savedAlerts.map(alert => toViewAlert(alert, devices)))
      setAlertsLoaded(true)
      setMode('ready')
    } catch (error) {
      setBackendConnected(false)
      setBackendError(error.message)
      setMode('error')
      if (!initial) reportFailure(error)
    }
  }, [reportFailure])

  useEffect(() => {
    loadWorkspace({ initial: true })
    const updateNetwork = () => setNetworkOnline(navigator.onLine)
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)
    return () => {
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
      window.clearTimeout(toastTimer.current)
    }
  }, [loadWorkspace])

  const navigate = page => {
    setActivePage(page)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function createProfile(values) {
    const result = await api('/profile', { method: 'POST', body: values })
    setProfile(result.profile)
    setBackendConnected(true)
    await loadWorkspace()
    navigate('dashboard')
  }

  async function saveReading(value) {
    try {
      const { reading } = await api('/readings', { method: 'POST', body: value })
      setReadings(previous => sortReadings([...previous, reading]))
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function addAppliance(value) {
    try {
      const { appliance } = await api('/appliances', {
        method: 'POST',
        body: {
          name: value.name,
          category: value.category,
          ratedWatts: value.watts,
          hoursPerDay: value.hours,
          usagePattern: value.pattern,
          brand: value.brand,
          model: value.model,
        },
      })
      setAppliances(items => [...items, toApplianceView(appliance)])
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function updateAppliance(value) {
    try {
      const { appliance } = await api(`/appliances/${value.id}`, {
        method: 'PUT',
        body: {
          name: value.name,
          category: value.category,
          ratedWatts: value.watts,
          hoursPerDay: value.hours,
          usagePattern: value.pattern,
          brand: value.brand,
          model: value.model,
        },
      })
      setAppliances(items => items.map(item => item.id === appliance.id ? toApplianceView(appliance) : item))
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function deleteAppliance(id) {
    try {
      await api(`/appliances/${id}`, { method: 'DELETE' })
      setAppliances(items => items.filter(item => item.id !== id))
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function updateAlert(id, changes) {
    try {
      await api(`/alerts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { read: changes.read, dismissed: changes.dismissed },
      })
      setAlerts(items => items.map(item => item.id === id ? { ...item, ...changes } : item))
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function refreshAlerts() {
    const [savedAlerts, devices] = await Promise.all([api('/alerts'), api('/devices')])
    setAlerts(savedAlerts.map(alert => toViewAlert(alert, devices)))
    setAlertsLoaded(true)
  }

  async function scanForAlerts() {
    try {
      const result = await api('/scan', { method: 'POST' })
      await refreshAlerts()
      showToast(result.scanned === 0
        ? 'No devices have a learned baseline yet. Add device readings and train a baseline first.'
        : result.newAlerts > 0
          ? `Scan finished: ${result.newAlerts} new alert${result.newAlerts === 1 ? '' : 's'} found.`
          : 'Scan finished: nothing new or unusual.')
    } catch (error) {
      reportFailure(error)
    }
  }

  async function explainAlert(id, refresh = false) {
    const result = await api(`/alerts/${encodeURIComponent(id)}/explain`, {
      method: 'POST',
      body: { refresh },
    })
    setAlerts(items => items.map(item => item.id === id
      ? { ...item, aiExplanation: result.explanation, aiModel: result.model }
      : item))
  }

  async function saveSettings(values) {
    try {
      const result = await api('/settings', {
        method: 'PUT',
        body: {
          userName: values.userName,
          householdName: values.householdName,
          ratePerKwh: values.ratePerKwh,
          compact: values.compact,
          weeklySummary: values.weeklySummary,
        },
      })
      setProfile(result.profile)
      setSettings(result.settings)
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  async function resetProfile() {
    try {
      await api('/profile', { method: 'DELETE' })
      setProfile(null)
      setMode('setup')
      setActivePage('dashboard')
      return true
    } catch (error) {
      reportFailure(error)
      return false
    }
  }

  const page = useMemo(() => {
    if (!profile) return null
    switch (activePage) {
      case 'meter':
        return <MeterPage readings={readings} rate={settings.ratePerKwh} onSave={saveReading} onToast={showToast} />
      case 'appliances':
        return <AppliancesPage appliances={appliances} onAdd={addAppliance} onUpdate={updateAppliance} onDelete={deleteAppliance} rate={settings.ratePerKwh} onToast={showToast} />
      case 'history':
        return <HistoryPage readings={readings} onToast={showToast} />
      case 'alerts':
        return <AlertsPage
          alerts={alerts.filter(alert => !alert.dismissed)}
          appliances={appliances}
          rate={settings.ratePerKwh}
          loaded={alertsLoaded}
          offline={!backendConnected}
          onUpdate={updateAlert}
          onExplain={explainAlert}
          onScan={scanForAlerts}
          onToast={showToast}
        />
      case 'settings':
        return <SettingsPage profile={profile} settings={settings} onSave={saveSettings} onResetProfile={resetProfile} onToast={showToast} />
      case 'admin':
        return <AdminPage onNavigate={navigate} />
      default:
        return <DashboardPage profile={profile} readings={readings} alerts={alerts} appliances={appliances} rate={settings.ratePerKwh} onNavigate={navigate} />
    }
  }, [activePage, profile, readings, appliances, alerts, settings, showToast])

  if (mode === 'loading') return <LoadingState />
  if (mode === 'error') return <ErrorMessage message={backendError} onRetry={() => loadWorkspace({ initial: true })} />
  if (mode === 'setup') return <SetupPage onCreateProfile={createProfile} />

  return (
    <div className="app-shell">
      <AppSidebar activePage={activePage} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} alertCount={unreadCount} userName={profile.userName} householdName={profile.householdName} />
      <div className="app-main">
        <AppHeader title={pageTitles[activePage]} unreadCount={unreadCount} onMenu={() => setMobileOpen(true)} onAlerts={() => navigate('alerts')} onProfile={() => navigate('settings')} onSearch={() => navigate('appliances')} backendConnected={backendConnected} localMode={localMode} networkOnline={networkOnline} userName={profile.userName} />
        <main className="main-content" key={activePage}>
          {backendError ? <ErrorMessage message={backendError} onRetry={() => loadWorkspace({ initial: true })} /> : page}
        </main>
        <footer className="app-footer"><span>© 2026 KuryenteWatch</span><span><i /> {localMode ? 'Saved on this device' : 'Local SQLite'} · {networkOnline ? 'Network connected' : 'Internet offline'}</span><button onClick={() => navigate('settings')}>Profile & settings</button></footer>
      </div>
      {toast && <div className={`toast ${toastKind === 'error' ? 'toast-error' : ''}`} role={toastKind === 'error' ? 'alert' : 'status'}><span><span className="toast-check">{toastKind === 'error' ? '!' : '✓'}</span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </div>
  )
}