import { useState } from 'react'
import type { Tension } from '../../lib/tensions'

interface TensionCardProps {
  tension: Tension
  onResolve?: (tensionId: string) => void
  onClaimClick?: (claimId: string) => void
}

export function TensionCard({ tension, onResolve, onClaimClick }: TensionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const statusColor = tension.resolved
    ? 'var(--accent-success)'
    : 'var(--accent-warning)'

  const statusLabel = tension.resolved ? 'Resolved' : 'Unresolved'

  return (
    <div
      style={{
        backgroundColor: isHovered ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        borderLeft: `3px solid ${statusColor}`,
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        cursor: 'pointer',
        transition: 'all var(--transition-normal)',
        transform: isHovered ? 'translateY(-1px)' : 'none',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header */}
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
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: statusColor,
              fontWeight: 600,
            }}
          >
            [{tension.id}]
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: statusColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 6px',
              backgroundColor: `${statusColor}15`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {statusLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast)',
          }}
        >
          v
        </span>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          fontWeight: 500,
          marginBottom: isExpanded ? 'var(--space-3)' : 0,
          lineHeight: 1.5,
        }}
      >
        {tension.description}
      </p>

      {/* Expanded content */}
      {isExpanded && (
        <div
          style={{
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Opposing sides */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 'var(--space-2)',
              alignItems: 'stretch',
              marginBottom: 'var(--space-3)',
            }}
          >
            {/* Side A */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2)',
                borderTop: '2px solid var(--accent-primary)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Position A
              </span>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {tension.sides[0]}
              </p>
            </div>

            {/* VS indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 var(--space-1)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                vs
              </span>
            </div>

            {/* Side B */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2)',
                borderTop: '2px solid var(--accent-secondary)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Position B
              </span>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {tension.sides[1]}
              </p>
            </div>
          </div>

          {/* Claim references */}
          {tension.claim_refs.length > 0 && (
            <div
              style={{
                marginBottom: 'var(--space-3)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  marginRight: 'var(--space-2)',
                }}
              >
                Related claims:
              </span>
              {tension.claim_refs.map((ref) => (
                <button
                  key={ref}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClaimClick?.(ref)
                  }}
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    marginRight: 'var(--space-1)',
                    backgroundColor: 'var(--accent-primary)20',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)40'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)20'
                  }}
                >
                  @{ref}
                </button>
              ))}
            </div>
          )}

          {/* Resolution or resolve button */}
          {tension.resolved && tension.resolution ? (
            <div
              style={{
                backgroundColor: 'var(--accent-success)10',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2)',
                borderLeft: '2px solid var(--accent-success)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-success)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Resolution
              </span>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                {tension.resolution}
              </p>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onResolve?.(tension.id)
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2)',
                backgroundColor: 'transparent',
                border: '1px dashed var(--accent-warning)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-warning)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-warning)10'
                e.currentTarget.style.borderStyle = 'solid'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderStyle = 'dashed'
              }}
            >
              Resolve this tension
            </button>
          )}
        </div>
      )}
    </div>
  )
}
