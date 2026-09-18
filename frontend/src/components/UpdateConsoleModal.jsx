import React, { useState, useEffect, useRef, memo } from 'react'
import {
  X,
  Minimize2,
  Maximize2,
  Terminal,
  Activity,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react'

function UpdateConsoleModalComponent({
  isOpen,
  onClose,
  onMinimize,
  onReloadPage
}) {
  const [updateState, setUpdateState] = useState({
    status: 'in_progress',
    progress_percent: 5,
    current_stage: 'Initializing update runner...',
    logs: '',
    error: null
  })
  const [copied, setCopied] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isServiceOnline, setIsServiceOnline] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const scrollRef = useRef(null)
  const lastLogsRef = useRef('')

  // Poll update status while modal is open
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    let consecutiveErrors = 0

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/v1/system/update-status')
        if (res.ok && isMounted) {
          const data = await res.json()
          setUpdateState(data)
          consecutiveErrors = 0
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          // Server might be restarting
          consecutiveErrors++
        }
      } catch (err) {
        consecutiveErrors++
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isOpen])

  // When update reaches restarting or server goes down, probe /api/v1/system/version until back online
  useEffect(() => {
    if (!isOpen) return
    if (updateState.status !== 'restarting' && updateState.status !== 'completed') return

    let isMounted = true
    setIsReconnecting(true)

    const probeServer = async () => {
      try {
        const res = await fetch('/api/v1/system/version', { cache: 'no-store' })
        if (res.ok && isMounted) {
          setIsServiceOnline(true)
          setIsReconnecting(false)
        }
      } catch (e) {
        // Server still restarting
      }
    }

    const interval = setInterval(probeServer, 1500)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isOpen, updateState.status])

  // Scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current && isOpen && updateState?.logs && updateState.logs !== lastLogsRef.current) {
      lastLogsRef.current = updateState.logs
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [updateState?.logs, isOpen])

  if (!isOpen) return null

  const isRunning = updateState.status === 'in_progress'
  const isRestarting = updateState.status === 'restarting'
  const isCompleted = updateState.status === 'completed' || isServiceOnline
  const isFailed = updateState.status === 'failed'
  const percent = updateState.progress_percent || (isCompleted ? 100 : (isRestarting ? 95 : 10))

  const handleCopy = () => {
    if (!updateState.logs) return
    navigator.clipboard.writeText(updateState.logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleReload = () => {
    if (onReloadPage) {
      onReloadPage()
    } else {
      window.location.reload()
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1150,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMaximized ? '0' : '20px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMaximized ? '100vw' : '900px',
          maxWidth: isMaximized ? '100vw' : '94vw',
          height: isMaximized ? '100vh' : '640px',
          maxHeight: isMaximized ? '100vh' : '88vh',
          borderRadius: isMaximized ? '0' : '12px',
          border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.14)',
          background: '#0a0d16',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          margin: 0,
          overflow: 'hidden'
        }}
      >
        {/* Titlebar Header */}
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          {/* Left: Traffic Lights & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={onClose}
                title="Close"
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ff5f56',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
              <button
                onClick={onMinimize}
                title="Minimize to Sidebar"
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ffbd2e',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Restore' : 'Maximize'}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#27c93f',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} style={{ color: '#a78bfa' }} />
              <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>
                ZenGram Automated Web Updater
              </span>
              <span style={{ fontSize: '0.75rem', color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                Live Execution
              </span>
            </div>
          </div>

          {/* Right: Status badge & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isRunning && (
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={12} className="animate-spin" /> Updating ({percent}%)
              </span>
            )}
            {isRestarting && !isServiceOnline && (
              <span style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={12} className="animate-spin" /> Reloading Service...
              </span>
            )}
            {(isCompleted || isServiceOnline) && (
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={12} /> Succeeded (100%)
              </span>
            )}
            {isFailed && (
              <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={12} /> Failed
              </span>
            )}

            <button
              onClick={handleCopy}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Copy all logs"
            >
              {copied ? <Check size={13} style={{ color: '#34d399' }} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onMinimize}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Minimize to sidebar"
            >
              <Minimize2 size={13} />
              <span>Minimize</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Stage & Progress Banner */}
        <div style={{ padding: '12px 18px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {/* Progress bar */}
          <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '6px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                background: isCompleted || isServiceOnline
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : (isFailed
                      ? '#ef4444'
                      : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'),
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRunning ? (
                <Activity size={14} className="animate-spin" style={{ color: '#60a5fa' }} />
              ) : isRestarting && !isServiceOnline ? (
                <RefreshCw size={14} className="animate-spin" style={{ color: '#a78bfa' }} />
              ) : isCompleted || isServiceOnline ? (
                <CheckCircle2 size={14} style={{ color: '#34d399' }} />
              ) : (
                <AlertCircle size={14} style={{ color: '#f87171' }} />
              )}
              <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                {isServiceOnline
                  ? 'ZenGram is updated and service is running!'
                  : (updateState.current_stage || (isRunning ? 'Applying update...' : (isCompleted ? 'Completed' : 'Update Failed')))}
              </span>
            </div>
            <div>
              <span>Stage Progress: <strong style={{ color: '#fff' }}>{percent}%</strong></span>
            </div>
          </div>
        </div>

        {/* Reconnect / Reload Announcement Banner */}
        {(isServiceOnline || isCompleted) && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
            borderBottom: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: '#34d399' }} />
              <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600' }}>
                ZenGram updated successfully! Reload page to activate latest bundle.
              </span>
            </div>
            <button
              onClick={handleReload}
              className="btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '6px 16px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
              }}
            >
              <span>Reload ZenGram</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Terminal Output Body */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            background: '#060911',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.78rem',
            color: '#a5f3fc',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}
        >
          {updateState.logs || (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Waiting for update logs...
            </span>
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '8px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.74rem',
            color: 'var(--text-muted)'
          }}
        >
          <span>
            {isRunning ? '⏳ Update in progress. You may minimize this window to keep browsing.' : (isFailed ? '❌ Review log output above for failure details.' : '✅ Update process finished.')}
          </span>
          <span>
            Started: {updateState.started_at ? new Date(updateState.started_at).toLocaleTimeString() : 'Just now'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(UpdateConsoleModalComponent)
