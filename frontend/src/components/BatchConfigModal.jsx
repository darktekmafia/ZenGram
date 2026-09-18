import React, { useState } from 'react'
import {
  DownloadCloud,
  Layers,
  X,
  Sparkles,
  Zap,
  FolderDown,
  Info,
  CheckCircle2,
  Clock,
  Flame
} from 'lucide-react'

export default function BatchConfigModal({
  isOpen,
  onClose,
  username,
  defaultLimit = 0,
  onStartBatch
}) {
  const [selectedDepth, setSelectedDepth] = useState(defaultLimit !== undefined ? defaultLimit : 0)
  const [includeHighlights, setIncludeHighlights] = useState(false)
  const [customCategory, setCustomCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !username) return null

  const cleanUser = username.trim().replace(/^@+/, '')

  const DEPTH_OPTIONS = [
    {
      value: 0,
      title: 'Full Profile History (Uncapped Deep Scroll)',
      subtitle: 'Continuously scrolls and indexes all available timeline posts, reels, and active stories.',
      badge: 'Complete Archive',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeColor: '#fbbf24',
      badgeBorder: 'rgba(245, 158, 11, 0.35)',
      icon: Sparkles,
      iconColor: '#f59e0b'
    },
    {
      value: 500,
      title: 'Latest 500 Posts & Reels',
      subtitle: 'Deep scrolls up to 500 recent items across timeline grid and reels.',
      badge: '500 Items',
      badgeBg: 'rgba(99, 102, 241, 0.15)',
      badgeColor: '#a5b4fc',
      badgeBorder: 'rgba(99, 102, 241, 0.35)',
      icon: Layers,
      iconColor: '#818cf8'
    },
    {
      value: 200,
      title: 'Latest 200 Posts & Reels',
      subtitle: 'Standard batch archive size. Balanced speed and recent content scope.',
      badge: '200 Items',
      badgeBg: 'rgba(59, 130, 246, 0.15)',
      badgeColor: '#93c5fd',
      badgeBorder: 'rgba(59, 130, 246, 0.35)',
      icon: Zap,
      iconColor: '#60a5fa'
    },
    {
      value: 50,
      title: 'Latest 50 Posts & Reels',
      subtitle: 'Fast sync for the most recent posts and activity.',
      badge: 'Quick Sync',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeColor: '#6ee7b7',
      badgeBorder: 'rgba(16, 185, 129, 0.35)',
      icon: Clock,
      iconColor: '#34d399'
    }
  ]

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setIsSubmitting(true)
    try {
      await onStartBatch(cleanUser, selectedDepth, customCategory.trim() || cleanUser, includeHighlights)
      onClose()
    } catch (err) {
      console.error('Failed to trigger batch archive:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '580px',
          width: '100%',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                flexShrink: 0
              }}
            >
              <DownloadCloud size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Batch Archive <span style={{ color: '#818cf8' }}>@{cleanUser}</span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Choose discovery depth & download scope for this profile
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="modal-close"
            style={{
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px 24px' }}>
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '10px'
              }}
            >
              Select Scraping & Discovery Depth
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DEPTH_OPTIONS.map((opt) => {
                const isSelected = selectedDepth === opt.value
                const IconComponent = opt.icon
                return (
                  <div
                    key={opt.value}
                    onClick={() => setSelectedDepth(opt.value)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid #6366f1'
                        : '1px solid var(--border-color)',
                      backgroundColor: isSelected
                        ? 'rgba(99, 102, 241, 0.12)'
                        : 'var(--bg-tertiary)',
                      boxShadow: isSelected
                        ? '0 4px 14px rgba(99, 102, 241, 0.2)'
                        : 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: opt.iconColor,
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      <IconComponent size={18} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                          {opt.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: opt.badgeBg,
                            color: opt.badgeColor,
                            border: `1px solid ${opt.badgeBorder}`
                          }}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {opt.subtitle}
                      </p>
                    </div>

                    <div style={{ marginTop: '4px', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? '#6366f1' : 'transparent',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease-in-out'
                        }}
                      >
                        {isSelected && <CheckCircle2 size={13} style={{ strokeWidth: 3 }} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Story Highlights Toggle Card */}
          <div style={{ marginTop: '16px' }}>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '8px'
              }}
            >
              Additional Content Scope
            </label>

            <div
              onClick={() => setIncludeHighlights((prev) => !prev)}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: includeHighlights
                  ? '1px solid #f43f5e'
                  : '1px solid var(--border-color)',
                backgroundColor: includeHighlights
                  ? 'rgba(244, 63, 94, 0.12)'
                  : 'var(--bg-tertiary)',
                boxShadow: includeHighlights
                  ? '0 4px 14px rgba(244, 63, 94, 0.2)'
                  : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease-in-out'
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: includeHighlights ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: '#f43f5e',
                  flexShrink: 0
                }}
              >
                <Flame size={18} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: includeHighlights ? '#ffffff' : 'var(--text-main)' }}>
                    Include Permanent Story Highlights
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(244, 63, 94, 0.15)',
                      color: '#fb7185',
                      border: '1px solid rgba(244, 63, 94, 0.35)'
                    }}
                  >
                    Highlights Albums
                  </span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                  Scans and archives all permanent highlight story albums for @{cleanUser}. (If no highlights exist, batch safely continues without failing).
                </p>
              </div>

              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: includeHighlights ? '1px solid #f43f5e' : '1px solid var(--border-color)',
                    backgroundColor: includeHighlights ? '#f43f5e' : 'transparent',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease-in-out'
                  }}
                >
                  {includeHighlights && <CheckCircle2 size={13} style={{ strokeWidth: 3 }} />}
                </div>
              </div>
            </div>
          </div>

          {/* Folder / Category Tag */}
          <div style={{ marginTop: '16px' }}>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '6px'
              }}
            >
              Category Folder / Tag (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <FolderDown size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={cleanUser}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '36px',
                  margin: 0,
                  fontSize: '0.88rem'
                }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Subfolder under your media directory where this batch will be organized (defaults to <code>@{cleanUser}</code>).
            </p>
          </div>

          {/* Live Progress Info Box */}
          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <Info size={16} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.78rem', color: '#c7d2fe', lineHeight: 1.4 }}>
              Once started, the <strong>Live Console Terminal</strong> will open automatically to stream real-time scroll cycles, media ingestion, and parallel downloads.
            </span>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.86rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #9333ea 100%)',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
              }}
            >
              <DownloadCloud size={16} />
              <span>{isSubmitting ? 'Starting...' : 'Start Batch Archive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
