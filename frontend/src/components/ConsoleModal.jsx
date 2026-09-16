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
  Clock
} from 'lucide-react'

function ConsoleModalComponent({
  isOpen,
  onClose,
  onMinimize,
  jobId,
  initialJob
}) {
  const [job, setJob] = useState(initialJob || null)
  const [copied, setCopied] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const scrollRef = useRef(null)
  const lastLogsRef = useRef('')

  // Sync initialJob if provided
  useEffect(() => {
    if (initialJob) {
      setJob(initialJob)
    }
  }, [initialJob])

  // Dedicated lightweight poll for the active job while modal is open
  useEffect(() => {
    if (!isOpen || !jobId) return

    let isMounted = true

    const fetchCurrentJob = async () => {
      try {
        const res = await fetch(`/api/v1/downloads/jobs/${jobId}`)
        if (res.ok && isMounted) {
          const data = await res.json()
          setJob(data)
        }
      } catch (err) {
        console.error('Error fetching console job details:', err)
      }
    }

    fetchCurrentJob()

    const isRunning = !job || job.status === 'in_progress' || job.status === 'queued'
    const intervalTime = isRunning ? 1000 : 3000

    const interval = setInterval(fetchCurrentJob, intervalTime)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isOpen, jobId, job?.status])

  // Scroll to bottom without smooth animation thrash
  useEffect(() => {
    if (scrollRef.current && isOpen && job?.logs && job.logs !== lastLogsRef.current) {
      lastLogsRef.current = job.logs
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [job?.logs, isOpen])

  if (!isOpen || !job) return null

  const isLive = job.status === 'in_progress'
  const isQueued = job.status === 'queued'
  const percent = job.total_items > 0
    ? Math.min(100, Math.round((job.completed_items / job.total_items) * 100))
    : (job.status === 'completed' ? 100 : 0)

  const displayTag = !job.category_tag || job.category_tag === 'General'
    ? '@General'
    : (job.category_tag.startsWith('@') || job.category_tag === 'Selected Items'
        ? job.category_tag
        : `@${job.category_tag}`)

  const handleCopy = () => {
    if (!job.logs) return
    navigator.clipboard.writeText(job.logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1100,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(5px)',
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
          width: isMaximized ? '100vw' : '880px',
          maxWidth: isMaximized ? '100vw' : '94vw',
          height: isMaximized ? '100vh' : '620px',
          maxHeight: isMaximized ? '100vh' : '88vh',
          borderRadius: isMaximized ? '0' : '12px',
          border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
          background: '#0a0e17',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
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
                Batch Archive: {displayTag}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                #{job.id}
              </span>
            </div>
          </div>

          {/* Right: Status badge & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {job.status === 'in_progress' && (
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={12} className="animate-spin" /> In Progress ({percent}%)
              </span>
            )}
            {job.status === 'queued' && (
              <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={12} /> Queued in Line
              </span>
            )}
            {job.status === 'completed' && (
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={12} /> Completed
              </span>
            )}
            {job.status === 'failed' && (
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
                width: isQueued ? '100%' : `${percent}%`,
                height: '100%',
                background: isQueued
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : (job.status === 'completed'
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'),
                transition: 'width 0.3s linear'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isLive ? (
                <Activity size={14} className="animate-spin" style={{ color: '#60a5fa' }} />
              ) : isQueued ? (
                <Clock size={14} style={{ color: '#fbbf24' }} />
              ) : (
                <CheckCircle2 size={14} style={{ color: '#34d399' }} />
              )}
              <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>
                {job.current_stage || (isLive ? 'Executing background tasks...' : (isQueued ? 'Waiting in batch queue...' : 'Completed'))}
              </span>
            </div>
            <div>
              {isQueued ? (
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>In Queue</span>
              ) : (
                <>Progress: <strong style={{ color: '#fff' }}>{job.completed_items || 0}</strong> / {job.total_items || 0} items ({percent}%)</>
              )}
            </div>
          </div>
        </div>

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
          {job.logs || (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Waiting for operational logs...
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
            💡 You can <strong>minimize</strong> this console to the sidebar to continue browsing other accounts.
          </span>
          <span>
            Started: {new Date(job.created_at).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(ConsoleModalComponent)
