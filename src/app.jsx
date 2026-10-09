import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import { ErrorMessage } from './components/error-message'
import { LoadingState } from './components/loading-state'
import { SetupPage } from './pages/setup-page'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { DEFAULT_SETTINGS } from './utils/settings'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import { demoAppliances } from './data/demo-data'
import { toViewAlert } from './utils/alerts'
import { AlertsPage } from './pages/alerts-page'
import { AppliancesPage } from './pages/appliances-page'
import { DashboardPage } from './pages/dashboard-page'
import { HistoryPage } from './pages/history-page'
import { MeterPage } from './pages/meter-page'
import { SettingsPage } from './pages/settings-page'
import { AdminPage } from './pages/admin-page'
import { AssistantPage } from './pages/assistant-page'

// Like useState, but the value is saved in this browser (localStorage) and restored on reload.
// `revive` turns the saved JSON back into the right shape (for example, date text back into Date objects).
function usePersistentState(key, initial, revive = value => value) {
  const storageKey = `kuryentewatch:v1:${key}`
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw !== null) return revive(JSON.parse(raw))
    } catch { /* storage blocked or the saved data is damaged: start from the defaults */ }
    return initial
  })
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* storage full or blocked: keep working in memory */ }
  }, [storageKey, value])
  return [value, setValue]
}
const asList = value => { if (!Array.isArray(value)) throw new Error('expected a list'); return value }
const withDates = list => list.map(item => ({ ...item, date: new Date(item.date) }))
const readOldBrowserCopy = key => { try { const raw = window.localStorage.getItem(`kuryentewatch:v1:${key}`); return raw === null ? null : JSON.parse(raw) } catch { return null } }
const forgetOldBrowserCopy = key => { try { window.localStorage.removeItem(`kuryentewatch:v1:${key}`) } catch { /* nothing to clean up */ } }

let applianceMoveStarted = false // survives React StrictMode's double-run in development
let browserCopyMoveStarted = false

const pageTitles = {
  dashboard: 'Dashboard',
  meter: 'Add a meter reading',
  appliances: 'My appliances',
  history: 'Energy history',
  alerts: 'Alerts',
  assistant: 'Energy Assistant',
  settings: 'Profile & settings',
  admin: 'About this installation',
  settings: 'Settings',
  admin: 'About this prototype',
}

const sortReadings = rows => rows.slice().sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt))
const toApplianceView = appliance => ({
  ...appliance,
  watts: appliance.ratedWatts,
  hours: appliance.hoursPerDay,
  pattern: appliance.usagePattern,
})

