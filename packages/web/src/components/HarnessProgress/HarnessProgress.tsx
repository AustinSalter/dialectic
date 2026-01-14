/**
 * HarnessProgress Component
 *
 * Displays real-time progress from the multi-pass harness:
 * - Current cycle and pass type
 * - Confidence trajectory visualization
 * - Non-monotonic trajectory explanation (explored counterarguments)
 * - Final synthesis with semantic markers preserved
 */

import type { PassType } from '../../lib/api'
import type { HarnessResult, HarnessStatus } from '../../lib/useHarness'

interface HarnessProgressProps {
  status: HarnessStatus
  currentCycle: number
  currentPass: PassType | null
  confidence: number
  trajectory: number[]
  tokensUsed: number
  result: HarnessResult | null
  error: { message: string } | null
  onCancel?: () => void
  onRetry?: () => void
}

/**
 * Get human-readable pass description
 */
function getPassDescription(pass: PassType | null): string {
  switch (pass) {
    case 'expansion':
      return 'Exploring possibilities'
    case 'compression':
      return 'Distilling insights'
    case 'critique':
      return 'Testing robustness'
    case 'synthesis':
      return 'Forming conclusion'
    default:
      return 'Preparing'
  }
}

/**
 * Get pass accent color
 */
function getPassColor(pass: PassType | null): string {
  switch (pass) {
    case 'expansion':
      return 'var(--accent-primary)'
    case 'compression':
      return 'var(--accent-secondary)'
    case 'critique':
      return 'var(--accent-warning)'
    case 'synthesis':
      return 'var(--accent-success)'
    default:
      return 'var(--text-muted)'
  }
}

/**
 * Format trajectory for display: "50% -> 65% -> 55% -> 72%"
 */
function formatTrajectory(trajectory: number[]): string {
  if (trajectory.length === 0) return '--'
  return trajectory.map(c => `${Math.round(c * 100)}%`).join(' -> ')
}

/**
 * Analyze trajectory for non-monotonic behavior
 */
function analyzeTrajectory(trajectory: number[]): { isNonMonotonic: boolean; explanation: string } {
  if (trajectory.length < 2) {
    return { isNonMonotonic: false, explanation: '' }
  }

  let hasDecreased = false
  for (let i = 1; i < trajectory.length; i++) {
    if (trajectory[i] < trajectory[i - 1]) {
      hasDecreased = true
      break
    }
  }

  if (!hasDecreased) {
    return { isNonMonotonic: false, explanation: 'Steady convergence' }
  }

  return {
    isNonMonotonic: true,
    explanation: 'Explored counterarguments before converging',
  }
}

/**
 * Render semantic markers with styling
 * Preserves [INSIGHT], [EVIDENCE], [RISK], [COUNTER] markers
 */
