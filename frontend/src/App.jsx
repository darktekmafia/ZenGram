import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MediaCard from './components/MediaCard'
import WatchedProfilesModal from './components/WatchedProfilesModal'
import ConsoleModal from './components/ConsoleModal'
import BatchConfigModal from './components/BatchConfigModal'
import UpdateModal from './components/UpdateModal'
import ProfileAvatar from './components/ProfileAvatar'
import { Download, RefreshCw, Layers, CheckCircle2, Shield, Eye, EyeOff, Users, UserCheck, Key, Settings as SettingsIcon, HardDrive, RotateCcw, Trash2, AlertCircle, ExternalLink, FolderDown, Clock, Loader2, Activity, Terminal, Sparkles, GitBranch, TerminalSquare, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

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
  const [showSessionKey, setShowSessionKey] = useState(false)
  const [sessionSaveStatus, setSessionSaveStatus] = useState(null)
  const [configSaveStatus, setConfigSaveStatus] = useState(null)
  const [downloadDirInput, setDownloadDirInput] = useState('/home/psychlone/Downloads/InstaSave')
  const [rateLimitDelayInput, setRateLimitDelayInput] = useState(3.0)
  const [syncIntervalInput, setSyncIntervalInput] = useState(6)
  const [maxPostsInput, setMaxPostsInput] = useState(0)
  const [maxQueueLimitInput, setMaxQueueLimitInput] = useState(8)
  const [maxWorkersInput, setMaxWorkersInput] = useState(2)
  const [batchTargetUser, setBatchTargetUser] = useState(null)

  const [downloadedItems, setDownloadedItems] = useState([])
  const [systemVersion, setSystemVersion] = useState(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    session: false,
    storage: false,
    maintenance: false,
    version: false
  })
  const [highlightedSection, setHighlightedSection] = useState(null)

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const setAllSections = (expand) => {
    setExpandedSections({
      session: expand,
      storage: expand,
      maintenance: expand,
      version: expand
    })
  }

  const navigateToSettingsSection = (sectionKey) => {
    setActiveTab('settings')
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: true
    }))
    setHighlightedSection(sectionKey)
    setTimeout(() => {
      const el = document.getElementById(`settings-section-${sectionKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)
    setTimeout(() => {
      setHighlightedSection(null)
    }, 2500)
  }

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

  // Fetch Downloaded Content
  const fetchDownloadedContent = async () => {
    try {
      let url = `/api/v1/downloads?content_type=${contentType}`
      if (selectedUserFilter) {
        url += `&filter_user=${encodeURIComponent(selectedUserFilter)}`
      }
      if (searchQuery) {
        url += `&query_search=${encodeURIComponent(searchQuery)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setDownloadedItems(data)
      }
    } catch (err) {
      console.error('Error fetching downloaded content:', err)
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

  // Fetch App Settings
  const fetchAppSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.download_directory) setDownloadDirInput(data.download_directory)
        if (data.rate_limit_delay_seconds) setRateLimitDelayInput(data.rate_limit_delay_seconds)
        if (data.auto_sync_interval_hours) setSyncIntervalInput(data.auto_sync_interval_hours)
        if (data.max_posts_per_fetch !== undefined) setMaxPostsInput(data.max_posts_per_fetch)
        if (data.max_queue_limit !== undefined) setMaxQueueLimitInput(data.max_queue_limit)
        if (data.max_download_workers !== undefined) setMaxWorkersInput(data.max_download_workers)
      }
    } catch (err) {
      console.error('Error fetching app settings:', err)
    }
  }

  // Fetch System Version & Git Details
  const fetchSystemVersion = async () => {
    try {
      const res = await fetch('/api/v1/system/version')
      if (res.ok) {
        const data = await res.json()
        setSystemVersion(data)
      }
    } catch (err) {
      console.error('Error fetching system version:', err)
    }
  }

  // Live Check for Upstream Updates
  const handleCheckUpdate = async (simulate = null) => {
    setCheckingUpdate(true)
    try {
      let url = '/api/v1/system/check-update'
      if (simulate !== null) {
        url += `?simulate_update=${simulate}`
      }
      const res = await fetch(url, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSystemVersion(data)
      }
    } catch (err) {
      console.error('Error checking updates:', err)
    }
    setCheckingUpdate(false)
  }

  useEffect(() => {
    fetchFeed()
    fetchDownloadedContent()
    fetchProfiles()
    fetchUserSession()
    fetchRateLimit()
    fetchAppSettings()
    fetchSystemVersion()
    const interval = setInterval(fetchRateLimit, 30000)
    return () => clearInterval(interval)
  }, [contentType, searchQuery, selectedUserFilter, activeTab])

  const handleRunSync = async () => {
    setSyncing(true)
    await fetchFeed()
    await fetchDownloadedContent()
    await fetchRateLimit()
    await fetchSystemVersion()
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
        fetchDownloadedContent()
      }
    } catch (err) {
      console.error('Error saving media:', err)
    }
  }

  const handleDeleteMedia = async (postId, slideIndex = null) => {
    const promptMsg = slideIndex 
      ? `Are you sure you want to delete slide #${slideIndex} from server disk?`
      : "Are you sure you want to delete all saved files for this post from server disk?"
    if (!window.confirm(promptMsg)) return
    try {
      let url = `/api/v1/downloads/file/${postId}`
      if (slideIndex) {
        url += `?index=${slideIndex}`
      }
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        await fetchDownloadedContent()
        await fetchFeed()
      }
    } catch (err) {
      console.error('Error deleting media file:', err)
    }
  }

  const handleAddProfile = async (username) => {
    const cleanUsername = username.trim().replace(/\/+$/, '').replace(/^@+/, '')
    if (!cleanUsername) return
    try {
      const res = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, is_unfollowed_track: true }),
      })
      if (res.ok) {
        await fetchProfiles()
        await fetch(`/api/v1/profiles/${encodeURIComponent(cleanUsername)}/media`)
        setSelectedUserFilter(cleanUsername)
        setSearchQuery('')
        fetchFeed()
      }
    } catch (err) {
      console.error('Error adding profile:', err)
    }
  }

  const handleBulkAddProfiles = async (usernames) => {
    if (!usernames || usernames.length === 0) return { added_count: 0, skipped_count: 0 }
    try {
      const res = await fetch('/api/v1/profiles/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames, is_unfollowed_track: true }),
      })
      if (res.ok) {
        const data = await res.json()
        await fetchProfiles()
        return data
      }
    } catch (err) {
      console.error('Error bulk adding profiles:', err)
    }
    return { added_count: 0, skipped_count: 0 }
  }

  const handleRemoveProfile = async (username) => {
    const cleanUsername = username.trim().replace(/\/+$/, '').replace(/^@+/, '')
    try {
      const res = await fetch(`/api/v1/profiles/${encodeURIComponent(cleanUsername)}`, {
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
    setSessionSaveStatus('saving')
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
        setSessionSaveStatus('success')
        setTimeout(() => setSessionSaveStatus(null), 4000)
      } else {
        setSessionSaveStatus('error')
      }
    } catch (err) {
      console.error('Error saving session cookie:', err)
      setSessionSaveStatus('error')
    }
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setConfigSaveStatus('saving')
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_directory: downloadDirInput,
          auto_sync_interval_hours: parseInt(syncIntervalInput) || 6,
          rate_limit_delay_seconds: parseFloat(rateLimitDelayInput) || 3.0,
          max_posts_per_fetch: parseInt(maxPostsInput) >= 0 ? parseInt(maxPostsInput) : 0,
          max_queue_limit: parseInt(maxQueueLimitInput) >= 1 ? parseInt(maxQueueLimitInput) : 8,
          max_download_workers: parseInt(maxWorkersInput) >= 1 ? parseInt(maxWorkersInput) : 2
        })
      })
      if (res.ok) {
        setConfigSaveStatus('success')
        setTimeout(() => setConfigSaveStatus(null), 4000)
      } else {
        setConfigSaveStatus('error')
      }
    } catch (err) {
      console.error('Error saving config:', err)
      setConfigSaveStatus('error')
    }
  }

  const [verifyingDisk, setVerifyingDisk] = useState(false)
  const [verifyDiskStatus, setVerifyDiskStatus] = useState(null)
  const [resettingDownloads, setResettingDownloads] = useState(false)
  const [resetStatus, setResetStatus] = useState(null)

  const [jobs, setJobs] = useState([])
  const [startingBatchUser, setStartingBatchUser] = useState(null)
  const [activeConsoleJobId, setActiveConsoleJobId] = useState(null)
  const [isConsoleModalOpen, setIsConsoleModalOpen] = useState(false)
  const [isConsoleDocked, setIsConsoleDocked] = useState(false)

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/v1/downloads/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
      }
    } catch (err) {
      console.error('Error fetching download jobs:', err)
    }
  }

  useEffect(() => {
    fetchJobs()
    const hasActive = jobs.some((j) => j.status === 'in_progress' || j.status === 'queued')
    const intervalMs = hasActive ? 2500 : 5000
    const jobInterval = setInterval(fetchJobs, intervalMs)
    return () => clearInterval(jobInterval)
  }, [activeTab, jobs.length])

  const handleStartBatchUserDownload = async (username, limit = 0, category = null) => {
    const cleanUser = (username || '').trim().replace(/^@+/, '')
    if (!cleanUser) return
    setStartingBatchUser(cleanUser)
    try {
      const queryParams = new URLSearchParams()
      if (limit !== undefined && limit !== null) {
        queryParams.set('limit', limit)
      }
      if (category) {
        queryParams.set('category_tag', category)
      }
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
      const res = await fetch(`/api/v1/downloads/bulk-user/${encodeURIComponent(cleanUser)}${queryString}`, { method: 'POST' })
      if (res.ok) {
        const createdJob = await res.json()
        await fetchJobs()
        if (createdJob?.id) {
          setActiveConsoleJobId(createdJob.id)
          setIsConsoleModalOpen(true)
          setIsConsoleDocked(false)
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.detail || 'Failed to queue batch archive')
      }
    } catch (err) {
      console.error('Error starting batch download for user:', err)
    }
    setStartingBatchUser(null)
  }

  const handleClearJobs = async () => {
    try {
      const res = await fetch('/api/v1/downloads/jobs', { method: 'DELETE' })
      if (res.ok) {
        fetchJobs()
      }
    } catch (err) {
      console.error('Error clearing jobs:', err)
    }
  }

  const handleDeleteSingleJob = async (jobId) => {
    try {
      const res = await fetch(`/api/v1/downloads/jobs/${jobId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchJobs()
      }
    } catch (err) {
      console.error('Error deleting job:', err)
    }
  }

  const handleVerifyDisk = async () => {
    setVerifyingDisk(true)
    setVerifyDiskStatus(null)
    try {
      const res = await fetch('/api/v1/downloads/verify-disk', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setVerifyDiskStatus(data)
        fetchFeed()
        fetchDownloadedContent()
      }
    } catch (err) {
      console.error('Error verifying disk media:', err)
    }
    setVerifyingDisk(false)
  }

  const handleResetDownloads = async () => {
    if (!window.confirm("Are you sure you want to reset all download records in the database? This will clear the Downloaded Content list and restore the 'Save Media' button on all media items.")) {
      return
    }
    setResettingDownloads(true)
    setResetStatus(null)
    try {
      const res = await fetch('/api/v1/downloads/reset-records', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setResetStatus(data)
        fetchFeed()
        fetchDownloadedContent()
      }
    } catch (err) {
      console.error('Error resetting download records:', err)
    }
    setResettingDownloads(false)
  }

  const activeConsoleJob = jobs.find((j) => j.id === activeConsoleJobId) || jobs.find((j) => j.status === 'in_progress') || jobs[0] || null
  const dockedJob = isConsoleDocked && activeConsoleJob ? activeConsoleJob : null

  const trackedUnfollowedList = watchedProfiles.filter((p) => p.is_unfollowed_track)
  const displayFollowedList = followedProfiles.length > 0 ? followedProfiles : watchedProfiles.filter((p) => !p.is_unfollowed_track)

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
        }}
        onOpenAddProfileModal={() => setIsTrackModalOpen(true)}
        userSession={userSession}
        dockedJob={dockedJob}
        onOpenDockedConsole={() => {
          setIsConsoleModalOpen(true)
          setIsConsoleDocked(false)
        }}
        onCloseDockedConsole={() => {
          setIsConsoleDocked(false)
        }}
        systemVersion={systemVersion}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onNavigateToSettings={navigateToSettingsSection}
      />

      <main className="main-content">
        <Header
          activeTab={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          contentType={contentType}
          setContentType={setContentType}
          rateLimitStatus={rateLimitStatus}
          onRunSync={handleRunSync}
          onOpenTrackModal={() => setIsTrackModalOpen(true)}
          syncing={syncing}
          systemVersion={systemVersion}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          onNavigateToSettings={navigateToSettingsSection}
        />

        <div className="content-body">
          {selectedUserFilter && (activeTab === 'dashboard' || activeTab === 'downloads') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Filtering by account:</span>
              <a
                href={`https://www.instagram.com/${selectedUserFilter}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="unfollowed-tag"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title={`Open @${selectedUserFilter} on instagram.com`}
              >
                <span>@{selectedUserFilter}</span>
                <ExternalLink size={10} />
              </a>
              <a
                href={`https://www.instagram.com/${selectedUserFilter}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ padding: '3px 10px', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title={`Open @${selectedUserFilter} on instagram.com`}
              >
                <ExternalLink size={12} />
                <span>Open @{selectedUserFilter} on Instagram</span>
              </a>
              <button
                className="btn-secondary"
                style={{ padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa' }}
                onClick={() => setBatchTargetUser(selectedUserFilter)}
                disabled={startingBatchUser === selectedUserFilter}
                title={`Batch archive all media posts from @${selectedUserFilter}`}
              >
                <FolderDown size={14} className={startingBatchUser === selectedUserFilter ? 'animate-spin' : ''} />
                <span>{startingBatchUser === selectedUserFilter ? 'Starting...' : `Batch Archive @${selectedUserFilter}`}</span>
              </button>
              <button
                className="btn-primary"
                style={{ padding: '3px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={async () => {
                  setSyncing(true)
                  try {
                    await fetch(`/api/v1/profiles/${selectedUserFilter}/media`)
                    await fetchFeed()
                    await fetchRateLimit()
                  } catch (err) {
                    console.error('Error fetching user media:', err)
                  }
                  setSyncing(false)
                }}
                disabled={syncing}
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Pulling...' : `Pull Latest @${selectedUserFilter} Media`}</span>
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                onClick={() => setSelectedUserFilter(null)}
              >
                Clear Filter
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            mediaItems.length > 0 ? (
              <div className="media-grid">
                {mediaItems.map((item) => (
                  <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} />
                ))}
              </div>
            ) : (
              <div className="modal-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', margin: '30px auto', maxWidth: '560px' }}>
                <Layers size={44} style={{ opacity: 0.4, marginBottom: '14px', color: '#60a5fa' }} />
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                  {selectedUserFilter ? `No Posts Scraped for @${selectedUserFilter} Yet` : 'No Media Posts Found'}
                </h3>
                <p style={{ fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                  {selectedUserFilter
                    ? `This profile was recently added and its posts have not been scraped into your local feed yet.`
                    : `Your media database is currently empty. Run a sync or browse followed accounts to load posts into your feed.`}
                </p>

                {selectedUserFilter ? (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        setSyncing(true)
                        try {
                          await fetch(`/api/v1/profiles/${selectedUserFilter}/media`)
                          await fetchFeed()
                          await fetchRateLimit()
                        } catch (err) {
                          console.error('Error fetching user media:', err)
                        }
                        setSyncing(false)
                      }}
                      disabled={syncing}
                    >
                      <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                      <span>{syncing ? 'Scraping Posts...' : `Pull Latest @${selectedUserFilter} Posts`}</span>
                    </button>

                    <button
                      className="btn-secondary"
                      style={{ color: '#60a5fa' }}
                      onClick={() => setBatchTargetUser(selectedUserFilter)}
                      disabled={startingBatchUser === selectedUserFilter}
                    >
                      <FolderDown size={15} />
                      <span>Batch Archive All Media</span>
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary" style={{ margin: '0 auto' }} onClick={handleRunSync} disabled={syncing}>
                    <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? 'Syncing...' : 'Run Full Sync'}</span>
                  </button>
                )}
              </div>
            )
          )}

          {activeTab === 'downloads' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>
                    Downloaded Content ({downloadedItems.length} Posts • {downloadedItems.reduce((acc, item) => acc + (item.carousel_media?.length || 1), 0)} Media Files)
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                    Media archived locally on your Fedora 44 filesystem.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleVerifyDisk}
                    disabled={verifyingDisk}
                  >
                    <HardDrive size={15} className={verifyingDisk ? 'animate-spin' : ''} />
                    <span>{verifyingDisk ? 'Verifying...' : 'Verify Disk Files'}</span>
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleResetDownloads}
                    disabled={resettingDownloads}
                  >
                    <RotateCcw size={15} />
                    <span>Clear All Saved Records</span>
                  </button>
                </div>
              </div>

              {verifyDiskStatus && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{verifyDiskStatus.message}</span>
                </div>
              )}

              {resetStatus && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{resetStatus.message}</span>
                </div>
              )}

              {downloadedItems.length === 0 ? (
                <div className="modal-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <HardDrive size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Saved Downloads Found</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto' }}>
                    Either no media has been archived yet matching your current filters, or saved records were reset after files were removed from disk. Browse your profile feeds or batch archive accounts to download media!
                  </p>
                </div>
              ) : (
                <div className="media-grid">
                  {downloadedItems.map((item) => (
                    <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} onDeleteMedia={handleDeleteMedia} />
                  ))}
                </div>
              )}
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

              <div className="profiles-grid">
                {displayFollowedList.map((p) => (
                  <div key={p.id || p.username} className="profile-card">
                    <a
                      href={`https://www.instagram.com/${p.username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                      title={`Open @${p.username} on instagram.com`}
                    >
                      <ProfileAvatar username={p.username} profilePicUrl={p.profile_pic_url} />
                      <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginTop: '10px', marginBottom: '2px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        @{p.username}
                        <ExternalLink size={12} style={{ opacity: 0.6 }} />
                      </h3>
                    </a>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.full_name || p.username}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: 'auto', flexWrap: 'wrap' }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '7px 4px' }}
                        onClick={() => {
                          setSelectedUserFilter(p.username)
                          setSearchQuery('')
                          setActiveTab('dashboard')
                        }}
                      >
                        View Posts
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '7px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa' }}
                        onClick={() => setBatchTargetUser(p.username)}
                        disabled={startingBatchUser === p.username}
                        title={`Batch archive posts from @${p.username}`}
                      >
                        <FolderDown size={14} className={startingBatchUser === p.username ? 'animate-spin' : ''} />
                        <span>{startingBatchUser === p.username ? '...' : 'Batch'}</span>
                      </button>
                      <a
                        href={`https://www.instagram.com/${p.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{ padding: '7px 8px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={`Open @${p.username} on instagram.com`}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'watched' || activeTab === 'unfollowed') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Tracked Accounts ({trackedUnfollowedList.length})</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                    Browse and archive media from public profiles without following them on Instagram.
                  </p>
                </div>
                <button className="btn-primary" onClick={() => setIsTrackModalOpen(true)}>
                  <Eye size={16} /> Track New Profile
                </button>
              </div>

              <div className="profiles-grid">
                {trackedUnfollowedList.length === 0 ? (
                  <div className="modal-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                    <Eye size={36} className="text-blue-500" style={{ margin: '0 auto 12px auto' }} />
                    <h3>No Custom Tracked Profiles Added</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                      Add an Instagram username to archive their media without following them.
                    </p>
                    <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => setIsTrackModalOpen(true)}>
                      Add Tracked Profile
                    </button>
                  </div>
                ) : (
                  trackedUnfollowedList.map((p) => (
                    <div key={p.id || p.username} className="profile-card">
                      <a
                        href={`https://www.instagram.com/${p.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                        title={`Open @${p.username} on instagram.com`}
                      >
                        <ProfileAvatar username={p.username} profilePicUrl={p.profile_pic_url} />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginTop: '10px', marginBottom: '2px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          @{p.username}
                          <ExternalLink size={12} style={{ opacity: 0.6 }} />
                        </h3>
                      </a>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: '600', marginBottom: '14px' }}>
                        Unfollowed Tracked
                      </div>
                      <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: 'auto', flexWrap: 'wrap' }}>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '7px 4px' }}
                          onClick={() => {
                            setSelectedUserFilter(p.username)
                            setSearchQuery('')
                            setActiveTab('dashboard')
                          }}
                        >
                          Browse
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '7px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa' }}
                          onClick={() => setBatchTargetUser(p.username)}
                          disabled={startingBatchUser === p.username}
                          title={`Batch archive posts from @${p.username}`}
                        >
                          <FolderDown size={14} className={startingBatchUser === p.username ? 'animate-spin' : ''} />
                          <span>{startingBatchUser === p.username ? '...' : 'Batch'}</span>
                        </button>
                        <a
                          href={`https://www.instagram.com/${p.username}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ padding: '7px 8px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title={`Open @${p.username} on instagram.com`}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          className="btn-secondary"
                          style={{ padding: '7px 8px', color: 'var(--accent-red)' }}
                          onClick={() => handleRemoveProfile(p.username)}
                          title="Remove profile"
                        >
                          <Trash2 size={14} />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Background Download Queue ({jobs.length})</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                    Real-time background task processing for batch profile archiving and media downloads.
                  </p>
                </div>

                {jobs.length > 0 && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleClearJobs}
                  >
                    <Trash2 size={14} />
                    <span>Clear Completed History</span>
                  </button>
                )}
              </div>

              {/* Status Summary Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div className="modal-card" style={{ padding: '14px 18px', margin: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>ACTIVE JOBS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#60a5fa' }}>
                    {jobs.filter((j) => j.status === 'in_progress' || j.status === 'queued').length}
                  </div>
                </div>

                <div className="modal-card" style={{ padding: '14px 18px', margin: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>COMPLETED JOBS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#34d399' }}>
                    {jobs.filter((j) => j.status === 'completed').length}
                  </div>
                </div>

                <div className="modal-card" style={{ padding: '14px 18px', margin: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>ITEMS ARCHIVED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#a78bfa' }}>
                    {jobs.reduce((acc, j) => acc + (j.completed_items || 0), 0)}
                  </div>
                </div>
              </div>

              {jobs.length === 0 ? (
                <div className="modal-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <FolderDown size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Active Background Tasks</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 16px auto' }}>
                    Batch archive any profile to download all videos and photos automatically in background threads.
                  </p>
                  <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => setActiveTab('followed')}>
                    Browse Followed Accounts
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {jobs.map((job) => {
                    const percent = job.total_items > 0 ? Math.min(100, Math.round((job.completed_items / job.total_items) * 100)) : (job.status === 'completed' ? 100 : 0)
                    const displayTag = !job.category_tag || job.category_tag === 'General'
                      ? '@General'
                      : (job.category_tag.startsWith('@') || job.category_tag === 'Selected Items'
                          ? job.category_tag
                          : `@${job.category_tag}`);
                    
                    return (
                      <div key={job.id} className="modal-card" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>
                              Batch Archive: {displayTag}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                              #{job.id}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {job.status === 'in_progress' && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <RefreshCw size={12} className="animate-spin" /> In Progress ({percent}%)
                              </span>
                            )}
                            {job.status === 'queued' && (
                              <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={12} /> Queued
                              </span>
                            )}
                            {job.status === 'completed' && (
                              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={12} /> Completed
                              </span>
                            )}
                            {job.status === 'failed' && (
                              <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={12} /> Failed
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteSingleJob(job.id)}
                              title="Cancel or Remove Job"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '8px', height: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                          <div
                            style={{
                              width: `${percent}%`,
                              height: '100%',
                              background: job.status === 'completed' ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                              transition: 'width 0.4s ease-in-out'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>
                            Progress: <strong style={{ color: 'var(--text-main)' }}>{job.completed_items}</strong> / {job.total_items} items archived
                          </span>
                          <span>
                            Started: {new Date(job.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {/* Current Stage Live Message */}
                        {job.current_stage && (
                          <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: job.status === 'completed' 
                              ? 'rgba(16, 185, 129, 0.08)' 
                              : job.status === 'failed' 
                                ? 'rgba(239, 68, 68, 0.08)' 
                                : 'rgba(59, 130, 246, 0.08)',
                            border: `1px solid ${job.status === 'completed' ? 'rgba(16, 185, 129, 0.25)' : job.status === 'failed' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.82rem',
                            color: job.status === 'completed' ? '#34d399' : job.status === 'failed' ? '#f87171' : '#60a5fa'
                          }}>
                            <Activity size={14} className={job.status === 'in_progress' ? 'animate-spin' : ''} />
                            <span style={{ fontWeight: '500' }}>{job.current_stage}</span>
                          </div>
                        )}

                        {/* Open Console Modal Action */}
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                          <button
                            className="btn-secondary"
                            style={{
                              fontSize: '0.8rem',
                              padding: '6px 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: job.status === 'in_progress' ? '#60a5fa' : 'var(--text-main)',
                              borderColor: job.status === 'in_progress' ? 'rgba(96, 165, 250, 0.4)' : 'var(--border-color)'
                            }}
                            onClick={() => {
                              setActiveConsoleJobId(job.id)
                              setIsConsoleModalOpen(true)
                              setIsConsoleDocked(false)
                            }}
                          >
                            <Terminal size={14} style={{ color: '#a78bfa' }} />
                            <span>{job.status === 'in_progress' ? 'Open Live Console' : 'View Operation Logs'}</span>
                          </button>
                        </div>

                        {job.error_message && (
                          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                            Error: {job.error_message}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-accordion-container">
              <div className="settings-toolbar">
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Application Settings</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '3px 0 0 0' }}>
                    Configure credentials, storage location, background queues, updates, and database maintenance.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      const allOpen = Object.values(expandedSections).every(Boolean)
                      setAllSections(!allOpen)
                    }}
                  >
                    <ChevronsUpDown size={14} />
                    <span>{Object.values(expandedSections).every(Boolean) ? 'Collapse All' : 'Expand All'}</span>
                  </button>
                </div>
              </div>

              {/* Section 1: User Session & Credentials */}
              <div
                id="settings-section-session"
                className={`settings-accordion-item ${expandedSections.session ? 'is-expanded' : ''} ${highlightedSection === 'session' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('session')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                      <Key size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>User Session & Instagram Credentials</h3>
                      <p>Session cookie for private media, followed accounts, stories, and rate limit protection</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className={`settings-badge ${userSession?.is_active ? 'success' : 'neutral'}`}>
                      {userSession?.is_active ? <><Shield size={12} /> Connected (@{userSession?.username || 'admin'})</> : 'No Active Session'}
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.session && (
                  <div className="settings-accordion-body">
                    <form onSubmit={handleSaveSession}>
                      <div className="settings-form-group">
                        <label className="settings-label">
                          Instagram Session Cookie (<code>sessionid</code>)
                        </label>
                        <div className="settings-input-wrapper">
                          <input
                            className="input-field"
                            type={showSessionKey ? 'text' : 'password'}
                            placeholder="Paste your Instagram sessionid cookie string here..."
                            value={sessionInput}
                            onChange={(e) => setSessionInput(e.target.value)}
                            style={{ paddingRight: '42px', margin: 0 }}
                          />
                          <button
                            type="button"
                            className="settings-input-action"
                            onClick={() => setShowSessionKey(!showSessionKey)}
                            title={showSessionKey ? 'Hide session cookie' : 'Show session cookie'}
                          >
                            {showSessionKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="settings-description">
                          Required for accessing private media, custom followed accounts, stories, and high-volume media requests without rate blocks.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                        <button type="submit" className="btn-primary" disabled={sessionSaveStatus === 'saving'}>
                          {sessionSaveStatus === 'saving' ? 'Saving...' : 'Save Session Cookie'}
                        </button>
                        {sessionSaveStatus === 'success' && (
                          <span style={{ color: '#10b981', fontSize: '0.84rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={16} /> Session cookie saved successfully!
                          </span>
                        )}
                        {sessionSaveStatus === 'error' && (
                          <span style={{ color: '#ef4444', fontSize: '0.84rem', fontWeight: '600' }}>
                            Failed to save session cookie.
                          </span>
                        )}
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Section 2: Engine & Storage Settings */}
              <div
                id="settings-section-storage"
                className={`settings-accordion-item ${expandedSections.storage ? 'is-expanded' : ''} ${highlightedSection === 'storage' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('storage')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                      <HardDrive size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>Engine, Queue & Storage Configuration</h3>
                      <p>Download folder path, batch scraping depth, parallel download workers, and cooldowns</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className="settings-badge neutral">
                      Local Storage
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.storage && (
                  <div className="settings-accordion-body">
                    <form onSubmit={handleSaveConfig}>
                      <div className="settings-form-group">
                        <label className="settings-label">Media Download Directory</label>
                        <input
                          className="input-field"
                          value={downloadDirInput}
                          onChange={(e) => setDownloadDirInput(e.target.value)}
                          style={{ margin: 0 }}
                        />
                        <p className="settings-description">
                          Directory on your filesystem where archived media and carousel zip bundles are saved.
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '12px' }}>
                        <div className="settings-form-group">
                          <label className="settings-label">Default Batch Depth</label>
                          <select
                            className="select-dropdown"
                            style={{ width: '100%', height: '42px' }}
                            value={maxPostsInput}
                            onChange={(e) => setMaxPostsInput(parseInt(e.target.value))}
                          >
                            <option value="0">🌟 Uncapped (Full Profile)</option>
                            <option value="500">⚡ 500 Posts / Reels</option>
                            <option value="200">⚡ 200 Posts / Reels</option>
                            <option value="100">⚡ 100 Posts / Reels</option>
                            <option value="50">⚡ 50 Posts / Reels</option>
                          </select>
                          <p className="settings-description">Default depth for scraping profiles.</p>
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Rate Limit Delay (Sec)</label>
                          <input
                            className="input-field"
                            type="number"
                            step="0.5"
                            min="1.0"
                            max="30.0"
                            value={rateLimitDelayInput}
                            onChange={(e) => setRateLimitDelayInput(e.target.value)}
                            style={{ margin: 0 }}
                          />
                          <p className="settings-description">Cooldown between media requests.</p>
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Auto-Sync Interval</label>
                          <select
                            className="select-dropdown"
                            style={{ width: '100%', height: '42px' }}
                            value={syncIntervalInput}
                            onChange={(e) => setSyncIntervalInput(e.target.value)}
                          >
                            <option value="2">Every 2 Hours</option>
                            <option value="4">Every 4 Hours</option>
                            <option value="6">Every 6 Hours</option>
                            <option value="12">Every 12 Hours</option>
                            <option value="24">Once Daily (24h)</option>
                          </select>
                          <p className="settings-description">Background interval for auto-sync.</p>
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Max Queue Limit</label>
                          <input
                            className="input-field"
                            type="number"
                            min="1"
                            max="50"
                            value={maxQueueLimitInput}
                            onChange={(e) => setMaxQueueLimitInput(e.target.value)}
                            style={{ margin: 0 }}
                          />
                          <p className="settings-description">Maximum queued & active batch jobs.</p>
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Parallel Download Workers</label>
                          <select
                            className="select-dropdown"
                            style={{ width: '100%', height: '42px' }}
                            value={maxWorkersInput}
                            onChange={(e) => setMaxWorkersInput(parseInt(e.target.value))}
                          >
                            <option value="1">1 Worker (Safest / Low CPU)</option>
                            <option value="2">2 Workers (Recommended / Fast)</option>
                            <option value="3">3 Workers (High Speed)</option>
                            <option value="4">4 Workers (Turbo)</option>
                          </select>
                          <p className="settings-description">Concurrent file downloads per batch.</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                        <button type="submit" className="btn-primary" disabled={configSaveStatus === 'saving'}>
                          {configSaveStatus === 'saving' ? 'Saving...' : 'Save Configuration'}
                        </button>
                        {configSaveStatus === 'success' && (
                          <span style={{ color: '#10b981', fontSize: '0.84rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={16} /> Configuration updated!
                          </span>
                        )}
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Section 3: Database & Media Maintenance */}
              <div
                id="settings-section-maintenance"
                className={`settings-accordion-item ${expandedSections.maintenance ? 'is-expanded' : ''} ${highlightedSection === 'maintenance' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('maintenance')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                      <FolderDown size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>Database & Storage Maintenance</h3>
                      <p>Verify disk media integrity, audit saved files, and database record synchronization</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className="settings-badge neutral">
                      Maintenance
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.maintenance && (
                  <div className="settings-accordion-body">
                    <div className="maintenance-item">
                      <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        Verify Disk Media Files
                      </div>
                      <p className="settings-description">
                        Scans your download folder (<code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{downloadDirInput}</code>) to verify that saved files exist. Reconciles deleted files so you can re-download them.
                      </p>
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleVerifyDisk}
                          disabled={verifyingDisk}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <HardDrive size={15} className={verifyingDisk ? 'animate-spin' : ''} />
                          <span>{verifyingDisk ? 'Verifying Files...' : 'Verify Disk Files Now'}</span>
                        </button>
                      </div>
                      {verifyDiskStatus && (
                        <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#60a5fa', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} />
                          <span>{verifyDiskStatus.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="maintenance-item" style={{ marginTop: '12px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--accent-red)' }}>
                        Reset Downloaded Content List
                      </div>
                      <p className="settings-description">
                        Clears all download records in the database. This restores the active "Save Media" button across all profile views.
                      </p>
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleResetDownloads}
                          disabled={resettingDownloads}
                          style={{ color: 'var(--accent-red)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RotateCcw size={15} />
                          <span>{resettingDownloads ? 'Resetting...' : 'Reset All Download Records'}</span>
                        </button>
                      </div>
                      {resetStatus && (
                        <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#f87171', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} />
                          <span>{resetStatus.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Version, Software Updates & System Environment */}
              <div
                id="settings-section-version"
                className={`settings-accordion-item ${expandedSections.version ? 'is-expanded' : ''} ${highlightedSection === 'version' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('version')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                      <Activity size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>Version, Software Updates & System Environment</h3>
                      <p>InstaSave version, git commit history, operating environment, and live update checking</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className={`settings-badge ${systemVersion?.update_available ? 'warning' : 'success'}`} style={systemVersion?.update_available ? { background: 'rgba(167,139,250,0.2)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' } : {}}>
                      {systemVersion?.update_available ? <><Sparkles size={12} /> Update Available (v{systemVersion.latest_version})</> : '● Up to date'}
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.version && (
                  <div className="settings-accordion-body">
                    <table className="info-table">
                      <tbody>
                        <tr>
                          <td className="label">Application Version</td>
                          <td className="value">
                            <strong>v{systemVersion?.version || '1.0.0'}</strong>
                            {systemVersion?.update_available && (
                              <span style={{ marginLeft: '8px', color: '#a78bfa', fontSize: '0.8rem', fontWeight: '600' }}>
                                (→ v{systemVersion.latest_version} Available)
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="label">Git Commit & Branch</td>
                          <td className="value" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                              #{systemVersion?.commit_hash || 'HEAD'}
                            </code>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({systemVersion?.branch || 'main'})</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="label">Operating System</td>
                          <td className="value">{systemVersion?.distro_name || 'Fedora Linux 44 (Workstation Edition)'}</td>
                        </tr>
                        <tr>
                          <td className="label">Backend Runtime</td>
                          <td className="value">Python {systemVersion?.python_version || '3.14'} (FastAPI + Uvicorn)</td>
                        </tr>
                        <tr>
                          <td className="label">Database Storage</td>
                          <td className="value">SQLite 3 (WAL Mode Active)</td>
                        </tr>
                        <tr>
                          <td className="label">Local Port & Service</td>
                          <td className="value"><code>instasave.service</code> • http://127.0.0.1:8484</td>
                        </tr>
                        <tr>
                          <td className="label">Rate Limit Quota</td>
                          <td className="value">
                            {rateLimitStatus 
                              ? `${rateLimitStatus.requests_made_last_hour} / ${rateLimitStatus.max_requests_per_hour} req/hr (${rateLimitStatus.utilization_percentage}%)`
                              : 'Measuring...'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Version Actions Toolbar */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleCheckUpdate()}
                        disabled={checkingUpdate}
                      >
                        <RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''} />
                        <span>{checkingUpdate ? 'Checking Upstream...' : 'Check for Updates'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                        onClick={() => setIsUpdateModalOpen(true)}
                      >
                        <span>View Release Details</span>
                      </button>

                      {/* Test update simulation toggle button for user testing */}
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          color: systemVersion?.update_available ? '#f87171' : '#a78bfa',
                          borderColor: systemVersion?.update_available ? 'rgba(239,68,68,0.3)' : 'rgba(167,139,250,0.3)'
                        }}
                        onClick={() => handleCheckUpdate(systemVersion?.update_available ? false : true)}
                        title={systemVersion?.update_available ? 'Reset test update state' : 'Simulate a new update (v1.1.0) to test notification banner'}
                      >
                        <Sparkles size={13} />
                        <span>{systemVersion?.update_available ? 'Reset Update Test' : 'Test Update Notification'}</span>
                      </button>
                    </div>

                    {systemVersion?.update_available && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: 'rgba(167, 139, 250, 0.1)',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        color: '#c4b5fd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={16} />
                          <span><strong>{systemVersion.update_status_text}</strong> • Run <code style={{ color: '#34d399', background: '#0a0d14', padding: '2px 6px', borderRadius: '4px' }}>./install.sh --update</code> to apply.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
        onBulkAddProfiles={handleBulkAddProfiles}
        onRemoveProfile={handleRemoveProfile}
        onSelectProfile={(username) => {
          setSelectedUserFilter(username)
          setSearchQuery('')
          setActiveTab('dashboard')
        }}
      />

      <BatchConfigModal
        isOpen={!!batchTargetUser}
        username={batchTargetUser}
        defaultLimit={maxPostsInput}
        onClose={() => setBatchTargetUser(null)}
        onStartBatch={handleStartBatchUserDownload}
      />

      <ConsoleModal
        isOpen={isConsoleModalOpen}
        jobId={activeConsoleJobId}
        initialJob={activeConsoleJob}
        onClose={() => {
          setIsConsoleModalOpen(false)
          setIsConsoleDocked(false)
        }}
        onMinimize={() => {
          setIsConsoleModalOpen(false)
          setIsConsoleDocked(true)
        }}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        systemVersion={systemVersion}
        onCheckUpdate={() => handleCheckUpdate()}
        checkingUpdate={checkingUpdate}
      />
    </div>
  )
}

