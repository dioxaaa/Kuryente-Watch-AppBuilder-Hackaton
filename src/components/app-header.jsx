import { Bell, Menu, Search } from 'lucide-react'

export function AppHeader({ title, unreadCount, onMenu, onAlerts, onProfile, onSearch, backendConnected, userName, networkOnline }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation menu"><Menu size={21} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <span className={`demo-mode ${!backendConnected ? 'connection-offline' : ''}`} title={backendConnected ? (networkOnline ? 'SQLite local server connected' : 'Internet disconnected; local SQLite server remains connected') : 'Local API unavailable'}><span /> {backendConnected ? (networkOnline ? 'SQLite ready' : 'Offline · local ready') : 'Local API unavailable'}</span>
        <button className="icon-button search-button" aria-label="Search appliances" title="Search appliances" onClick={onSearch}><Search size={19} /></button>
        <button className="icon-button notification-button" aria-label={`${unreadCount} unread alerts`} onClick={onAlerts}>
          <Bell size={19} />{unreadCount > 0 && <span className="notification-dot" />}
        </button>
        <button className="profile-button" aria-label="Open settings" onClick={onProfile}>
          <span className="avatar">{userName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="profile-name">{userName}</span>
        </button>
      </div>
    </header>
  )
}
