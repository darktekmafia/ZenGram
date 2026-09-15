import React, { useState } from 'react'
import { X, Plus, Trash2, Eye, UserCheck } from 'lucide-react'

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
    await onAddProfile(handle.trim())
    setHandle('')
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} className="text-blue-500" />
            <h2 className="modal-title">Track Unfollowed Accounts</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Enter an Instagram handle or User ID to browse and archive media without following the account on Instagram.
        </p>

        <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Instagram Username or Handle
          </label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. life_hacker or @recipes_daily"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              style={{ margin: 0 }}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              <Plus size={16} />
              <span>{loading ? 'Adding...' : 'Add'}</span>
            </button>
          </div>
        </form>

        <h3 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>
          Currently Tracked Profiles ({profiles.length})
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
                  <img
                    src={p.profile_pic_url || `https://ui-avatars.com/api/?name=${p.username}`}
                    alt={p.username}
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
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
