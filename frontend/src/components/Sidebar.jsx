import React from 'react'
import { LayoutDashboard, Users, Eye, Download, ListOrdered, Settings, ShieldCheck, Terminal, X, Sparkles, GitBranch } from 'lucide-react'

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenAddProfileModal,
  userSession,
  dockedJob,
  onOpenDockedConsole,
  onCloseDockedConsole,
  systemVersion,
  onOpenUpdateModal,
  onNavigateToSettings
}) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span
              className="brand-version"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateToSettings ? onNavigateToSettings('version') : setActiveTab('settings')}
              title="Click to view version in Settings"
            >
              v{systemVersion?.version || '1.0.0'}
            </span>
            {systemVersion?.update_available && (
              <span
                onClick={() => onNavigateToSettings ? onNavigateToSettings('version') : setActiveTab('settings')}
                style={{
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                className="animate-pulse"
                title={`New update v${systemVersion.latest_version || ''} available! Click to view in Settings.`}
              >
                <Sparkles size={10} /> Update
              </span>
            )}
          </div>
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

      {/* Docked Minimized Console Card */}
      {dockedJob && (
        <div
          style={{
            marginTop: 'auto',
            marginBottom: '10px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'linear-gradient(145deg, #0d1220, #080b14)',
            border: dockedJob.status === 'in_progress' ? '1px solid rgba(96, 165, 250, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: dockedJob.status === 'in_progress' ? '0 0 14px rgba(59, 130, 246, 0.25)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
          onClick={onOpenDockedConsole}
          title="Click to restore full live console modal"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <Terminal size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {dockedJob.category_tag ? `@${dockedJob.category_tag.replace(/^@/, '')}` : 'Batch Download'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {dockedJob.status === 'in_progress' ? (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#60a5fa' }} className="animate-pulse" />
              ) : dockedJob.status === 'completed' ? (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399' }} />
              ) : (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f87171' }} />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseDockedConsole()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Dismiss docked console"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Mini progress bar */}
          <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${dockedJob.total_items > 0 ? Math.min(100, Math.round((dockedJob.completed_items / dockedJob.total_items) * 100)) : (dockedJob.status === 'completed' ? 100 : 0)}%`,
                height: '100%',
                background: dockedJob.status === 'completed' ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '105px' }}>
              {dockedJob.current_stage || (dockedJob.status === 'in_progress' ? 'Downloading...' : 'Completed')}
            </span>
            <span style={{ fontWeight: '600', color: dockedJob.status === 'completed' ? '#34d399' : '#60a5fa' }}>
              {dockedJob.total_items > 0 ? `${Math.min(100, Math.round((dockedJob.completed_items / dockedJob.total_items) * 100))}%` : (dockedJob.status === 'completed' ? '100%' : 'Active')}
            </span>
          </div>
        </div>
      )}

      <div className="user-status-card" style={dockedJob ? { marginTop: '0' } : {}}>
        <div className="user-avatar">{initial}</div>
        <div className="user-info">
          <span className="user-name">{displayName}</span>
          <span className="user-role" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <ShieldCheck size={12} /> {systemVersion?.distro_name?.split(' ')[0] || 'Linux'} Active
          </span>
        </div>
      </div>

      {/* Dedicated Bottom Version & Update Tracker Footer */}
      <div
        className="sidebar-version-footer"
        onClick={() => {
          if (onNavigateToSettings) {
            onNavigateToSettings('version')
          } else {
            setActiveTab('settings')
          }
        }}
        title={
          systemVersion?.update_available
            ? `Update available: v${systemVersion.latest_version}. Click to open Settings & view update instructions.`
            : `InstaSave v${systemVersion?.version || '1.0.0'} (Up to date). Click to view in Settings.`
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="version-label">
            v{systemVersion?.version || '1.0.0'}
          </span>
          <span className="version-hash">
            #{systemVersion?.commit_hash || 'HEAD'}
          </span>
        </div>

        {systemVersion?.update_available ? (
          <span className="update-available-pill animate-pulse">
            <Sparkles size={11} /> Update
          </span>
        ) : (
          <span className="up-to-date-indicator">
            <span className="dot" /> Up to date
          </span>
        )}
      </div>
    </aside>
  )
}

