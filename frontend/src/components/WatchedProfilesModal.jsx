import React, { useState } from 'react'
import { X, Plus, Trash2, Eye, UserCheck } from 'lucide-react'
import ProfileAvatar from './ProfileAvatar'

export default function WatchedProfilesModal({
  isOpen,
  onClose,
  profiles,
  onAddProfile,
  onRemoveProfile,
  onSelectProfile
}) {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!handle.trim()) return
    setLoading(true)
    await onAddProfile(handle)
    setHandle('')
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} color="var(--accent-purple)" />
            <h2 className="modal-title">Track Unfollowed Accounts</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Add Instagram usernames that you <strong>do not follow</strong> to archive their public media feed, reels, and stories alongside your followed accounts.
        </p>

        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="@username (e.g. tay_miles_24)"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              style={{ marginBottom: 0, flex: 1 }}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !handle.trim()}
              style={{ height: '42px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>{loading ? 'Adding...' : 'Track'}</span>
            </button>
          </div>
        </form>

        <h3 style={{ fontSize: '0.88rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-muted)' }}>
          Tracked Unfollowed Profiles ({profiles.length})
        </h3>

        <div className="profiles-list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {profiles.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No custom tracked profiles added yet.
            </p>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="profile-item-row">
                <div className="profile-user-group">
                  <ProfileAvatar
                    username={p.username}
                    profilePicUrl={p.profile_pic_url}
                    className="profile-avatar-small"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>@{p.username}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {p.is_unfollowed_track ? 'Unfollowed Tracked Account' : 'Followed Account'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => {
                      onSelectProfile(p.username)
                      onClose()
                    }}
                  >
                    View Media
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 8px', color: 'var(--accent-red)' }}
                    onClick={() => onRemoveProfile(p.username)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
