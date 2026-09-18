import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MediaCard from './components/MediaCard'
import WatchedProfilesModal from './components/WatchedProfilesModal'
import ConsoleModal from './components/ConsoleModal'
import BatchConfigModal from './components/BatchConfigModal'
import UpdateModal from './components/UpdateModal'
import DevToolsGuideModal from './components/DevToolsGuideModal'
import LoginScreen from './components/LoginScreen'
import ProfileAvatar from './components/ProfileAvatar'
import { Download, RefreshCw, Layers, CheckCircle2, Shield, Eye, EyeOff, Users, UserCheck, Key, Settings as SettingsIcon, HardDrive, RotateCcw, Trash2, AlertCircle, ExternalLink, FolderDown, Clock, Loader2, Activity, Terminal, Sparkles, GitBranch, TerminalSquare, ChevronDown, ChevronUp, ChevronsUpDown, Monitor, BookOpen, AlertTriangle, Lock, BarChart3, Server, Cpu, Copy, Check, Box, Boxes, PieChart, ShieldCheck } from 'lucide-react'

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
  const [crawlerStatus, setCrawlerStatus] = useState({
    is_running: false,
    current_username: '',
    current_index: 0,
    total_accounts: 0,
    new_posts_saved: 0,
    status_message: 'Idle'
  })
  const [selectedUserFilter, setSelectedUserFilter] = useState(null)
  const [sessionInput, setSessionInput] = useState('')
  const [sessionUsernameInput, setSessionUsernameInput] = useState('')
  const [showSessionKey, setShowSessionKey] = useState(false)
  const [sessionSaveStatus, setSessionSaveStatus] = useState(null)
  const [sessionTesting, setSessionTesting] = useState(false)
  const [sessionTestResult, setSessionTestResult] = useState(null)
  const [configSaveStatus, setConfigSaveStatus] = useState(null)
  const [downloadDirInput, setDownloadDirInput] = useState('~/Downloads/ZenGram')
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
  const [isDevToolsGuideOpen, setIsDevToolsGuideOpen] = useState(false)
  const [interactiveLoginState, setInteractiveLoginState] = useState(null)
  const [isStartingBrowserLogin, setIsStartingBrowserLogin] = useState(false)
  const [displayInfo, setDisplayInfo] = useState(null)
  const [showResourceGuide, setShowResourceGuide] = useState(false)

  // Pagination & Infinite Scroll State
  const [feedPage, setFeedPage] = useState(1)
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedHasMore, setFeedHasMore] = useState(false)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)

  const [downloadsPage, setDownloadsPage] = useState(1)
  const [downloadsTotal, setDownloadsTotal] = useState(0)
  const [downloadsHasMore, setDownloadsHasMore] = useState(false)
  const [downloadsLoadingMore, setDownloadsLoadingMore] = useState(false)

  const feedSentinelRef = React.useRef(null)
  const downloadsSentinelRef = React.useRef(null)
  
  // Master Authentication & Security State
  const [authStatus, setAuthStatus] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('')
  const [passwordChangeStatus, setPasswordChangeStatus] = useState(null)
  const [authToggleStatus, setAuthToggleStatus] = useState(null)

  const [appStats, setAppStats] = useState(null)
  const [fetchingStats, setFetchingStats] = useState(false)
  const [systemHardware, setSystemHardware] = useState(null)
  const [fetchingHardware, setFetchingHardware] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)

  const [expandedSections, setExpandedSections] = useState({
    stats: true,
    systemInfo: false,
    session: false,
    storage: false,
    maintenance: false,
    version: false,
    security: false
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
      stats: expand,
      systemInfo: expand,
      session: expand,
      storage: expand,
      maintenance: expand,
      version: expand,
      security: expand
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

  // Fetch Feed Media (supports pagination and appending next page chunk)
  const fetchFeed = async (page = 1, append = false) => {
    try {
      if (append) {
        setFeedLoadingMore(true)
      }
      let url = `/api/v1/feed?page=${page}&page_size=36&content_type=${contentType}`
      if (selectedUserFilter) {
        url += `&filter_user=${encodeURIComponent(selectedUserFilter)}`
      }
      if (searchQuery) {
        url += `&query_search=${encodeURIComponent(searchQuery)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const items = data.items || (Array.isArray(data) ? data : [])
        if (append) {
          setMediaItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id || i.post_id))
            const newUnique = items.filter((i) => !existingIds.has(i.id || i.post_id))
            return [...prev, ...newUnique]
          })
        } else {
          setMediaItems(items)
        }
        setFeedPage(data.page || page)
        setFeedTotal(data.total_items ?? items.length)
        setFeedHasMore(data.has_next ?? false)
      }
    } catch (err) {
      console.error('Error fetching feed:', err)
    } finally {
      if (append) {
        setFeedLoadingMore(false)
      }
    }
  }

  // Fetch Downloaded Content (supports pagination and appending next page chunk)
  const fetchDownloadedContent = async (page = 1, append = false) => {
    try {
      if (append) {
        setDownloadsLoadingMore(true)
      }
      let url = `/api/v1/downloads?page=${page}&page_size=36&content_type=${contentType}`
      if (selectedUserFilter) {
        url += `&filter_user=${encodeURIComponent(selectedUserFilter)}`
      }
      if (searchQuery) {
        url += `&query_search=${encodeURIComponent(searchQuery)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const items = data.items || (Array.isArray(data) ? data : [])
        if (append) {
          setDownloadedItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id || i.post_id))
            const newUnique = items.filter((i) => !existingIds.has(i.id || i.post_id))
            return [...prev, ...newUnique]
          })
        } else {
          setDownloadedItems(items)
        }
        setDownloadsPage(data.page || page)
        setDownloadsTotal(data.total_items ?? items.length)
        setDownloadsHasMore(data.has_next ?? false)
      }
    } catch (err) {
      console.error('Error fetching downloaded content:', err)
    } finally {
      if (append) {
        setDownloadsLoadingMore(false)
      }
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
        if (data.username && data.username !== 'admin') {
          setSessionUsernameInput(data.username)
        }
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
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const res = await fetch('/api/v1/system/check-update', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSystemVersion(data)
      }
    } catch (err) {
      console.error('Error checking updates:', err)
    } finally {
      setCheckingUpdate(false)
    }
  }

  // Fetch Master Auth Status (HttpOnly Cookie & Setup Check)
  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/v1/auth/status')
      if (res.ok) {
        const data = await res.json()
        setAuthStatus(data)
      }
    } catch (err) {
      console.error('Error checking master auth status:', err)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Fetch Application & Download Stats
  const fetchAppStats = async (forceRefresh = false) => {
    try {
      setFetchingStats(true)
      const res = await fetch(`/api/v1/system/stats${forceRefresh ? '?refresh=true' : ''}`)
      if (res.ok) {
        const data = await res.json()
        setAppStats(data)
      }
    } catch (err) {
      console.error('Error fetching application stats:', err)
    } finally {
      setFetchingStats(false)
    }
  }

  // Fetch System Information & Hardware Telemetry
  const fetchSystemHardware = async () => {
    try {
      setFetchingHardware(true)
      const res = await fetch('/api/v1/system/hardware')
      if (res.ok) {
        const data = await res.json()
        setSystemHardware(data)
      }
    } catch (err) {
      console.error('Error fetching system hardware info:', err)
    } finally {
      setFetchingHardware(false)
    }
  }

  const handleCopyDownloadPath = () => {
    if (appStats?.download_directory) {
      navigator.clipboard.writeText(appStats.download_directory)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 2000)
    }
  }

  useEffect(() => {
    fetchAuthStatus()
  }, [])

  useEffect(() => {
    if (!authStatus?.is_setup_required && (authStatus?.is_authenticated || !authStatus?.auth_enabled)) {
      fetchFeed(1, false)
      fetchDownloadedContent(1, false)
      fetchProfiles()
      fetchUserSession()
      fetchRateLimit()
      fetchAppSettings()
      fetchSystemVersion()
      fetchDisplayInfo()
      fetchAppStats()
      fetchSystemHardware()
      const interval = setInterval(fetchRateLimit, 30000)
      return () => clearInterval(interval)
    }
  }, [authStatus, contentType, searchQuery, selectedUserFilter, activeTab])

  // Infinite Scroll Observer for Dashboard Feed
  useEffect(() => {
    if (activeTab !== 'dashboard' || !feedHasMore || feedLoadingMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchFeed(feedPage + 1, true)
      }
    }, { rootMargin: '300px' })
    if (feedSentinelRef.current) {
      observer.observe(feedSentinelRef.current)
    }
    return () => observer.disconnect()
  }, [activeTab, feedHasMore, feedLoadingMore, feedPage, contentType, selectedUserFilter, searchQuery])

  // Infinite Scroll Observer for Downloaded Content
  useEffect(() => {
    if (activeTab !== 'downloads' || !downloadsHasMore || downloadsLoadingMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchDownloadedContent(downloadsPage + 1, true)
      }
    }, { rootMargin: '300px' })
    if (downloadsSentinelRef.current) {
      observer.observe(downloadsSentinelRef.current)
    }
    return () => observer.disconnect()
  }, [activeTab, downloadsHasMore, downloadsLoadingMore, downloadsPage, contentType, selectedUserFilter, searchQuery])

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' })
      setAuthStatus((prev) => ({ ...prev, is_authenticated: false }))
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  const handleChangeMasterPassword = async (e) => {
    e.preventDefault()
    setPasswordChangeStatus('saving')
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordChangeStatus('mismatch')
      return
    }
    if (newPasswordInput.length < 6) {
      setPasswordChangeStatus('short')
      return
    }
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPasswordInput,
          new_password: newPasswordInput
        })
      })
      if (res.ok) {
        setPasswordChangeStatus('success')
        setCurrentPasswordInput('')
        setNewPasswordInput('')
        setConfirmNewPasswordInput('')
        setTimeout(() => setPasswordChangeStatus(null), 4000)
      } else {
        const err = await res.json()
        setPasswordChangeStatus(err.detail || 'error')
      }
    } catch (err) {
      setPasswordChangeStatus('Network error changing password.')
    }
  }

  const handleToggleAuthRequirement = async (enabled) => {
    setAuthToggleStatus('saving')
    try {
      const res = await fetch('/api/v1/auth/security-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_enabled: enabled })
      })
      if (res.ok) {
        const data = await res.json()
        setAuthStatus((prev) => ({ ...prev, auth_enabled: data.auth_enabled }))
        setAuthToggleStatus('success')
        setTimeout(() => setAuthToggleStatus(null), 3000)
      } else {
        setAuthToggleStatus('error')
      }
    } catch (err) {
      setAuthToggleStatus('error')
    }
  }

  // Fetch Display Info for Browser Mode
  const fetchDisplayInfo = async () => {
    try {
      const res = await fetch('/api/v1/auth/display-info')
      if (res.ok) {
        const data = await res.json()
        setDisplayInfo(data)
      }
    } catch (err) {
      console.error('Error fetching display info:', err)
    }
  }

  // Interactive Login Poller
  useEffect(() => {
    let interval = null
    if (interactiveLoginState?.is_running) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/v1/auth/interactive-login/status')
          if (res.ok) {
            const data = await res.json()
            setInteractiveLoginState(data)
            if (!data.is_running) {
              clearInterval(interval)
              if (data.status === 'success') {
                await fetchUserSession()
              }
            }
          }
        } catch (err) {
          console.error('Error polling login status:', err)
        }
      }, 2000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [interactiveLoginState?.is_running])

  const fetchCrawlerStatus = async () => {
    try {
      const res = await fetch('/api/v1/feed/sync-status')
      if (res.ok) {
        const data = await res.json()
        setCrawlerStatus(data)
        return data
      }
    } catch (err) {
      console.error('Error fetching crawler status:', err)
    }
    return null
  }

  const handleStopSync = async () => {
    try {
      const res = await fetch('/api/v1/feed/sync-stop', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.crawler) setCrawlerStatus(data.crawler)
      }
    } catch (err) {
      console.error('Error stopping sync:', err)
    }
  }

  useEffect(() => {
    fetchCrawlerStatus()
  }, [])

  useEffect(() => {
    let timer = null
    if (crawlerStatus?.is_running) {
      timer = setInterval(async () => {
        const status = await fetchCrawlerStatus()
        if (status) {
          // Progressively refresh the feed & profiles during crawl
          fetchFeed(1, false)
          fetchProfiles()
          if (!status.is_running) {
            fetchAppStats()
            fetchRateLimit()
          }
        }
      }, 2500)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [crawlerStatus?.is_running])

  const handleRunSync = async () => {
    setSyncing(true)
    const startTime = Date.now()
    try {
      // 1. Trigger backend feed & followed accounts sync & crawler
      const res = await fetch('/api/v1/feed/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.crawler) setCrawlerStatus(data.crawler)
      } else {
        await fetch('/api/v1/profiles/sync-following', { method: 'POST' })
      }
      await fetchCrawlerStatus()
    } catch (err) {
      console.error('Error running full sync:', err)
    } finally {
      // 2. Refresh local state
      await Promise.allSettled([
        fetchFeed(),
        fetchProfiles(),
        fetchDownloadedContent(),
        fetchRateLimit(),
        fetchSystemVersion(),
        fetchAppStats(),
        fetchSystemHardware()
      ])

      // Ensure minimum visual feedback duration so user clearly sees "Syncing..." state
      const elapsed = Date.now() - startTime
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed))
      }
      setSyncing(false)
    }
  }

  const handleSyncFollowed = async () => {
    setSyncingFollowed(true)
    try {
      const res = await fetch('/api/v1/profiles/sync-following', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        await fetchProfiles()
        await fetchUserSession()
        alert(`Successfully synced ${data.length} followed accounts from Instagram!`)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.detail || 'Failed to sync followed accounts from Instagram.')
      }
    } catch (err) {
      console.error('Error syncing followed accounts:', err)
      alert('Network error while syncing followed accounts.')
    } finally {
      setSyncingFollowed(false)
    }
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
    if (e) e.preventDefault()
    setSessionSaveStatus('saving')
    setSessionTestResult(null)
    const targetUsername = sessionUsernameInput.trim().replace(/^@/, '') || (userSession?.username && userSession.username !== 'admin' ? userSession.username : '')
    try {
      const payload = {
        username: targetUsername
      }
      if (sessionInput && sessionInput.trim()) {
        payload.session_cookie = sessionInput.trim()
      }
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const savedData = await res.json()
        setUserSession(savedData)
        if (savedData.username && savedData.username !== 'admin') {
          setSessionUsernameInput(savedData.username)
        }
        setSessionInput('')
        await fetchUserSession()
        setSessionSaveStatus('success')
        
        // Auto-test with Instagram
        try {
          const testPayload = {
            username: savedData.username || targetUsername
          }
          if (sessionInput && sessionInput.trim()) {
            testPayload.session_cookie = sessionInput.trim()
          }
          const testRes = await fetch('/api/v1/auth/session/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
          })
          if (testRes.ok) {
            const testData = await testRes.json()
            setSessionTestResult(testData)
            if (testData.username && testData.username !== 'admin') {
              setSessionUsernameInput(testData.username)
            }
            if (testData.profile_pic_url) {
              await fetchUserSession()
            }
          }
        } catch (testErr) {
          console.error('Error auto-testing session:', testErr)
        }
        setTimeout(() => setSessionSaveStatus(null), 6000)
      } else {
        setSessionSaveStatus('error')
      }
    } catch (err) {
      console.error('Error saving session cookie:', err)
      setSessionSaveStatus('error')
    }
  }

  const handleTestSession = async () => {
    setSessionTesting(true)
    setSessionTestResult(null)
    const targetUsername = sessionUsernameInput.trim().replace(/^@/, '') || (userSession?.username && userSession.username !== 'admin' ? userSession.username : '')
    try {
      const payload = {
        username: targetUsername
      }
      if (sessionInput && sessionInput.trim()) {
        payload.session_cookie = sessionInput.trim()
      }
      const res = await fetch('/api/v1/auth/session/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      setSessionTestResult(data)
      if (data.is_valid && data.username && data.username !== 'admin') {
        setSessionUsernameInput(data.username)
        await fetchUserSession()
      }
    } catch (err) {
      setSessionTestResult({ is_valid: false, message: 'Network error communicating with ZenGram server.' })
    } finally {
      setSessionTesting(false)
    }
  }

  const handleStartInteractiveLogin = async () => {
    setIsStartingBrowserLogin(true)
    try {
      const res = await fetch('/api/v1/auth/interactive-login', { method: 'POST' })
      const data = await res.json()
      setInteractiveLoginState(data)
      if (data.status === 'headless_detected') {
        setIsDevToolsGuideOpen(true)
      }
    } catch (err) {
      console.error('Failed to start interactive login:', err)
      setInteractiveLoginState({
        status: 'error',
        message: 'Failed to launch browser login service.'
      })
    } finally {
      setIsStartingBrowserLogin(false)
    }
  }

  const handleCancelInteractiveLogin = async () => {
    try {
      await fetch('/api/v1/auth/interactive-login/cancel', { method: 'POST' })
      setInteractiveLoginState(null)
    } catch (err) {
      console.error('Failed to cancel interactive login:', err)
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

  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17' }}>
        <Loader2 size={38} className="animate-spin" style={{ color: '#60a5fa' }} />
      </div>
    )
  }

  if (authStatus?.is_setup_required || (!authStatus?.is_authenticated && authStatus?.auth_enabled)) {
    return (
      <LoginScreen
        isSetupRequired={authStatus?.is_setup_required}
        onSuccess={fetchAuthStatus}
      />
    )
  }

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
        onLogout={handleLogout}
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
          crawlerStatus={crawlerStatus}
          systemVersion={systemVersion}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          onNavigateToSettings={navigateToSettingsSection}
        />

        <div className="content-body">
          {/* Active Background Feed Crawler Banner */}
          {crawlerStatus?.is_running && activeTab === 'dashboard' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(15, 23, 42, 0.4))',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ color: '#60a5fa' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#93c5fd' }}>
                    Syncing Followed Accounts Feed ({crawlerStatus.current_index} of {crawlerStatus.total_accounts})
                  </span>
                  {crawlerStatus.current_username && (
                    <span className="unfollowed-tag" style={{ fontSize: '0.78rem' }}>
                      @{crawlerStatus.current_username}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {crawlerStatus.new_posts_saved > 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
                      +{crawlerStatus.new_posts_saved} new posts saved
                    </span>
                  )}
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.76rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                    onClick={handleStopSync}
                  >
                    Cancel Sync
                  </button>
                </div>
              </div>
              
              {/* Progress bar */}
              <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${crawlerStatus.total_accounts > 0 ? (crawlerStatus.current_index / crawlerStatus.total_accounts) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          )}
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
              <div>
                <div className="media-grid">
                  {mediaItems.map((item) => (
                    <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} />
                  ))}
                </div>

                {/* Infinite Scroll Sentinel & Load More Controls */}
                {feedHasMore && (
                  <div className="pagination-load-more-container">
                    <div ref={feedSentinelRef} style={{ height: '10px', width: '100%' }} />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      onClick={() => fetchFeed(feedPage + 1, true)}
                      disabled={feedLoadingMore}
                    >
                      {feedLoadingMore ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      <span>{feedLoadingMore ? 'Loading More Posts...' : `Load More Posts (${mediaItems.length} of ${feedTotal.toLocaleString()})`}</span>
                    </button>
                  </div>
                )}

                {!feedHasMore && mediaItems.length > 0 && (
                  <div className="pagination-end-badge">
                    <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                    <span>You've reached the end of your feed ({feedTotal.toLocaleString()} posts)</span>
                  </div>
                )}
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
                <div>
                  <div className="media-grid">
                    {downloadedItems.map((item) => (
                      <MediaCard key={item.id} item={item} onSaveMedia={handleSaveMedia} onDeleteMedia={handleDeleteMedia} />
                    ))}
                  </div>

                  {/* Infinite Scroll Sentinel & Load More Controls */}
                  {downloadsHasMore && (
                    <div className="pagination-load-more-container">
                      <div ref={downloadsSentinelRef} style={{ height: '10px', width: '100%' }} />
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => fetchDownloadedContent(downloadsPage + 1, true)}
                        disabled={downloadsLoadingMore}
                      >
                        {downloadsLoadingMore ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        <span>{downloadsLoadingMore ? 'Loading More Saved Posts...' : `Load More Downloads (${downloadedItems.length} of ${downloadsTotal.toLocaleString()})`}</span>
                      </button>
                    </div>
                  )}

                  {!downloadsHasMore && downloadedItems.length > 0 && (
                    <div className="pagination-end-badge">
                      <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                      <span>All {downloadsTotal.toLocaleString()} saved posts loaded</span>
                    </div>
                  )}
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
                    <ProfileAvatar
                      username={userSession?.username || 'admin'}
                      profilePicUrl={userSession?.profile_pic_url}
                      className="user-avatar"
                      style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                    />
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

              {/* Section: Application & Download Statistics */}
              <div
                id="settings-section-stats"
                className={`settings-accordion-item ${expandedSections.stats ? 'is-expanded' : ''} ${highlightedSection === 'stats' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('stats')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                      <BarChart3 size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>Application & Download Statistics</h3>
                      <p>Overview of followed accounts, tracked profiles, downloaded media volume, and storage metrics</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className="settings-badge success">
                      {appStats ? `${appStats.download_dir_size_formatted} Saved • ${appStats.total_saved_posts.toLocaleString()} Posts` : 'Loading Stats...'}
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.stats && (
                  <div className="settings-accordion-body">
                    {/* 4-Card KPI Stat Grid */}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-card-header">
                          <span className="stat-card-label">Followed Accounts</span>
                          <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                            <Users size={16} />
                          </div>
                        </div>
                        <div>
                          <div className="stat-card-value">
                            {appStats ? appStats.total_followed_accounts.toLocaleString() : '...'}
                          </div>
                          <div className="stat-card-sub">Profiles followed on Instagram</div>
                        </div>
                        <button
                          type="button"
                          className="stat-card-action"
                          onClick={() => setActiveTab('followed')}
                        >
                          View Followed →
                        </button>
                      </div>

                      <div className="stat-card">
                        <div className="stat-card-header">
                          <span className="stat-card-label">Tracked Accounts</span>
                          <div className="stat-card-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                            <Eye size={16} />
                          </div>
                        </div>
                        <div>
                          <div className="stat-card-value">
                            {appStats ? appStats.total_tracked_accounts.toLocaleString() : '...'}
                          </div>
                          <div className="stat-card-sub">Unfollowed custom watched</div>
                        </div>
                        <button
                          type="button"
                          className="stat-card-action"
                          onClick={() => setActiveTab('watched')}
                        >
                          View Tracked →
                        </button>
                      </div>

                      <div className="stat-card">
                        <div className="stat-card-header">
                          <span className="stat-card-label">Saved Media Posts</span>
                          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                            <HardDrive size={16} />
                          </div>
                        </div>
                        <div>
                          <div className="stat-card-value">
                            {appStats ? appStats.total_saved_posts.toLocaleString() : '...'}
                          </div>
                          <div className="stat-card-sub">Downloaded posts & reels on disk</div>
                        </div>
                        <button
                          type="button"
                          className="stat-card-action"
                          onClick={() => setActiveTab('downloads')}
                        >
                          View Content →
                        </button>
                      </div>

                      <div className="stat-card">
                        <div className="stat-card-header">
                          <span className="stat-card-label">Download Storage</span>
                          <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                            <FolderDown size={16} />
                          </div>
                        </div>
                        <div>
                          <div className="stat-card-value">
                            {appStats ? appStats.download_dir_size_formatted : '...'}
                          </div>
                          <div className="stat-card-sub">
                            {appStats ? `${appStats.download_dir_file_count.toLocaleString()} media files on disk` : 'Calculating...'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Total Directory Size
                        </span>
                      </div>
                    </div>

                    {/* Download Directory Path Bar */}
                    <div className="stat-download-path-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', flexShrink: 0 }}>
                          <FolderDown size={18} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                            Configured Download Directory
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {appStats?.download_directory || 'Loading...'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={handleCopyDownloadPath}
                        >
                          {copiedPath ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                          <span>{copiedPath ? 'Copied!' : 'Copy Path'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Drive Storage Volume Gauge */}
                    {appStats && (
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HardDrive size={14} style={{ color: '#60a5fa' }} /> Download Drive Capacity ({appStats.download_directory})
                          </span>
                          <span style={{ fontWeight: '700', color: appStats.disk_used_percentage > 85 ? '#ef4444' : appStats.disk_used_percentage > 70 ? '#f59e0b' : '#34d399' }}>
                            {appStats.disk_used_percentage}% Used
                          </span>
                        </div>
                        <div className="resource-bar-track">
                          <div
                            className={`resource-bar-fill ${appStats.disk_used_percentage > 85 ? 'critical' : appStats.disk_used_percentage > 70 ? 'warning' : 'safe'}`}
                            style={{ width: `${Math.min(appStats.disk_used_percentage, 100)}%` }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>Used: <strong>{appStats.disk_used_formatted}</strong> of {appStats.disk_total_formatted}</span>
                          <span>Available Free: <strong style={{ color: '#34d399' }}>{appStats.disk_free_formatted}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Refresh Stats Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => fetchAppStats(true)}
                        disabled={fetchingStats}
                      >
                        <RefreshCw size={14} className={fetchingStats ? 'animate-spin' : ''} />
                        <span>{fetchingStats ? 'Scanning Storage...' : 'Refresh Stats & Re-scan Disk'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section: System Information & Hardware Telemetry */}
              <div
                id="settings-section-system-info"
                className={`settings-accordion-item ${expandedSections.systemInfo ? 'is-expanded' : ''} ${highlightedSection === 'systemInfo' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('systemInfo')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                      <Server size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>System Information & Hardware Resources</h3>
                      <p>Real-time OS, CPU, RAM, swap, and disk telemetry optimized for local & LXC environments</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className="settings-badge info" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      {systemHardware?.is_container ? <><Box size={12} /> {systemHardware.container_type}</> : <><Server size={12} /> {systemHardware?.hostname || 'Host'}</>}
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.systemInfo && (
                  <div className="settings-accordion-body">
                    {/* Live Resource Meters (CPU, RAM, Swap, Disk) */}
                    <div className="resource-meters-grid">
                      {/* CPU Meter */}
                      <div className="resource-meter-card">
                        <div className="resource-meter-header">
                          <div className="resource-meter-title">
                            <Cpu size={15} style={{ color: '#60a5fa' }} />
                            <span>CPU Usage</span>
                          </div>
                          <div className="resource-meter-pct" style={{ color: (systemHardware?.cpu_usage_percent || 0) > 85 ? '#ef4444' : (systemHardware?.cpu_usage_percent || 0) > 70 ? '#f59e0b' : '#34d399' }}>
                            {systemHardware?.cpu_usage_percent ?? 0}%
                          </div>
                        </div>
                        <div className="resource-bar-track">
                          <div
                            className={`resource-bar-fill ${(systemHardware?.cpu_usage_percent || 0) > 85 ? 'critical' : (systemHardware?.cpu_usage_percent || 0) > 70 ? 'warning' : 'safe'}`}
                            style={{ width: `${Math.min(systemHardware?.cpu_usage_percent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="resource-meter-sub">
                          {systemHardware?.cpu_cores_logical || 1} Cores ({systemHardware?.cpu_cores_physical || 1} Phys) • Load: {systemHardware?.load_average?.join(', ') || 'N/A'}
                        </div>
                      </div>

                      {/* RAM Meter */}
                      <div className="resource-meter-card">
                        <div className="resource-meter-header">
                          <div className="resource-meter-title">
                            <Activity size={15} style={{ color: '#34d399' }} />
                            <span>RAM Memory</span>
                          </div>
                          <div className="resource-meter-pct" style={{ color: (systemHardware?.ram_usage_percent || 0) > 85 ? '#ef4444' : (systemHardware?.ram_usage_percent || 0) > 70 ? '#f59e0b' : '#34d399' }}>
                            {systemHardware?.ram_usage_percent ?? 0}%
                          </div>
                        </div>
                        <div className="resource-bar-track">
                          <div
                            className={`resource-bar-fill ${(systemHardware?.ram_usage_percent || 0) > 85 ? 'critical' : (systemHardware?.ram_usage_percent || 0) > 70 ? 'warning' : 'safe'}`}
                            style={{ width: `${Math.min(systemHardware?.ram_usage_percent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="resource-meter-sub">
                          {systemHardware?.ram_used_formatted || '0 B'} used / {systemHardware?.ram_total_formatted || '0 B'} ({systemHardware?.ram_free_formatted || '0 B'} free)
                        </div>
                      </div>

                      {/* Swap Meter */}
                      <div className="resource-meter-card">
                        <div className="resource-meter-header">
                          <div className="resource-meter-title">
                            <Layers size={15} style={{ color: '#c084fc' }} />
                            <span>Swap Space</span>
                          </div>
                          <div className="resource-meter-pct" style={{ color: (systemHardware?.swap_usage_percent || 0) > 85 ? '#ef4444' : (systemHardware?.swap_usage_percent || 0) > 70 ? '#f59e0b' : '#c084fc' }}>
                            {systemHardware?.swap_usage_percent ?? 0}%
                          </div>
                        </div>
                        <div className="resource-bar-track">
                          <div
                            className={`resource-bar-fill ${(systemHardware?.swap_usage_percent || 0) > 85 ? 'critical' : (systemHardware?.swap_usage_percent || 0) > 70 ? 'warning' : 'safe'}`}
                            style={{ width: `${Math.min(systemHardware?.swap_usage_percent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="resource-meter-sub">
                          {systemHardware?.swap_used_formatted || '0 B'} used / {systemHardware?.swap_total_formatted || '0 B'}
                        </div>
                      </div>

                      {/* Root Disk Meter */}
                      <div className="resource-meter-card">
                        <div className="resource-meter-header">
                          <div className="resource-meter-title">
                            <HardDrive size={15} style={{ color: '#fbbf24' }} />
                            <span>Root Storage (/)</span>
                          </div>
                          <div className="resource-meter-pct" style={{ color: (systemHardware?.disk_usage_percent || 0) > 85 ? '#ef4444' : (systemHardware?.disk_usage_percent || 0) > 70 ? '#f59e0b' : '#34d399' }}>
                            {systemHardware?.disk_usage_percent ?? 0}%
                          </div>
                        </div>
                        <div className="resource-bar-track">
                          <div
                            className={`resource-bar-fill ${(systemHardware?.disk_usage_percent || 0) > 85 ? 'critical' : (systemHardware?.disk_usage_percent || 0) > 70 ? 'warning' : 'safe'}`}
                            style={{ width: `${Math.min(systemHardware?.disk_usage_percent || 0, 100)}%` }}
                          />
                        </div>
                        <div className="resource-meter-sub">
                          {systemHardware?.disk_used_formatted || '0 B'} used / {systemHardware?.disk_total_formatted || '0 B'} ({systemHardware?.disk_free_formatted || '0 B'} free)
                        </div>
                      </div>
                    </div>

                    {/* Detailed Telemetry Table */}
                    <table className="info-table">
                      <tbody>
                        <tr>
                          <td className="label">Host & Operating System</td>
                          <td className="value">{systemHardware?.os_name || 'Detecting OS...'}</td>
                        </tr>
                        <tr>
                          <td className="label">Linux Kernel & Arch</td>
                          <td className="value">{systemHardware?.kernel_version || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="label">Environment / Virtualization</td>
                          <td className="value" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <span className={`settings-badge ${systemHardware?.is_container ? 'info' : 'neutral'}`} style={{ fontSize: '0.76rem', padding: '2px 8px' }}>
                              {systemHardware?.container_type || 'Bare Metal / VM Host'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({systemHardware?.hostname || 'localhost'})</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="label">CPU Processor Model</td>
                          <td className="value" style={{ fontFamily: 'monospace', fontSize: '0.84rem' }}>
                            {systemHardware?.cpu_model || 'Generic CPU'}
                          </td>
                        </tr>
                        <tr>
                          <td className="label">System Uptime</td>
                          <td className="value">
                            <strong style={{ color: '#34d399' }}>{systemHardware?.uptime || 'N/A'}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td className="label">Backend Runtime & Memory</td>
                          <td className="value">
                            Python {systemHardware?.python_version || '3.x'} • Service Process RSS: <strong style={{ color: '#60a5fa' }}>{systemHardware?.process_memory_formatted || 'N/A'}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Action Buttons */}
                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={fetchSystemHardware}
                        disabled={fetchingHardware}
                      >
                        <RefreshCw size={14} className={fetchingHardware ? 'animate-spin' : ''} />
                        <span>{fetchingHardware ? 'Querying System...' : 'Refresh System Metrics'}</span>
                      </button>
                    </div>
                  </div>
                )}
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
                    {/* Top Action Tools Banner */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '14px 18px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '18px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            fontSize: '0.85rem',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            border: 'none',
                            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
                          }}
                          onClick={handleStartInteractiveLogin}
                          disabled={interactiveLoginState?.is_running || isStartingBrowserLogin}
                          title="Opens a native Chromium browser window on your desktop to log in and automatically extract session cookies."
                        >
                          {interactiveLoginState?.is_running || isStartingBrowserLogin ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <Sparkles size={15} />
                          )}
                          <span>
                            {interactiveLoginState?.is_running ? 'Browser Login Active...' : 'Log In via Browser Window'}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '0.85rem'
                          }}
                          onClick={() => setIsDevToolsGuideOpen(true)}
                          title="View step-by-step instructions for extracting sessionid using browser DevTools (Chrome, Firefox, Safari, LXC)."
                        >
                          <BookOpen size={15} />
                          <span>DevTools Extraction Guide</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            background: displayInfo?.has_display ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: displayInfo?.has_display ? '#34d399' : '#60a5fa',
                            border: displayInfo?.has_display ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontWeight: 500
                          }}
                        >
                          <Monitor size={12} />
                          {displayInfo?.has_display ? `Desktop Display (${displayInfo.display_var})` : 'Headless Server / LXC'}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Login Status Feedback Card */}
                    {interactiveLoginState && (
                      <div className={`interactive-login-box ${interactiveLoginState.is_running ? 'is-active' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {interactiveLoginState.is_running ? (
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(167, 139, 250, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                              <RefreshCw size={15} className="animate-spin" />
                            </div>
                          ) : interactiveLoginState.status === 'success' ? (
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                              <CheckCircle2 size={16} />
                            </div>
                          ) : (
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                              <AlertCircle size={16} />
                            </div>
                          )}

                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {interactiveLoginState.is_running ? 'Interactive Browser Login in Progress' : interactiveLoginState.status === 'success' ? 'Authentication Successful!' : 'Browser Login Notice'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {interactiveLoginState.message}
                            </div>
                          </div>
                        </div>

                        {interactiveLoginState.is_running ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '5px 10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            onClick={handleCancelInteractiveLogin}
                          >
                            Cancel Login
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                            onClick={() => setInteractiveLoginState(null)}
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}

                    {/* Divider */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '18px 0 16px 0'
                      }}
                    >
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Or Enter Session Cookie Manually
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                    </div>

                    <form onSubmit={handleSaveSession}>
                      <div className="settings-form-group">
                        <label className="settings-label">
                          Instagram Username
                        </label>
                        <div className="settings-input-wrapper">
                          <input
                            className="input-field"
                            type="text"
                            placeholder="e.g. your_instagram_handle (or leave blank to auto-detect)"
                            value={sessionUsernameInput}
                            onChange={(e) => setSessionUsernameInput(e.target.value)}
                            style={{ margin: 0 }}
                          />
                        </div>
                        <p className="settings-description">
                          Your Instagram account handle used for profile identification and avatar display in the sidebar. Can be left blank to auto-detect from your session cookie.
                        </p>
                      </div>

                      <div className="settings-form-group">
                        <label className="settings-label">
                          Instagram Session Cookie (<code>sessionid</code>)
                        </label>
                        <div className="settings-input-wrapper">
                          <input
                            className="input-field"
                            type={showSessionKey ? 'text' : 'password'}
                            placeholder={userSession?.has_session_cookie ? '•••••••••••••••• (Active Session Configured - Enter new to update)' : 'Paste your Instagram sessionid cookie string here...'}
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button type="submit" className="btn-primary" disabled={sessionSaveStatus === 'saving' || sessionTesting}>
                          {sessionSaveStatus === 'saving' ? 'Saving...' : 'Save Session Cookie'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleTestSession}
                          disabled={(!sessionInput && !userSession?.has_session_cookie) || sessionTesting || sessionSaveStatus === 'saving'}
                          title="Verify if this session cookie is currently valid and active with Instagram."
                        >
                          <RefreshCw size={14} className={sessionTesting ? 'animate-spin' : ''} />
                          <span>{sessionTesting ? 'Testing Connection...' : 'Test Connection'}</span>
                        </button>
                        {sessionSaveStatus === 'success' && (
                          <span style={{ color: '#10b981', fontSize: '0.84rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={16} /> Session saved!
                          </span>
                        )}
                        {sessionSaveStatus === 'error' && (
                          <span style={{ color: '#ef4444', fontSize: '0.84rem', fontWeight: '600' }}>
                            Failed to save session cookie.
                          </span>
                        )}
                      </div>

                      {sessionTestResult && (
                        <div style={{
                          marginTop: '14px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: sessionTestResult.is_valid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          border: `1px solid ${sessionTestResult.is_valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          color: sessionTestResult.is_valid ? '#34d399' : '#f87171',
                          fontSize: '0.84rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {sessionTestResult.is_valid ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                          <span>{sessionTestResult.message}</span>
                        </div>
                      )}
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
                    {/* Slim Resource Guidance Banner */}
                    <div className="settings-resource-banner">
                      <div className="resource-banner-left">
                        <Cpu size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                        <span>
                          <strong>Hardware Guideline:</strong> For 2-core / 2GB RAM LXC containers & desktops, keep <strong>Parallel Workers ≤ 2</strong> and <strong>Queue Limit ≤ 8</strong> to avoid CPU spikes and system freezes.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="resource-banner-toggle"
                        onClick={() => setShowResourceGuide(!showResourceGuide)}
                      >
                        {showResourceGuide ? 'Hide Details' : 'View Impact Guide'}
                      </button>
                    </div>

                    {/* Expandable Balanced Resource Details Drawer */}
                    {showResourceGuide && (
                      <div className="resource-guide-drawer">
                        <div className="resource-guide-card">
                          <div className="resource-guide-card-header">
                            <strong>Parallel Workers</strong>
                            <span className="impact-badge high">High CPU / IO</span>
                          </div>
                          <div>
                            • <strong>1 Worker:</strong> Safest for 1-core / low-RAM LXC.<br />
                            • <strong>2 Workers:</strong> Recommended default.<br />
                            • <span style={{ color: '#f87171' }}><strong>3–4:</strong> Heavy I/O. May freeze low-spec systems.</span>
                          </div>
                        </div>

                        <div className="resource-guide-card">
                          <div className="resource-guide-card-header">
                            <strong>Max Queue Limit</strong>
                            <span className="impact-badge medium">RAM & SQLite</span>
                          </div>
                          <div>
                            • <strong>4–8 Jobs:</strong> Low RAM footprint (~150MB).<br />
                            • <span style={{ color: '#fbbf24' }}><strong>12+ Jobs:</strong> Higher active memory & lock overhead.</span>
                          </div>
                        </div>

                        <div className="resource-guide-card">
                          <div className="resource-guide-card-header">
                            <strong>Rate Limit Delay</strong>
                            <span className="impact-badge low">Anti-Ban</span>
                          </div>
                          <div>
                            • <strong>3.0s+ (Default):</strong> Safe against 429 blocks.<br />
                            • <span style={{ color: '#f87171' }}><strong>&lt; 2.0s:</strong> Risk of temporary Instagram ban.</span>
                          </div>
                        </div>

                        <div className="resource-guide-card">
                          <div className="resource-guide-card-header">
                            <strong>Batch Depth</strong>
                            <span className="impact-badge low">Memory</span>
                          </div>
                          <div>
                            • <strong>Uncapped:</strong> Full post history.<br />
                            • <strong>100–200 Posts:</strong> Lightweight & faster sync.
                          </div>
                        </div>
                      </div>
                    )}

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
                          <p className="settings-description">
                            {parseFloat(rateLimitDelayInput) < 2.0 ? (
                              <span style={{ color: '#f87171' }}>⚠️ Cooldown &lt; 2.0s risks Instagram rate limit bans.</span>
                            ) : (
                              'Cooldown between media requests.'
                            )}
                          </p>
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
                          <p className="settings-description">
                            {parseInt(maxQueueLimitInput) > 12 ? (
                              <span style={{ color: '#fbbf24' }}>⚠️ High queues increase memory load.</span>
                            ) : (
                              'Maximum queued & active batch jobs.'
                            )}
                          </p>
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Parallel Download Workers</label>
                          <select
                            className="select-dropdown"
                            style={{
                              width: '100%',
                              height: '42px',
                              borderColor: maxWorkersInput >= 3 ? '#ef4444' : undefined
                            }}
                            value={maxWorkersInput}
                            onChange={(e) => setMaxWorkersInput(parseInt(e.target.value))}
                          >
                            <option value="1">1 Worker (Safest / Low CPU)</option>
                            <option value="2">2 Workers (Recommended / Fast)</option>
                            <option value="3">3 Workers (High Speed - High CPU)</option>
                            <option value="4">4 Workers (Turbo - High CPU & I/O)</option>
                          </select>
                          <p className="settings-description">
                            {maxWorkersInput === 1 ? (
                              <span style={{ color: '#34d399' }}>🟢 Lowest CPU/RAM. Ideal for 1-core LXCs.</span>
                            ) : maxWorkersInput === 2 ? (
                              <span style={{ color: '#60a5fa' }}>⚡ Optimal balance for 2-core LXCs.</span>
                            ) : (
                              <span style={{ color: '#f87171', fontWeight: 600 }}>⚠️ High CPU & I/O. May freeze low-spec systems.</span>
                            )}
                          </p>
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
                      <p>ZenGram version, git commit history, operating environment, and live update checking</p>
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
                          <td className="value"><code>zengram.service</code> • http://127.0.0.1:8484</td>
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

              {/* Section 5: Master Security & Access Control */}
              <div
                id="settings-section-security"
                className={`settings-accordion-item ${expandedSections.security ? 'is-expanded' : ''} ${highlightedSection === 'security' ? 'highlight-section' : ''}`}
              >
                <div
                  className="settings-accordion-header"
                  onClick={() => toggleSection('security')}
                >
                  <div className="settings-accordion-header-left">
                    <div className="settings-accordion-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                      <Lock size={19} />
                    </div>
                    <div className="settings-accordion-title-group">
                      <h3>Master Security & Web Access Control</h3>
                      <p>Update administrator password, manage HttpOnly cookies, and configure authentication requirements</p>
                    </div>
                  </div>

                  <div className="settings-accordion-header-right">
                    <span className={`settings-badge ${authStatus?.auth_enabled ? 'success' : 'neutral'}`}>
                      {authStatus?.auth_enabled ? '🔒 Password Protected' : '🔓 Auth Disabled'}
                    </span>
                    <div className="settings-accordion-chevron">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {expandedSections.security && (
                  <div className="settings-accordion-body">
                    {/* Security Overview & Info Banner */}
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '20px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={20} style={{ color: '#34d399', flexShrink: 0 }} />
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                          <strong>HttpOnly Session Cookie Active</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: '1px' }}>
                            Your session token is cryptographically signed and stored in a secure <code>HttpOnly</code> cookie, protecting ZenGram from XSS attacks and unauthorized direct LAN/reverse proxy bypass.
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            fontSize: '0.8rem',
                            padding: '6px 12px',
                            color: authStatus?.auth_enabled ? '#f87171' : '#34d399',
                            borderColor: authStatus?.auth_enabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                          }}
                          onClick={() => handleToggleAuthRequirement(!authStatus?.auth_enabled)}
                          disabled={authToggleStatus === 'saving'}
                        >
                          {authStatus?.auth_enabled ? 'Disable Password Requirement' : 'Enable Password Requirement'}
                        </button>
                      </div>
                    </div>

                    {/* Change Password Form */}
                    <form onSubmit={handleChangeMasterPassword} style={{ maxWidth: '520px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Key size={15} /> Change Master Admin Password
                      </h4>

                      <div className="settings-form-group">
                        <label className="settings-label">Current Master Password</label>
                        <input
                          type="password"
                          className="input-field"
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          placeholder="Enter your current password"
                          required
                          style={{ margin: 0 }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                        <div className="settings-form-group">
                          <label className="settings-label">New Password</label>
                          <input
                            type="password"
                            className="input-field"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Min 6 characters"
                            required
                            style={{ margin: 0 }}
                          />
                        </div>

                        <div className="settings-form-group">
                          <label className="settings-label">Confirm New Password</label>
                          <input
                            type="password"
                            className="input-field"
                            value={confirmNewPasswordInput}
                            onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                            placeholder="Re-enter new password"
                            required
                            style={{ margin: 0 }}
                          />
                        </div>
                      </div>

                      {passwordChangeStatus === 'mismatch' && (
                        <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '8px' }}>
                          Passwords do not match. Please re-enter.
                        </p>
                      )}
                      {passwordChangeStatus === 'short' && (
                        <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '8px' }}>
                          New password must be at least 6 characters long.
                        </p>
                      )}
                      {passwordChangeStatus && !['mismatch', 'short', 'saving', 'success'].includes(passwordChangeStatus) && (
                        <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '8px' }}>
                          {passwordChangeStatus}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                        <button type="submit" className="btn-primary" disabled={passwordChangeStatus === 'saving'}>
                          {passwordChangeStatus === 'saving' ? 'Updating...' : 'Update Master Password'}
                        </button>
                        {passwordChangeStatus === 'success' && (
                          <span style={{ color: '#10b981', fontSize: '0.84rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={16} /> Password updated successfully!
                          </span>
                        )}
                      </div>
                    </form>
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

      <DevToolsGuideModal
        isOpen={isDevToolsGuideOpen}
        onClose={() => setIsDevToolsGuideOpen(false)}
      />
    </div>
  )
}

