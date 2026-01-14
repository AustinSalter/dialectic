import { useRef, useEffect, useState, useMemo, type ReactNode } from 'react'
import { Message } from './Message'
import { ClaimCard } from './ClaimCard'
import { OptionChips } from './OptionChips'
import type { Claim } from '../../lib/ingest'
import type { Question } from '../../lib/interview'

export interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  content: string
  claim?: Claim & { source: string }
  question?: Question
  timestamp: Date
}

export interface UserResponse {
  questionId: string
  selectedOption?: number
  freeText?: string
}

interface ChatThreadProps {
  messages: ChatMessage[]
  currentQuestion?: Question
  onOptionSelect: (questionId: string, optionIndex: number) => void
  onFreeTextSubmit: (questionId: string, text: string) => void
  responses: UserResponse[]
  claims?: Claim[]
  onClaimClick?: (claimId: string) => void
}

/**
 * Parse text and render @CLAIM-N references as clickable spans
 */
function renderWithClaimRefs(
  text: string,
  claims: Claim[],
  onClaimClick?: (claimId: string) => void
) {
  const claimIds = new Set(claims.map(c => c.id))
  const parts: (string | ReactNode)[] = []
  const regex = /@(CLAIM-\d+)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const claimId = match[1]
    const claim = claims.find(c => c.id === claimId)
    const isValid = claimIds.has(claimId)

    parts.push(
      <span
        key={`${claimId}-${match.index}`}
        onClick={() => isValid && onClaimClick?.(claimId)}
        title={claim ? claim.snippet.slice(0, 100) + '...' : undefined}
        style={{
          color: isValid ? 'var(--accent-primary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
          cursor: isValid ? 'pointer' : 'default',
          textDecoration: isValid ? 'underline' : 'none',
          textDecorationStyle: 'dotted',
        }}
      >
        @{claimId}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

export function ChatThread({
  messages,
  currentQuestion,
  onOptionSelect,
  onFreeTextSubmit,
  responses,
  claims = [],
  onClaimClick,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [freeText, setFreeText] = useState('')

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const getResponseForQuestion = (questionId: string) => {
    return responses.find(r => r.questionId === questionId)
  }

  const handleFreeTextSubmit = () => {
    if (currentQuestion && freeText.trim()) {
      onFreeTextSubmit(currentQuestion.id, freeText.trim())
      setFreeText('')
    }
  }

  // Progress indicator
  const progress = useMemo(() => {
    const totalQuestions = messages.filter(m => m.question).length
    const answered = responses.length
    return { answered, total: totalQuestions }
  }, [messages, responses])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header with progress */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          Interview
        </span>
        {progress.total > 0 && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            {progress.answered}/{progress.total} answered
          </span>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              padding: 'var(--space-4)',
            }}
          >
            {claims.length === 0
              ? 'No claims extracted from source. Try a different URL or paste content directly.'
              : 'Generating interview questions...'}
          </div>
        )}

        {messages.map((msg, index) => (
          <Message
            key={msg.id}
            sender={msg.sender}
            timestamp={msg.timestamp}
            isNew={index === messages.length - 1}
          >
            {/* Render claim card if present */}
            {msg.claim && (
              <ClaimCard
                claimId={msg.claim.id}
                text={msg.claim.text}
                snippet={msg.claim.snippet}
                source={msg.claim.source}
                type={msg.claim.type}
              />
            )}

            {/* Render message content with claim refs */}
            <p style={{ margin: 0 }}>
              {renderWithClaimRefs(msg.content, claims, onClaimClick)}
            </p>

            {/* Render options if this is a question */}
            {msg.question && (
              <OptionChips
                options={msg.question.options}
                selectedIndex={getResponseForQuestion(msg.question.id)?.selectedOption}
                onSelect={(index) => onOptionSelect(msg.question!.id, index)}
                disabled={!!getResponseForQuestion(msg.question.id)}
              />
            )}
          </Message>
        ))}
      </div>

      {/* Free text input (when there's an active question) */}
      {currentQuestion && !getResponseForQuestion(currentQuestion.id) && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: 'var(--space-3)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Or share your thoughts in your own words:
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFreeTextSubmit()}
              placeholder="Type your response..."
              style={{
                flex: 1,
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: freeText.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: freeText.trim() ? 'white' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                cursor: freeText.trim() ? 'pointer' : 'default',
                transition: 'var(--transition-fast)',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Completion state */}
      {progress.total > 0 && progress.answered === progress.total && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--accent-primary-muted)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-primary)',
              fontWeight: 500,
            }}
          >
            Interview complete - ready to synthesize
          </span>
        </div>
      )}
    </div>
  )
}
