import React from 'react'
import { CheckCircle2, RefreshCw, Search, PlusCircle, Activity } from 'lucide-react'

export default function Header({
  activeTab,
  searchQuery,
  setSearchQuery,
  contentType,
  setContentType,
  rateLimitStatus,
  onRunSync,
  onOpenTrackModal,
  syncing,
  systemVersion,
  onOpenUpdateModal
}) {
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'downloads':
        return {
          title: 'Downloaded Content',
          subtitle: `Explore, view, and manage media saved locally on your ${systemVersion?.distro_name?.split(' ')[0] || 'Linux'} filesystem`
        }
      case 'followed':
        return {
          title: 'Followed Accounts',
          subtitle: 'Sync, browse, and batch archive media from accounts you follow on Instagram'
        }
      case 'watched':
      case 'unfollowed':
        return {
          title: 'Tracked Profiles',
          subtitle: 'Browse and archive public profiles tracked without following'
        }
      case 'queue':
        return {
          title: 'Background Task Queue',
          subtitle: 'Real-time monitoring of batch downloads and background media jobs'
        }
      case 'settings':
        return {
          title: 'Application Settings',
          subtitle: 'Configure credentials, storage location, rate limits, updates, and maintenance'
        }
      default:
        return {
          title: 'Media Feed & Archiver',
          subtitle: 'Browse and save media from your followed accounts (newest first)'
        }
    }
  }

  const { title, subtitle } = getHeaderInfo()
  const showMediaControls = activeTab === 'dashboard' || activeTab === 'downloads'

  return (
    <>
      {/* Top System Status Banner */}
      <div className="status-banner">
        <div className="status-left">
          <CheckCircle2 size={16} />
          <span>
            {systemVersion?.distro_name ? `System active on ${systemVersion.distro_name}` : 'System active on Linux'} • Local Server Running on :8484
          </span>
          {systemVersion?.update_available && (
            <span
              onClick={onOpenUpdateModal}
              style={{
                marginLeft: '10px',
                background: 'rgba(167, 139, 250, 0.2)',
                color: '#c4b5fd',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Click to view update details"
            >
              Update Available (v{systemVersion.latest_version})
            </span>
          )}
        </div>
        <div className="status-right">
          {rateLimitStatus && (
            <div className={`meter-pill ${rateLimitStatus.is_critical ? 'critical' : ''}`}>
              <Activity size={14} />
              <span>Rate Quota: {rateLimitStatus.requests_made_last_hour}/{rateLimitStatus.max_requests_per_hour} req/hr</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Control Toolbar */}
      <div className="control-bar">
        <div className="page-title-group">
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>

        {showMediaControls && (
          <div className="controls-right">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search user or caption..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="select-dropdown"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
              <option value="ALL">All Media Types</option>
              <option value="IMAGE">Photos Only</option>
              <option value="VIDEO">Videos Only</option>
              <option value="CAROUSEL">Carousels Only</option>
              <option value="STORY">Stories Only</option>
            </select>

            {activeTab === 'dashboard' && (
              <>
                <button className="btn-secondary" onClick={onOpenTrackModal}>
                  <PlusCircle size={16} />
                  <span>Track Account</span>
                </button>

                <button className="btn-primary" onClick={onRunSync} disabled={syncing}>
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  <span>{syncing ? 'Syncing...' : 'Run Full Sync'}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
