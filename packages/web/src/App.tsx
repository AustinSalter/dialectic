import { useState, useCallback, useEffect } from 'react'
import { TerminalPanel } from './components/Terminal'
import type { CommandBlockData } from './components/Terminal'
import { KanbanBoard, stateLabels } from './components/Kanban'
import type { Session, SessionState, SessionCategory } from './components/Kanban'
import { HomePage } from './components/Home/HomePage'
import { SourceViewer } from './components/SourceViewer'
import { ChatThread } from './components/Chat'
import type { ChatMessage, UserResponse } from './components/Chat'
import { ThesisCard } from './components/ThesisCard'
import { HarnessProgress } from './components/HarnessProgress'
import { LeftRail, CommandBar } from './components/Layout'
import {
  loadSessions,
  saveSessions,
  createSession,
  hasApiKey,
  setApiKey,
  clearApiKey,
  deleteSession,
  getUserProfile,
  getSessionData,
  saveSessionData,
  deleteSessionData,
} from './lib/storage'
import type { UserProfile, PersistedSessionData } from './lib/storage'
import { validateApiKey } from './lib/claude'
import { ingestSource, ingestFromText } from './lib/ingest'
import type { IngestResult } from './lib/ingest'
import { generateQuestions, createPosition } from './lib/interview'
import type { Question, Position } from './lib/interview'
import { generateDraftThesis, formatDraftThesis } from './lib/draft'
import type { DraftThesis } from './lib/draft'
import { synthesizeThesis, canSynthesize } from './lib/synthesis'
import type { Thesis, SessionData } from './lib/synthesis'
import { identifyTensions, resolveTension } from './lib/tensions'
import type { Tension } from './lib/tensions'
import { TensionCard } from './components/TensionCard'
import { sendMessage } from './lib/chat'
import type { ChatContext } from './lib/chat'
import { useHarness } from './lib/useHarness'
import type { Claim } from './lib/api'

type View = 'home' | 'terminal' | 'board' | 'ingest' | 'thesis' | 'tensions' | 'harness' | 'session-preview'

interface IngestState {
  result: IngestResult | null
  highlightedClaimId: string | null
  isLoading: boolean
  error: string | null
}

interface InterviewState {
  questions: Question[]
  messages: ChatMessage[]
  responses: UserResponse[]
  positions: Position[]
  isGenerating: boolean
  currentQuestionIndex: number
  error: string | null
}

interface SynthesisState {
  thesis: Thesis | null
  isGenerating: boolean
  error: string | null
  tensions: Tension[] // Track tensions for synthesis
}

interface DraftState {
  draft: DraftThesis | null
  isGenerating: boolean
  error: string | null
}

