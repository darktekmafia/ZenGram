import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderDown,
  Layers,
  Loader2,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function HighlightViewerModal({
  highlight,
  username,
  onClose,
  onSaveMedia
}) {
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const [downloadingAlbum, setDownloadingAlbum] = useState(false)
  const [albumDownloadResult, setAlbumDownloadResult] = useState(null)
  const [savingSlide, setSavingSlide] = useState(false)

  const videoRef = useRef(null)

  // Fetch story items for this highlight album
  useEffect(() => {
    if (!highlight || !username) return
    let isMounted = true
    setLoading(true)
    setError(null)
    setCurrentIndex(0)

    const fetchMedia = async () => {
      try {
        const hlId = highlight.id || highlight.highlight_id
        const res = await fetch(`/api/v1/profiles/${encodeURIComponent(username)}/highlights/${encodeURIComponent(hlId)}/media`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setSlides(data || [])
            if (!data || data.length === 0) {
              setError('No stories found in this highlight album.')
            }
          }
        } else {
          if (isMounted) setError('Failed to load highlight stories from Instagram.')
        }
      } catch (err) {
        console.error('Error fetching highlight media:', err)
        if (isMounted) setError('Network error fetching highlight media.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchMedia()
    return () => {
      isMounted = false
    }
  }, [highlight, username])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, slides.length])

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleDownloadEntireAlbum = async () => {
    if (!highlight || !username || downloadingAlbum) return
    setDownloadingAlbum(true)
    setAlbumDownloadResult(null)
    try {
      const hlId = highlight.id || highlight.highlight_id
      const res = await fetch(`/api/v1/profiles/${encodeURIComponent(username)}/highlights/${encodeURIComponent(hlId)}/download`, {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        setAlbumDownloadResult({
          success: true,
          message: `Saved ${data.downloaded_count} stories to Highlights/${data.album_title || 'Album'}`
        })
      } else {
        const errData = await res.json().catch(() => ({}))
        setAlbumDownloadResult({
          success: false,
          message: errData.detail || 'Failed to download highlight album.'
        })
      }
    } catch (err) {
      console.error('Error downloading highlight album:', err)
      setAlbumDownloadResult({
        success: false,
        message: 'Network error downloading album.'
      })
    } finally {
      setDownloadingAlbum(false)
    }
  }

  const handleSaveCurrentSlide = async () => {
    const current = slides[currentIndex]
    if (!current || savingSlide) return
    setSavingSlide(true)
    try {
      if (onSaveMedia) {
        await onSaveMedia(current)
      } else {
        // Direct save call
        await fetch('/api/v1/downloads/save-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: current.post_id,
            category_tag: `Highlights/${highlight.title || 'Album'}`
          })
        })
      }
      setAlbumDownloadResult({
        success: true,
        message: `Slide saved locally!`
      })
    } catch (err) {
      console.error('Error saving slide:', err)
    } finally {
      setSavingSlide(false)
      setTimeout(() => setAlbumDownloadResult(null), 3000)
    }
  }

  if (!highlight) return null

  const currentSlide = slides[currentIndex]
  const albumTitle = highlight.title || 'Highlights'

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div
        className="highlight-viewer-modal"
        style={{
          background: 'rgba(11, 17, 33, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '560px',
          height: '88vh',
          maxHeight: '820px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
          position: 'relative'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                padding: '2px',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {highlight.cover_url ? (
                  <img
                    src={`/api/v1/image-proxy?url=${encodeURIComponent(highlight.cover_url)}`}
                    alt={albumTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Layers size={16} style={{ color: '#fff' }} />
                )}
              </div>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontWeight: '700',
                  fontSize: '0.92rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#fff'
                }}
              >
                {albumTitle}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                @{username} • {slides.length > 0 ? `Slide ${currentIndex + 1} of ${slides.length}` : 'Loading...'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleDownloadEntireAlbum}
              disabled={downloadingAlbum || slides.length === 0}
              title="Download entire highlight reel to disk"
            >
              {downloadingAlbum ? <Loader2 size={13} className="animate-spin" /> : <FolderDown size={13} />}
              <span>{downloadingAlbum ? 'Saving Reel...' : 'Download Album'}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px', borderRadius: '8px' }}
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Story Progress Bar Segments */}
        {slides.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '8px 16px 4px 16px',
              background: 'rgba(0,0,0,0.4)'
            }}
          >
            {slides.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  flex: 1,
                  height: '3px',
                  borderRadius: '2px',
                  background: idx === currentIndex
                    ? '#3b82f6'
                    : idx < currentIndex
                    ? 'rgba(255, 255, 255, 0.7)'
                    : 'rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              />
            ))}
          </div>
        )}

        {/* Feedback Alert if available */}
        {albumDownloadResult && (
          <div
            style={{
              padding: '8px 16px',
              background: albumDownloadResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderBottom: `1px solid ${albumDownloadResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: albumDownloadResult.success ? '#6ee7b7' : '#fca5a5',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {albumDownloadResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{albumDownloadResult.message}</span>
          </div>
        )}

        {/* Main Story Content Viewer */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070b14',
            overflow: 'hidden'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <span style={{ fontSize: '0.88rem' }}>Loading highlight stories...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#f87171' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 10px auto' }} />
              <p style={{ fontSize: '0.9rem' }}>{error}</p>
            </div>
          ) : currentSlide ? (
            <>
              {currentSlide.media_type === 'VIDEO' && currentSlide.video_url ? (
                <video
                  ref={videoRef}
                  key={currentSlide.post_id}
                  src={currentSlide.video_url}
                  autoPlay
                  controls
                  playsInline
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <img
                  key={currentSlide.post_id}
                  src={
                    currentSlide.display_url?.startsWith('http')
                      ? `/api/v1/image-proxy?url=${encodeURIComponent(currentSlide.display_url)}`
                      : currentSlide.display_url
                  }
                  alt={currentSlide.caption || albumTitle}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}

              {/* Left & Right Clickable Overlays */}
              <div
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '25%',
                  cursor: currentIndex > 0 ? 'pointer' : 'default',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '10px'
                }}
              >
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrev()
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
              </div>

              <div
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '25%',
                  cursor: currentIndex < slides.length - 1 ? 'pointer' : 'default',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '10px'
                }}
              >
                {currentIndex < slides.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNext()
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Bottom Footer Controls & Caption */}
        {currentSlide && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {currentSlide.caption && (
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    margin: '0 0 4px 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentSlide.caption}
                </p>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={11} />
                  {currentSlide.taken_at ? new Date(currentSlide.taken_at).toLocaleDateString() : 'Story'}
                </span>
                <span>•</span>
                <span>{currentSlide.media_type === 'VIDEO' ? '🎥 Video Story' : '📷 Photo Story'}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#60a5fa',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                flexShrink: 0
              }}
              onClick={handleSaveCurrentSlide}
              disabled={savingSlide}
              title="Save this specific story slide"
            >
              {savingSlide ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span>{savingSlide ? 'Saving...' : 'Save Slide'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
