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
  Layers,
  ChevronDown,
  ChevronUp
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
  const [expandedCommits, setExpandedCommits] = useState({})
  
  // Decide active tab
  const [activeTab, setActiveTab] = useState('changelog')

  const toggleExpandCommit = (key) => {
    setExpandedCommits(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getCategoryStyle = (cat) => {
    switch ((cat || '').toLowerCase()) {
      case 'feature':
        return { bg: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: 'rgba(139, 92, 246, 0.4)', icon: '✨', label: 'Feature' }
      case 'fix':
        return { bg: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.4)', icon: '🐛', label: 'Fix' }
      case 'security':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.4)', icon: '🔒', label: 'Security' }
      case 'performance':
        return { bg: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)', icon: '⚡', label: 'Performance' }
      case 'docs':
        return { bg: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.4)', icon: '📄', label: 'Docs' }
      case 'refactor':
        return { bg: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: 'rgba(168, 85, 247, 0.4)', icon: '♻️', label: 'Refactor' }
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)', icon: '📦', label: 'Update' }
    }
  }

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
  const installedCommits = systemVersion?.installed_commits || []

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: '#8b5cf6' }} />
                    <span>Incoming Changes in this Update ({pendingCommits.length})</span>
                  </div>

                  {/* Category Summary Pills */}
                  {pendingCommits.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {['Feature', 'Fix', 'Security', 'Performance', 'Docs', 'Refactor'].map(cat => {
                        const count = pendingCommits.filter(c => (c.category || '').toLowerCase() === cat.toLowerCase()).length
                        if (count === 0) return null
                        const style = getCategoryStyle(cat)
                        return (
                          <span
                            key={cat}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 7px',
                              borderRadius: '10px',
                              background: style.bg,
                              color: style.color,
                              border: `1px solid ${style.border}`,
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{style.icon}</span>
                            <span>{count} {cat}{count > 1 ? 's' : ''}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {pendingCommits.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {pendingCommits.map((c, idx) => {
                      const isExpanded = !!expandedCommits[c.hash || idx]
                      const catStyle = getCategoryStyle(c.category)
                      const hasBody = !!c.body && c.body.trim().length > 0

                      return (
                        <div
                          key={c.hash || idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                              {/* Category Badge */}
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: catStyle.bg,
                                color: catStyle.color,
                                border: `1px solid ${catStyle.border}`,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>
                                {catStyle.label}
                              </span>

                              {/* Hash */}
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '0.74rem',
                                background: 'rgba(139, 92, 246, 0.15)',
                                color: '#c4b5fd',
                                border: '1px solid rgba(139, 92, 246, 0.25)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>
                                #{c.hash}
                              </span>

                              {/* Message */}
                              <span style={{ fontSize: '0.84rem', fontWeight: '500', color: '#fff', lineHeight: 1.4 }}>
                                {c.message}
                              </span>
                            </div>

                            {/* Expand Body Button if body exists */}
                            {hasBody && (
                              <button
                                type="button"
                                onClick={() => toggleExpandCommit(c.hash || idx)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: isExpanded ? '#a78bfa' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  fontSize: '0.72rem',
                                  flexShrink: 0
                                }}
                                title={isExpanded ? 'Collapse commit details' : 'Expand commit details'}
                              >
                                <span>{isExpanded ? 'Less' : 'Details'}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            )}
                          </div>

                          {/* Expanded Commit Body / Details */}
                          {hasBody && isExpanded && (
                            <div style={{
                              marginTop: '4px',
                              padding: '8px 12px',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: '#cbd5e1',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace'
                            }}>
                              {c.body}
                            </div>
                          )}

                          {/* Author & Timestamp */}
                          {(c.author || c.date) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                      )
                    })}
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Installed Version</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                    v{systemVersion?.version || '1.0.0'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <GitBranch size={12} /> #{systemVersion?.commit_hash || 'HEAD'} ({systemVersion?.branch || 'main'})
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Update Status</div>
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
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Operating System:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{systemVersion?.distro_name || 'Linux'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Server Hostname:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{systemVersion?.hostname || 'localhost'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Python Runtime:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Python {systemVersion?.python_version || '3.12+'} (FastAPI + Uvicorn)</span>
                </div>
              </div>

              {/* Installed Commit History Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: '#34d399' }} />
                    <span>Recent Installed Commits & Changelog ({installedCommits.length})</span>
                  </div>

                  {/* Category Summary Pills */}
                  {installedCommits.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {['Feature', 'Fix', 'Security', 'Performance', 'Docs', 'Refactor'].map(cat => {
                        const count = installedCommits.filter(c => (c.category || '').toLowerCase() === cat.toLowerCase()).length
                        if (count === 0) return null
                        const style = getCategoryStyle(cat)
                        return (
                          <span
                            key={cat}
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 7px',
                              borderRadius: '10px',
                              background: style.bg,
                              color: style.color,
                              border: `1px solid ${style.border}`,
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{style.icon}</span>
                            <span>{count} {cat}{count > 1 ? 's' : ''}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {installedCommits.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {installedCommits.map((c, idx) => {
                      const isExpanded = !!expandedCommits[`installed_${c.hash || idx}`]
                      const catStyle = getCategoryStyle(c.category)
                      const hasBody = !!c.body && c.body.trim().length > 0

                      return (
                        <div
                          key={`installed_${c.hash || idx}`}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                              {/* Category Badge */}
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: catStyle.bg,
                                color: catStyle.color,
                                border: `1px solid ${catStyle.border}`,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>
                                {catStyle.label}
                              </span>

                              {/* Hash */}
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '0.74rem',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#6ee7b7',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>
                                #{c.hash}
                              </span>

                              {/* Message */}
                              <span style={{ fontSize: '0.84rem', fontWeight: '500', color: '#fff', lineHeight: 1.4 }}>
                                {c.message}
                              </span>
                            </div>

                            {/* Expand Body Button if body exists */}
                            {hasBody && (
                              <button
                                type="button"
                                onClick={() => toggleExpandCommit(`installed_${c.hash || idx}`)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: isExpanded ? '#34d399' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  fontSize: '0.72rem',
                                  flexShrink: 0
                                }}
                                title={isExpanded ? 'Collapse commit details' : 'Expand commit details'}
                              >
                                <span>{isExpanded ? 'Less' : 'Details'}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            )}
                          </div>

                          {/* Expanded Commit Body / Details */}
                          {hasBody && isExpanded && (
                            <div style={{
                              marginTop: '4px',
                              padding: '8px 12px',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: '#cbd5e1',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace'
                            }}>
                              {c.body}
                            </div>
                          )}

                          {/* Author & Timestamp */}
                          {(c.author || c.date) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                      )
                    })}
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
                    {systemVersion?.commit_message ? `Active local commit: "${systemVersion.commit_message}"` : 'Local build active.'}
                  </div>
                )}
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
