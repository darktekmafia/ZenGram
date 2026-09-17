import React, { useState, useRef } from 'react'
import { X, Plus, Trash2, Eye, UserPlus, FileText, UploadCloud, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import ProfileAvatar from './ProfileAvatar'

export default function WatchedProfilesModal({
  isOpen,
  onClose,
  profiles,
  onAddProfile,
  onBulkAddProfiles,
  onRemoveProfile,
  onSelectProfile
}) {
  const [mode, setMode] = useState('single') // 'single' | 'bulk' | 'file'
  const [singleHandle, setSingleHandle] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [fileParsedHandles, setFileParsedHandles] = useState([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }
  const [listSearch, setListSearch] = useState('')
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  // Utility to extract clean usernames from text
  const parseUsernames = (text) => {
    if (!text) return []
    // Split by newlines, commas, semicolons, tabs, or whitespace
    const tokens = text.split(/[\r\n,;\s]+/)
    const seen = new Set()
    const result = []

    for (let token of tokens) {
      let clean = token.trim()
      if (!clean) continue

      // Handle full Instagram URLs (e.g. https://www.instagram.com/tay_miles_24/ or instagram.com/tay_miles_24?igsh=...)
      if (clean.includes('instagram.com/')) {
        const parts = clean.split('instagram.com/')
        if (parts.length > 1) {
          clean = parts[1].split('?')[0].split('/')[0]
        }
      }

      clean = clean.replace(/\/+$/, '').replace(/^@+/, '').trim()
      // Basic IG username validation: 1-30 chars, alphanumeric, dots, underscores
      if (clean && clean.length <= 100 && /^[a-zA-Z0-9._]+$/.test(clean)) {
        const lower = clean.toLowerCase()
        if (!seen.has(lower)) {
          seen.add(lower)
          result.push(clean)
        }
      }
    }
    return result
  }

  const handleSingleSubmit = async (e) => {
    e.preventDefault()
    const clean = singleHandle.trim().replace(/\/+$/, '').replace(/^@+/, '')
    if (!clean) return
    setLoading(true)
    setFeedback(null)
    try {
      await onAddProfile(clean)
      setSingleHandle('')
      setFeedback({ type: 'success', message: `Added @${clean} to tracked accounts.` })
    } catch (err) {
      setFeedback({ type: 'error', message: `Failed to add @${clean}.` })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    const usernames = parseUsernames(bulkText)
    if (usernames.length === 0) {
      setFeedback({ type: 'error', message: 'No valid usernames detected in input.' })
      return
    }

    setLoading(true)
    setFeedback(null)
    try {
      if (onBulkAddProfiles) {
        const res = await onBulkAddProfiles(usernames)
        const added = res?.added_count ?? usernames.length
        const skipped = res?.skipped_count ?? 0
        setBulkText('')
        setFeedback({
          type: 'success',
          message: `Successfully imported ${added} new tracked ${added === 1 ? 'account' : 'accounts'}${skipped > 0 ? ` (${skipped} were already tracked)` : ''}.`
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error importing accounts.' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setFeedback(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const handles = parseUsernames(content)
        setFileParsedHandles(handles)
        if (handles.length === 0) {
          setFeedback({ type: 'error', message: `No valid usernames found in "${file.name}".` })
        }
      }
    }
    reader.onerror = () => {
      setFeedback({ type: 'error', message: `Could not read file "${file.name}".` })
    }
    reader.readAsText(file)
  }

  const handleFileSubmit = async () => {
    if (fileParsedHandles.length === 0) return
    setLoading(true)
    setFeedback(null)
    try {
      if (onBulkAddProfiles) {
        const res = await onBulkAddProfiles(fileParsedHandles)
        const added = res?.added_count ?? fileParsedHandles.length
        const skipped = res?.skipped_count ?? 0
        setFileParsedHandles([])
        setSelectedFileName('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        setFeedback({
          type: 'success',
          message: `Successfully imported ${added} accounts from "${selectedFileName}"${skipped > 0 ? ` (${skipped} already tracked)` : ''}.`
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to import accounts from file.' })
    } finally {
      setLoading(false)
    }
  }

  const detectedBulkCount = parseUsernames(bulkText).length
  const filteredProfiles = profiles.filter((p) =>
    p.username.toLowerCase().includes(listSearch.toLowerCase()) ||
    (p.full_name && p.full_name.toLowerCase().includes(listSearch.toLowerCase()))
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '620px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} color="var(--accent-purple)" />
            <h2 className="modal-title">Track Unfollowed Accounts</h2>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
          Add public Instagram usernames you <strong>do not follow</strong> to browse their profiles and download media on-demand without cluttering your main feed.
        </p>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '4px',
          gap: '4px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => { setMode('single'); setFeedback(null) }}
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: '0.8rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: mode === 'single' ? 'var(--accent-purple)' : 'transparent',
              color: mode === 'single' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={14} />
            <span>Single Add</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('bulk'); setFeedback(null) }}
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: '0.8rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: mode === 'bulk' ? 'var(--accent-purple)' : 'transparent',
              color: mode === 'bulk' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={14} />
            <span>Bulk Paste Text</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('file'); setFeedback(null) }}
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: '0.8rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: mode === 'file' ? 'var(--accent-purple)' : 'transparent',
              color: mode === 'file' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <UploadCloud size={14} />
            <span>Import File (.txt / .csv)</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '14px',
            fontSize: '0.82rem',
            background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? '#4ade80' : '#f87171'
          }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 1. Single Mode Form */}
        {mode === 'single' && (
          <form onSubmit={handleSingleSubmit} style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="@username or https://instagram.com/username"
                value={singleHandle}
                onChange={(e) => setSingleHandle(e.target.value)}
                style={{ marginBottom: 0, flex: 1 }}
                autoFocus
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !singleHandle.trim()}
                style={{ height: '42px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{loading ? 'Adding...' : 'Track'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. Bulk Textarea Mode Form */}
        {mode === 'bulk' && (
          <form onSubmit={handleBulkSubmit} style={{ marginBottom: '18px' }}>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <textarea
                className="input-field"
                rows={5}
                placeholder={`Paste a list of usernames or profile URLs, one per line or comma-separated:\n\n@tay_miles_24\nhttps://instagram.com/design_daily\nphotography_hub\ncreative_shots`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  resize: 'vertical',
                  marginBottom: 0
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: detectedBulkCount > 0 ? 'var(--accent-purple)' : 'var(--text-muted)', fontWeight: '600' }}>
                {detectedBulkCount > 0 ? `✓ ${detectedBulkCount} unique accounts ready to import` : 'Paste handles separated by newlines, commas, or spaces'}
              </span>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || detectedBulkCount === 0}
                style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>{loading ? 'Importing...' : `Import ${detectedBulkCount > 0 ? detectedBulkCount : ''} Accounts`}</span>
              </button>
            </div>
          </form>
        )}

        {/* 3. Text File Import Mode */}
        {mode === 'file' && (
          <div style={{ marginBottom: '18px' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = e.dataTransfer.files
                if (files && files.length > 0) {
                  const input = fileInputRef.current
                  if (input) {
                    input.files = files
                    handleFileChange({ target: { files } })
                  }
                }
              }}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s',
                marginBottom: '10px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-purple)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
            >
              <UploadCloud size={32} color="var(--accent-purple)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
                {selectedFileName ? selectedFileName : 'Click or Drag & Drop a .txt or .csv File'}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Accepts text files containing usernames or profile URLs (one per line or comma-separated)
              </div>
            </div>

            {fileParsedHandles.length > 0 && (
              <div style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {fileParsedHandles.length} Accounts Found
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Preview: {fileParsedHandles.slice(0, 4).map(h => `@${h}`).join(', ')}{fileParsedHandles.length > 4 ? ` and ${fileParsedHandles.length - 4} more...` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleFileSubmit}
                  disabled={loading}
                  style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  <span>{loading ? 'Importing...' : `Import All ${fileParsedHandles.length}`}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tracked Accounts List Header & Quick Filter */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '14px'
        }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: '600', margin: 0, color: 'var(--text-muted)' }}>
            Currently Tracked Profiles ({profiles.length})
          </h3>
          {profiles.length > 5 && (
            <input
              type="text"
              placeholder="Filter list..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="input-field"
              style={{ padding: '4px 10px', fontSize: '0.76rem', width: '140px', marginBottom: 0 }}
            />
          )}
        </div>

        {/* Profiles List */}
        <div className="profiles-list" style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {filteredProfiles.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              {profiles.length === 0 ? 'No custom tracked profiles added yet.' : 'No matching profiles found.'}
            </p>
          ) : (
            filteredProfiles.map((p) => (
              <div key={p.id || p.username} className="profile-item-row">
                <div className="profile-user-group">
                  <ProfileAvatar
                    username={p.username}
                    profilePicUrl={p.profile_pic_url}
                    className="profile-avatar-small"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      @{p.username}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.full_name || (p.is_unfollowed_track ? 'Unfollowed Tracked' : 'Followed Account')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
                    title={`Remove @${p.username}`}
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
