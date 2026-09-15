import React from 'react'
import { LayoutDashboard, Users, Eye, Download, ListOrdered, Settings, ShieldCheck } from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab, onOpenAddProfileModal, userSession }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'watched', label: 'Tracked Accounts', icon: Eye, badge: 'Unfollowed' },
    { id: 'followed', label: 'Users Followed', icon: Users },
    { id: 'downloads', label: 'Downloaded Content', icon: Download },
    { id: 'queue', label: 'Tasks Queue', icon: ListOrdered },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const initial = userSession?.username ? userSession.username[0].toUpperCase() : 'A'
  const displayName = userSession?.username ? `@${userSession.username}` : 'Local Admin'

  return (
    <aside className="sidebar">
      <div className="brand-header">
        <div className="brand-logo">
          <Download size={20} />
        </div>
        <div>
          <div className="brand-title">InstaSave</div>
          <span className="brand-version">v1.0.0</span>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span className="unfollowed-tag" style={{ fontSize: '0.65rem' }}>{item.badge}</span>
              )}
            </div>
          )
        })}
      </nav>

      <div className="user-status-card">
        <div className="user-avatar">{initial}</div>
        <div className="user-info">
          <span className="user-name">{displayName}</span>
          <span className="user-role" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} /> Fedora Active
          </span>
        </div>
      </div>
    </aside>
  )
}

