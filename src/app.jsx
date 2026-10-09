import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { DEFAULT_SETTINGS } from './utils/settings'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import { demoAlerts, demoAppliances } from './data/demo-data'
import { AlertsPage } from './pages/alerts-page'
import { AdminPage } from './pages/admin-page'
import { AppliancesPage } from './pages/appliances-page'
import { DashboardPage } from './pages/dashboard-page'
import { HistoryPage } from './pages/history-page'
import { MeterPage } from './pages/meter-page'
import { SettingsPage } from './pages/settings-page'

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
const reviveAlerts = value => asList(value).map(item => ({ ...item, createdAt: new Date(item.createdAt) }))
const withDates = list => list.map(item => ({ ...item, date: new Date(item.date) }))
const readOldBrowserCopy = key => { try { const raw = window.localStorage.getItem(`kuryentewatch:v1:${key}`); return raw === null ? null : JSON.parse(raw) } catch { return null } }
const forgetOldBrowserCopy = key => { try { window.localStorage.removeItem(`kuryentewatch:v1:${key}`) } catch { /* nothing to clean up */ } }

let applianceMoveStarted = false // survives React StrictMode's double-run in development
let browserCopyMoveStarted = false

const pageTitles = {
  dashboard: 'Dashboard',
  meter: 'Scan my meter',
  appliances: 'My appliances',
  history: 'Energy history',
  alerts: 'Alerts',
  settings: 'Settings',
  admin: 'About this prototype',
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [readings, setReadings] = useState([]) // meter readings, loaded from the database
  const [appliances, setAppliances] = usePersistentState('appliances', demoAppliances, asList) // last copy from the database
  const [serverStatus, setServerStatus] = useState('connecting') // connecting | online | offline
  const savedBeforeDatabase = useRef(appliances)
  const [alerts, setAlerts] = usePersistentState('alerts', demoAlerts, reviveAlerts)
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS) // loaded from the database
  const [toast, setToast] = useState('')
  const unreadCount = alerts.filter(alert => !alert.read && !alert.dismissed).length
  const title = pageTitles[activePage]

  const toastMessage = message => {
    setToast(message)
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

  const addReading = async reading => {
    try {
      const saved = await api.post('/meter-readings', { kwh: reading.kwh, date: reading.date.toISOString(), source: reading.source })
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
    setActivePage(page === 'about' ? 'admin' : page)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const page = useMemo(() => {
    switch (activePage) {
      case 'meter':
        return <MeterPage readings={readings} rate={Number(settings.rate) || 0} onSave={addReading} onToast={toastMessage} />
      case 'appliances':
        return <AppliancesPage appliances={appliances} onAdd={addAppliance} onUpdate={updateAppliance} onDelete={deleteAppliance} rate={Number(settings.rate) || 0} onToast={toastMessage} />
      case 'history':
        return <HistoryPage readings={readings} rate={Number(settings.rate) || 0} onToast={toastMessage} />
      case 'alerts':
        return <AlertsPage alerts={alerts.filter(alert => !alert.dismissed)} onUpdate={(id, changes) => setAlerts(items => items.map(item => item.id === id ? { ...item, ...changes } : item))} onToast={toastMessage} />
      case 'settings':
        return <SettingsPage settings={settings} onSave={saveSettings} onToast={toastMessage} />
      case 'admin':
        return <AdminPage onNavigate={navigate} />
      default:
        return <DashboardPage readings={readings} alerts={alerts.filter(alert => !alert.dismissed)} appliances={appliances} rate={Number(settings.rate) || 0} household={settings.household} onNavigate={navigate} />
    }
  }, [activePage, readings, appliances, alerts, settings])

  return (
    <div className="app-shell">
      <AppSidebar household={settings.household} activePage={activePage} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} alertCount={unreadCount} />
      <div className="app-main">
        <AppHeader household={settings.household} title={title} unreadCount={unreadCount} onMenu={() => setMobileOpen(true)} onAlerts={() => navigate('alerts')} onProfile={() => navigate('settings')} />
        <main className="main-content" key={activePage}>{page}</main>
        <footer className="app-footer"><span>© 2026 KuryenteWatch</span><span><i /> {serverStatus === 'online' ? 'Local database connected' : serverStatus === 'offline' ? 'Local server off: changes can’t be saved. Start it with npm run server' : 'Connecting to local database'}</span><button onClick={() => navigate('admin')}>About this prototype</button></footer>
      </div>
      {toast && <div className="toast" role="status"><span><span className="toast-check">✓</span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    </div>
  )
}