function renderWithSemanticMarkers(text: string): React.ReactNode {
  const markerStyles: Record<string, { bg: string; color: string }> = {
    INSIGHT: { bg: 'var(--accent-primary)20', color: 'var(--accent-primary)' },
    EVIDENCE: { bg: 'var(--accent-success)20', color: 'var(--accent-success)' },
    RISK: { bg: 'var(--accent-error)20', color: 'var(--accent-error)' },
    COUNTER: { bg: 'var(--accent-warning)20', color: 'var(--accent-warning)' },
  }

  // Split by semantic markers while preserving them
  const parts = text.split(/(\[[A-Z_]+\])/g)

  return parts.map((part, index) => {
    const markerMatch = part.match(/^\[([A-Z_]+)\]$/)
    if (markerMatch) {
      const marker = markerMatch[1]
      const style = markerStyles[marker] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
      return (
        <span
          key={index}
          style={{
            backgroundColor: style.bg,
            color: style.color,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            marginRight: '4px',
          }}
        >
          {part}
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function HarnessProgress({
  status,
  currentCycle,
  currentPass,
  confidence,
  trajectory,
  tokensUsed,
  result,
  error,
  onCancel,
  onRetry,
}: HarnessProgressProps) {
  const trajectoryAnalysis = analyzeTrajectory(trajectory)
  const confidencePercent = Math.round(confidence * 100)

  // Status-specific styling
  const statusStyles: Record<HarnessStatus, { bg: string; border: string; label: string }> = {
    idle: { bg: 'var(--bg-tertiary)', border: 'var(--border-subtle)', label: 'Ready' },
    connecting: { bg: 'var(--bg-tertiary)', border: 'var(--accent-primary)', label: 'Connecting...' },
    running: { bg: 'var(--accent-primary)10', border: 'var(--accent-primary)', label: 'Running' },
    complete: { bg: 'var(--accent-success)10', border: 'var(--accent-success)', label: 'Complete' },
    error: { bg: 'var(--accent-error)10', border: 'var(--accent-error)', label: 'Error' },
    cancelled: { bg: 'var(--bg-tertiary)', border: 'var(--text-muted)', label: 'Cancelled' },
  }

  const currentStatus = statusStyles[status]

  return (
    <div
      style={{
        backgroundColor: currentStatus.bg,
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${currentStatus.border}`,
        padding: 'var(--space-4)',
        transition: 'all var(--transition-normal)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: currentStatus.border,
              padding: '2px 8px',
              backgroundColor: `${currentStatus.border}20`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {currentStatus.label}
          </span>
          {status === 'running' && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {tokensUsed.toLocaleString()} tokens
            </span>
          )}
        </div>
        {(status === 'running' || status === 'connecting') && onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              backgroundColor: 'transparent',
              border: '1px solid var(--text-muted)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Cancel
          </button>
        )}
        {(status === 'error' || status === 'cancelled') && onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              backgroundColor: 'var(--accent-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Retry
          </button>
        )}
      </div>

      {/* Progress display when running */}
      {(status === 'running' || status === 'connecting') && (
        <>
          {/* Current cycle and pass */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Cycle {currentCycle}/5
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: getPassColor(currentPass),
                  textTransform: 'capitalize',
                }}
              >
                {currentPass || 'initializing'}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {getPassDescription(currentPass)}
              </span>
            </div>
          </div>

          {/* Current confidence */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-1)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Current Confidence
              </span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {confidencePercent}%
              </span>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${confidencePercent}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'width var(--transition-normal)',
                }}
              />
            </div>
          </div>

          {/* Confidence trajectory */}
          {trajectory.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Trajectory
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {formatTrajectory(trajectory)}
              </div>
              {trajectoryAnalysis.isNonMonotonic && (
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--accent-warning)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Good:</span>
                  <span>{trajectoryAnalysis.explanation}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Error display */}
      {status === 'error' && error && (
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            borderLeft: '3px solid var(--accent-error)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              display: 'block',
              marginBottom: 'var(--space-2)',
            }}
          >
            Error
          </span>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {error.message}
          </p>
        </div>
      )}

      {/* Completed result display */}
      {status === 'complete' && result && (
        <>
          {/* Final confidence with trajectory analysis */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Final Confidence
              </span>
              <span
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  color: result.finalConfidence >= 0.7
                    ? 'var(--accent-success)'
                    : result.finalConfidence >= 0.5
                    ? 'var(--accent-warning)'
                    : 'var(--accent-error)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {Math.round(result.finalConfidence * 100)}%
              </span>
            </div>
            <div
              style={{
                height: '10px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(result.finalConfidence * 100)}%`,
                  height: '100%',
                  backgroundColor: result.finalConfidence >= 0.7
                    ? 'var(--accent-success)'
                    : result.finalConfidence >= 0.5
                    ? 'var(--accent-warning)'
                    : 'var(--accent-error)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
          </div>

          {/* Trajectory summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
              }}
            >
              Confidence Trajectory
            </div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}
            >
              {formatTrajectory(result.trajectoryAnalysis ? trajectory : [])}
            </div>
            {result.trajectoryAnalysis && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <TrajectoryBadge
                  label={result.trajectoryAnalysis.is_monotonic ? 'Monotonic' : 'Non-monotonic'}
                  color={result.trajectoryAnalysis.is_monotonic ? 'var(--text-muted)' : 'var(--accent-warning)'}
                  tooltip={result.trajectoryAnalysis.is_monotonic
                    ? 'Steady progress without dips'
                    : 'Explored counterarguments before converging'}
                />
                <TrajectoryBadge
                  label={`Trend: ${result.trajectoryAnalysis.final_trend}`}
                  color={result.trajectoryAnalysis.final_trend === 'increasing'
                    ? 'var(--accent-success)'
                    : result.trajectoryAnalysis.final_trend === 'stable'
                    ? 'var(--text-muted)'
                    : 'var(--accent-warning)'}
                />
                {result.trajectoryAnalysis.max_dip > 0 && (
                  <TrajectoryBadge
                    label={`Max dip: ${Math.round(result.trajectoryAnalysis.max_dip * 100)}%`}
                    color="var(--accent-warning)"
                    tooltip="Largest confidence decrease between passes"
                  />
                )}
              </div>
            )}
          </div>

          {/* Final synthesis with semantic markers */}
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              borderLeft: '3px solid var(--accent-success)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-success)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                display: 'block',
                marginBottom: 'var(--space-3)',
              }}
            >
              Final Synthesis
            </span>
            <div
              style={{
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderWithSemanticMarkers(result.finalSynthesis)}
            </div>
          </div>

          {/* Metadata footer */}
          <div
            style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>
              {result.terminationReason}
            </span>
            <span>
              {Math.round(result.totalDurationMs / 1000)}s | {result.totalTokens.toLocaleString()} tokens
            </span>
          </div>
        </>
      )}

      {/* Idle state hint */}
      {status === 'idle' && (
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: 'var(--space-4)',
          }}
        >
          Run analysis to explore the claims through multi-pass reasoning
        </div>
      )}
    </div>
  )
}

/**
 * Small badge for trajectory analysis attributes
 */
function TrajectoryBadge({
  label,
  color,
  tooltip,
}: {
  label: string
  color: string
  tooltip?: string
}) {
  return (
    <span
      title={tooltip}
      style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: color,
        padding: '2px 8px',
        backgroundColor: `${color}15`,
        borderRadius: 'var(--radius-sm)',
        cursor: tooltip ? 'help' : 'default',
      }}
    >
      {label}
    </span>
  )
}

export default HarnessProgress
