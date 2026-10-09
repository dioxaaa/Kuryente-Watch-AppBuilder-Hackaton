import { Bell, Menu, Search } from 'lucide-react'

import { useEffect, useState } from 'react'
import { ThemeToggle } from './theme-toggle.jsx'
import { initialsOf } from '../utils/energy-utils'

export function AppHeader({ household, title, unreadCount, onMenu, onAlerts, onProfile }) {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation menu"><Menu size={21} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <span className={`demo-mode ${online ? '' : 'connection-offline'}`} title="Internet connection status. The app saves to the local server on this computer, so it works without internet."><span /> {online ? 'Online' : 'Offline'}</span>
        <ThemeToggle />
        <button className="icon-button search-button" aria-label="Search (not available yet)" title="Search is not available yet"><Search size={19} /></button>
        <button className="icon-button notification-button" aria-label={`${unreadCount} unread alerts`} onClick={onAlerts}>
          <Bell size={19} />{unreadCount > 0 && <span className="notification-dot" />}
        </button>
        <button className="profile-button" aria-label="Open settings" onClick={onProfile}>
          <span className="avatar">{initialsOf(household)}</span><span className="profile-name">{household || 'My household'}</span>
        </button>
      </div>
    </header>
  )
}