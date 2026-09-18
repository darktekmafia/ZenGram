import React, { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, Layers } from 'lucide-react'

export default function HighlightsTray({
  username,
  onSelectHighlight,
  onHighlightsLoaded
}) {
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchHighlights = async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/profiles/${encodeURIComponent(username)}/highlights`)
      if (res.ok) {
        const data = await res.json()
        setHighlights(data || [])
        if (onHighlightsLoaded) {
          onHighlightsLoaded(data || [])
        }
      } else {
        setError('Failed to load highlights')
      }
    } catch (err) {
      console.error('Error fetching highlights:', err)
      setError('Network error loading highlights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHighlights()
  }, [username])

  if (!username) return null

  // If loading and no highlights yet, show shimmer skeletons
  if (loading && highlights.length === 0) {
    return (
      <div className="highlights-tray-container">
        <div className="highlights-header">
          <div className="highlights-title-group">
            <Sparkles size={15} className="highlights-icon animate-pulse" />
            <span>Story Highlights</span>
          </div>
        </div>
        <div className="highlights-scroll-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="highlight-circle-item skeleton-item">
              <div className="highlight-ring skeleton-ring" />
              <div className="highlight-title-skeleton" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!loading && highlights.length === 0) {
    return null // Don't take up space if user has no highlights
  }

  return (
    <div className="highlights-tray-container">
      <div className="highlights-header">
        <div className="highlights-title-group">
          <Sparkles size={15} className="highlights-icon" />
          <span className="highlights-title">Story Highlights</span>
          <span className="highlights-count-badge">{highlights.length}</span>
        </div>
        <button
          type="button"
          className="highlights-refresh-btn"
          onClick={fetchHighlights}
          disabled={loading}
          title="Refresh Highlights"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="highlights-scroll-row">
        {highlights.map((hl) => {
          const cover = hl.cover_url
          const count = hl.media_count || 0
          return (
            <button
              key={hl.id}
              type="button"
              className="highlight-circle-item"
              onClick={() => onSelectHighlight && onSelectHighlight(hl)}
              title={`View "${hl.title}" (${count > 0 ? `${count} stories` : 'Highlight Album'})`}
            >
              <div className="highlight-ring">
                <div className="highlight-avatar-wrapper">
                  {cover ? (
                    <img
                      src={`/api/v1/image-proxy?url=${encodeURIComponent(cover)}`}
                      alt={hl.title}
                      className="highlight-cover-img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="highlight-fallback-avatar"
                    style={{ display: cover ? 'none' : 'flex' }}
                  >
                    <Layers size={20} />
                  </div>
                  {count > 0 && (
                    <span className="highlight-badge">{count}</span>
                  )}
                </div>
              </div>
              <span className="highlight-title-label">{hl.title || 'Highlights'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
