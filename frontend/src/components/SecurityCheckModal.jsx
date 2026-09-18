import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Copy,
  Check,
  Info,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export default function SecurityCheckModal({
  isOpen,
  onClose
}) {
  const [statusState, setStatusState] = useState({
    status: 'idle', // idle, in_progress, completed, failed
    progress_percent: 0,
    current_stage: 'Ready',
    logs: '',
    passed: false,
    error: null
  })
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [showExplanation, setShowExplanation] = useState(true)
  const scrollRef = useRef(null)
  const lastLogsRef = useRef('')

  // Trigger test run on open
  const startSecurityCheck = async () => {
    setIsRunning(true)
    try {
      const res = await fetch('/api/v1/system/security-check/run', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setStatusState(data)
      }
    } catch (err) {
      console.error('Error launching security check:', err)
    }
  }

  useEffect(() => {
    if (isOpen) {
      startSecurityCheck()
    }
  }, [isOpen])

  // Poll status while open & running
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/v1/system/security-check/status')
        if (res.ok && isMounted) {
          const data = await res.json()
          setStatusState(data)
          if (data.status === 'completed' || data.status === 'failed') {
            setIsRunning(false)
          }
        }
      } catch (err) {
        console.error('Error polling security check status:', err)
      }
    }

    const interval = setInterval(pollStatus, 800)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isOpen])

  // Auto-scroll terminal on new logs
  useEffect(() => {
    if (scrollRef.current && isOpen && statusState?.logs && statusState.logs !== lastLogsRef.current) {
      lastLogsRef.current = statusState.logs
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, statusState?.logs])

  if (!isOpen) return null

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(statusState.logs || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isCompleted = statusState.status === 'completed'
  const isFailed = statusState.status === 'failed'
  const inProgress = statusState.status === 'in_progress'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          maxWidth: '720px',
          width: '95vw',
          maxHeight: '90vh',
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
              background: isCompleted && statusState.passed
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : isFailed
                  ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: isCompleted && statusState.passed ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
            }}>
              {isCompleted && statusState.passed ? (
                <ShieldCheck size={22} />
              ) : isFailed ? (
                <AlertTriangle size={22} />
              ) : (
                <Shield size={22} />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                Security & Hardening Diagnostic Runner
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Automated test suite verifying 20 encryption, SSRF, authentication, and isolation boundaries
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

        {/* Modal Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Status & Progress Header Card */}
          <div style={{
            background: 'var(--bg-tertiary)',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {inProgress && <Loader2 size={16} className="animate-spin" style={{ color: '#818cf8' }} />}
                {isCompleted && statusState.passed && <CheckCircle2 size={16} style={{ color: '#34d399' }} />}
                {isFailed && <AlertTriangle size={16} style={{ color: '#f87171' }} />}
                <span style={{ fontWeight: '600', fontSize: '0.92rem', color: '#fff' }}>
                  {statusState.current_stage || 'Preparing security tests...'}
                </span>
              </div>

              <span style={{
                fontSize: '0.74rem',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                background: isCompleted && statusState.passed
                  ? 'rgba(16, 185, 129, 0.2)'
                  : isFailed
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(99, 102, 241, 0.2)',
                color: isCompleted && statusState.passed
                  ? '#34d399'
                  : isFailed
                    ? '#f87171'
                    : '#a5b4fc',
                border: `1px solid ${
                  isCompleted && statusState.passed
                    ? 'rgba(16, 185, 129, 0.4)'
                    : isFailed
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'rgba(99, 102, 241, 0.4)'
                }`
              }}>
                {inProgress ? `${statusState.progress_percent || 10}% IN PROGRESS` : isCompleted && statusState.passed ? 'PASSED (20/20 SUITES)' : 'FAILED'}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${statusState.progress_percent || (inProgress ? 25 : 0)}%`,
                height: '100%',
                borderRadius: '3px',
                background: isCompleted && statusState.passed
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : isFailed
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : 'linear-gradient(90deg, #4f46e5, #818cf8)',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Quick Badges of Boundaries Checked */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {[
                'Auth Enforcement',
                'Secret Redaction',
                'SSRF & IP Pinning',
                'AES-256 Fernet',
                'Atomic Rollback',
                'WAL Backup Check'
              ].map(badge => (
                <span
                  key={badge}
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8'
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Collapsible Explainer Callout */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.06)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#cbd5e1'
          }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                fontWeight: '600',
                color: '#a5b4fc'
              }}
              onClick={() => setShowExplanation(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={15} />
                <span>Why you will see "FATAL:" logs during a passing test</span>
              </div>
              {showExplanation ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </div>

            {showExplanation && (
              <p style={{ margin: '8px 0 0 0', lineHeight: 1.5, color: '#cbd5e1' }}>
                The security test suite deliberately injects simulated key tampering and database migration failures to verify that ZenGram <strong>fails closed</strong> and triggers an <strong>atomic rollback</strong>. When you see the two <code>FATAL:</code> log lines in the console below, that confirms the security defenses actively caught the simulated attacks as designed.
              </p>
            )}
          </div>

          {/* Terminal Console */}
          <div style={{
            background: '#060911',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                <Terminal size={14} />
                <span>Diagnostic Console Output</span>
              </div>

              <button
                type="button"
                onClick={handleCopyLogs}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem'
                }}
              >
                {copied ? <Check size={12} style={{ color: '#34d399' }} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy Logs'}</span>
              </button>
            </div>

            <div
              ref={scrollRef}
              style={{
                padding: '12px 14px',
                height: '220px',
                overflowY: 'auto',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.76rem',
                lineHeight: 1.5,
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              {statusState.logs ? (
                statusState.logs.split('\n').map((line, idx) => {
                  let lineStyle = { color: '#cbd5e1' }
                  if (line.includes('[SUCCESS]') || line.includes('All security') || line.includes('tests passed')) {
                    lineStyle = { color: '#34d399', fontWeight: 'bold' }
                  } else if (line.includes('[FAILURE]') || line.includes('AssertionError') || line.includes('Exception')) {
                    lineStyle = { color: '#f87171', fontWeight: 'bold' }
                  } else if (line.includes('FATAL:')) {
                    lineStyle = { color: '#fbbf24', fontWeight: 'bold' }
                  } else if (line.startsWith('[')) {
                    lineStyle = { color: '#94a3b8' }
                  }

                  return (
                    <div key={idx} style={lineStyle}>
                      {line}
                    </div>
                  )
                })
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Initializing test execution...</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
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
            onClick={startSecurityCheck}
            disabled={isRunning}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
            <span>{isRunning ? 'Running Check...' : 'Re-Run Security Check'}</span>
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
