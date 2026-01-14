import React, { useState, useMemo } from 'react'
import { Globe, TrendingUp, Cpu, Zap, Wrench } from 'lucide-react'
import type { Session, SessionCategory } from '../Kanban'

interface LeftRailProps {
  sessions: Session[]
  onSelectSession: (session: Session) => void
  currentSessionId?: string | null
  onNewIdea?: () => void
  onNewDecision?: () => void
}

// Category icons (monochrome, subtle)
const CategoryIcon: Record<SessionCategory, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  'geopolitical': Globe,
  'market-structure': TrendingUp,
  'ai-infrastructure': Cpu,
  'energy-power': Zap,
  'operational': Wrench,
}

// Semantic CSS variable references for dark mode support
const colors = {
  parchment: 'var(--bg-card)',
  terracotta: 'var(--border-strong)',
  weathered: 'var(--text-muted)',
  wornChrome: 'var(--border-default)',
  hiluxCream: 'var(--bg-subtle)',
  dinerAmber: 'var(--accent-warm)',
  charcoal: 'var(--text-primary)',
  forest: 'var(--accent-success)',
  burntSienna: 'var(--accent-primary)',
  umber: 'var(--text-secondary)',
  driftwood: 'var(--text-tertiary)',
  rust: 'var(--accent-primary-hover)',
}

/**
 * LeftRail - "The Cabin"
 *
 * Dense, warm, wood-toned left panel. This is where tools hang on the pegboard.
 * Organized but full. Fixed at 260px width.
 *
 * Sections:
 * 1. IDEAS - Tree of sessions organized by status
 * 2. CANON - Collapsible placeholder for canon sources
 * 3. Quick Stats - Fixed at bottom
 */
