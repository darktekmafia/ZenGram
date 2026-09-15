import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MediaCard from './components/MediaCard'
import WatchedProfilesModal from './components/WatchedProfilesModal'
import { Download, RefreshCw, Layers, CheckCircle2, Shield, Eye, Users, UserCheck, Key, Settings as SettingsIcon } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [contentType, setContentType] = useState('ALL')
  const [mediaItems, setMediaItems] = useState([])
  const [watchedProfiles, setWatchedProfiles] = useState([])
  const [followedProfiles, setFollowedProfiles] = useState([])
  const [userSession, setUserSession] = useState(null)
  const [rateLimitStatus, setRateLimitStatus] = useState(null)
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingFollowed, setSyncingFollowed] = useState(false)
  const [selectedUserFilter, setSelectedUserFilter] = useState(null)
  const [sessionInput, setSessionInput] = useState('')

  // Fetch Feed Media
  const fetchFeed = async () => {
    try {
      let url = `/api/v1/feed?content_type=${contentType}`
      if (selectedUserFilter) {
        url += `&filter_user=${encodeURIComponent(selectedUserFilter)}`
      }
      if (searchQuery) {
        url += `&query_search=${encodeURIComponent(searchQuery)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setMediaItems(data)
      }
    } catch (err) {
      console.error('Error fetching feed:', err)
    }
  }

  // Fetch Tracked Profiles & Followed Profiles
  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/v1/profiles')
      if (res.ok) {
        const data = await res.json()
        setWatchedProfiles(data)
      }
      const fRes = await fetch('/api/v1/profiles/followed')
      if (fRes.ok) {
        const fData = await fRes.json()
        setFollowedProfiles(fData)
      }
    } catch (err) {
      console.error('Error fetching profiles:', err)
    }
  }

  // Fetch User Session
  const fetchUserSession = async () => {
    try {
      const res = await fetch('/api/v1/auth/session')
      if (res.ok) {
        const data = await res.json()
        setUserSession(data)
        setSessionInput(data.session_cookie || '')
      }
    } catch (err) {
      console.error('Error fetching user session:', err)
    }
  }

  // Fetch Rate Limit Status
  const fetchRateLimit = async () => {
    try {
      const res = await fetch('/api/v1/settings/rate-limit')
      if (res.ok) {
        const data = await res.json()
        setRateLimitStatus(data)
      }
    } catch (err) {
      console.error('Error fetching rate limit status:', err)
    }
  }

  useEffect(() => {
    fetchFeed()
    fetchProfiles()
    fetchUserSession()
    fetchRateLimit()
    const interval = setInterval(fetchRateLimit, 30000)
    return () => clearInterval(interval)
  }, [contentType, searchQuery, selectedUserFilter, activeTab])

  const handleRunSync = async () => {
    setSyncing(true)
    await fetchFeed()
    await fetchRateLimit()
    setSyncing(false)
  }

  const handleSyncFollowed = async () => {
    setSyncingFollowed(true)
    try {
      const res = await fetch('/api/v1/profiles/sync-following', { method: 'POST' })
      if (res.ok) {
        await fetchProfiles()
      }
    } catch (err) {
      console.error('Error syncing followed accounts:', err)
    }
    setSyncingFollowed(false)
  }

  const handleSaveMedia = async (postId) => {
    try {
      const res = await fetch(`/api/v1/downloads/single/${postId}`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchFeed()
      }
    } catch (err) {
      console.error('Error saving media:', err)
    }
  }

  const handleAddProfile = async (username) => {
    try {
      const res = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, is_unfollowed_track: true }),
      })
      if (res.ok) {
        await fetchProfiles()
        await fetch(`/api/v1/profiles/${username}/media`)
        setSelectedUserFilter(username)
        fetchFeed()
      }
    } catch (err) {
      console.error('Error adding profile:', err)
    }
  }

  const handleRemoveProfile = async (username) => {
    try {
      const res = await fetch(`/api/v1/profiles/${username}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchProfiles()
      }
    } catch (err) {
      console.error('Error removing profile:', err)
    }
  }

  const handleSaveSession = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userSession?.username || 'admin',
          session_cookie: sessionInput
        })
      })
      if (res.ok) {
        await fetchUserSession()
      }
    } catch (err) {
      console.error('Error saving session cookie:', err)
    }
  }

  const trackedUnfollowedList = watchedProfiles.filter((p) => p.is_unfollowed_track)
  const displayFollowedList = followedProfiles.length > 0 ? followedProfiles : watchedProfiles.filter((p) => !p.is_unfollowed_track)

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
          if (tab !== 'dashboard') setSelectedUserFilter(null)
        }}
        onOpenAddProfileModal={() => setIsTrackModalOpen(true)}
        userSession={userSession}
      />

      <main className="main-content">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          contentType={contentType}
          setContentType={setContentType}
          rateLimitStatus={rateLimitStatus}
          onRunSync={handleRunSync}
          onOpenTrackModal={() => setIsTrackModalOpen(true)}
          syncing={syncing}
        />

        <div className="content-body">
          {selectedUserFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Filtering by account:</span>
              <span className="unfollowed-tag">@{selectedUserFilter}</span>
              <button
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setSelectedUserFilter(null)}
              >
                Clear Filter
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="media-grid">
              {mediaItems.map((item) => (
                <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} />
              ))}
            </div>
          )}

          {activeTab === 'downloads' && (
            <div className="media-grid">
              {mediaItems.filter((i) => i.is_saved).map((item) => (
                <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} />
              ))}
            </div>
          )}

          {activeTab === 'followed' && (
            <div>
              {/* User Session Banner */}
              <div className="modal-card" style={{ marginBottom: '24px', background: 'var(--card-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '1.2rem'
                    }}>
                      {userSession?.username ? userSession.username[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                        User Details: @{userSession?.username || 'admin'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <UserCheck size={14} className="text-green-400" /> Session Active & Verified
                        <span style={{ color: 'var(--border-color)' }}>•</span>
                        <span>{displayFollowedList.length} Followed Accounts Linked</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleSyncFollowed}
                    disabled={syncingFollowed}
                  >
                    <RefreshCw size={16} className={syncingFollowed ? 'animate-spin' : ''} />
                    <span>{syncingFollowed ? 'Syncing...' : 'Sync Followed Accounts'}</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Your Followed Instagram Accounts ({displayFollowedList.length})</h2>
              </div>

              <div className="profiles-list">
                {displayFollowedList.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                    No followed accounts imported yet. Click "Sync Followed Accounts" above to import your followed profiles.
                  </p>
                ) : (
                  displayFollowedList.map((p) => (
                    <div key={p.id || p.username} className="profile-item-row">
                      <div className="profile-user-group">
                        <img
                          src={p.profile_pic_url || `https://ui-avatars.com/api/?name=${p.username}`}
                          alt={p.username}
                          style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                        />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>@{p.username}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {p.full_name || 'Instagram Followed Account'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setSelectedUserFilter(p.username)
                            setActiveTab('dashboard')
                          }}
                        >
                          Browse Media
                        </button>
                        <button className="btn-secondary" onClick={() => handleRemoveProfile(p.username)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'watched' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Tracked Unfollowed Profiles ({trackedUnfollowedList.length})</h2>
                <button className="btn-primary" onClick={() => setIsTrackModalOpen(true)}>
                  <Eye size={16} /> Track New Profile
                </button>
              </div>

              <div className="profiles-list">
                {trackedUnfollowedList.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                    No custom tracked unfollowed profiles yet.
                  </p>
                ) : (
                  trackedUnfollowedList.map((p) => (
                    <div key={p.id} className="profile-item-row">
                      <div className="profile-user-group">
                        <img
                          src={p.profile_pic_url || `https://ui-avatars.com/api/?name=${p.username}`}
                          alt={p.username}
                          style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                        />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>@{p.username}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Unfollowed Account (Tracked)
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setSelectedUserFilter(p.username)
                            setActiveTab('dashboard')
                          }}
                        >
                          Browse Media
                        </button>
                        <button className="btn-secondary" onClick={() => handleRemoveProfile(p.username)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div>
              <h2 style={{ marginBottom: '16px' }}>Background Download Queue</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No active background jobs running. Batch downloads process automatically in background threads.
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Application Settings</h2>

              <div className="modal-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} className="text-purple-400" /> User Session Credentials
                </h3>
                <form onSubmit={handleSaveSession}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.85rem' }}>
                    Instagram Session Cookie (`sessionid`)
                  </label>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="Paste your Instagram sessionid cookie string here..."
                    value={sessionInput}
                    onChange={(e) => setSessionInput(e.target.value)}
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Required for accessing private profile media, custom followed account feeds, and high-rate requests.
                  </p>
                  <button type="submit" className="btn-primary">
                    Save Session Cookie
                  </button>
                </form>
              </div>

              <div className="modal-card" style={{ maxWidth: '650px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>Media Download Location</label>
                <input className="input-field" defaultValue="/home/psychlone/Downloads/InstaSave" readOnly />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Target directory on Fedora 44 filesystem where saved images and videos are stored.
                </p>

                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>Rate Limit Cooldown Delay (Seconds)</label>
                <input className="input-field" defaultValue="3.0" />
                
                <button className="btn-primary" style={{ marginTop: '10px' }}>
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <WatchedProfilesModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        profiles={watchedProfiles}
        onAddProfile={handleAddProfile}
        onRemoveProfile={handleRemoveProfile}
        onSelectProfile={(username) => {
          setSelectedUserFilter(username)
          setActiveTab('dashboard')
        }}
      />
    </div>
  )
}

