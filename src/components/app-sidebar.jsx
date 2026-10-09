import {
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  House,
  Plug,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { initialsOf } from '../utils/energy-utils'

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'meter', label: 'Scan my meter', icon: Zap },
  { id: 'appliances', label: 'My appliances', icon: Plug },
  { id: 'history', label: 'Energy history', icon: ChartNoAxesCombined },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'admin', label: 'About this installation', icon: ShieldCheck },
]

export function AppSidebar({ activePage, onNavigate, mobileOpen, onClose, alertCount, userName, householdName }) {
  return (
    <>
      {mobileOpen && <button className="drawer-scrim" aria-label="Close navigation menu" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
          <span className="brand-copy"><strong>Kuryente<span>Watch</span></strong><small>YOUR LOCAL ENERGY DETECTIVE</small></span>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={onClose}><ChevronLeft size={18} /></button>
        </div>
        <div className="household-switch">
          <span className="household-icon"><House size={16} /></span>
          <span><small>HOUSEHOLD</small><strong>{householdName || 'My household'}</strong></span>
          <ChevronRight size={15} className="muted-icon" />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${activePage === id ? 'nav-link-active' : ''}`} onClick={() => onNavigate(id)} aria-current={activePage === id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {id === 'alerts' && alertCount > 0 && <span className="nav-count">{alertCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon"><ShieldCheck size={17} /></span>
            <strong>Your data stays yours</strong>
            <p>Your profile and energy records are stored on this computer.</p>
          </div>
          <button className="profile-mini" onClick={() => onNavigate('settings')}>
            <span className="avatar avatar-small">{initialsOf(userName)}</span>
            <span><strong>{userName || 'Local profile'}</strong><small>Household settings</small></span>
            <ChevronRight size={16} className="muted-icon" />
          </button>
        </div>
      </aside>
    </>
  )
}