export function LeftRail({ sessions, onSelectSession, currentSessionId, onNewIdea, onNewDecision }: LeftRailProps) {
  const [canonExpanded, setCanonExpanded] = useState(false)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)

  // Calculate quick stats
  const stats = useMemo(() => {
    const ideas = sessions.filter(s => s.mode === 'idea').length
    const decisions = sessions.filter(s => s.mode === 'decision').length
    const tensions = sessions.reduce((acc, s) => acc + s.tensionCount, 0)
    return { ideas, decisions, tensions }
  }, [sessions])

  // Group sessions by state for tree display
  const sessionsByState = useMemo(() => {
    const groups: Record<string, Session[]> = {
      tensions: [],
      exploring: [],
      backlog: [],
      formed: [],
      synthesizing: [],
    }
    sessions.forEach(session => {
      if (session.tensionCount > 0) {
        groups.tensions.push(session)
      } else if (groups[session.state]) {
        groups[session.state].push(session)
      }
    })
    return groups
  }, [sessions])

  const getTreeItemStyle = (session: Session, isHovered: boolean, isActive: boolean): React.CSSProperties => {
    const hasTensions = session.tensionCount > 0
    const isExploring = session.state === 'exploring'
    const isBacklogOrFormed = session.state === 'backlog' || session.state === 'formed'

    let baseStyle: React.CSSProperties = {
      fontSize: '14px',
      padding: '8px 12px',
      borderRadius: '3px',
      color: colors.umber,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      borderLeft: '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    }

    // Status-based styling
    if (hasTensions) {
      baseStyle.fontWeight = 600
      baseStyle.color = colors.charcoal
    } else if (isExploring) {
      baseStyle.fontStyle = 'italic'
      baseStyle.color = colors.forest
    } else if (isBacklogOrFormed) {
      baseStyle.color = colors.weathered
    }

    // Hover state - diner glow: subtle warmth like light hitting a vinyl booth
    if (isHovered && !isActive) {
      baseStyle.background = `linear-gradient(135deg, rgba(232, 184, 74, 0.12), rgba(232, 184, 74, 0.04))`
      baseStyle.borderLeftColor = colors.wornChrome
      // Subtle warm box shadow on hover
      baseStyle.boxShadow = '0 0 8px rgba(232, 184, 74, 0.1)'
    }

    // Active/selected state - full diner glow: amber through a beer glass
    if (isActive) {
      baseStyle.background = colors.dinerAmber
      baseStyle.color = colors.charcoal
      baseStyle.borderLeftColor = colors.rust
      baseStyle.fontWeight = 500
      // Full glow effect with inset highlight
      baseStyle.boxShadow = '0 0 20px rgba(232, 184, 74, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
    }

    return baseStyle
  }

  const renderSessionItem = (session: Session) => {
    const isHovered = hoveredSessionId === session.id
    const isActive = currentSessionId === session.id

    return (
      <div
        key={session.id}
        style={getTreeItemStyle(session, isHovered, isActive)}
        onMouseEnter={() => setHoveredSessionId(session.id)}
        onMouseLeave={() => setHoveredSessionId(null)}
        onClick={() => onSelectSession(session)}
      >
        {/* Category icon (monochrome) */}
        {(() => {
          const Icon = CategoryIcon[session.category]
          return (
            <Icon
              size={12}
              style={{
                color: isActive ? colors.charcoal : colors.weathered,
                flexShrink: 0,
                marginRight: '8px',
              }}
            />
          )
        })()}
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {session.title}
        </span>
        {session.tensionCount > 0 && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isActive ? colors.charcoal : colors.burntSienna,
            flexShrink: 0,
          }}>
            {session.tensionCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <aside
      className="left-rail"
      style={{
        width: '260px',
        minWidth: '260px',
        height: '100%',
        background: colors.parchment,
        borderRight: `1px solid ${colors.terracotta}`,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        // Subtle wood grain suggestion
        backgroundImage: `
          linear-gradient(
            90deg,
            transparent 0%,
            rgba(180, 107, 74, 0.03) 50%,
            transparent 100%
          )
        `,
      }}
    >
      {/* IDEAS Section */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: colors.weathered,
            padding: '8px 0',
            borderBottom: `1px solid ${colors.wornChrome}`,
            marginBottom: '8px',
          }}
        >
          Ideas
        </div>

        {/* Sessions with tensions (highest priority) */}
        {sessionsByState.tensions.map(renderSessionItem)}

        {/* Currently exploring */}
        {sessionsByState.exploring.map(renderSessionItem)}

        {/* Synthesizing */}
        {sessionsByState.synthesizing.map(renderSessionItem)}

        {/* Backlog items */}
        {sessionsByState.backlog.map(renderSessionItem)}

        {/* Formed/completed */}
        {sessionsByState.formed.map(renderSessionItem)}

        {sessions.length === 0 && (
          <div style={{
            fontSize: '13px',
            color: colors.driftwood,
            fontStyle: 'italic',
            padding: '12px 8px',
          }}>
            No ideas yet
          </div>
        )}
      </div>

      {/* CANON Section (collapsible) */}
      <div style={{ marginTop: '16px' }}>
        <div
          className="hoverable"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: colors.weathered,
            padding: '8px 4px',
            marginLeft: '-4px',
            marginRight: '-4px',
            borderBottom: `1px solid ${colors.wornChrome}`,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            borderRadius: '3px',
            transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
          onClick={() => setCanonExpanded(!canonExpanded)}
        >
          <span>Canon</span>
          <span style={{
            transform: canonExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            fontSize: '10px',
          }}>
            {'\u25B6'}
          </span>
        </div>

        {canonExpanded && (
          <div style={{
            fontSize: '13px',
            color: colors.driftwood,
            fontStyle: 'italic',
            padding: '8px 12px',
          }}>
            Canon sources coming soon
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(onNewIdea || onNewDecision) && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            display: 'flex',
            gap: '8px',
          }}
        >
          {onNewIdea && (
            <button
              onClick={onNewIdea}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.wornChrome}`,
                borderRadius: '4px',
                color: colors.driftwood,
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.forest
                e.currentTarget.style.color = colors.forest
                e.currentTarget.style.backgroundColor = 'rgba(61, 90, 71, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.wornChrome
                e.currentTarget.style.color = colors.driftwood
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              + Idea
            </button>
          )}
          {onNewDecision && (
            <button
              onClick={onNewDecision}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.burntSienna}`,
                borderRadius: '4px',
                color: colors.burntSienna,
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(196, 88, 43, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              + Decision
            </button>
          )}
        </div>
      )}

      {/* Quick Stats (fixed at bottom) */}
      <div
        style={{
          paddingTop: '12px',
          borderTop: `1px solid ${colors.wornChrome}`,
          marginTop: '12px',
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          color: colors.driftwood,
        }}
      >
        <span>{stats.ideas} Ideas</span>
        <span>{stats.decisions} Decisions</span>
        <span>{stats.tensions} Tensions</span>
      </div>
    </aside>
  )
}

export default LeftRail
