import React, { useState, useEffect } from 'react'
import {
  X,
  Sparkles,
  CheckCircle2,
  GitCommit,
  GitBranch,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Play,
  Clock,
  User,
  Info,
  Layers
} from 'lucide-react'

export default function UpdateModal({
  isOpen,
  onClose,
  systemVersion,
  onCheckUpdate,
  checkingUpdate,
  onApplyUpdate,
  initialTab = 'auto'
}) {
  const [copied, setCopied] = useState(false)
  const isUpdateAvailable = !!systemVersion?.update_available
  
  // Decide active tab
  const [activeTab, setActiveTab] = useState('changelog')

  useEffect(() => {
    if (initialTab === 'installed') {
      setActiveTab('installed')
    } else if (initialTab === 'changelog') {
      setActiveTab('changelog')
    } else {
      setActiveTab(isUpdateAvailable ? 'changelog' : 'installed')
    }
  }, [initialTab, isUpdateAvailable, isOpen])

  if (!isOpen) return null

  const updateCmd = './install.sh --update'

  const handleCopy = () => {
    navigator.clipboard.writeText(updateCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingCommits = systemVersion?.pending_commits || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '95vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: '0',
          overflow: 'hidden',
          background: '#0c101c',
          border: '1px solid rgba(255, 255, 255, 0.12)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: isUpdateAvailable ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: isUpdateAvailable ? '0 0 15px rgba(139, 92, 246, 0.3)' : 'none'
            }}>
              {isUpdateAvailable ? <Sparkles size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                {isUpdateAvailable ? 'Update Details & Release Manager' : 'ZenGram System Information'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isUpdateAvailable ? `${systemVersion?.behind_by || 0} pending commit${systemVersion?.behind_by !== 1 ? 's' : ''} available from upstream` : 'Your ZenGram installation is running on the latest commit'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '0 20px'
        }}>
          {isUpdateAvailable && (
            <button
              onClick={() => setActiveTab('changelog')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'changelog' ? '2px solid #8b5cf6' : '2px solid transparent',
                color: activeTab === 'changelog' ? '#fff' : 'var(--text-muted)',
                padding: '12px 16px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={14} style={{ color: activeTab === 'changelog' ? '#a78bfa' : 'inherit' }} />
              <span>Update Details ({pendingCommits.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('installed')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'installed' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'installed' ? '#fff' : 'var(--text-muted)',
              padding: '12px 16px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Info size={14} style={{ color: activeTab === 'installed' ? '#60a5fa' : 'inherit' }} />
            <span>Installed Version & Environment</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* TAB 1: Incoming Changelog & Upstream Commits */}
          {activeTab === 'changelog' && isUpdateAvailable && (
            <>
              {/* Version Comparison Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: 'var(--bg-tertiary)',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Installed</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                    v{systemVersion?.version || '1.0.0'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GitBranch size={12} /> #{systemVersion?.commit_hash || 'HEAD'} ({systemVersion?.branch || 'main'})
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Release</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#c4b5fd', marginTop: '2px' }}>
                    v{systemVersion?.latest_version || systemVersion?.version || '1.0.1'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '2px' }}>
                    ● {systemVersion?.behind_by} new commit{systemVersion?.behind_by !== 1 ? 's' : ''} ready to apply
                  </div>
                </div>
              </div>

              {/* Commit List / Changelog */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} style={{ color: '#8b5cf6' }} />
                  <span>Incoming Changes in this Update</span>
                </div>

                {pendingCommits.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {pendingCommits.map((c, idx) => (
                      <div
                        key={c.hash || idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '0.74rem',
                              background: 'rgba(139, 92, 246, 0.2)',
                              color: '#c4b5fd',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              #{c.hash}
                            </span>
                            <span style={{ fontSize: '0.84rem', fontWeight: '500', color: '#fff' }}>
                              {c.message}
                            </span>
                          </div>
                        </div>

                        {(c.author || c.date) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {c.author && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <User size={11} /> {c.author}
                              </span>
                            )}
                            {c.date && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> {c.date}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic'
                  }}>
                    {systemVersion?.commit_message ? `Latest upstream change: "${systemVersion.commit_message}"` : 'New upstream revisions available.'}
                  </div>
                )}
              </div>

              {/* Action Banner: Apply Web Update */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={15} style={{ color: '#a78bfa' }} />
                    <span>Ready to update ZenGram?</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Non-breaking update will pull changes, compile frontend assets, and restart the service.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onClose()
                    if (onApplyUpdate) onApplyUpdate()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    fontSize: '0.88rem',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  <Play size={14} />
                  <span>Apply Web Update Now</span>
                </button>
              </div>

              {/* Manual CLI Command Alternative */}
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Or update manually via terminal:
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#060911',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  color: '#34d399'
                }}>
                  <span>{updateCmd}</span>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem'
                    }}
                  >
                    {copied ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Installed Details & Environment */}
          {activeTab === 'installed' && (
            <>
              {/* Installed Version Overview Card */}
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Installed Version</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                    v{systemVersion?.version || '1.0.0'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GitBranch size={12} /> #{systemVersion?.commit_hash || 'HEAD'} ({systemVersion?.branch || 'main'})
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Update Status</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '600', color: isUpdateAvailable ? '#a78bfa' : '#34d399', marginTop: '6px' }}>
                    {isUpdateAvailable ? `● ${systemVersion?.update_status_text}` : '● System is Up to Date'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Commit date: {systemVersion?.commit_date || 'Recent'}
                  </div>
                </div>
              </div>

              {/* Environment Details Table */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Operating System:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{systemVersion?.distro_name || 'Linux'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Server Hostname:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{systemVersion?.hostname || 'localhost'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Python Runtime:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Python {systemVersion?.python_version || '3.12+'} (FastAPI + Uvicorn)</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Latest Local Commit Message:</div>
                  <div style={{
                    color: 'var(--text-main)',
                    fontStyle: 'italic',
                    background: 'var(--bg-tertiary)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    "{systemVersion?.commit_message || 'Local build'}"
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCheckUpdate}
            disabled={checkingUpdate}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''} />
            <span>{checkingUpdate ? 'Checking Upstream...' : 'Check Upstream'}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ fontSize: '0.82rem', padding: '6px 18px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
