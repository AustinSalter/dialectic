import React, { useState } from 'react'
import type { ThesisDocument, Trigger } from '../../lib/synthesis'

interface ThesisViewerProps {
  document: ThesisDocument
  onTriggerToggle?: (triggerId: number, fired: boolean) => void
  onClose?: () => void
}

export function ThesisViewer({ document: doc, onTriggerToggle, onClose }: ThesisViewerProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(doc.markdown)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // Fallback to download
      const blob = new Blob([doc.markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const confidencePercent = Math.round(doc.confidence * 100)
  const confidenceColor = doc.confidence >= 0.7
    ? 'var(--accent-success)'
    : doc.confidence >= 0.5
    ? 'var(--accent-warning)'
    : 'var(--accent-error)'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div>
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
              {doc.id}
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
          <h2
            style={{
              fontSize: 'var(--text-xl)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {doc.title}
          </h2>
          <div
            style={{
              marginTop: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Confidence:
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
              <div
                style={{
                  width: '60px',
                  height: '4px',
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
                  }}
                />
              </div>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {doc.created.toLocaleDateString()}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: copySuccess ? 'var(--accent-success)' : 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: copySuccess ? 'white' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            {copySuccess ? 'Copied!' : 'Copy MD'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Content area with sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main essay content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--space-6)',
          }}
        >
          <div
            style={{
              maxWidth: '700px',
              margin: '0 auto',
            }}
          >
            <MarkdownRenderer content={doc.markdown} />
          </div>
        </div>

        {/* Trigger sidebar */}
        <div
          style={{
            width: '280px',
            borderLeft: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            overflow: 'auto',
            padding: 'var(--space-4)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Triggers to Monitor
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {doc.triggers.map((trigger, i) => (
              <TriggerItem
                key={i}
                trigger={trigger}
                onToggle={(fired) => onTriggerToggle?.(i, fired)}
              />
            ))}
            {doc.triggers.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No triggers defined
              </p>
            )}
          </div>

          {/* Thesis summary */}
          <div style={{ marginTop: 'var(--space-6)' }}>
            <h3
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Core Belief
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                fontStyle: 'italic',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--accent-primary)',
              }}
            >
              {doc.thesis.core_belief}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TriggerItemProps {
  trigger: Trigger
  onToggle?: (fired: boolean) => void
}

function TriggerItem({ trigger, onToggle }: TriggerItemProps) {
  const typeColors: Record<Trigger['type'], string> = {
    disconfirming: 'var(--accent-error)',
    environmental: 'var(--accent-warning)',
    time_bound: 'var(--accent-primary)',
    assumption: 'var(--accent-info)',
  }

  const color = typeColors[trigger.type] || 'var(--text-muted)'

  return (
    <div
      style={{
        padding: 'var(--space-2)',
        backgroundColor: trigger.fired ? `${color}15` : 'var(--bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${trigger.fired ? color : 'var(--border-subtle)'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
        }}
      >
        <button
          onClick={() => onToggle?.(!trigger.fired)}
          style={{
            width: '18px',
            height: '18px',
            border: `2px solid ${color}`,
            borderRadius: 'var(--radius-sm)',
            backgroundColor: trigger.fired ? color : 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
          }}
        >
          {trigger.fired && '✓'}
        </button>
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            {trigger.type.replace('_', ' ')}
          </span>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: trigger.fired ? 'var(--text-muted)' : 'var(--text-secondary)',
              lineHeight: 1.4,
              margin: 'var(--space-1) 0 0 0',
              textDecoration: trigger.fired ? 'line-through' : 'none',
            }}
          >
            {trigger.condition}
          </p>
          {trigger.fired && trigger.firedAt && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              Fired {trigger.firedAt.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface MarkdownRendererProps {
  content: string
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Simple markdown rendering - in production would use react-markdown
  const renderMarkdown = (text: string) => {
    // Split into lines and process
    const lines = text.split('\n')
    const elements: React.ReactElement[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // Skip frontmatter
      if (line.startsWith('---') && i === 0) {
        i++
        while (i < lines.length && !lines[i].startsWith('---')) {
          i++
        }
        i++
        continue
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1
            key={i}
            style={{
              fontSize: 'var(--text-2xl)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: 'var(--space-6)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {line.slice(2)}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2
            key={i}
            style={{
              fontSize: 'var(--text-xl)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: 'var(--space-5)',
              marginBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 'var(--space-2)',
            }}
          >
            {line.slice(3)}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={i}
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: 'var(--space-4)',
              marginBottom: 'var(--space-2)',
            }}
          >
            {line.slice(4)}
          </h3>
        )
      }
      // List items
      else if (line.startsWith('- ')) {
        const listItems: string[] = []
        while (i < lines.length && lines[i].startsWith('- ')) {
          listItems.push(lines[i].slice(2))
          i++
        }
        elements.push(
          <ul
            key={elements.length}
            style={{
              margin: 'var(--space-3) 0',
              paddingLeft: 'var(--space-6)',
            }}
          >
            {listItems.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  marginBottom: 'var(--space-1)',
                }}
              >
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        )
        continue
      }
      // Checkbox items
      else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        const checked = line.startsWith('- [x] ')
        elements.push(
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--accent-warning)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: checked ? 'var(--accent-warning)' : 'transparent',
                marginTop: '4px',
              }}
            />
            <span
              style={{
                fontSize: 'var(--text-base)',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                textDecoration: checked ? 'line-through' : 'none',
              }}
            >
              {line.slice(6)}
            </span>
          </div>
        )
      }
      // Blockquote / italic text blocks
      else if (line.startsWith('*') && line.endsWith('*')) {
        elements.push(
          <p
            key={i}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {line.slice(1, -1)}
          </p>
        )
      }
      // Regular paragraph
      else if (line.trim()) {
        elements.push(
          <p
            key={i}
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              marginBottom: 'var(--space-4)',
            }}
          >
            {renderInlineMarkdown(line)}
          </p>
        )
      }

      i++
    }

    return elements
  }

  const renderInlineMarkdown = (text: string) => {
    // Handle italics and quotes
    const parts = text.split(/(\*"[^"]+"\*|\*[^*]+\*|@CLAIM-\d+)/g)

    return parts.map((part, i) => {
      if (part.startsWith('*"') && part.endsWith('"*')) {
        // User quote
        return (
          <span
            key={i}
            style={{
              fontStyle: 'italic',
              backgroundColor: 'var(--accent-primary)15',
              padding: '0 4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {part.slice(1, -1)}
          </span>
        )
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        // Italic
        return (
          <em key={i} style={{ fontStyle: 'italic' }}>
            {part.slice(1, -1)}
          </em>
        )
      }
      if (part.startsWith('@CLAIM-')) {
        // Claim reference
        return (
          <span
            key={i}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-info)',
              backgroundColor: 'var(--accent-info)15',
              padding: '0 4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  return <div>{renderMarkdown(content)}</div>
}
