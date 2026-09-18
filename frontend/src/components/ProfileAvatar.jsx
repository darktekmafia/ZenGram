import React, { useState, useEffect } from 'react'

export default function ProfileAvatar({ username, profilePicUrl, className = "profile-avatar-large", style = {} }) {
  const cleanUsername = (username || 'user').trim().replace(/^@/, '')
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUsername)}&background=232936&color=fff&bold=true`

  const getTargetUrl = (url) => {
    if (!url) return fallbackAvatar
    const clean = url.replace(/&amp;/g, '&')
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      // Direct proxy endpoint to bypass Instagram CORS / hotlink restrictions reliably
      return `/api/v1/proxy/image?url=${encodeURIComponent(clean)}`
    }
    return clean
  }

  const [src, setSrc] = useState(getTargetUrl(profilePicUrl))
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    setSrc(getTargetUrl(profilePicUrl))
    setErrorCount(0)
  }, [profilePicUrl, username])

  const handleError = () => {
    if (errorCount === 0 && profilePicUrl) {
      // If direct proxy fails or direct url failed, try fallback proxy/direct
      setErrorCount(1)
      const clean = profilePicUrl.replace(/&amp;/g, '&')
      if (src.includes('/api/v1/proxy/image')) {
        setSrc(clean)
      } else {
        setSrc(`/api/v1/proxy/image?url=${encodeURIComponent(clean)}`)
      }
    } else {
      setSrc(fallbackAvatar)
    }
  }

  return (
    <img
      key={`avatar_${cleanUsername}_${profilePicUrl || 'default'}_${errorCount}`}
      src={src}
      alt={cleanUsername}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  )
}
