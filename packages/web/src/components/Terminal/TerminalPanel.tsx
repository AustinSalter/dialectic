import { useRef, useEffect } from 'react'
import { CommandInput } from './CommandInput'
import { CommandBlock } from './CommandBlock'
import type { CommandBlockData } from './CommandBlock'

interface TerminalPanelProps {
  blocks: CommandBlockData[]
  commandHistory: string[]
  onCommand: (command: string) => void
  isProcessing?: boolean
}

export function TerminalPanel({
  blocks,
  commandHistory,
  onCommand,
  isProcessing = false,
}: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new blocks are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [blocks])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Output area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {blocks.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              gap: 'var(--space-6)',
              animation: 'fadeIn 300ms ease-out',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '1.75rem',
                  marginBottom: 'var(--space-3)',
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--weight-regular)',
                  letterSpacing: '0.05em',
                }}
              >
                /
              </div>
              <div style={{
                fontSize: 'var(--text-item-title)',
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
                fontWeight: 'var(--weight-medium)',
                fontStyle: 'italic',
                letterSpacing: 'var(--tracking-tight)',
                lineHeight: 'var(--leading-normal)',
              }}>
                Every thesis begins with friction
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              maxWidth: 380,
              lineHeight: 'var(--leading-relaxed)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-body)',
            }}>
              <p style={{ marginBottom: 'var(--space-3)' }}>
                Type <code style={{
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-mono)',
                }}>help</code> to see commands
              </p>
              <p>
                or <code style={{
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-mono)',
                }}>ingest &lt;url&gt;</code> to analyze a source
              </p>
            </div>
          </div>
        ) : (
          blocks.map((block, index) => (
            <CommandBlock
              key={block.id}
              block={block}
              isLatest={index === blocks.length - 1}
            />
          ))
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid var(--border-default)',
          padding: 'var(--space-3)',
        }}
      >
        <CommandInput
          onSubmit={onCommand}
          history={commandHistory}
          disabled={isProcessing}
        />
      </div>
    </div>
  )
}
