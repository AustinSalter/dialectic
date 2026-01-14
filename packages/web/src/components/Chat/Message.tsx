import type { ReactNode } from 'react'

interface MessageProps {
  sender: 'ai' | 'user'
  children: ReactNode
  timestamp?: Date
  isNew?: boolean
}

export function Message({ sender, children, timestamp, isNew = false }: MessageProps) {
  const isAI = sender === 'ai'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isAI ? 'flex-start' : 'flex-end',
        animation: isNew ? 'fadeIn 150ms ease-out' : undefined,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: isAI ? 'var(--bg-secondary)' : 'var(--accent-primary-muted)',
          border: isAI ? '1px solid var(--border-subtle)' : '1px solid var(--accent-primary)',
        }}
      >
        {/* Sender label */}
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {isAI ? (
            <>
              <span style={{ color: 'var(--accent-primary)' }}>◆</span>
              Assistant
            </>
          ) : (
            'You'
          )}
          {timestamp && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
