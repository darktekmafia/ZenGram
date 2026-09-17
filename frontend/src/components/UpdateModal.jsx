import React, { useState } from 'react'
import { X, Sparkles, CheckCircle2, ArrowUpRight, Copy, Check, GitBranch, RefreshCw, Terminal } from 'lucide-react'

export default function UpdateModal({
  isOpen,
  onClose,
  systemVersion,
  onCheckUpdate,
  checkingUpdate
}) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const isUpdateAvailable = systemVersion?.update_available
  const updateCmd = './install.sh --update'

  const handleCopy = () => {
    navigator.clipboard.writeText(updateCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '540px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isUpdateAvailable ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              {isUpdateAvailable ? <Sparkles size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {isUpdateAvailable ? 'New Update Available!' : 'System Up to Date'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                InstaSave Version & Release Engine
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

        {/* Version Comparison Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: 'var(--bg-tertiary)',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CURRENT VERSION</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
              v{systemVersion?.version || '1.0.0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GitBranch size={12} /> {systemVersion?.commit_hash || 'HEAD'} ({systemVersion?.branch || 'main'})
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>LATEST AVAILABLE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700', color: isUpdateAvailable ? '#a78bfa' : '#34d399' }}>
              v{systemVersion?.latest_version || systemVersion?.version || '1.0.0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: isUpdateAvailable ? '#60a5fa' : '#34d399', marginTop: '2px' }}>
              {isUpdateAvailable ? (systemVersion?.update_status_text || 'New release ready') : 'Latest Release'}
            </div>
          </div>
        </div>

        {/* Environment Details */}
        <div style={{
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          marginBottom: '20px',
          background: 'rgba(255,255,255,0.02)',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Environment:</span>
            <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{systemVersion?.distro_name || 'Linux'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Commit Message:</span>
            <span style={{ color: 'var(--text-main)', fontStyle: 'italic', maxWidth: '300px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              "{systemVersion?.commit_message || 'Latest changes'}"
            </span>
          </div>
        </div>

        {/* Upgrade Instructions */}
        {isUpdateAvailable && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={15} style={{ color: '#60a5fa' }} />
              <span>How to Apply Update</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              Run the update command in your terminal from the InstaSave project directory. It will pull the latest commits, install any new dependencies, recompile frontend assets, and restart the service automatically:
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0d14',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              color: '#34d399'
            }}>
              <span>{updateCmd}</span>
              <button
                onClick={handleCopy}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem'
                }}
              >
                {copied ? <><Check size={13} className="text-green-400" /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCheckUpdate}
            disabled={checkingUpdate}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''} />
            <span>{checkingUpdate ? 'Checking Upstream...' : 'Check for Updates'}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
