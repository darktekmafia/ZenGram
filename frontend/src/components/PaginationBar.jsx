import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight
} from 'lucide-react'

export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 36,
  onPageChange,
  onPageSizeChange,
  loading = false
}) {
  const [jumpInput, setJumpInput] = useState('')

  if (totalItems === 0) {
    return null
  }

  const handleJump = (e) => {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages && target !== currentPage) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  // Generate sliding window of page numbers
  const getPageNumbers = () => {
    const pages = []
    const delta = 2
    const left = Math.max(1, currentPage - delta)
    const right = Math.min(totalPages, currentPage + delta)

    for (let i = left; i <= right; i++) {
      pages.push(i)
    }

    // Add 1 and ellipses if needed
    if (left > 1) {
      if (left > 2) {
        pages.unshift('ellipsis_left')
      }
      pages.unshift(1)
    }

    // Add totalPages and ellipses if needed
    if (right < totalPages) {
      if (right < totalPages - 1) {
        pages.push('ellipsis_right')
      }
      pages.push(totalPages)
    }

    return pages
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div
      className="pagination-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '14px 20px',
        marginTop: '24px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
      }}
    >
      {/* Left: Item Counter */}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Showing <strong style={{ color: '#fff' }}>{startItem.toLocaleString()}</strong> –{' '}
        <strong style={{ color: '#fff' }}>{endItem.toLocaleString()}</strong> of{' '}
        <strong style={{ color: '#a78bfa' }}>{totalItems.toLocaleString()}</strong> posts
      </div>

      {/* Center: Pagination Numbered Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1 || loading}
          title="First Page"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage <= 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-main)',
            borderRadius: '6px',
            padding: '6px 8px',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          title="Previous Page"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage <= 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-main)',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            transition: 'all 0.2s'
          }}
        >
          <ChevronLeft size={15} />
          <span>Prev</span>
        </button>

        {/* Page Chips */}
        {getPageNumbers().map((p, idx) => {
          if (p === 'ellipsis_left' || p === 'ellipsis_right') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  color: 'var(--text-muted)',
                  padding: '4px 6px',
                  fontSize: '0.85rem',
                  userSelect: 'none'
                }}
              >
                •••
              </span>
            )
          }

          const isActive = p === currentPage
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={loading || isActive}
              style={{
                minWidth: '34px',
                height: '34px',
                borderRadius: '8px',
                border: isActive
                  ? '1px solid #8b5cf6'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                background: isActive
                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                  : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.82rem',
                cursor: isActive ? 'default' : 'pointer',
                boxShadow: isActive ? '0 0 12px rgba(139, 92, 246, 0.45)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 8px'
              }}
            >
              {p}
            </button>
          )
        })}

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          title="Next Page"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage >= totalPages ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-main)',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            transition: 'all 0.2s'
          }}
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages || loading}
          title="Last Page"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage >= totalPages ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-main)',
            borderRadius: '6px',
            padding: '6px 8px',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {/* Right: Page Size Selector & Jump Box */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              style={{
                background: '#0a0d16',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.78rem',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              <option value="24">24</option>
              <option value="36">36</option>
              <option value="48">48</option>
              <option value="96">96</option>
            </select>
          </div>
        )}

        <form onSubmit={handleJump} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            min="1"
            max={totalPages}
            placeholder={`Page #${currentPage}`}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            style={{
              width: '74px',
              padding: '4px 8px',
              fontSize: '0.78rem',
              background: '#0a0d16',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#fff'
            }}
          />
          <button
            type="submit"
            disabled={!jumpInput}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#fff',
              cursor: jumpInput ? 'pointer' : 'default',
              opacity: jumpInput ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center'
            }}
            title="Jump to page"
          >
            <ArrowRight size={13} />
          </button>
        </form>
      </div>
    </div>
  )
}
