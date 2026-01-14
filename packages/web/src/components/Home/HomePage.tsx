/**
 * HomePage Component - "The Window"
 *
 * Main workspace with:
 * - Landscape gradient background (view out to sky/forest/lake)
 * - Session resume card with tensions
 * - Recent activity section with monochrome category icons
 * - Ambient amber warmth on cards (lamplight)
 *
 * No duplicate header (left rail handles navigation)
 * No command input (CommandBar component handles that)
 */

import { Globe, TrendingUp, Cpu, Zap, Wrench } from 'lucide-react'
import type { Session, SessionCategory } from '../Kanban'

// Category icons (monochrome, subtle)
const CategoryIcon: Record<SessionCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  'geopolitical': Globe,
  'market-structure': TrendingUp,
  'ai-infrastructure': Cpu,
  'energy-power': Zap,
  'operational': Wrench,
}

// State colors for status badges
const stateColors: Record<string, { bg: string; text: string }> = {
  'backlog': { bg: 'var(--bg-subtle)', text: 'var(--text-muted)' },
  'exploring': { bg: 'rgba(107, 152, 184, 0.15)', text: 'var(--accent-info)' },
  'tensions': { bg: 'rgba(196, 88, 43, 0.15)', text: 'var(--accent-primary)' },
  'synthesizing': { bg: 'rgba(232, 184, 74, 0.15)', text: 'var(--accent-warm)' },
  'formed': { bg: 'rgba(61, 90, 71, 0.15)', text: 'var(--accent-success)' },
}

interface HomePageProps {
  sessions: Session[]
  onNewIdea?: () => void  // Optional - buttons now in LeftRail
  onNewDecision?: () => void  // Optional - buttons now in LeftRail
  onContinueSession: (session: Session) => void
  onCommand: (command: string) => void
}

interface Tension {
  id: string
  title: string
  description: string
}

// Mock tension data - in production this would come from session
function getTensionsForSession(session: Session): Tension[] {
  if (session.tensionCount === 0) return []

  // Generate mock tensions based on count
  const mockTensions: Tension[] = []
  for (let i = 0; i < Math.min(session.tensionCount, 3); i++) {
    mockTensions.push({
      id: `${session.id}-tension-${i}`,
      title: i === 0 ? 'Scope vs. Timeline' : i === 1 ? 'Quality vs. Speed' : 'Innovation vs. Stability',
      description: i === 0
        ? 'The proposed feature set exceeds what can be delivered in the current sprint without compromising code quality...'
        : i === 1
          ? 'Stakeholders want faster iteration, but the codebase needs refactoring to support new features safely...'
          : 'New technology stack offers advantages, but team ramp-up time creates delivery risk...',
    })
  }
  return mockTensions
}

