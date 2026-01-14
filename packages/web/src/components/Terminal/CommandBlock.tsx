import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

export type BlockStatus = 'running' | 'complete' | 'error'

export interface CommandBlockData {
  id: string
  command: string
  output: string
  status: BlockStatus
  timestamp: Date
}

interface CommandBlockProps {
  block: CommandBlockData
  isLatest?: boolean
}

export function CommandBlock({ block, isLatest = false }: CommandBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showCopy, setShowCopy] = useState(false)

  const statusColors: Record<BlockStatus, string> = {
    running: 'var(--accent-warm)',
    complete: 'var(--accent-success)',
    error: 'var(--accent-primary)',
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(block.output)
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: isLatest ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
        boxShadow: isLatest ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'all var(--transition-default)',
        animation: isLatest ? 'fadeIn 200ms ease-out' : undefined,
      }}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      {/* Command header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--bg-subtle)',
          cursor: 'pointer',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColors[block.status],
            flexShrink: 0,
            animation: block.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : undefined,
            boxShadow: block.status === 'running' ? `0 0 8px ${statusColors.running}` : undefined,
          }}
        />
        <span
          style={{
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-mono)',
            userSelect: 'none',
          }}
        >
          &gt;
        </span>
        <code
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-mono)',
            color: 'var(--text-primary)',
          }}
        >
          {block.command}
        </code>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--text-caption)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Output */}
      {!isCollapsed && block.output && (
        <div
          style={{
            position: 'relative',
            padding: 'var(--space-3)',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          {showCopy && (
            <button
              onClick={handleCopy}
              style={{
                position: 'absolute',
                top: 'var(--space-2)',
                right: 'var(--space-2)',
                padding: 'var(--space-1) var(--space-2)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-caption)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              Copy
            </button>
          )}
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-body)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p style={{ margin: '0 0 var(--space-2) 0' }}>{children}</p>
                ),
                code: ({ children }) => (
                  <code
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-mono)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'auto',
                      margin: 'var(--space-2) 0',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-mono)',
                    }}
                  >
                    {children}
                  </pre>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: '0 0 var(--space-2) 0', paddingLeft: 'var(--space-4)' }}>
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 'var(--space-1)' }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>
                ),
              }}
            >
              {block.output}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {block.status === 'running' && (
        <div
          style={{
            padding: 'var(--space-3)',
            borderTop: '1px solid var(--border-default)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-mono)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Processing...
        </div>
      )}
    </div>
  )
}
