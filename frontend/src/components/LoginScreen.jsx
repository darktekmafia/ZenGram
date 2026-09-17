import React, { useState, useEffect } from 'react'
import { Download, Lock, Key, ShieldCheck, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Loader2, User, Info } from 'lucide-react'

export default function LoginScreen({ isSetupRequired, onSuccess }) {
  const [setupMode, setSetupMode] = useState(!!isSetupRequired)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    setSetupMode(!!isSetupRequired)
  }, [isSetupRequired])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (setupMode) {
      if (!password || password.length < 6) {
        setError('Master password must be at least 6 characters long.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.')
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/v1/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim() || 'admin',
            password
          })
        })
        const data = await res.json()
        if (res.ok) {
          setSuccessMsg('Master password configured! Unlocking...')
          setTimeout(() => {
            onSuccess()
          }, 600)
        } else {
          setError(data.detail || 'Failed to initialize master password.')
        }
      } catch (err) {
        setError('Network error connecting to InstaSave server.')
      } finally {
        setLoading(false)
      }
    } else {
      if (!password) {
        setError('Please enter your password.')
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim() || 'admin',
            password,
            remember_me: rememberMe
          })
        })
        const data = await res.json()
        if (res.ok) {
          setSuccessMsg('Authenticated! Entering dashboard...')
          setTimeout(() => {
            onSuccess()
          }, 400)
        } else {
          // If server says setup required, automatically switch to setup mode
          if (data.detail && data.detail.includes('setup required')) {
            setSetupMode(true)
            setError('No master password set yet. Please confirm your password below to complete initial setup.')
          } else {
            setError(data.detail || 'Invalid username or password.')
          }
        }
      } catch (err) {
        setError('Network error connecting to InstaSave server.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0b0f17 80%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background ambient lighting glows */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.12) 0%, rgba(139, 92, 246, 0.04) 50%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      <div
        className="modal-content"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px 32px',
          borderRadius: '20px',
          background: 'rgba(23, 27, 38, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.1)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
            }}
          >
            <Download size={28} />
          </div>

          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            InstaSave
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {setupMode
              ? 'First-Time Setup: Create your master administrator password'
              : 'Direct & Remote Access Protected'}
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px',
              animation: 'accordionFadeIn 0.2s ease'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px'
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Admin Username
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}>
                <User size={16} />
              </div>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                style={{ paddingLeft: '38px', margin: 0, width: '100%' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              {setupMode ? 'Create Master Password' : 'Password'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}>
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={setupMode ? 'Minimum 6 characters' : 'Enter master password'}
                style={{ paddingLeft: '38px', paddingRight: '40px', margin: 0, width: '100%' }}
                autoFocus
                required
              />
              <button
                type="button"
                className="settings-input-action"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {setupMode && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Confirm Master Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{ paddingLeft: '38px', margin: 0, width: '100%' }}
                  required
                />
              </div>
            </div>
          )}

          {!setupMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                Remember login (30 days)
              </label>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              fontWeight: 700,
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              boxShadow: '0 4px 18px rgba(59, 130, 246, 0.4)'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{setupMode ? 'Configuring Security...' : 'Authenticating...'}</span>
              </>
            ) : (
              <>
                <span>{setupMode ? 'Create Master Password' : 'Unlock InstaSave'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Badge */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)'
          }}
        >
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Secured with Bcrypt & HttpOnly Session Cookies</span>
        </div>
      </div>
    </div>
  )
}
