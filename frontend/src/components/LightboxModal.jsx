import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Check,
  Heart,
  MessageCircle,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Trash2,
  FileArchive,
  Loader2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward
} from 'lucide-react'

export default function LightboxModal({
  item,
  initialSlideIndex = 0,
  feedItems = [],
  onClose,
  onSaveMedia,
  onDeleteMedia,
  onNavigatePost
}) {
  const [activeSlide, setActiveSlide] = useState(initialSlideIndex)
  const [loadedSlides, setLoadedSlides] = useState((item && item.carousel_media && item.carousel_media.length > 0) ? item.carousel_media : null)
  const [loadingSlides, setLoadingSlides] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [videoPlaying, setVideoPlaying] = useState(true)
  const [videoMuted, setVideoMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const videoRef = useRef(null)
  const containerRef = useRef(null)

  // Sync state when incoming post item changes
  useEffect(() => {
    if (!item) return
    setActiveSlide(initialSlideIndex || 0)
    setZoomLevel(1)
    setPanPosition({ x: 0, y: 0 })
    if (item.carousel_media && item.carousel_media.length > 0) {
      setLoadedSlides(item.carousel_media)
    } else {
      setLoadedSlides(null)
    }
  }, [item, initialSlideIndex])

  const totalSlides = loadedSlides ? loadedSlides.length : (item?.carousel_media ? item.carousel_media.length : 1)
  const isCarousel = (item?.media_type === 'CAROUSEL') || totalSlides > 1
  const slides = loadedSlides || item?.carousel_media || null
  const currentSlide = slides ? slides[activeSlide] : null

  const isCurrentVideo = (item?.media_type === 'VIDEO' && (!slides || slides.length <= 1)) ||
                         (currentSlide && currentSlide.media_type === 'VIDEO') ||
                         (currentSlide && currentSlide.video_url) ||
                         (item?.video_url && (!slides || slides.length <= 1))

  // Fetch carousel slides on demand if needed
  const fetchCarouselSlides = async () => {
    if (!item || loadingSlides || (loadedSlides && loadedSlides.length > 1)) return loadedSlides
    setLoadingSlides(true)
    try {
      const rawCode = (item.shortcode || item.post_id || '').replace(/^ig_/, '')
      const code = rawCode.length >= 11 ? rawCode.slice(0, 11) : rawCode
      const res = await fetch(`/api/v1/feed/carousel/${encodeURIComponent(code)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.slides && data.slides.length > 0) {
          setLoadedSlides(data.slides)
          return data.slides
        }
      }
    } catch (err) {
      console.error('Error loading carousel slides in Lightbox:', err)
    } finally {
      setLoadingSlides(false)
    }
    return null
  }

  // Auto-fetch carousel slides if opening a carousel post
  useEffect(() => {
    if (isCarousel && (!loadedSlides || loadedSlides.length <= 1) && !item?.is_saved) {
      fetchCarouselSlides()
    }
  }, [item?.post_id, isCarousel])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isCarousel && totalSlides > 1) {
          handleNextSlide()
        } else if (onNavigatePost) {
          onNavigatePost(1)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isCarousel && totalSlides > 1) {
          handlePrevSlide()
        } else if (onNavigatePost) {
          onNavigatePost(-1)
        }
      } else if (e.key === ']' || (e.shiftKey && e.key === 'ArrowRight')) {
        e.preventDefault()
        if (onNavigatePost) onNavigatePost(1)
      } else if (e.key === '[' || (e.shiftKey && e.key === 'ArrowLeft')) {
        e.preventDefault()
        if (onNavigatePost) onNavigatePost(-1)
      } else if (e.key === ' ' && isCurrentVideo) {
        e.preventDefault()
        toggleVideoPlay()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        handleZoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        handleZoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        handleZoomReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSlide, totalSlides, isCarousel, isCurrentVideo, zoomLevel, onNavigatePost])

  if (!item) return null

  const handlePrevSlide = async (e) => {
    if (e) e.stopPropagation()
    setZoomLevel(1)
    setPanPosition({ x: 0, y: 0 })
    if (!slides || slides.length <= 1) {
      const fetched = await fetchCarouselSlides()
      if (fetched && fetched.length > 1) {
        setActiveSlide(fetched.length - 1)
      }
      return
    }
    setActiveSlide((prev) => (prev > 0 ? prev - 1 : totalSlides - 1))
  }

  const handleNextSlide = async (e) => {
    if (e) e.stopPropagation()
    setZoomLevel(1)
    setPanPosition({ x: 0, y: 0 })
    if (!slides || slides.length <= 1) {
      const fetched = await fetchCarouselSlides()
      if (fetched && fetched.length > 1) {
        setActiveSlide(1)
      }
      return
    }
    setActiveSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : 0))
  }

  // Zoom and Pan Handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.75, 3.0))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.75, 1.0)
      if (next === 1.0) setPanPosition({ x: 0, y: 0 })
      return next
    })
  }

  const handleZoomReset = () => {
    setZoomLevel(1)
    setPanPosition({ x: 0, y: 0 })
  }

  const handleImageDoubleClick = () => {
    if (zoomLevel === 1) {
      setZoomLevel(2.0)
    } else {
      handleZoomReset()
    }
  }

  const handleMouseDown = (e) => {
    if (zoomLevel <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Media Source Resolvers
  const getVideoSrc = () => {
    if (item.is_saved) {
      if (currentSlide && currentSlide.view_url) {
        return currentSlide.view_url
      }
      return `/api/v1/downloads/view/${item.post_id}?index=${activeSlide + 1}`
    }
    if (currentSlide) {
      if (currentSlide.video_url && (currentSlide.video_url.includes('.mp4') || currentSlide.video_url.startsWith('http'))) {
        return currentSlide.video_url
      }
      if (currentSlide.url && (currentSlide.url.includes('.mp4') || currentSlide.media_type === 'VIDEO')) {
        return currentSlide.url
      }
    }
    if (item.video_url && (item.video_url.includes('.mp4') || item.video_url.startsWith('http'))) {
      return item.video_url
    }
    return null
  }

  const getSlideSrc = () => {
    let rawUrl = null
    if (item.is_saved) {
      if (currentSlide && currentSlide.view_url) {
        return currentSlide.view_url
      }
      return `/api/v1/downloads/view/${item.post_id}?index=${activeSlide + 1}`
    }
    if (currentSlide) {
      rawUrl = currentSlide.display_url || currentSlide.thumbnail_url || currentSlide.url || item.display_url || item.thumbnail_url
    } else {
      rawUrl = item.display_url || item.thumbnail_url
    }

    if (!rawUrl) return null
    if (rawUrl.startsWith('/api/v1/proxy/image') || rawUrl.startsWith('/api/v1/image-proxy')) {
      return rawUrl
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      if (rawUrl.includes('fbcdn.net') || rawUrl.includes('instagram.com') || rawUrl.includes('cdninstagram.com')) {
        return `/api/v1/proxy/image?url=${encodeURIComponent(rawUrl)}`
      }
    }
    return rawUrl
  }

  const toggleVideoPlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setVideoPlaying(true)
    } else {
      videoRef.current.pause()
      setVideoPlaying(false)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const newMuted = !videoRef.current.muted
    videoRef.current.muted = newMuted
    setVideoMuted(newMuted)
  }

  const handleSpeedChange = (speed) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = speed
    setPlaybackSpeed(speed)
  }

  const handleSave = async () => {
    if (saving || item.is_saved) return
    setSaving(true)
    await onSaveMedia(item.post_id)
    setSaving(false)
  }

  const getOriginalUrl = () => {
    const code = item.shortcode || item.post_id.replace('ig_', '')
    const canonical = code.length >= 11 ? code.slice(0, 11) : code
    if (item.media_type === 'STORY') {
      return `https://www.instagram.com/stories/${item.username}/`
    }
    if (item.media_type === 'VIDEO') {
      return `https://www.instagram.com/reel/${canonical}/`
    }
    return `https://www.instagram.com/p/${canonical}/`
  }

  const playableVideo = getVideoSrc()
  const imageSrc = getSlideSrc()
  const activeSaveUrl = item.is_saved
    ? `/api/v1/downloads/file/${item.post_id}?index=${activeSlide + 1}`
    : `/api/v1/downloads/file/${item.post_id}`

  const currentIndexInFeed = feedItems.findIndex((f) => f.post_id === item.post_id)
  const hasPrevPost = currentIndexInFeed > 0
  const hasNextPost = currentIndexInFeed >= 0 && currentIndexInFeed < feedItems.length - 1

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()} ref={containerRef}>
        
        {/* Main Media Canvas (Left/Center) */}
        <div
          className="lightbox-media-area"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Top Canvas Controls Bar */}
          <div className="lightbox-canvas-toolbar">
            <div className="lightbox-canvas-pill">
              {isCarousel ? (
                <span>
                  <Layers size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                  Slide {activeSlide + 1} of {totalSlides}
                </span>
              ) : isCurrentVideo ? (
                <span>Video Post</span>
              ) : (
                <span>Photo Post</span>
              )}
            </div>

            {!isCurrentVideo && (
              <div className="lightbox-zoom-controls">
                <button
                  type="button"
                  className="lightbox-icon-btn"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={16} />
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  className="lightbox-icon-btn"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={16} />
                </button>
                {zoomLevel > 1 && (
                  <button
                    type="button"
                    className="lightbox-icon-btn"
                    onClick={handleZoomReset}
                    title="Reset Zoom (0)"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Media Player / Image Display */}
          <div className="lightbox-canvas-viewport">
            {loadingSlides ? (
              <div className="lightbox-loader-container">
                <Loader2 size={36} className="animate-spin text-blue-400" />
                <span>Loading slides...</span>
              </div>
            ) : isCurrentVideo && playableVideo ? (
              <div className="lightbox-video-wrapper">
                <video
                  ref={videoRef}
                  key={`lb_vid_${item.post_id}_${activeSlide}_${playableVideo}`}
                  src={playableVideo}
                  poster={imageSrc || undefined}
                  autoPlay
                  controls
                  playsInline
                  className="lightbox-media-element"
                  onLoadedMetadata={(e) => {
                    e.target.volume = 0.35
                    e.target.playbackRate = playbackSpeed
                  }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                />
              </div>
            ) : (
              <img
                key={`lb_img_${item.post_id}_${activeSlide}_${imageSrc}`}
                src={imageSrc}
                alt={item.caption || `Post media ${activeSlide + 1}`}
                className="lightbox-media-element"
                onDoubleClick={handleImageDoubleClick}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Carousel Slide Navigation Arrows */}
          {isCarousel && totalSlides > 1 && (
            <>
              <button
                type="button"
                className="lightbox-slide-arrow left"
                onClick={handlePrevSlide}
                title="Previous slide (Left Arrow)"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="lightbox-slide-arrow right"
                onClick={handleNextSlide}
                title="Next slide (Right Arrow)"
              >
                <ChevronRight size={28} />
              </button>

              {/* Bottom Carousel Segment Indicators */}
              <div className="lightbox-slide-dots">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`lightbox-dot ${idx === activeSlide ? 'active' : ''}`}
                    onClick={() => {
                      setZoomLevel(1)
                      setPanPosition({ x: 0, y: 0 })
                      setActiveSlide(idx)
                    }}
                    title={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Post-to-Post Quick Nav Rail */}
          {onNavigatePost && (
            <div className="lightbox-post-nav-rail">
              {hasPrevPost && (
                <button
                  type="button"
                  className="lightbox-post-nav-btn left"
                  onClick={() => onNavigatePost(-1)}
                  title="Previous Post ([ or Shift+Left)"
                >
                  <SkipBack size={16} />
                  <span>Prev Post</span>
                </button>
              )}
              {hasNextPost && (
                <button
                  type="button"
                  className="lightbox-post-nav-btn right"
                  onClick={() => onNavigatePost(1)}
                  title="Next Post (] or Shift+Right)"
                >
                  <span>Next Post</span>
                  <SkipForward size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right-Side Metadata & Action Drawer */}
        <div className="lightbox-sidebar">
          {/* Header & Close */}
          <div className="lightbox-sidebar-header">
            <a
              href={`https://www.instagram.com/${item.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-user-link"
              title={`View @${item.username} on Instagram`}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${item.username}&background=232936&color=fff`}
                alt={item.username}
                className="lightbox-avatar"
              />
              <div className="lightbox-user-meta">
                <span className="lightbox-username">@{item.username}</span>
                <span className="lightbox-post-date">
                  <Calendar size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                  {item.taken_at ? new Date(item.taken_at).toLocaleString() : 'Recent Post'}
                </span>
              </div>
            </a>

            <button
              type="button"
              className="lightbox-close-btn"
              onClick={onClose}
              title="Close Lightbox (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Caption & Scrollable Body */}
          <div className="lightbox-sidebar-body">
            {item.caption ? (
              <div className="lightbox-caption-box">
                <p className="lightbox-caption-text">{item.caption}</p>
              </div>
            ) : (
              <div className="lightbox-caption-empty">
                <em>No caption provided for this post.</em>
              </div>
            )}

            {/* Engagement Stats */}
            <div className="lightbox-stats-row">
              <div className="lightbox-stat-badge">
                <Heart size={14} style={{ color: '#f43f5e' }} />
                <span>{item.likes_count?.toLocaleString() || 0} Likes</span>
              </div>
              <div className="lightbox-stat-badge">
                <MessageCircle size={14} style={{ color: '#38bdf8' }} />
                <span>{item.comments_count?.toLocaleString() || 0} Comments</span>
              </div>
            </div>

            {/* Post Details Card */}
            <div className="lightbox-info-card">
              <div className="lightbox-info-row">
                <span className="lightbox-info-label">Type</span>
                <span className="lightbox-info-val">
                  {item.media_type === 'CAROUSEL'
                    ? `Carousel (${totalSlides} Slides)`
                    : item.media_type === 'VIDEO'
                    ? 'Video / Reel'
                    : item.media_type === 'STORY'
                    ? 'Story'
                    : 'Photo'}
                </span>
              </div>
              <div className="lightbox-info-row">
                <span className="lightbox-info-label">Shortcode</span>
                <span className="lightbox-info-val" style={{ fontFamily: 'monospace' }}>
                  {item.shortcode ? (item.shortcode.length >= 11 ? item.shortcode.slice(0, 11) : item.shortcode) : '—'}
                </span>
              </div>
              <div className="lightbox-info-row">
                <span className="lightbox-info-label">Status</span>
                <span className={`lightbox-info-val ${item.is_saved ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {item.is_saved ? 'Archived Locally' : 'Available in Feed'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar Footer */}
          <div className="lightbox-sidebar-footer">
            {item.is_saved ? (
              <>
                <div className="lightbox-saved-status">
                  <Check size={15} /> Archived to Storage ({totalSlides} {totalSlides > 1 ? 'Files' : 'File'})
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <a
                    href={activeSaveUrl}
                    download
                    className="btn-primary"
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center', fontSize: '0.82rem', padding: '9px 12px' }}
                    title="Save current slide file to your device"
                  >
                    <Download size={14} /> {totalSlides > 1 ? `Save Slide #${activeSlide + 1}` : 'Save to Device'}
                  </a>
                  {totalSlides > 1 && (
                    <a
                      href={`/api/v1/downloads/zip/${item.post_id}`}
                      download
                      className="btn-secondary"
                      style={{ fontSize: '0.82rem', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Download full carousel ZIP"
                    >
                      <FileArchive size={14} /> ZIP
                    </a>
                  )}
                </div>

                {onDeleteMedia && (
                  <button
                    type="button"
                    onClick={() => onDeleteMedia(item.post_id, totalSlides > 1 ? activeSlide + 1 : null)}
                    className="btn-action-delete"
                    style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
                    title="Delete local file from storage"
                  >
                    <Trash2 size={14} /> Delete {totalSlides > 1 ? `Slide #${activeSlide + 1}` : 'File'}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
                title="Archive media permanently to local ZenGram storage"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{saving ? 'Archiving to Server...' : 'Save to ZenGram'}</span>
              </button>
            )}

            <a
              href={getOriginalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: '0.8rem' }}
              title="Open post directly on Instagram in a new tab"
            >
              <ExternalLink size={13} style={{ marginRight: '5px' }} />
              View on Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
