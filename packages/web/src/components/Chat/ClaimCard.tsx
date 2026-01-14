interface ClaimCardProps {
  claimId: string
  text: string
  snippet: string
  source: string
  type?: 'core_thesis' | 'framework' | 'meta' | 'counter'
}

export function ClaimCard({ claimId, text, snippet, source, type = 'core_thesis' }: ClaimCardProps) {
  const typeColors: Record<string, string> = {
    core_thesis: 'var(--accent-primary)',
    framework: 'var(--accent-secondary)',
    meta: 'var(--accent-warning)',
    counter: 'var(--accent-danger)',
  }

  const typeLabels: Record<string, string> = {
    core_thesis: 'Core Thesis',
    framework: 'Framework',
    meta: 'Meta',
    counter: 'Counter',
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        borderLeft: `3px solid ${typeColors[type]}`,
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: typeColors[type],
            fontWeight: 600,
          }}
        >
          [{claimId}]
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {typeLabels[type]}
        </span>
      </div>

      {/* Claim text */}
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          fontWeight: 500,
          marginBottom: 'var(--space-2)',
          lineHeight: 1.5,
        }}
      >
        {text}
      </p>

      {/* Quote */}
      <blockquote
        style={{
          margin: 0,
          paddingLeft: 'var(--space-3)',
          borderLeft: '2px solid var(--border-subtle)',
          fontStyle: 'italic',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
        }}
      >
        "{snippet}"
      </blockquote>

      {/* Source */}
      <div
        style={{
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        — {source}
      </div>
    </div>
  )
}