export function HomePage({
  sessions,
  onContinueSession,
}: HomePageProps) {
  // Find last active session with tensions
  const lastActiveSession = [...sessions]
    .filter(s => s.tensionCount > 0 && s.state !== 'formed')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

  const tensions = lastActiveSession ? getTensionsForSession(lastActiveSession) : []

  // Recent sessions (sorted by updatedAt)
  const recentSessions = [...sessions]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5)

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-8)',
        background: 'var(--bg-base)',
        backgroundImage: 'var(--landscape-gradient)',
        overflowY: 'auto',
      }}
    >
    {/* Constrained content wrapper for cozier feel */}
    <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Session Resume Card - with ambient warmth and texture */}
      {lastActiveSession && (
        <div
          className="glow-card-hoverable textured"
          style={{
            background: 'var(--bg-elevated)',
            backgroundImage: 'var(--ambient-glow)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
            boxShadow: 'var(--shadow-card), var(--ambient-highlight)',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              fontSize: 'var(--text-caption)',
              fontWeight: 'var(--weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wide)',
              color: 'var(--text-tertiary)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--border-default)',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Continue Session</span>
            <button
              onClick={() => onContinueSession(lastActiveSession)}
              className="hoverable"
              style={{
                fontSize: 'var(--text-caption)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--accent-info)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                margin: '-4px -8px',
                borderRadius: 'var(--radius-sm)',
                textTransform: 'none',
                letterSpacing: 'normal',
                transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-warm)'
                e.currentTarget.style.textShadow = '0 0 8px rgba(232, 184, 74, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--accent-info)'
                e.currentTarget.style.textShadow = 'none'
              }}
            >
              Resume
            </button>
          </div>

          {/* Session Title */}
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {lastActiveSession.title}
          </h2>

          {/* Tension Items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tensions.map((tension, index) => (
              <div
                key={tension.id}
                onClick={() => onContinueSession(lastActiveSession)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onContinueSession(lastActiveSession)
                  }
                }}
                style={{
                  padding: 'var(--space-4) 0',
                  borderBottom: index < tensions.length - 1 ? '1px solid var(--bg-card)' : 'none',
                  display: 'flex',
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                  marginLeft: 0,
                  paddingLeft: 0,
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
                onMouseEnter={(e) => {
                  // Diner glow: directional warm gradient from above-left
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(232, 184, 74, 0.10) 0%, rgba(232, 184, 74, 0.03) 50%, transparent 100%)'
                  e.currentTarget.style.marginLeft = '-16px'
                  e.currentTarget.style.paddingLeft = '16px'
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(232, 184, 74, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.marginLeft = '0'
                  e.currentTarget.style.paddingLeft = '0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Burnt sienna bullet */}
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: '2px solid var(--accent-primary)',
                    marginTop: '5px',
                    flexShrink: 0,
                  }}
                />

                {/* Tension content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    {tension.title}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      lineHeight: 'var(--leading-relaxed)',
                      fontStyle: 'italic',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {tension.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Section - with ambient warmth and texture */}
      <div
        className="glow-card-hoverable textured"
        style={{
          background: 'var(--bg-elevated)',
          backgroundImage: 'var(--ambient-glow)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
          boxShadow: 'var(--shadow-card), var(--ambient-highlight)',
          flex: 1,
          minHeight: '200px',
        }}
      >
        {/* Section Header */}
        <div
          style={{
            fontSize: 'var(--text-caption)',
            fontWeight: 'var(--weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wide)',
            color: 'var(--text-tertiary)',
            paddingBottom: 'var(--space-3)',
            borderBottom: '1px solid var(--border-default)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Recent Activity
        </div>

        {recentSessions.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--text-tertiary)',
              fontSize: '15px',
              fontStyle: 'italic',
            }}
          >
            No sessions yet. Start exploring an idea or make a decision.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {recentSessions.map(session => (
              <button
                key={session.id}
                onClick={() => onContinueSession(session)}
                aria-label={`Open session: ${session.title} (${session.mode}, ${session.state})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-3)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(232, 184, 74, 0.10) 0%, rgba(232, 184, 74, 0.03) 50%, transparent 100%)'
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(232, 184, 74, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Category icon (monochrome) */}
                {(() => {
                  const Icon = CategoryIcon[session.category]
                  return (
                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}>
                      <Icon size={14} />
                    </span>
                  )
                })()}
                {/* Session title */}
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    flex: 1,
                  }}
                >
                  {session.title}
                </span>
                {/* State badge with color */}
                <span
                  style={{
                    fontSize: 'var(--text-caption)',
                    fontWeight: 'var(--weight-medium)',
                    color: stateColors[session.state]?.text || 'var(--text-muted)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: stateColors[session.state]?.bg || 'var(--bg-card)',
                  }}
                >
                  {session.state}
                </span>
                {/* Tension count */}
                {session.tensionCount > 0 && (
                  <span
                    style={{
                      fontSize: 'var(--text-caption)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'white',
                      backgroundColor: 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      minWidth: '24px',
                      textAlign: 'center',
                    }}
                  >
                    {session.tensionCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
