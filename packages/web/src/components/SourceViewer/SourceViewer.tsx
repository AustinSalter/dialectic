import { useEffect, useRef, useState } from 'react'
import type { Claim } from '../../lib/ingest'

interface SourceViewerProps {
  title: string
  text: string
  claims: Claim[]
  highlightedClaimId: string | null
  onClaimClick?: (claimId: string) => void
}

const CONTEXT_CHARS = 150 // Characters to show before/after claim

const typeColors: Record<Claim['type'], string> = {
  core_thesis: 'rgba(99, 102, 241, 0.3)',      // indigo
  framework: 'rgba(34, 197, 94, 0.3)',          // green
  meta: 'rgba(234, 179, 8, 0.3)',               // yellow
  counter: 'rgba(239, 68, 68, 0.3)',            // red
}

const typeActiveColors: Record<Claim['type'], string> = {
  core_thesis: 'rgba(99, 102, 241, 0.6)',
  framework: 'rgba(34, 197, 94, 0.6)',
  meta: 'rgba(234, 179, 8, 0.6)',
  counter: 'rgba(239, 68, 68, 0.6)',
}

interface ClaimExcerpt {
  claim: Claim
  beforeContext: string
  highlightedText: string
  afterContext: string
}

export function SourceViewer({
  title,
  text,
  claims,
  highlightedClaimId,
  onClaimClick,
}: SourceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredClaim, setHoveredClaim] = useState<string | null>(null)

  // Build excerpts for each claim with context
  const excerpts: ClaimExcerpt[] = claims
    .filter(c => c.quote_start >= 0 && c.quote_end > c.quote_start)
    .map(c => {
      const start = Math.max(0, c.quote_start - CONTEXT_CHARS)
      const end = Math.min(text.length, c.quote_end + CONTEXT_CHARS)

      // Find word boundaries for cleaner excerpts
      let beforeStart = start
      if (start > 0) {
        const spaceIndex = text.indexOf(' ', start)
        if (spaceIndex !== -1 && spaceIndex < c.quote_start) {
          beforeStart = spaceIndex + 1
        }
      }

      let afterEnd = end
      if (end < text.length) {
        const spaceIndex = text.lastIndexOf(' ', end)
        if (spaceIndex !== -1 && spaceIndex > c.quote_end) {
          afterEnd = spaceIndex
        }
      }

      return {
        claim: c,
        beforeContext: (beforeStart > 0 ? '...' : '') + text.slice(beforeStart, c.quote_start),
        highlightedText: text.slice(c.quote_start, c.quote_end),
        afterContext: text.slice(c.quote_end, afterEnd) + (afterEnd < text.length ? '...' : ''),
      }
    })
    .sort((a, b) => a.claim.quote_start - b.claim.quote_start)

  // Scroll to highlighted claim when it changes
  useEffect(() => {
    if (!highlightedClaimId || !containerRef.current) return

    const highlightEl = containerRef.current.querySelector(
      `[data-claim-id="${highlightedClaimId}"]`
    )
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedClaimId])

  // Render a single claim excerpt
  const renderExcerpt = (excerpt: ClaimExcerpt) => {
    const { claim } = excerpt
    const isActive = highlightedClaimId === claim.id
    const isHovered = hoveredClaim === claim.id
    const bgColor = isActive || isHovered
      ? typeActiveColors[claim.type]
      : typeColors[claim.type]

    return (
      <div
        key={claim.id}
        data-claim-id={claim.id}
        style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
          borderRadius: 'var(--radius-md)',
          borderLeft: `3px solid ${typeActiveColors[claim.type]}`,
          transition: 'background-color 0.15s ease',
        }}
      >
        {/* Claim label */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: typeActiveColors[claim.type].replace('0.3', '1').replace('0.6', '1'),
            marginBottom: 'var(--space-2)',
          }}
        >
          @{claim.id}
        </div>

        {/* Excerpt with highlighted claim text */}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            lineHeight: 1.7,
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{excerpt.beforeContext}</span>
          <span
            onClick={() => onClaimClick?.(claim.id)}
            onMouseEnter={() => setHoveredClaim(claim.id)}
            onMouseLeave={() => setHoveredClaim(null)}
            style={{
              backgroundColor: bgColor,
              borderRadius: '2px',
              padding: '2px 4px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              boxShadow: isActive ? `0 0 0 2px ${typeActiveColors[claim.type]}` : undefined,
            }}
            title={`Click to highlight ${claim.id}`}
          >
            {excerpt.highlightedText}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{excerpt.afterContext}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-1)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {claims.length} claims extracted
        </div>
      </div>

      {/* Claim Legend */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        {claims.map(claim => (
          <button
            key={claim.id}
            onClick={() => onClaimClick?.(claim.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-2)',
              backgroundColor:
                highlightedClaimId === claim.id
                  ? typeActiveColors[claim.type]
                  : typeColors[claim.type],
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontWeight: 600 }}>@{claim.id}</span>
          </button>
        ))}
      </div>

      {/* Excerpts */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-4)',
        }}
      >
        {excerpts.length > 0 ? (
          excerpts.map(excerpt => renderExcerpt(excerpt))
        ) : (
          <div
            style={{
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              padding: 'var(--space-4)',
              textAlign: 'center',
            }}
          >
            No claims with valid source positions found.
          </div>
        )}
      </div>
    </div>
  )
}
