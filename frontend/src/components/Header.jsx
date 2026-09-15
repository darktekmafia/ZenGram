import React from 'react'
import { CheckCircle2, RefreshCw, Search, PlusCircle, Activity } from 'lucide-react'

export default function Header({
  searchQuery,
  setSearchQuery,
  contentType,
  setContentType,
  rateLimitStatus,
  onRunSync,
  onOpenTrackModal,
  syncing
}) {
  return (
    <>
      {/* Top System Status Banner */}
      <div className="status-banner">
        <div className="status-left">
          <CheckCircle2 size={16} />
          <span>Last successful sync: 5 minutes ago. System active on Fedora 44.</span>
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
          <h1>Media Feed & Archiver</h1>
          <p className="page-subtitle">Browse and save media from followed accounts and unfollowed tracked profiles</p>
        </div>

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
          </select>

          <button className="btn-secondary" onClick={onOpenTrackModal}>
            <PlusCircle size={16} />
            <span>Track Account</span>
          </button>

          <button className="btn-primary" onClick={onRunSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Run Full Sync'}</span>
          </button>
        </div>
      </div>
    </>
  )
}
