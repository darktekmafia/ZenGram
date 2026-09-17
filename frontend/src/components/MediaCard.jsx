import React, { useState, useEffect } from 'react'
import { Download, ExternalLink, Check, Image as ImageIcon, Video, Layers, Flame, Heart, MessageCircle, Trash2, ChevronLeft, ChevronRight, FileArchive, Loader2, Play } from 'lucide-react'

export default function MediaCard({ item, onSaveMedia, onDeleteMedia }) {
  const [saving, setSaving] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [isPlayingVideo, setIsPlayingVideo] = useState(false)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [loadedSlides, setLoadedSlides] = useState((item.carousel_media && item.carousel_media.length > 0) ? item.carousel_media : null)
  const [loadingSlides, setLoadingSlides] = useState(false)

  useEffect(() => {
    if (item.carousel_media && item.carousel_media.length > 0) {
      setLoadedSlides(item.carousel_media)
    }
  }, [item.carousel_media])

  const totalSlides = loadedSlides ? loadedSlides.length : (item.carousel_media ? item.carousel_media.length : 1)
  const isCarousel = item.media_type === 'CAROUSEL' || totalSlides > 1
  const slides = loadedSlides || item.carousel_media || null
  const currentSlide = slides ? slides[activeSlide] : null

  // Check if current view is a video
  const isPostVideo = (item.media_type === 'VIDEO') || 
                      (currentSlide && currentSlide.media_type === 'VIDEO') || 
                      (item.video_url && item.video_url.length > 0)

  const fetchCarouselSlides = async () => {
    if (loadingSlides || (loadedSlides && loadedSlides.length > 1)) return loadedSlides
    setLoadingSlides(true)
    try {
      const code = item.shortcode || item.post_id
      const res = await fetch(`/api/v1/feed/carousel/${code}`)
      if (res.ok) {
        const data = await res.json()
        if (data.slides && data.slides.length > 0) {
          setLoadedSlides(data.slides)
          return data.slides
        }
      }
    } catch (err) {
      console.error('Error fetching carousel slides:', err)
    } finally {
      setLoadingSlides(false)
    }
    return null
  }

  useEffect(() => {
    setVideoError(false)
    setIsPlayingVideo(false)
  }, [activeSlide])

  const handleCardMouseEnter = () => {
    if (item.media_type !== 'STORY' && (!loadedSlides || loadedSlides.length <= 1) && !item.is_saved) {
      fetchCarouselSlides()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSaveMedia(item.post_id)
    setSaving(false)
  }

  const handlePrevSlide = async (e) => {
    e.stopPropagation()
    setVideoError(false)
    setIsPlayingVideo(false)
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
    e.stopPropagation()
    setVideoError(false)
    setIsPlayingVideo(false)
    if (!slides || slides.length <= 1) {
      const fetched = await fetchCarouselSlides()
      if (fetched && fetched.length > 1) {
        setActiveSlide(1)
      }
      return
    }
    setActiveSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : 0))
  }

  const getMediaBadge = () => {
    if (item.media_type === 'STORY') {
      return (
        <span className="badge-media-type badge-story">
          <Flame size={12} /> Story
        </span>
      )
    }
    if (isCarousel && totalSlides > 1) {
      return (
        <span className="badge-media-type">
          <Layers size={12} /> Carousel ({totalSlides} Items)
        </span>
      )
    }
    if (isPostVideo) {
      return (
        <span className="badge-media-type">
          <Video size={12} /> Video
        </span>
      )
    }
    if (item.media_type === 'CAROUSEL') {
      return (
        <span className="badge-media-type">
          <Layers size={12} /> Carousel
        </span>
      )
    }
    return (
      <span className="badge-media-type">
        <ImageIcon size={12} /> Photo
      </span>
    )
  }

  const getOriginalUrl = () => {
    if (item.media_type === 'STORY') {
      return `https://www.instagram.com/stories/${item.username}/`
    }
    if (item.media_type === 'VIDEO') {
      return `https://www.instagram.com/reel/${item.shortcode}/`
    }
    return `https://www.instagram.com/p/${item.shortcode}/`
  }

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
    // If it is a video, return the image thumbnail URL (never an MP4 video file path)
    if (isPostVideo) {
      if (currentSlide && (currentSlide.thumbnail_url || currentSlide.display_url)) {
        return currentSlide.thumbnail_url || currentSlide.display_url
      }
      return item.thumbnail_url || item.display_url
    }

    if (item.is_saved) {
      if (currentSlide && currentSlide.view_url) {
        return currentSlide.view_url
      }
      return `/api/v1/downloads/view/${item.post_id}?index=${activeSlide + 1}`
    }
    if (currentSlide) {
      return currentSlide.thumbnail_url || currentSlide.display_url || currentSlide.url || item.thumbnail_url || item.display_url
    }
    return item.thumbnail_url || item.display_url
  }

  const handlePlayVideo = async (e) => {
    if (e) e.stopPropagation()
    setVideoError(false)
    const currentVideo = getVideoSrc()
    if (currentVideo) {
      setIsPlayingVideo(true)
      return
    }

    setLoadingVideo(true)
    try {
      const code = item.shortcode || item.post_id
      const res = await fetch(`/api/v1/feed/carousel/${code}`)
      if (res.ok) {
        const data = await res.json()
        if (data.slides && data.slides.length > 0) {
          setLoadedSlides(data.slides)
          setIsPlayingVideo(true)
        }
      }
    } catch (err) {
      console.error('Failed to load video stream:', err)
    } finally {
      setLoadingVideo(false)
    }
  }

  const playableVideo = getVideoSrc()
  const activeSaveUrl = item.is_saved 
    ? `/api/v1/downloads/file/${item.post_id}?index=${activeSlide + 1}`
    : `/api/v1/downloads/file/${item.post_id}`

  return (
    <div className="media-card" onMouseEnter={handleCardMouseEnter}>
      <div className="card-header">
        <a
          href={`https://www.instagram.com/${item.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="card-user-info"
          style={{ textDecoration: 'none', color: 'inherit' }}
          title={`Open @${item.username} on instagram.com`}
        >
          <img
            src={`https://ui-avatars.com/api/?name=${item.username}&background=232936&color=fff`}
            alt={item.username}
            className="card-avatar"
          />
          <span className="card-username" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            @{item.username}
            <ExternalLink size={11} style={{ opacity: 0.6 }} />
          </span>
        </a>
        <span className="card-date">
          {item.taken_at ? new Date(item.taken_at).toLocaleDateString() : 'Recent'}
        </span>
      </div>

      <div className="card-preview" style={{ position: 'relative' }}>
        {isPlayingVideo && playableVideo && !videoError ? (
          <video
            key={`vid_playing_${item.post_id}_${activeSlide}_${playableVideo}`}
            src={playableVideo}
            poster={getSlideSrc() || undefined}
            controls
            autoPlay
            muted
            playsInline
            className="card-img"
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            onLoadedMetadata={(e) => {
              // Set default volume to low (20%) for comfort when user unmutes
              e.target.volume = 0.20
            }}
            onError={() => {
              setVideoError(true)
              setIsPlayingVideo(false)
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {isPostVideo && playableVideo ? (
              <video
                key={`vid_thumb_${item.post_id}_${activeSlide}_${playableVideo}`}
                src={`${playableVideo}#t=0.001`}
                poster={getSlideSrc() || undefined}
                preload="metadata"
                muted
                playsInline
                className="card-img"
                style={{ objectFit: 'cover', width: '100%', height: '100%', pointerEvents: 'none' }}
              />
            ) : (
              <img
                key={`img_${item.post_id}_${activeSlide}_${getSlideSrc()}`}
                src={getSlideSrc()}
                alt={`Media slide ${activeSlide + 1}`}
                className="card-img"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const fallback = getSlideSrc() || item.display_url
                  if (fallback && !e.target.dataset.triedProxy) {
                    e.target.dataset.triedProxy = 'true'
                    e.target.src = `/api/v1/proxy/image?url=${encodeURIComponent(fallback)}`
                  }
                }}
              />
            )}
            {isPostVideo && (
              <button
                onClick={handlePlayVideo}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                  borderRadius: '50%',
                  width: '52px',
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                  zIndex: 8,
                  transition: 'transform 0.2s, background 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)'
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.0)'
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)'
                }}
                title="Click to play video"
              >
                {loadingVideo || loadingSlides ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Play fill="white" size={24} style={{ marginLeft: '3px' }} />
                )}
              </button>
            )}
          </div>
        )}

        {getMediaBadge()}

        {isCarousel && (
          <>
            <button
              onClick={handlePrevSlide}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
                transition: 'background 0.2s, transform 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
              }}
              title={totalSlides > 1 ? "Previous slide" : "Load carousel slides"}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextSlide}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
                transition: 'background 0.2s, transform 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
              }}
              title={totalSlides > 1 ? "Next slide" : "Load carousel slides"}
            >
              <ChevronRight size={18} />
            </button>
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.75)',
                color: '#fff',
                fontSize: '0.72rem',
                padding: '3px 10px',
                borderRadius: '12px',
                fontWeight: 600,
                letterSpacing: '0.5px',
                pointerEvents: 'none',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
            >
              {loadingSlides ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Loader2 size={12} className="animate-spin" /> Loading slides...
                </span>
              ) : totalSlides > 1 ? (
                <span>Slide {activeSlide + 1} of {totalSlides}</span>
              ) : (
                <span>Multi-slide Carousel</span>
              )}
            </div>
          </>
        )}
      </div>

      {item.caption && (
        <p className="card-caption" title={item.caption}>
          {item.caption}
        </p>
      )}

      <div className="card-stats">
        <span className="stat-item">
          <Heart size={13} /> {item.likes_count}
        </span>
        <span className="stat-item">
          <MessageCircle size={13} /> {item.comments_count}
        </span>
      </div>

      <div className="card-actions" style={{ flexDirection: 'column', gap: '6px' }}>
        {item.is_saved ? (
          <>
            <div className="saved-status-badge">
              <Check size={14} /> Archived Locally ({totalSlides} {totalSlides > 1 ? 'Files' : 'File'})
            </div>
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <a
                href={activeSaveUrl}
                download
                className="btn-action-client-download"
                style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                title={`Download file #${activeSlide + 1} to your device`}
              >
                <Download size={13} /> {totalSlides > 1 ? `Save Slide #${activeSlide + 1}` : 'Save to Device'}
              </a>
              {totalSlides > 1 && (
                <a
                  href={`/api/v1/downloads/zip/${item.post_id}`}
                  download
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  title="Download all media files in this carousel post as a .zip archive"
                >
                  <FileArchive size={13} /> Save All (.zip)
                </a>
              )}
            </div>
            {onDeleteMedia && (
              <button
                onClick={() => onDeleteMedia(item.post_id, totalSlides > 1 ? activeSlide + 1 : null)}
                className="btn-action-delete"
                style={{ width: '100%' }}
                title="Delete files for this post from server storage"
              >
                <Trash2 size={13} /> Delete {totalSlides > 1 ? `Slide #${activeSlide + 1}` : 'File'}
              </button>
            )}
          </>
        ) : (
          <button className="btn-action-save" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
            <Download size={14} />
            <span>{saving ? 'Saving...' : 'Save Media'}</span>
          </button>
        )}

        <a
          href={getOriginalUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-action-view"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <ExternalLink size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          View Original
        </a>
      </div>
    </div>
  )
}
