import { useState } from 'react'
import type { Thesis } from '../../lib/synthesis'
import { exportThesisMarkdown } from '../../lib/synthesis'

interface ThesisCardProps {
  thesis: Thesis
  onExport?: (markdown: string) => void
}

export function ThesisCard({ thesis, onExport }: ThesisCardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    evidence_for: false,
    evidence_against: false,
    triggers: true, // Triggers shown by default - most important
  })
  const [isHovered, setIsHovered] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleExport = async () => {
    const markdown = exportThesisMarkdown(thesis)

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(markdown)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // Fallback - trigger download
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${thesis.title.toLowerCase().replace(/\s+/g, '-')}.md`
      a.click()
      URL.revokeObjectURL(url)
    }

    onExport?.(markdown)
  }

  const confidencePercent = Math.round(thesis.confidence * 100)
  const confidenceColor = thesis.confidence >= 0.7
    ? 'var(--accent-success)'
    : thesis.confidence >= 0.5
    ? 'var(--accent-warning)'
    : 'var(--accent-error)'

  return (
    <div
      style={{
        backgroundColor: isHovered ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        padding: 'var(--space-4)',
        transition: 'all var(--transition-normal)',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-1)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              [{thesis.id}]
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-success)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 6px',
                backgroundColor: 'var(--accent-success)15',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
              }}
            >
              Formed
            </span>
          </div>
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {thesis.title}
          </h3>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: copySuccess ? 'var(--accent-success)' : 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: copySuccess ? 'white' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}
        >
          {copySuccess ? 'Copied!' : 'Export'}
        </button>
      </div>

      {/* Confidence meter */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
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
            Confidence
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: confidenceColor,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {confidencePercent}%
          </span>
        </div>
        <div
          style={{
            height: '6px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${confidencePercent}%`,
              height: '100%',
              backgroundColor: confidenceColor,
              borderRadius: 'var(--radius-sm)',
              transition: 'width var(--transition-normal)',
            }}
          />
        </div>
      </div>

      {/* Core belief */}
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          borderLeft: '3px solid var(--accent-primary)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
            display: 'block',
            marginBottom: 'var(--space-2)',
          }}
        >
          Core Belief
        </span>
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          {thesis.core_belief}
        </p>
      </div>

      {/* Collapsible sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {/* Evidence For */}
        <CollapsibleSection
          title="Evidence For"
          count={thesis.evidence_for.length}
          isExpanded={expandedSections.evidence_for}
          onToggle={() => toggleSection('evidence_for')}
          accentColor="var(--accent-success)"
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {thesis.evidence_for.map((evidence, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {evidence}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Evidence Against */}
        <CollapsibleSection
          title="Evidence Against"
          count={thesis.evidence_against.length}
          isExpanded={expandedSections.evidence_against}
          onToggle={() => toggleSection('evidence_against')}
          accentColor="var(--accent-error)"
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {thesis.evidence_against.map((evidence, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {evidence}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Triggers - What Would Change This */}
        <CollapsibleSection
          title="What Would Change This"
          count={thesis.triggers.length}
          isExpanded={expandedSections.triggers}
          onToggle={() => toggleSection('triggers')}
          accentColor="var(--accent-warning)"
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {thesis.triggers.map((trigger, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid var(--accent-warning)',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {trigger}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Created {thesis.created_at.toLocaleDateString()}
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          Dialectic synthesis
        </span>
      </div>
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  accentColor: string
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  count,
  isExpanded,
  onToggle,
  accentColor,
  children,
}: CollapsibleSectionProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: accentColor,
              fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              backgroundColor: `${accentColor}15`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {count}
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
      </button>
      {isExpanded && (
        <div
          style={{
            padding: '0 var(--space-3) var(--space-3)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
