import React, { useState } from 'react'
import { Download, ExternalLink, Check, Image as ImageIcon, Video, Layers, Heart, MessageCircle } from 'lucide-react'

export default function MediaCard({ item, onSaveMedia }) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSaveMedia(item.post_id)
    setSaving(false)
  }

  const getMediaBadge = () => {
    if (item.media_type === 'VIDEO') {
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

  return (
    <div className="media-card">
      <div className="card-header">
        <div className="card-user-info">
          <img
            src={`https://ui-avatars.com/api/?name=${item.username}&background=232936&color=fff`}
            alt={item.username}
            className="card-avatar"
          />
          <span className="card-username">@{item.username}</span>
        </div>
        <span className="card-date">
          {item.taken_at ? new Date(item.taken_at).toLocaleDateString() : 'Recent'}
        </span>
      </div>

      <div className="card-preview">
        <img src={item.display_url} alt="Media preview" className="card-img" />
        {getMediaBadge()}
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

      <div className="card-actions">
        {item.is_saved ? (
          <div className="saved-status-badge">
            <Check size={14} /> Archived Locally
          </div>
        ) : (
          <button className="btn-action-save" onClick={handleSave} disabled={saving}>
            <Download size={14} />
            <span>{saving ? 'Saving...' : 'Save Image/Video'}</span>
          </button>
        )}

        <a
          href={`https://www.instagram.com/p/${item.shortcode}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-action-view"
        >
          <ExternalLink size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          View Original
        </a>
      </div>
    </div>
  )
}