function App() {
  const [view, setView] = useState<View>('home')
  const [blocks, setBlocks] = useState<CommandBlockData[]>([])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [ingestState, setIngestState] = useState<IngestState>({
    result: null,
    highlightedClaimId: null,
    isLoading: false,
    error: null,
  })
  const [interviewState, setInterviewState] = useState<InterviewState>({
    questions: [],
    messages: [],
    responses: [],
    positions: [],
    isGenerating: false,
    currentQuestionIndex: 0,
    error: null,
  })
  const [synthesisState, setSynthesisState] = useState<SynthesisState>({
    thesis: null,
    isGenerating: false,
    error: null,
    tensions: [],
  })
  const [draftState, setDraftState] = useState<DraftState>({
    draft: null,
    isGenerating: false,
    error: null,
  })

  // User profile for remembering user preferences and patterns
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Track current session for persistence
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Session being previewed (before continuing)
  const [previewSession, setPreviewSession] = useState<Session | null>(null)

  // Multi-pass harness hook
  const harness = useHarness()

  // Load sessions and user profile from storage on mount
  useEffect(() => {
    const stored = loadSessions()
    setSessions(stored)

    // Load or create user profile
    const profile = getUserProfile()
    if (profile) {
      setUserProfile(profile)
    }

    if (!hasApiKey()) {
      setShowApiKeyModal(true)
    }
  }, [])

  // Save sessions when they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions)
    }
  }, [sessions])

  // Auto-save session data when relevant state changes
  useEffect(() => {
    if (!currentSessionId || !ingestState.result) return

    const sessionData: PersistedSessionData = {
      source: {
        url: ingestState.result.url,
        title: ingestState.result.title,
        text: ingestState.result.text,
        claims: ingestState.result.claims,
      },
      interview: {
        questions: interviewState.questions,
        responses: interviewState.responses,
        positions: interviewState.positions,
        messages: interviewState.messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString(),
        })),
      },
      synthesis: {
        draftThesis: draftState.draft || undefined,
        tensions: synthesisState.tensions,
        thesis: synthesisState.thesis ? {
          ...synthesisState.thesis,
          created_at: synthesisState.thesis.created_at.toISOString(),
        } : undefined,
      },
    }

    saveSessionData(currentSessionId, sessionData)
  }, [
    currentSessionId,
    ingestState.result,
    interviewState.positions.length,
    interviewState.responses.length,
    synthesisState.tensions.length,
    synthesisState.thesis,
    draftState.draft,
  ])

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim()
    if (!key) {
      setApiKeyError('Please enter an API key')
      return
    }
    if (!key.startsWith('sk-ant-')) {
      setApiKeyError('Invalid key format. Key should start with sk-ant-')
      return
    }
    setIsValidatingKey(true)
    setApiKeyError('')
    const valid = await validateApiKey(key)
    setIsValidatingKey(false)
    if (valid) {
      setApiKey(key)
      setShowApiKeyModal(false)
      setApiKeyInput('')
    } else {
      setApiKeyError('Could not validate API key. Check your key and try again.')
    }
  }

  const handleClearApiKey = () => {
    clearApiKey()
    setShowApiKeyModal(true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'b') {
        e.preventDefault()
        setView(v => v === 'terminal' ? 'board' : 'terminal')
      }
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSessionMove = useCallback((sessionId: string, newState: SessionState) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, state: newState, updatedAt: new Date() }
          : s
      )
    )
  }, [])

  const handleSessionDelete = useCallback((sessionId: string) => {
    setSessions(prev => deleteSession(prev, sessionId))
    // Also delete persisted session data
    deleteSessionData(sessionId)
    // Clear current session if it was the deleted one
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null)
    }
  }, [currentSessionId])

  // Continue a session - load its state and resume
  const handleContinueSession = useCallback((session: Session) => {
    // Set current session for persistence
    setCurrentSessionId(session.id)

    // Try to restore persisted session data
    const persistedData = getSessionData(session.id)

    if (persistedData) {
      // Restore source/ingest state
      if (persistedData.source) {
        setIngestState({
          result: {
            url: persistedData.source.url,
            title: persistedData.source.title,
            text: persistedData.source.text,
            claims: persistedData.source.claims,
          },
          highlightedClaimId: null,
          isLoading: false,
          error: null,
        })
      }

      // Restore interview state
      if (persistedData.interview) {
        setInterviewState({
          questions: persistedData.interview.questions,
          responses: persistedData.interview.responses,
          positions: persistedData.interview.positions,
          messages: persistedData.interview.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
          isGenerating: false,
          currentQuestionIndex: persistedData.interview.responses.length,
          error: null,
        })
      }

      // Restore synthesis state
      if (persistedData.synthesis) {
        setSynthesisState({
          thesis: persistedData.synthesis.thesis ? {
            ...persistedData.synthesis.thesis,
            created_at: new Date(persistedData.synthesis.thesis.created_at),
          } : null,
          isGenerating: false,
          error: null,
          tensions: persistedData.synthesis.tensions || [],
        })
        setDraftState({
          draft: persistedData.synthesis.draftThesis || null,
          isGenerating: false,
          error: null,
        })
      }

      // Switch to appropriate view based on restored state
      if (persistedData.source) {
        setView('ingest')
        return
      }
    }

    // For sessions without persisted data or claims, show terminal prompt
    const newBlock: CommandBlockData = {
      id: Date.now().toString(),
      command: `continue ${session.id}`,
      output: `# Continuing: ${session.title}

**Stage**: ${stateLabels[session.state]}
**Claims**: ${session.claimCount}

${session.claimCount === 0
  ? `This session has no claims extracted yet.

To continue, run \`ingest <url>\` to add a new source.`
  : `Session loaded. Interview questions will generate automatically.`}`,
      status: 'complete',
      timestamp: new Date(),
    }
    setBlocks(prev => [...prev, newBlock])
    setView('terminal')
  }, [])

  // Card click now auto-continues (low friction)
  // Card click shows preview (friendly greeting before continuing)
  const handleSessionOpen = useCallback((session: Session) => {
    setPreviewSession(session)
    setView('session-preview')
  }, [])

  // Handle new idea from homepage
  const handleNewIdea = useCallback(() => {
    setView('terminal')
    // Add a helpful prompt
    const newBlock: CommandBlockData = {
      id: Date.now().toString(),
      command: 'new idea',
      output: `# Start New Idea

To begin exploring a new idea, ingest a source:

\`ingest <url>\` - Ingest from a URL
\`ingest --paste\` - Ingest from clipboard

The GATHER → SHAPE → CRITIQUE → SYNTHESIZE workflow will help you form a thesis.`,
      status: 'complete',
      timestamp: new Date(),
    }
    setBlocks(prev => [...prev, newBlock])
  }, [])

  // Handle new decision from homepage (analyze mode)
  const handleNewDecision = useCallback(() => {
    setView('terminal')
    // Prompt for decision context
    const newBlock: CommandBlockData = {
      id: Date.now().toString(),
      command: 'new decision',
      output: `# Start Decision Analysis

Decision mode applies your formed theses to specific questions.

\`analyze "your question"\` - Start analysis with a specific question
\`analyze\` - Start interactive decision mode

Example: \`analyze "Should I invest in companies building context graphs?"\``,
      status: 'complete',
      timestamp: new Date(),
    }
    setBlocks(prev => [...prev, newBlock])
  }, [])

  // Generate draft thesis after ingest (new flow)
  const generateDraft = useCallback(async (result: IngestResult, blockId: string) => {
    if (!result.claims.length) return

    setDraftState(prev => ({ ...prev, isGenerating: true, error: null }))

    try {
      const draft = await generateDraftThesis(result.claims)

      setDraftState(prev => ({
        ...prev,
        draft,
        isGenerating: false,
      }))

      // Update block with the draft thesis
      const formattedDraft = formatDraftThesis(draft, result.title)
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? {
                ...b,
                output: formattedDraft,
                status: 'complete' as const,
              }
            : b
        )
      )

      // Switch to terminal view to show the draft
      setView('terminal')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate draft thesis'
      setDraftState(prev => ({
        ...prev,
        isGenerating: false,
        error: message,
      }))
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? { ...b, output: `# Draft Generation Failed\n\n${message}`, status: 'error' as const }
            : b
        )
      )
    }
  }, [])

  // Generate interview questions after ingest (kept for optional use)
  const generateInterviewQuestions = useCallback(async (result: IngestResult) => {
    if (!result.claims.length) return

    setInterviewState(prev => ({ ...prev, isGenerating: true, error: null }))

    try {
      const questions = await generateQuestions(result.claims)

      const messages: ChatMessage[] = []

      messages.push({
        id: 'intro',
        sender: 'ai',
        content: `I've extracted ${result.claims.length} claims from "${result.title}". Let me ask you some questions to understand your position on these claims.`,
        timestamp: new Date(),
      })

      if (questions.length > 0) {
        const firstQ = questions[0]
        messages.push({
          id: `msg-${firstQ.id}`,
          sender: 'ai',
          content: firstQ.text,
          question: firstQ,
          timestamp: new Date(),
        })
      }

      setInterviewState(prev => ({
        ...prev,
        questions,
        messages,
        isGenerating: false,
        currentQuestionIndex: 0,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate questions'
      setInterviewState(prev => ({
        ...prev,
        isGenerating: false,
        error: message,
      }))
    }
  }, [])

  // Handle ingest completion
  const handleIngestComplete = useCallback((result: IngestResult, blockId: string) => {
    const newSession = createSession({
      title: result.title,
      category: 'operational' as SessionCategory,
      summary: result.claims.length > 0
        ? result.claims[0].text
        : 'Source ingested - no claims extracted',
    })

    const sessionWithClaims: Session = {
      ...newSession,
      claimCount: result.claims.length,
      state: 'exploring',
    }

    setSessions(prev => [...prev, sessionWithClaims])

    // Track this as the current session for persistence
    setCurrentSessionId(sessionWithClaims.id)

    setIngestState({
      result,
      highlightedClaimId: null,
      isLoading: false,
      error: null,
    })

    const claimList = result.claims.map(c => `- @${c.id}: ${c.text}`).join('\n')
    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? {
              ...b,
              output: `# Source Ingested

**Title**: ${result.title}
**Claims Extracted**: ${result.claims.length}

${claimList}

---
*Generating interview questions...*

Click **Source** tab to view claims. Answer the interview questions in the left panel to shape your thesis.`,
              status: 'running' as const,
            }
          : b
      )
    )

    // Generate interview questions (interview must complete before thesis)
    generateInterviewQuestions(result)
  }, [generateInterviewQuestions])

  const handleIngestError = useCallback((error: string, blockId: string) => {
    setIngestState(prev => ({
      ...prev,
      isLoading: false,
      error,
    }))

    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? { ...b, output: `# Ingest Failed\n\n${error}`, status: 'error' as const }
          : b
      )
    )
    setIsProcessing(false)
  }, [])

  const handleIngestUrl = useCallback(async (url: string, blockId: string) => {
    setIngestState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await ingestSource(url)
      handleIngestComplete(result, blockId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      handleIngestError(message, blockId)
    }
  }, [handleIngestComplete, handleIngestError])

  const handleIngestPaste = useCallback(async (blockId: string) => {
    setIngestState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        throw new Error('Clipboard is empty')
      }
      const result = await ingestFromText(text)
      handleIngestComplete(result, blockId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read clipboard'
      handleIngestError(message, blockId)
    }
  }, [handleIngestComplete, handleIngestError])

  const handleClaimClick = useCallback((claimId: string) => {
    setIngestState(prev => ({
      ...prev,
      highlightedClaimId: prev.highlightedClaimId === claimId ? null : claimId,
    }))
  }, [])

  // Handle interview option selection
  const handleOptionSelect = useCallback((questionId: string, optionIndex: number) => {
    const question = interviewState.questions.find(q => q.id === questionId)
    if (!question) return

    const position = createPosition(question, optionIndex)

    const response: UserResponse = {
      questionId,
      selectedOption: optionIndex,
    }

    const userMsg: ChatMessage = {
      id: `user-${questionId}`,
      sender: 'user',
      content: question.options[optionIndex].label,
      timestamp: new Date(),
    }

    const currentIndex = interviewState.questions.findIndex(q => q.id === questionId)
    const nextQuestion = interviewState.questions[currentIndex + 1]

    const newMessages: ChatMessage[] = [userMsg]

    if (nextQuestion) {
      newMessages.push({
        id: `msg-${nextQuestion.id}`,
        sender: 'ai',
        content: nextQuestion.text,
        question: nextQuestion,
        timestamp: new Date(),
      })
    } else {
      newMessages.push({
        id: 'complete',
        sender: 'ai',
        content: `Interview complete! You've taken positions on ${interviewState.responses.length + 1} claims. Ready to identify tensions and move toward synthesis.`,
        timestamp: new Date(),
      })
    }

    setInterviewState(prev => ({
      ...prev,
      responses: [...prev.responses, response],
      positions: [...prev.positions, position],
      messages: [...prev.messages, ...newMessages],
      currentQuestionIndex: currentIndex + 1,
    }))
  }, [interviewState.questions, interviewState.responses.length])

  const handleFreeTextSubmit = useCallback((questionId: string, text: string) => {
    const question = interviewState.questions.find(q => q.id === questionId)
    if (!question) return

    const position: Position = {
      claim_id: question.claim_ref,
      question_id: question.id,
      position_type: 'nuances',
      selected_option: -1,
      elaboration: text,
    }

    const response: UserResponse = {
      questionId,
      freeText: text,
    }

    const userMsg: ChatMessage = {
      id: `user-${questionId}`,
      sender: 'user',
      content: text,
      timestamp: new Date(),
    }

    const currentIndex = interviewState.questions.findIndex(q => q.id === questionId)
    const nextQuestion = interviewState.questions[currentIndex + 1]

    const newMessages: ChatMessage[] = [userMsg]

    if (nextQuestion) {
      newMessages.push({
        id: `msg-${nextQuestion.id}`,
        sender: 'ai',
        content: nextQuestion.text,
        question: nextQuestion,
        timestamp: new Date(),
      })
    } else {
      newMessages.push({
        id: 'complete',
        sender: 'ai',
        content: `Interview complete! You've taken positions on ${interviewState.responses.length + 1} claims. Ready to identify tensions and move toward synthesis.`,
        timestamp: new Date(),
      })
    }

    setInterviewState(prev => ({
      ...prev,
      responses: [...prev.responses, response],
      positions: [...prev.positions, position],
      messages: [...prev.messages, ...newMessages],
      currentQuestionIndex: currentIndex + 1,
    }))
  }, [interviewState.questions, interviewState.responses.length])

  const currentQuestion = interviewState.questions[interviewState.currentQuestionIndex]

  const interviewProgress = {
    answered: interviewState.responses.length,
    total: interviewState.questions.length,
  }

  const isInterviewComplete = interviewState.questions.length > 0 &&
    interviewState.responses.length === interviewState.questions.length

  // Generate draft thesis after interview completes
  useEffect(() => {
    if (isInterviewComplete && ingestState.result && !draftState.draft && !draftState.isGenerating) {
      // Find the latest ingest block to update
      const ingestBlock = blocks.find(b => b.command.startsWith('ingest'))
      if (ingestBlock) {
        generateDraft(ingestState.result, ingestBlock.id)
      }
    }
  }, [isInterviewComplete, ingestState.result, draftState.draft, draftState.isGenerating, blocks, generateDraft])

  // Handle thesis synthesis
  const handleSynthesize = useCallback(async (blockId: string) => {
    if (!ingestState.result) {
      return { success: false, error: 'No source ingested' }
    }

    const sessionData: SessionData = {
      id: `session-${Date.now()}`,
      title: ingestState.result.title,
      claims: ingestState.result.claims,
      positions: interviewState.positions,
      tensions: synthesisState.tensions,
    }

    const readiness = canSynthesize(sessionData)
    if (!readiness.ready) {
      return { success: false, error: readiness.reason }
    }

    setSynthesisState(prev => ({ ...prev, isGenerating: true, error: null }))

    try {
      const thesis = await synthesizeThesis(sessionData)

      setSynthesisState(prev => ({
        ...prev,
        thesis,
        isGenerating: false,
      }))

      // Update the most recent session to formed state
      setSessions(prev => {
        const latest = [...prev].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        if (latest) {
          return prev.map(s =>
            s.id === latest.id
              ? { ...s, state: 'formed' as SessionState, updatedAt: new Date() }
              : s
          )
        }
        return prev
      })

      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? {
                ...b,
                output: `# Thesis Synthesized

**${thesis.title}**

**Confidence**: ${Math.round(thesis.confidence * 100)}%

${thesis.core_belief}

---
*Type \`view thesis\` to see full thesis card.*`,
                status: 'complete' as const,
              }
            : b
        )
      )

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Synthesis failed'
      setSynthesisState(prev => ({
        ...prev,
        isGenerating: false,
        error: message,
      }))

      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? { ...b, output: `# Synthesis Failed\n\n${message}`, status: 'error' as const }
            : b
        )
      )

      return { success: false, error: message }
    }
  }, [ingestState.result, interviewState.positions, synthesisState.tensions])

  // Handle critique - identify tensions from positions
  const handleCritique = useCallback(async (blockId: string) => {
    if (!ingestState.result) {
      return { success: false, error: 'No source ingested' }
    }
    if (interviewState.positions.length === 0) {
      return { success: false, error: 'No positions taken yet' }
    }

    setSynthesisState(prev => ({ ...prev, isGenerating: true, error: null }))

    try {
      const tensions = await identifyTensions(
        ingestState.result.claims,
        interviewState.positions
      )

      setSynthesisState(prev => ({
        ...prev,
        tensions,
        isGenerating: false,
      }))

      // Update the most recent session to tensions state
      setSessions(prev => {
        const latest = [...prev].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        if (latest) {
          return prev.map(s =>
            s.id === latest.id
              ? { ...s, state: 'tensions' as SessionState, tensionCount: tensions.length, updatedAt: new Date() }
              : s
          )
        }
        return prev
      })

      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? {
                ...b,
                output: `# Critique Complete

**Tensions Identified**: ${tensions.length}

${tensions.map(t => `- **${t.id}**: ${t.description}`).join('\n')}

---
*Type \`tensions\` to view and resolve tensions.*`,
                status: 'complete' as const,
              }
            : b
        )
      )

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Critique failed'
      setSynthesisState(prev => ({
        ...prev,
        isGenerating: false,
        error: message,
      }))

      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId
            ? { ...b, output: `# Critique Failed\n\n${message}`, status: 'error' as const }
            : b
        )
      )

      return { success: false, error: message }
    }
  }, [ingestState.result, interviewState.positions])

  // Handle tension resolution
  const handleResolveTension = useCallback((tensionId: string) => {
    // For now, just mark as resolved with a placeholder
    // In a full implementation, this would open a dialog for user input
    const resolution = 'User acknowledged this tension.'
    setSynthesisState(prev => ({
      ...prev,
      tensions: resolveTension(prev.tensions, tensionId, resolution),
    }))
  }, [])

  // Handle starting multi-pass harness analysis
  const handleRunAnalysis = useCallback(() => {
    if (!ingestState.result) {
      console.warn('[App] Cannot run analysis: no source ingested')
      return
    }

    // Convert ingest claims to API Claim format
    const claims: Claim[] = ingestState.result.claims.map(c => ({
      id: c.id,
      text: c.text,
      type: c.type,
      snippet: c.snippet,
      quote_start: c.quote_start,
      quote_end: c.quote_end,
    }))

    // Start the harness
    harness.actions.start(ingestState.result.title, claims)

    // Switch to harness view
    setView('harness')
  }, [ingestState.result, harness.actions])

  // Retry harness after error/cancel
  const handleRetryAnalysis = useCallback(() => {
    if (!ingestState.result) return
    handleRunAnalysis()
  }, [ingestState.result, handleRunAnalysis])

  const handleCommand = useCallback((command: string) => {
    setCommandHistory(prev => [...prev, command])

    const newBlock: CommandBlockData = {
      id: Date.now().toString(),
      command,
      output: '',
      status: 'running',
      timestamp: new Date(),
    }
    setBlocks(prev => [...prev, newBlock])
    setIsProcessing(true)

    setTimeout(() => {
      let output = ''
      let status: 'complete' | 'error' = 'complete'

      const cmd = command.toLowerCase().trim()
      const args = cmd.split(' ').slice(1).join(' ')

      if (cmd === 'help') {
        output = `# Available Commands

**Navigation**
- \`board\` - Switch to Kanban board view
- \`terminal\` - Switch to terminal view

**Source Intake**
- \`ingest <url>\` - Start dialectic intake from URL
- \`ingest --paste\` - Intake from clipboard
- \`extract\` - Re-extract claims from current source (if extraction failed)

**Analysis & Decisions**
- \`analyze\` - Run multi-pass harness analysis on extracted claims
- \`analyze "question"\` - Start decision mode with a specific question
- \`harness\` - View harness progress and results

**Critique & Tensions**
- \`critique\` - Identify tensions in your positions (run after interview)
- \`tensions\` - View and resolve identified tensions

**Synthesis**
- \`synthesize\` - Synthesize thesis from current session
- \`view thesis\` - View formed thesis card

**Session Management**
- \`status\` - Show current session state
- \`sessions\` - List all sessions
- \`continue [session-id]\` - Resume session (or most recent if no ID)
- \`open <session-id>\` - View session details
- \`move <session-id> to <state>\` - Move session to new state
- \`delete <session-id>\` - Delete a session

**Other**
- \`help\` - Show this help message
- \`clear\` - Clear terminal history
- \`settings\` - Configure API key

**Conversational Mode**
Type any natural language question or prompt to chat with Claude.
Claude has access to tools for file operations and web fetching.`
      } else if (cmd === 'board') {
        output = 'Switching to board view...'
        setTimeout(() => setView('board'), 300)
      } else if (cmd === 'terminal') {
        output = 'Already in terminal view.'
      } else if (cmd === 'synthesize') {
        if (!hasApiKey()) {
          output = 'No API key configured. Run `settings key` first.'
          status = 'error'
        } else if (!ingestState.result) {
          output = 'No source ingested. Run `ingest <url>` first.'
          status = 'error'
        } else if (interviewState.positions.length === 0) {
          output = 'No positions taken. Complete the interview first.'
          status = 'error'
        } else {
          output = `# Synthesizing Thesis

**Source**: ${ingestState.result.title}
**Positions**: ${interviewState.positions.length}
**Tensions**: ${synthesisState.tensions.length}

Running multi-pass synthesis...`
          handleSynthesize(newBlock.id)
        }
      } else if (cmd === 'view thesis') {
        if (synthesisState.thesis) {
          output = 'Switching to thesis view...'
          setTimeout(() => setView('thesis'), 300)
        } else {
          output = 'No thesis formed yet. Run `synthesize` first.'
          status = 'error'
        }
      } else if (cmd === 'critique') {
        if (!hasApiKey()) {
          output = 'No API key configured. Run `settings key` first.'
          status = 'error'
        } else if (!ingestState.result) {
          output = 'No source ingested. Run `ingest <url>` first.'
          status = 'error'
        } else if (interviewState.positions.length === 0) {
          output = 'No positions taken. Complete the interview first.'
          status = 'error'
        } else {
          output = `# Running Critique

**Source**: ${ingestState.result.title}
**Positions**: ${interviewState.positions.length}

Identifying tensions in your positions...`
          handleCritique(newBlock.id)
        }
      } else if (cmd === 'tensions') {
        if (synthesisState.tensions.length > 0) {
          output = 'Switching to tensions view...'
          setTimeout(() => setView('tensions'), 300)
        } else {
          output = 'No tensions identified yet. Run `critique` after completing the interview.'
          status = 'error'
        }
      } else if (cmd === 'analyze' || cmd === 'run analysis' || cmd.startsWith('analyze ')) {
        // Check for quoted question: analyze "question here"
        const questionMatch = command.match(/analyze\s+["'](.+?)["']/i)
        const question = questionMatch ? questionMatch[1] : null

        if (question) {
          // Decision mode: analyze with a specific question
          // Find relevant formed theses from existing sessions
          const formedSessions = sessions.filter(s => s.state === 'formed' && s.mode === 'idea')
          const thesesContext = formedSessions.length > 0
            ? formedSessions.map(s => `- **${s.title}**: ${s.summary || 'No summary'}`).join('\n')
            : 'No formed theses available yet.'

          // Create a decision session
          const decisionSession = createSession({
            title: `Decision: ${question.slice(0, 50)}${question.length > 50 ? '...' : ''}`,
            category: 'operational' as SessionCategory,
            summary: question,
            mode: 'decision',
          })
          setSessions(prev => [...prev, decisionSession])

          output = `# Decision Analysis Started

**Question**: ${question}

**Relevant Theses** (${formedSessions.length} formed):
${thesesContext}

---
*Decision mode searches your thesis library for relevant context.*
*Run \`ingest <url>\` to add new evidence, then \`analyze\` to run multi-pass reasoning.*`

          // If we have an ingested source, we can run the harness
          if (ingestState.result && ingestState.result.claims.length > 0) {
            output += `

**Current Source**: ${ingestState.result.title}
Starting multi-pass analysis with thesis context...`
            setTimeout(() => handleRunAnalysis(), 100)
          }
        } else if (!ingestState.result) {
          output = 'No source ingested. Run `ingest <url>` first, or use `analyze "your question"` to start decision mode.'
          status = 'error'
        } else if (ingestState.result.claims.length === 0) {
          output = 'No claims extracted. Run `extract` to re-extract claims.'
          status = 'error'
        } else {
          output = `# Starting Multi-Pass Analysis

**Source**: ${ingestState.result.title}
**Claims**: ${ingestState.result.claims.length}

Connecting to harness backend...`
          // Start harness in background and switch view
          setTimeout(() => handleRunAnalysis(), 100)
        }
      } else if (cmd === 'harness') {
        if (harness.status === 'idle' && !harness.result) {
          output = 'No analysis running. Run `analyze` to start multi-pass reasoning.'
          status = 'error'
        } else {
          output = 'Switching to harness view...'
          setTimeout(() => setView('harness'), 300)
        }
      } else if (cmd === 'clear') {
        setBlocks([])
        return
      } else if (cmd === 'settings') {
        output = `# Settings

**API Key**: ${hasApiKey() ? 'Configured' : 'Not configured'}

Type \`settings key\` to update your API key.`
      } else if (cmd === 'settings key') {
        setShowApiKeyModal(true)
        output = 'Opening API key settings...'
      } else if (cmd === 'sessions') {
        const byState: Record<string, Session[]> = {}
        sessions.forEach(s => {
          if (!byState[s.state]) byState[s.state] = []
          byState[s.state].push(s)
        })
        output = `# Sessions (${sessions.length} total)

${Object.entries(byState).map(([state, list]) => `
**${stateLabels[state as SessionState]}** (${list.length})
${list.map(s => `- \`${s.id}\`: ${s.title}`).join('\n')}
`).join('\n')}`
      } else if (cmd === 'status') {
        const counts = {
          backlog: sessions.filter(s => s.state === 'backlog').length,
          exploring: sessions.filter(s => s.state === 'exploring').length,
          tensions: sessions.filter(s => s.state === 'tensions').length,
          synthesizing: sessions.filter(s => s.state === 'synthesizing').length,
          formed: sessions.filter(s => s.state === 'formed').length,
        }
        output = `# Current Status

**Sessions by Stage**
- ${stateLabels.backlog}: ${counts.backlog}
- ${stateLabels.exploring}: ${counts.exploring}
- ${stateLabels.tensions}: ${counts.tensions}
- ${stateLabels.synthesizing}: ${counts.synthesizing}
- ${stateLabels.formed}: ${counts.formed}

**Interview Progress**: ${interviewProgress.answered}/${interviewProgress.total} questions

Type \`sessions\` for details or \`board\` to view visually.`
      } else if (cmd.startsWith('open ')) {
        const sessionId = args
        const session = sessions.find(s => s.id === sessionId)
        if (session) {
          output = `# ${session.title}

**Category**: ${session.category}
**Stage**: ${stateLabels[session.state]}
**Claims**: ${session.claimCount}
**Tensions**: ${session.tensionCount}

${session.summary || 'No summary available.'}

---
*Use \`continue ${session.id}\` to resume this session.*`
        } else {
          output = `Session not found: \`${sessionId}\`\n\nUse \`sessions\` to see all sessions.`
          status = 'error'
        }
      } else if (cmd.startsWith('ingest ')) {
        // Strip angle brackets and whitespace from URL
        const url = args.replace(/^<|>$/g, '').trim()
        if (!hasApiKey()) {
          output = `No API key configured. Run \`settings key\` first.`
          status = 'error'
        } else if (url === '--paste') {
          output = `# Source Intake Started

**Source**: Clipboard

Reading clipboard and extracting claims...`
          handleIngestPaste(newBlock.id)
        } else if (url) {
          output = `# Source Intake Started

**URL**: ${url}

Fetching source and extracting claims...`
          handleIngestUrl(url, newBlock.id)
        } else {
          output = `Usage: \`ingest <url>\` or \`ingest --paste\``
          status = 'error'
        }
      } else if (cmd.startsWith('continue ') || cmd === 'continue') {
        const sessionId = args.trim()
        if (!sessionId) {
          // Continue most recent session
          const sorted = [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          const mostRecent = sorted[0]
          if (mostRecent) {
            handleContinueSession(mostRecent)
            output = `Continuing most recent session: **${mostRecent.title}**`
          } else {
            output = 'No sessions to continue. Run `ingest <url>` to start.'
            status = 'error'
          }
        } else {
          const session = sessions.find(s => s.id === sessionId)
          if (session) {
            handleContinueSession(session)
            output = `Continuing: **${session.title}**`
          } else {
            output = `Session not found: \`${sessionId}\`\n\nUse \`sessions\` to see all sessions.`
            status = 'error'
          }
        }
      } else if (cmd.startsWith('move ')) {
        const match = args.match(/(\S+)\s+to\s+(\S+)/)
        if (match) {
          const [, sessionId, newState] = match
          const validStates = ['backlog', 'exploring', 'tensions', 'synthesizing', 'formed']
          if (validStates.includes(newState)) {
            const session = sessions.find(s => s.id === sessionId)
            if (session) {
              handleSessionMove(sessionId, newState as SessionState)
              output = `Moved **${session.title}** to **${newState}**.`
            } else {
              output = `Session not found: \`${sessionId}\``
              status = 'error'
            }
          } else {
            output = `Invalid state: \`${newState}\`\n\nValid states: ${validStates.join(', ')}`
            status = 'error'
          }
        } else {
          output = `Invalid syntax. Use: \`move <session-id> to <state>\``
          status = 'error'
        }
      } else if (cmd === 'extract' || cmd === 'extract claims') {
        // Re-extract claims from current source
        if (!hasApiKey()) {
          output = `No API key configured. Run \`settings key\` first.`
          status = 'error'
        } else if (!ingestState.result) {
          output = `No source loaded. Run \`ingest <url>\` first.`
          status = 'error'
        } else if (!ingestState.result.text) {
          output = `No source text available.`
          status = 'error'
        } else {
          output = `# Re-extracting Claims

**Source**: ${ingestState.result.title}
**Text length**: ${ingestState.result.text.length} characters

Calling Claude to extract claims...`
          // Async re-extraction
          import('./lib/ingest').then(async ({ extractClaims }) => {
            try {
              const claims = await extractClaims(ingestState.result!.text, ingestState.result!.title)
              setIngestState(prev => ({
                ...prev,
                result: prev.result ? { ...prev.result, claims } : null,
              }))
              // Update session claim count
              setSessions(prev => {
                const latest = [...prev].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
                if (latest) {
                  return prev.map(s => s.id === latest.id ? { ...s, claimCount: claims.length } : s)
                }
                return prev
              })
              setBlocks(prev =>
                prev.map(b =>
                  b.id === newBlock.id
                    ? {
                        ...b,
                        output: `# Claims Extracted

**Found**: ${claims.length} claims

${claims.map(c => `- @${c.id}: ${c.text}`).join('\n')}

Switch to **Source** view to see highlighted passages.`,
                        status: 'complete' as const,
                      }
                    : b
                )
              )
              // Trigger interview generation
              if (claims.length > 0) {
                generateInterviewQuestions({ ...ingestState.result!, claims })
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Extraction failed'
              setBlocks(prev =>
                prev.map(b =>
                  b.id === newBlock.id
                    ? { ...b, output: `# Extraction Failed\n\n${errMsg}`, status: 'error' as const }
                    : b
                )
              )
            }
            setIsProcessing(false)
          })
          return // Don't fall through
        }
      } else if (cmd.startsWith('delete ')) {
        const sessionId = args.trim()
        if (!sessionId) {
          output = `Usage: \`delete <session-id>\`\n\nUse \`sessions\` to see all session IDs.`
          status = 'error'
        } else {
          const session = sessions.find(s => s.id === sessionId)
          if (session) {
            setSessions(prev => deleteSession(prev, sessionId))
            output = `Deleted session: **${session.title}**`
          } else {
            output = `Session not found: \`${sessionId}\`\n\nUse \`sessions\` to see all sessions.`
            status = 'error'
          }
        }
      } else {
        // Conversational mode - send to Claude
        if (!hasApiKey()) {
          output = `No API key configured. Run \`settings key\` first to enable conversational mode.`
          status = 'error'
          setBlocks(prev =>
            prev.map(b =>
              b.id === newBlock.id
                ? { ...b, output, status }
                : b
            )
          )
          setIsProcessing(false)
          return
        }

        // Build context for chat
        const chatContext: ChatContext = {
          currentSessionId: sessions[0]?.id,
          currentSessionTitle: sessions[0]?.title,
          claims: ingestState.result?.claims || [],
          positions: interviewState.positions,
          tensions: synthesisState.tensions,
          draftThesis: draftState.draft,
          userProfile: userProfile,
        }

        // Update block to show we're thinking
        setBlocks(prev =>
          prev.map(b =>
            b.id === newBlock.id
              ? { ...b, output: '*Thinking...*', status: 'running' as const }
              : b
          )
        )

        // Stream response from Claude
        let streamedOutput = ''
        sendMessage(
          command,
          chatContext,
          (chunk: string) => {
            streamedOutput += chunk
            setBlocks(prev =>
              prev.map(b =>
                b.id === newBlock.id
                  ? { ...b, output: streamedOutput, status: 'running' as const }
                  : b
              )
            )
          }
        )
          .then(() => {
            setBlocks(prev =>
              prev.map(b =>
                b.id === newBlock.id
                  ? { ...b, output: streamedOutput, status: 'complete' as const }
                  : b
              )
            )
            setIsProcessing(false)
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : 'Chat failed'
            setBlocks(prev =>
              prev.map(b =>
                b.id === newBlock.id
                  ? { ...b, output: `Error: ${errMsg}`, status: 'error' as const }
                  : b
              )
            )
            setIsProcessing(false)
          })
        return // Don't fall through to the normal block update
      }

      setBlocks(prev =>
        prev.map(b =>
          b.id === newBlock.id
            ? { ...b, output, status }
            : b
        )
      )
      setIsProcessing(false)
    }, 200)
  }, [sessions, handleSessionMove, handleContinueSession, interviewProgress, handleIngestPaste, handleIngestUrl, ingestState.result, interviewState.positions, synthesisState.tensions, synthesisState.thesis, handleSynthesize, handleCritique, generateInterviewQuestions, draftState.draft, harness.status, harness.result, handleRunAnalysis])

  // Determine if we should show the left rail (only on 'home' view)
  const showLeftRail = view === 'home'

  // Terminal and Board are full-width views
  const isFullWidthView = view === 'terminal' || view === 'board'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-headers)',
            fontSize: '20px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            letterSpacing: '0.02em',
            margin: 0,
          }}
        >
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>[</span>
          <span style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>dialectic</span>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>]</span>
        </h1>
        <div
          style={{
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setView('home')}
            className="nav-button"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${view === 'home' ? 'var(--accent-info)' : 'var(--border-default)'}`,
              backgroundColor: view === 'home' ? 'var(--accent-info)' : 'transparent',
              color: view === 'home' ? 'white' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-out)',
              fontWeight: view === 'home' ? 500 : 400,
            }}
          >
            Home
          </button>
          <button
            onClick={() => setView('terminal')}
            className="nav-button"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${view === 'terminal' ? 'var(--accent-info)' : 'var(--border-default)'}`,
              backgroundColor: view === 'terminal' ? 'var(--accent-info)' : 'transparent',
              color: view === 'terminal' ? 'white' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-out)',
              fontWeight: view === 'terminal' ? 500 : 400,
            }}
          >
            Terminal
          </button>
          <button
            onClick={() => setView('board')}
            className="nav-button"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${view === 'board' ? 'var(--accent-info)' : 'var(--border-default)'}`,
              backgroundColor: view === 'board' ? 'var(--accent-info)' : 'transparent',
              color: view === 'board' ? 'white' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-out)',
              fontWeight: view === 'board' ? 500 : 400,
            }}
          >
            Board
          </button>
          {ingestState.result && (
            <button
              onClick={() => setView('ingest')}
              className="nav-button"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${view === 'ingest' ? 'var(--accent-info)' : 'var(--border-default)'}`,
                backgroundColor: view === 'ingest' ? 'var(--accent-info)' : 'transparent',
                color: view === 'ingest' ? 'white' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                fontWeight: view === 'ingest' ? 500 : 400,
              }}
            >
              Source
            </button>
          )}
          {synthesisState.tensions.length > 0 && (
            <button
              onClick={() => setView('tensions')}
              className="nav-button"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${view === 'tensions' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                backgroundColor: view === 'tensions' ? 'var(--accent-primary)' : 'transparent',
                color: view === 'tensions' ? 'var(--bg-base)' : 'var(--accent-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                fontWeight: view === 'tensions' ? 500 : 400,
              }}
            >
              Tensions ({synthesisState.tensions.length})
            </button>
          )}
          {(harness.isActive || harness.result) && (
            <button
              onClick={() => setView('harness')}
              className="nav-button"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${view === 'harness' ? 'var(--accent-success)' : 'var(--border-default)'}`,
                backgroundColor: view === 'harness' ? 'var(--accent-success)' : 'transparent',
                color: view === 'harness' ? 'var(--bg-base)' : 'var(--accent-success)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                fontWeight: view === 'harness' ? 500 : 400,
              }}
            >
              {harness.isActive ? `Analysis (${Math.round(harness.confidence * 100)}%)` : 'Analysis'}
            </button>
          )}
          {synthesisState.thesis && (
            <button
              onClick={() => setView('thesis')}
              className="nav-button"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${view === 'thesis' ? 'var(--accent-success)' : 'var(--border-default)'}`,
                backgroundColor: view === 'thesis' ? 'var(--accent-success)' : 'transparent',
                color: view === 'thesis' ? 'var(--bg-base)' : 'var(--accent-success)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                fontWeight: view === 'thesis' ? 500 : 400,
              }}
            >
              Thesis
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area - Cabin/Window Layout */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          // Account for command bar at bottom (52px) - not needed in terminal view
          paddingBottom: view === 'terminal' ? '0' : '52px',
        }}
      >
        {/* Left Rail - The Cabin (only on home view) */}
        {showLeftRail && (
          <LeftRail
            sessions={sessions}
            onSelectSession={handleContinueSession}
            currentSessionId={currentSessionId}
            onNewIdea={handleNewIdea}
            onNewDecision={handleNewDecision}
          />
        )}

        {/* Main Workspace - The Window */}
        <main
          className="main-workspace"
          style={{
            flex: 1,
            background: 'var(--bg-base)',
            padding: isFullWidthView ? '16px' : '32px',
            overflowY: 'auto',
            // Subtle cool gradient suggesting depth/distance (the view out)
            backgroundImage: `
              linear-gradient(
                180deg,
                var(--bg-base) 0%,
                rgba(107, 152, 184, 0.03) 100%
              )
            `,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {view === 'home' && (
            <HomePage
              sessions={sessions}
              onNewIdea={handleNewIdea}
              onNewDecision={handleNewDecision}
              onContinueSession={handleContinueSession}
              onCommand={(cmd) => {
                setView('terminal')
                handleCommand(cmd)
              }}
            />
          )}
          {view === 'terminal' && (
            <TerminalPanel
              blocks={blocks}
              commandHistory={commandHistory}
              onCommand={handleCommand}
              isProcessing={isProcessing}
            />
          )}
          {view === 'board' && (
            <KanbanBoard
              sessions={sessions}
              onSessionMove={handleSessionMove}
              onSessionOpen={handleSessionOpen}
              onSessionDelete={handleSessionDelete}
            />
          )}
          {view === 'ingest' && ingestState.result && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {/* Source view header with Run Analysis button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexShrink: 0,
                }}
              >
                <div>
                  <h2
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '18px',
                      margin: 0,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ingestState.result.title}
                  </h2>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {ingestState.result.claims.length} claims extracted
                  </span>
                </div>
                <button
                  onClick={handleRunAnalysis}
                  disabled={harness.isActive}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: harness.isActive ? 'var(--bg-card)' : 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    color: harness.isActive ? 'var(--text-tertiary)' : 'white',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    cursor: harness.isActive ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {harness.isActive ? 'Analysis Running...' : 'Run Analysis'}
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  flex: 1,
                  overflow: 'hidden',
                }}
              >
              <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ChatThread
                  messages={interviewState.messages}
                  currentQuestion={currentQuestion}
                  onOptionSelect={handleOptionSelect}
                  onFreeTextSubmit={handleFreeTextSubmit}
                  responses={interviewState.responses}
                  claims={ingestState.result.claims}
                  onClaimClick={handleClaimClick}
                />
              </div>
              <SourceViewer
                title={ingestState.result.title}
                text={ingestState.result.text}
                claims={ingestState.result.claims}
                highlightedClaimId={ingestState.highlightedClaimId}
                onClaimClick={handleClaimClick}
              />
              </div>
            </div>
          )}
          {view === 'harness' && (
            <div
              style={{
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '22px',
                    margin: 0,
                    color: 'var(--text-primary)',
                  }}
                >
                  Multi-Pass Analysis
                </h2>
                {ingestState.result && harness.status === 'idle' && !harness.result && (
                  <button
                    onClick={handleRunAnalysis}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Run Analysis
                  </button>
                )}
              </div>
              {ingestState.result && (
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '6px',
                  }}
                >
                  <strong>Source:</strong> {ingestState.result.title}
                  <br />
                  <strong>Claims:</strong> {ingestState.result.claims.length}
                </div>
              )}
              <HarnessProgress
                status={harness.status}
                currentCycle={harness.currentCycle}
                currentPass={harness.currentPass}
                confidence={harness.confidence}
                trajectory={harness.trajectory}
                tokensUsed={harness.tokensUsed}
                result={harness.result}
                error={harness.error}
                onCancel={harness.actions.cancel}
                onRetry={handleRetryAnalysis}
              />
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  onClick={() => setView('terminal')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-card)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Back to Terminal
                </button>
              </div>
            </div>
          )}
          {view === 'thesis' && synthesisState.thesis && (
            <div
              style={{
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
              }}
            >
              <ThesisCard
                thesis={synthesisState.thesis}
                onExport={(markdown) => {
                  console.log('Thesis exported:', markdown)
                }}
              />
            </div>
          )}
          {view === 'tensions' && synthesisState.tensions.length > 0 && (
            <div
              style={{
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '22px',
                  marginBottom: '16px',
                  color: 'var(--text-primary)',
                }}
              >
                Tensions Identified
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '16px',
                }}
              >
                Review and resolve these tensions before synthesizing your thesis.
              </p>
              {synthesisState.tensions.map((tension) => (
                <TensionCard
                  key={tension.id}
                  tension={tension}
                  onResolve={handleResolveTension}
                  onClaimClick={handleClaimClick}
                />
              ))}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  onClick={() => setView('terminal')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Back to Terminal
                </button>
              </div>
            </div>
          )}
          {view === 'session-preview' && previewSession && (
            <div
              style={{
                maxWidth: '600px',
                margin: '0 auto',
                width: '100%',
                padding: '24px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  padding: '24px',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 1px 3px rgba(44, 42, 38, 0.06), 0 4px 12px rgba(44, 42, 38, 0.03)',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '22px',
                    marginBottom: '8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {previewSession.title}
                </h2>
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>Stage: <strong style={{ color: 'var(--accent-primary)' }}>{stateLabels[previewSession.state]}</strong></span>
                  <span>{previewSession.claimCount} claims</span>
                  {previewSession.tensionCount > 0 && (
                    <span style={{ color: 'var(--accent-warm)' }}>{previewSession.tensionCount} tensions</span>
                  )}
                </div>
                {previewSession.summary && (
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '16px',
                      lineHeight: 1.5,
                    }}
                  >
                    {previewSession.summary}
                  </p>
                )}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '6px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    Hi, let's continue discussing <em>{previewSession.title}</em>.
                    {previewSession.claimCount > 0
                      ? " I'll pick up where we left off with the interview questions."
                      : " We can start by ingesting some source material to explore."
                    }
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setPreviewSession(null)
                      setView('board')
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-card)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      handleContinueSession(previewSession)
                      setPreviewSession(null)
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Continue Session
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Command Bar - The Radio (fixed at bottom, hidden in terminal view) */}
      {view !== 'terminal' && (
        <CommandBar
          onCommand={handleCommand}
          sessionCount={sessions.length}
          isProcessing={isProcessing}
        />
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && hasApiKey()) {
              setShowApiKeyModal(false)
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '8px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 4px 24px rgba(44, 42, 38, 0.15)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              API Key Required
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Enter your Anthropic API key to enable Claude integration. Your key is stored locally and never sent to our servers.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="sk-ant-..."
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                marginBottom: '8px',
              }}
              autoFocus
            />
            {apiKeyError && (
              <p style={{ fontSize: '12px', color: 'var(--accent-primary)', marginBottom: '12px' }}>
                {apiKeyError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {hasApiKey() && (
                <>
                  <button
                    onClick={() => { setShowApiKeyModal(false); setApiKeyInput(''); setApiKeyError(''); }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearApiKey}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--accent-primary)',
                      borderRadius: '6px',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
              <button
                onClick={handleSaveApiKey}
                disabled={isValidatingKey}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isValidatingKey ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: isValidatingKey ? 0.7 : 1,
                }}
              >
                {isValidatingKey ? 'Validating...' : 'Save Key'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
              Get your key at{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
