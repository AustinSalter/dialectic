import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

export type SessionState = 'backlog' | 'exploring' | 'tensions' | 'synthesizing' | 'formed'
export type SessionCategory = 'geopolitical' | 'market-structure' | 'ai-infrastructure' | 'energy-power' | 'operational'
export type SessionMode = 'idea' | 'decision'

export interface Session {
  id: string
  title: string
  category: SessionCategory
  state: SessionState
  mode: SessionMode
  claimCount: number
  tensionCount: number
  summary?: string
  createdAt: Date
  updatedAt: Date
}

interface SessionCardProps {
  session: Session
  onDoubleClick?: () => void
  onDelete?: () => void
}

const categoryColors: Record<SessionCategory, string> = {
  'geopolitical': 'var(--category-geopolitical)',
  'market-structure': 'var(--category-market-structure)',
  'ai-infrastructure': 'var(--category-ai-infrastructure)',
  'energy-power': 'var(--category-energy-power)',
  'operational': 'var(--category-operational)',
}

const categoryLabels: Record<SessionCategory, string> = {
  'geopolitical': 'Geo',
  'market-structure': 'Market',
  'ai-infrastructure': 'AI',
  'energy-power': 'Energy',
  'operational': 'Ops',
}

export function SessionCard({ session, onDoubleClick, onDelete }: SessionCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${categoryColors[session.category]}`,
        padding: 'var(--space-3)',
        cursor: 'grab',
        transform: isDragging ? `${style.transform} scale(1.03)` : isHovered ? `${style.transform || ''} translateY(-2px)` : style.transform,
        boxShadow: isDragging ? 'var(--shadow-lg)' : isHovered ? 'var(--shadow-md)' : 'var(--shadow-card)',
        transition: 'all var(--transition-default)',
        background: isHovered && !isDragging ? 'var(--glow-hover)' : undefined,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={onDoubleClick}
      {...attributes}
      {...listeners}
    >
      {/* Mode badge, category badge and delete button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--text-caption)',
              color: session.mode === 'decision' ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontWeight: 'var(--weight-medium)',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: session.mode === 'decision' ? 'rgba(196, 88, 43, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${session.mode === 'decision' ? 'rgba(196, 88, 43, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
          >
            {session.mode}
          </span>
          <span
            style={{
              fontSize: 'var(--text-caption)',
              color: 'white',
              fontWeight: 'var(--weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: categoryColors[session.category],
            }}
          >
            {categoryLabels[session.category]}
          </span>
        </div>
        {onDelete && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              if (window.confirm(`Delete "${session.title}"?`)) {
                onDelete()
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: 'var(--text-caption)',
              color: 'var(--accent-primary)',
              opacity: 0.7,
              borderRadius: 'var(--radius-sm)',
              transition: 'opacity var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
            title="Delete session"
          >
            Delete
          </button>
        )}
      </div>

      {/* Title */}
      <h4
        style={{
          fontSize: 'var(--text-small)',
          color: 'var(--text-primary)',
          fontWeight: 'var(--weight-medium)',
          marginBottom: 'var(--space-2)',
          lineHeight: 'var(--leading-tight)',
          fontFamily: 'var(--font-serif)',
        }}
      >
        {session.title}
      </h4>

      {/* Summary */}
      {session.summary && (
        <p
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-2)',
            lineHeight: 'var(--leading-normal)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: 'var(--font-serif)',
          }}
        >
          {session.summary}
        </p>
      )}

      {/* Metrics */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          fontSize: 'var(--text-caption)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ color: 'var(--accent-success)' }}>{session.claimCount} claims</span>
        {session.tensionCount > 0 && (
          <span style={{ color: 'var(--accent-primary)' }}>
            {session.tensionCount} tensions
          </span>
        )}
      </div>
    </div>
  )
}