export default function App() {
  const [mode, setMode] = useState('loading')
  const [activePage, setActivePage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [backendError, setBackendError] = useState('')
  const [backendConnected, setBackendConnected] = useState(false)
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine)
  const [profile, setProfile] = useState(null)
  const [readings, setReadings] = useState([])
  const [appliances, setAppliances] = useState([])
  const [alerts, setAlerts] = useState([])
  const [settings, setSettings] = useState({ ratePerKwh: 12.5, compact: false, weeklySummary: true })
  const [readings, setReadings] = useState([]) // meter readings, loaded from the database
  const [appliances, setAppliances] = usePersistentState('appliances', demoAppliances, asList) // last copy from the database
  const [serverStatus, setServerStatus] = useState('connecting') // connecting | online | offline
  const savedBeforeDatabase = useRef(appliances)
  const [alerts, setAlerts] = useState([]) // detector alerts, loaded from the database
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS) // loaded from the database
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
      const [savedReadings, savedAppliances, savedAlerts] = await Promise.all([
        api('/readings'),
        api('/appliances'),
        api('/alerts'),
      ])
      setReadings(savedReadings)
      setAppliances(savedAppliances.map(toApplianceView))
      setAlerts(savedAlerts)
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
    window.clearTimeout(window.toastTimer)
    window.toastTimer = window.setTimeout(() => setToast(''), 3400)
  }

  // Load appliances from the local database when the app opens.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // One-time move: appliances added before the database existed (they have a "custom-" id) go into it first.
        if (!applianceMoveStarted) {
          applianceMoveStarted = true
          for (const item of savedBeforeDatabase.current.filter(item => String(item.id).startsWith('custom-'))) await api.post('/appliances', item)
        }
        const list = await api.get('/appliances')
        if (!cancelled) { setAppliances(list); setServerStatus('online') }
      } catch {
        applianceMoveStarted = false // try the move again next time the server is reachable
        if (!cancelled) setServerStatus('offline')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Load meter readings and settings from the local database when the app opens.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // One-time move: data saved in this browser before the database held it goes into the database first.
        if (!browserCopyMoveStarted) {
          browserCopyMoveStarted = true
          const oldReadings = readOldBrowserCopy('readings')
          if (Array.isArray(oldReadings)) {
            for (const item of oldReadings.filter(item => String(item.id).startsWith('entry-'))) await api.post('/meter-readings', item) // skips the old sample rows
            forgetOldBrowserCopy('readings')
          }
          const oldSettings = readOldBrowserCopy('settings')
          if (oldSettings && typeof oldSettings === 'object' && (await api.get('/settings/preferences')).value === null) await api.put('/settings/preferences', { value: { ...DEFAULT_SETTINGS, ...oldSettings } })
          forgetOldBrowserCopy('settings')
        }
        const [list, saved] = await Promise.all([api.get('/meter-readings'), api.get('/settings/preferences')])
        if (cancelled) return
        setReadings(withDates(list))
        if (saved.value) setSettingsState({ ...DEFAULT_SETTINGS, ...saved.value })
      } catch {
        browserCopyMoveStarted = false // try the move again next time the server is reachable
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Alerts come from the detector via /api/alerts. Reload when the Alerts page opens so new scans show up.
  const loadAlerts = async () => {
    try {
      const [list, devices] = await Promise.all([api.get('/alerts'), api.get('/devices')])
      setAlerts(list.map(item => toViewAlert(item, devices)))
    } catch { /* the footer already says when the server is off */ }
    finally { setAlertsLoaded(true) }
  }
  useEffect(() => { forgetOldBrowserCopy('alerts') }, []) // sample alerts used to be saved in this browser
  useEffect(() => { loadAlerts() }, [activePage === 'alerts'])

  const updateAlert = async (id, changes) => {
    setAlerts(items => items.map(item => item.id === id ? { ...item, ...changes } : item))
    try { await api.patch(`/alerts/${encodeURIComponent(id)}`, changes) }
    catch (err) { toastMessage(err.message); loadAlerts() }
  }
  // Runs the detector over every device's new readings, then reloads the alert list.
  const scanForAlerts = async () => {
    try {
      const result = await api.post('/scan')
      await loadAlerts()
      toastMessage(result.scanned === 0 ? 'No devices with a learned baseline yet. Run npm run seed to load demo data.'
        : result.newAlerts > 0 ? `Scan finished: ${result.newAlerts} new alert${result.newAlerts === 1 ? '' : 's'} found.`
        : 'Scan finished: nothing new or unusual.')
    } catch (err) { toastMessage(err.message) }
  }
  // Asks the local AI to explain one alert. Throws the server's message so the card can show it.
  const explainAlert = async (id, refresh = false) => {
    const { explanation, model } = await api.post(`/alerts/${encodeURIComponent(id)}/explain`, { refresh })
    setAlerts(items => items.map(item => item.id === id ? { ...item, aiExplanation: explanation, aiModel: model } : item))
  }

  const addReading = async reading => {
    try {
      const saved = await api.post('/meter-readings', { kwh: reading.kwh, date: reading.date.toISOString(), source: reading.source, reset: reading.reset === true })
      setReadings(items => [...items, ...withDates([saved])].sort((a, b) => a.date.getTime() - b.date.getTime()))
      return true
    } catch (err) { toastMessage(err.message); return false }
  }
  const saveSettings = async next => {
    try { await api.put('/settings/preferences', { value: next }); setSettingsState(next); return true }
    catch (err) { toastMessage(err.message); return false }
  }

  // Each returns true when the database accepted the change, so the page knows whether to close its form.
  const addAppliance = async appliance => {
    try { const saved = await api.post('/appliances', appliance); setAppliances(items => [...items, saved]); return true }
    catch (err) { toastMessage(err.message); return false }
  }
  const updateAppliance = async appliance => {
    try { const saved = await api.put(`/appliances/${encodeURIComponent(appliance.id)}`, appliance); setAppliances(items => items.map(item => item.id === saved.id ? saved : item)); return true }
    catch (err) { toastMessage(err.message); return false }
  }
  const deleteAppliance = async id => {
    try { await api.del(`/appliances/${encodeURIComponent(id)}`); setAppliances(items => items.filter(item => item.id !== id)); return true }
    catch (err) { toastMessage(err.message); return false }
  }

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
        return <AlertsPage alerts={alerts} onUpdate={updateAlert} onToast={showToast} />
      case 'assistant':
        return <AssistantPage />
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
        <AppHeader title={pageTitles[activePage]} unreadCount={unreadCount} onMenu={() => setMobileOpen(true)} onAlerts={() => navigate('alerts')} onProfile={() => navigate('settings')} onSearch={() => navigate('appliances')} backendConnected={backendConnected} networkOnline={networkOnline} userName={profile.userName} />
        <main className="main-content" key={activePage}>
          {backendError ? <ErrorMessage message={backendError} onRetry={() => loadWorkspace({ initial: true })} /> : page}
        </main>
        <footer className="app-footer"><span>© 2026 KuryenteWatch</span><span><i /> Local SQLite · {networkOnline ? 'Network connected' : 'Internet offline'}</span><button onClick={() => navigate('settings')}>Profile & settings</button></footer>
        return <MeterPage readings={readings} rate={Number(settings.rate) || 0} onSave={addReading} onToast={toastMessage} />
      case 'appliances':
        return <AppliancesPage appliances={appliances} onAdd={addAppliance} onUpdate={updateAppliance} onDelete={deleteAppliance} rate={Number(settings.rate) || 0} onToast={toastMessage} />
      case 'history':
        return <HistoryPage readings={readings} rate={Number(settings.rate) || 0} onToast={toastMessage} />
      case 'alerts':
        return <AlertsPage alerts={alerts.filter(alert => !alert.dismissed)} appliances={appliances} rate={Number(settings.rate) || 0} loaded={alertsLoaded} offline={serverStatus === 'offline'} onUpdate={updateAlert} onExplain={explainAlert} onScan={scanForAlerts} onToast={toastMessage} />
      case 'settings':
        return <SettingsPage settings={settings} onSave={saveSettings} onToast={toastMessage} />
      case 'admin':
        return <AdminPage onNavigate={navigate} />
      default:
        return <DashboardPage readings={readings} alerts={alerts.filter(alert => !alert.dismissed)} alertsLoaded={alertsLoaded} appliances={appliances} rate={Number(settings.rate) || 0} household={settings.household} onNavigate={navigate} />
    }
  }, [activePage, readings, appliances, alerts, alertsLoaded, serverStatus, settings])

  return (
    <div className="app-shell">
      <AppSidebar household={settings.household} activePage={activePage} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} alertCount={unreadCount} />
      <div className="app-main">
        <AppHeader household={settings.household} title={title} unreadCount={unreadCount} onMenu={() => setMobileOpen(true)} onAlerts={() => navigate('alerts')} onProfile={() => navigate('settings')} />
        <main className="main-content" key={activePage}>{page}</main>
        <footer className="app-footer"><span>© 2026 KuryenteWatch</span><span><i /> {serverStatus === 'online' ? 'Local database connected' : serverStatus === 'offline' ? 'Local server off: changes can’t be saved. Start it with npm run server' : 'Connecting to local database'}</span><button onClick={() => navigate('admin')}>About this prototype</button></footer>
      </div>
      {toast && <div className={`toast ${toastKind === 'error' ? 'toast-error' : ''}`} role={toastKind === 'error' ? 'alert' : 'status'}><span><span className="toast-check">{toastKind === 'error' ? '!' : '✓'}</span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </div>
  )
}