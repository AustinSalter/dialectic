/**
 * Dialectic V2Upgrade
 *
 * Floating window system with vista backgrounds.
 * Two views: Terminal (default) and Board.
 */

import { useState, useCallback, useEffect } from 'react'
import { Header, type View } from './components/Layout'
import { Vista, VistaScrollButton, type VistaType, vistaOrder } from './components/Vista'
import { TerminalView, type CommandBlockData } from './components/Terminal'
import { BoardView } from './components/Board'
import { KeyboardHints } from './components/KeyboardHints'
import { FloatingWindow } from './components/Window'
import { Conversation, Entry, InputArea, ThinkingIndicator } from './components/Conversation'
import { LeftRail, RightRail } from './components/Rails'
import { GlobalInputBar } from './components/GlobalInput'
import { NotesPanel, type Note } from './components/Notes'
import { DocumentViewer, type DocumentContent } from './components/DocumentViewer'
import type { Session, SessionState, SessionCategory } from './components/Kanban'
import { loadSessions, saveSessions, createSession } from './lib/storage'

// Demo document content
const demoDocuments: Record<string, DocumentContent> = {
  '/research/wang-letters.md': {
    id: 'wang-letters',
    filename: 'wang-letters.md',
    sections: [
      {
        type: 'summary',
        marginNote: 'Key claim',
        content: 'Wang\'s central thesis: China\'s manufacturing capabilities in "hard tech" — semiconductors, EVs, batteries, renewable energy — represent durable competitive advantages that Western financial analysts systematically undervalue.',
      },
      {
        type: 'argument',
        content: 'Unlike software (where network effects dominate), physical manufacturing requires accumulated process knowledge that cannot be easily replicated or leapfrogged.',
      },
      {
        type: 'quote',
        content: '"The factory floor is the laboratory. Process improvements compound over decades."',
      },
      {
        type: 'text',
        content: 'Wang argues this explains why China\'s EV industry has advanced faster than most predictions — BYD, CATL, and others benefit from manufacturing density that accelerates iteration.',
      },
      {
        type: 'tension',
        title: 'Tensions with Dalio',
        content: 'Where Dalio sees debt cycles as deterministic, Wang emphasizes industrial momentum. Key question: Does financial gravity override industrial momentum?',
      },
    ],
  },
  '/research/dalio-world-order.md': {
    id: 'dalio-world-order',
    filename: 'dalio.md',
    sections: [
      {
        type: 'summary',
        marginNote: 'Core thesis',
        content: 'Dalio argues that empires follow predictable cycles driven by debt, internal conflict, and external challenges. The current US-China dynamic mirrors historical great power transitions.',
      },
      {
        type: 'argument',
        content: 'The "Big Cycle" framework: rising powers build wealth through productivity, then financialize, then decline as debt burdens compound and social cohesion fractures.',
      },
      {
        type: 'quote',
        content: '"History doesn\'t repeat, but it rhymes. The patterns of rise and decline are remarkably consistent across civilizations."',
      },
    ],
  },
}

// Session window state
interface SessionWindowState {
  zIndex: number
  isFullscreen: boolean
  isThinking: boolean
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

// Z-index management - start above empty state (5) and window base (50)
let nextZIndex = 60

function App() {
  const [view, setView] = useState<View>('terminal')
  const [blocks, setBlocks] = useState<CommandBlockData[]>([])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())

  // Session windows state
  const [openWindows, setOpenWindows] = useState<Map<string, SessionWindowState>>(new Map())
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null)

  // Rails state
  const [leftRailOpen, setLeftRailOpen] = useState(false)
  const [rightRailOpen, setRightRailOpen] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('dialectic_notes')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  const [notesWindowOpen, setNotesWindowOpen] = useState(false)
  const [notesZIndex, setNotesZIndex] = useState(10)

  // Document viewer state
  const [openDocument, setOpenDocument] = useState<string | null>(null)
  const [documentZIndex, setDocumentZIndex] = useState(10)

  // Persist notes
  useEffect(() => {
    localStorage.setItem('dialectic_notes', JSON.stringify(notes))
  }, [notes])

  // Notes handlers
  const handleAddNote = useCallback((content: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      content,
      timestamp: new Date(),
      isPinned: false,
    }
    setNotes((prev) => [...prev, newNote])
  }, [])

  const handleTogglePin = useCallback((noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n))
    )
  }, [])

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }, [])

  const handleToggleNotesWindow = useCallback(() => {
    setNotesWindowOpen((prev) => !prev)
    if (!notesWindowOpen) {
      setNotesZIndex(nextZIndex++)
    }
  }, [notesWindowOpen])

  const handleFocusNotes = useCallback(() => {
    setNotesZIndex(nextZIndex++)
  }, [])

  // Document viewer handlers
  const handleOpenDocument = useCallback((path: string) => {
    setOpenDocument(path)
    setDocumentZIndex(nextZIndex++)
  }, [])

  const handleCloseDocument = useCallback(() => {
    setOpenDocument(null)
  }, [])

  const handleFocusDocument = useCallback(() => {
    setDocumentZIndex(nextZIndex++)
  }, [])

  const handleAddDocumentToSession = useCallback((documentId: string) => {
    // Add document reference to active session's messages
    if (activeWindowId) {
      setOpenWindows((prev) => {
        const updated = new Map(prev)
        const existing = updated.get(activeWindowId)
        if (existing) {
          const doc = Object.values(demoDocuments).find(d => d.id === documentId)
          if (doc) {
            updated.set(activeWindowId, {
              ...existing,
              messages: [
                ...existing.messages,
                { role: 'user' as const, content: `[Added document: ${doc.filename}]` },
              ],
            })
          }
        }
        return updated
      })
    }
  }, [activeWindowId])

  // Vista state (manual lock - resets on page refresh)
  const [vistaVariant, setVistaVariant] = useState<VistaType>('fire-lookout')

  // Cycle to next vista
  const cycleVista = useCallback(() => {
    setVistaVariant((current) => {
      const currentIndex = vistaOrder.indexOf(current)
      const nextIndex = (currentIndex + 1) % vistaOrder.length
      return vistaOrder[nextIndex]
    })
  }, [])

  // Save sessions on change
  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  const handleMoveSession = useCallback((sessionId: string, newState: SessionState) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, state: newState, updatedAt: new Date() } : s
      )
    )
  }, [])

  // Delete a session
  const handleDeleteSession = useCallback((sessionId: string) => {
    // Close the window if open
    setOpenWindows((prev) => {
      const updated = new Map(prev)
      updated.delete(sessionId)
      return updated
    })
    // Remove from sessions
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }, [])

  // Open a session in a floating window
  const handleOpenSession = useCallback((sessionId: string) => {
    setOpenWindows((prev) => {
      // If already open, just focus it
      if (prev.has(sessionId)) {
        const updated = new Map(prev)
        const existing = updated.get(sessionId)!
        updated.set(sessionId, { ...existing, zIndex: nextZIndex++ })
        return updated
      }
      // Open new window
      const updated = new Map(prev)
      updated.set(sessionId, {
        zIndex: nextZIndex++,
        isFullscreen: false,
        isThinking: false,
        messages: [],
      })
      return updated
    })
    setActiveWindowId(sessionId)
  }, [])

  // Close a session window
  const handleCloseSession = useCallback((sessionId: string) => {
    setOpenWindows((prev) => {
      const updated = new Map(prev)
      updated.delete(sessionId)
      return updated
    })
    // Update active window if we closed the active one
    setActiveWindowId((prev) => {
      if (prev === sessionId) {
        // Find the window with highest z-index
        const remaining = Array.from(openWindows.entries())
          .filter(([id]) => id !== sessionId)
        if (remaining.length > 0) {
          remaining.sort((a, b) => b[1].zIndex - a[1].zIndex)
          return remaining[0][0]
        }
        return null
      }
      return prev
    })
  }, [openWindows])

  // Focus a session window (bring to front)
  const handleFocusSession = useCallback((sessionId: string) => {
    setOpenWindows((prev) => {
      const updated = new Map(prev)
      const existing = updated.get(sessionId)
      if (existing) {
        updated.set(sessionId, { ...existing, zIndex: nextZIndex++ })
      }
      return updated
    })
    setActiveWindowId(sessionId)
  }, [])

  // Toggle fullscreen for a session window
  const handleToggleFullscreen = useCallback((sessionId: string) => {
    setOpenWindows((prev) => {
      const updated = new Map(prev)
      const existing = updated.get(sessionId)
      if (existing) {
        updated.set(sessionId, { ...existing, isFullscreen: !existing.isFullscreen })
      }
      return updated
    })
  }, [])

  // Add a message to a session's conversation
  // TODO: Replace with actual Claude API integration
  const handleSessionMessage = useCallback((sessionId: string, message: string) => {
    if (!message.trim()) return

    setOpenWindows((prev) => {
      const updated = new Map(prev)
      const existing = updated.get(sessionId)
      if (existing) {
        const newMessages = [
          ...existing.messages,
          { role: 'user' as const, content: message },
        ]
        // Set thinking state
        updated.set(sessionId, { ...existing, messages: newMessages, isThinking: true })

        // PLACEHOLDER: This is where Claude API would be called
        // In production, this would:
        // 1. Send message to Claude API
        // 2. Stream response back
        // 3. Handle tool calls (like AskUserQuestion)
        setTimeout(() => {
          setOpenWindows((p) => {
            const u = new Map(p)
            const e = u.get(sessionId)
            if (e) {
              u.set(sessionId, {
                ...e,
                isThinking: false,
                messages: [
                  ...e.messages,
                  {
                    role: 'assistant' as const,
                    content: `*[API integration pending]*

This is where Claude would respond to your message. The conversation UI is ready - it just needs to be connected to the Claude API.

To complete this integration:
- Wire up \`handleSessionMessage\` to call Claude's messages API
- Handle streaming responses for real-time text display
- Support tool use (like dialectic's thesis analysis tools)`,
                  },
                ],
              })
            }
            return u
          })
        }, 1200)
      }
      return updated
    })
  }, [])

  // Create new session and open it
  const handleNewSession = useCallback(() => {
    const categories: SessionCategory[] = ['geopolitical', 'market-structure', 'ai-infrastructure', 'energy-power', 'operational']
    const randomCategory = categories[Math.floor(Math.random() * categories.length)]

    const newSession = createSession({
      title: 'New Session',
      category: randomCategory,
      summary: 'Start typing to begin your analysis...',
      mode: 'idea',
    })

    setSessions((prev) => [...prev, newSession])
    handleOpenSession(newSession.id)
  }, [handleOpenSession])

  // Global keyboard shortcuts
  // Note: ⌘N and ⌘W conflict with browser/macOS, so use Shift+⌘ variants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea to avoid intercepting typing
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // ⌘K or / to focus command input (unless typing in input)
      if ((e.metaKey && e.key === 'k') || (e.key === '/' && !isTyping)) {
        e.preventDefault()
        setView('terminal')
        // Focus will happen via TerminalView's CommandInput
      }
      // ⌘B for Board view
      if (e.metaKey && e.key === 'b') {
        e.preventDefault()
        setView('board')
      }
      // ⇧⌘T for Terminal view (⌘T conflicts with browser new tab)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setView('terminal')
      }
      // ⌥⌘N for new session (⌘N and ⇧⌘N conflict with browser)
      // Use e.code because Option+N produces "ñ" as e.key on Mac
      if (e.metaKey && e.altKey && e.code === 'KeyN') {
        e.preventDefault()
        handleNewSession()
      }
      // Escape to close active window (⌘W conflicts with browser close tab)
      if (e.key === 'Escape' && activeWindowId && !isTyping) {
        e.preventDefault()
        handleCloseSession(activeWindowId)
      }
      // ⌘[ and ⌘] to toggle rails
      if (e.metaKey && e.key === '[') {
        e.preventDefault()
        setLeftRailOpen(prev => !prev)
      }
      if (e.metaKey && e.key === ']') {
        e.preventDefault()
        setRightRailOpen(prev => !prev)
      }
      // ⇧⌘O to toggle notes panel
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        handleToggleNotesWindow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewSession, activeWindowId, handleCloseSession, handleToggleNotesWindow])

  const handleCommand = useCallback((command: string) => {
    // Add to history
    setCommandHistory((prev) => [...prev, command])

    // Create new block
    const blockId = `block-${Date.now()}`
    const newBlock: CommandBlockData = {
      id: blockId,
      command,
      output: '',
      status: 'running',
      timestamp: new Date(),
    }
    setBlocks((prev) => [...prev, newBlock])

    // Process command
    const [cmd] = command.toLowerCase().split(' ')
    let output = ''
    let status: CommandBlockData['status'] = 'done'

    switch (cmd) {
      case 'help':
        output = `**Available Commands**

- \`help\` - Show this help message
- \`terminal\` - Switch to Terminal view
- \`board\` - Switch to Board view
- \`sessions\` - List all sessions
- \`clear\` - Clear terminal output
- \`ingest <url>\` - Fetch and analyze content (coming soon)
- \`ingest --paste\` - Analyze clipboard content (coming soon)
- \`demo\` - Add sample sessions for testing`
        break

      case 'demo': {
        const demoSessions: Session[] = [
          {
            id: `session-${Date.now()}-1`,
            title: 'Tariff Impact on Semiconductor Supply Chain',
            category: 'geopolitical',
            state: 'backlog',
            mode: 'decision',
            claimCount: 12,
            tensionCount: 3,
            summary: 'Analyzing potential supply chain disruptions from new trade policies',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: `session-${Date.now()}-2`,
            title: 'AI Infrastructure Investment Thesis',
            category: 'ai-infrastructure',
            state: 'exploring',
            mode: 'idea',
            claimCount: 8,
            tensionCount: 2,
            summary: 'Evaluating compute build-out trajectories and power constraints',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: `session-${Date.now()}-3`,
            title: 'Energy Grid Transformation',
            category: 'energy-power',
            state: 'tensions',
            mode: 'decision',
            claimCount: 15,
            tensionCount: 5,
            summary: 'Data center power demand vs renewable capacity growth',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
        setSessions((prev) => [...prev, ...demoSessions])
        output = `Added ${demoSessions.length} demo sessions. Switch to Board view with \`board\` to see them.`
        break
      }

      case 'terminal':
        setView('terminal')
        output = 'Switched to Terminal view'
        break

      case 'board':
        setView('board')
        output = 'Switched to Board view'
        break

      case 'sessions':
        if (sessions.length === 0) {
          output = 'No sessions yet. Use `ingest <url>` to start one.'
        } else {
          output = sessions.map((s) => `- **${s.title}** (${s.state})`).join('\n')
        }
        break

      case 'clear':
        setBlocks([])
        return // Don't add a block for clear

      default:
        output = `Unknown command: \`${cmd}\`. Type \`help\` for available commands.`
        status = 'error'
    }

    // Update block with output
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, output, status } : b
      )
    )
  }, [sessions])

  // Get session by ID helper
  const getSession = (sessionId: string) => sessions.find((s) => s.id === sessionId)

  return (
    <div className="app">
      <Header
        currentView={view}
        onViewChange={setView}
        onNewSession={handleNewSession}
        onToggleNotes={handleToggleNotesWindow}
        notesOpen={notesWindowOpen}
        onToggleFilesRail={() => setLeftRailOpen(!leftRailOpen)}
        filesRailOpen={leftRailOpen}
        onToggleSessionsRail={() => setRightRailOpen(!rightRailOpen)}
        sessionsRailOpen={rightRailOpen}
      />

      {/* Vista background (always present in terminal view) */}
      {view === 'terminal' && (
        <>
          <Vista
            variant={vistaVariant}
            showBear={blocks.length === 0 && openWindows.size === 0}
          />
          <VistaScrollButton
            currentVista={vistaVariant}
            onNext={cycleVista}
          />
        </>
      )}

      {/* Main content */}
      {view === 'terminal' ? (
        <TerminalView
          blocks={blocks}
          commandHistory={commandHistory}
          onCommand={handleCommand}
          hasOpenSessions={openWindows.size > 0}
          vistaVariant={vistaVariant}
        />
      ) : (
        <BoardView
          sessions={sessions}
          onMoveSession={handleMoveSession}
          onOpenSession={handleOpenSession}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* Session windows */}
      {Array.from(openWindows.entries()).map(([sessionId, windowState]) => {
        const session = getSession(sessionId)
        if (!session) return null

        return (
          <FloatingWindow
            key={sessionId}
            id={sessionId}
            title={session.title}
            status={{ type: session.tensionCount > 0 ? 'tensions' : 'active', count: session.tensionCount }}
            initialPosition={{ x: 100 + (openWindows.size * 20), y: 80 + (openWindows.size * 20) }}
            initialSize={{ width: 700, height: 500 }}
            isFullscreen={windowState.isFullscreen}
            zIndex={windowState.zIndex}
            onClose={() => handleCloseSession(sessionId)}
            onMinimize={() => handleCloseSession(sessionId)}
            onMaximize={() => handleToggleFullscreen(sessionId)}
            onFocus={() => handleFocusSession(sessionId)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <Conversation>
                {windowState.messages.length === 0 && !windowState.isThinking ? (
                  <div style={{ padding: '24px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Start typing to explore this thesis. Ask questions, challenge assumptions, or paste content to analyze.
                  </div>
                ) : (
                  <>
                    {windowState.messages.map((msg, idx) => (
                      <Entry key={idx} role={msg.role}>
                        {msg.content}
                      </Entry>
                    ))}
                    {windowState.isThinking && <ThinkingIndicator message="Analyzing" />}
                  </>
                )}
              </Conversation>
              <InputArea
                placeholder="Continue the analysis..."
                promptChar=">"
                onSubmit={(value) => handleSessionMessage(sessionId, value)}
                autoFocus={sessionId === activeWindowId}
                disabled={windowState.isThinking}
              />
            </div>
          </FloatingWindow>
        )
      })}

      {/* Notes Window */}
      {notesWindowOpen && (
        <FloatingWindow
          id="notes"
          title="Notes"
          status={{ type: 'notes', count: notes.length }}
          initialPosition={{ x: window.innerWidth - 360, y: 100 }}
          initialSize={{ width: 320, height: 400 }}
          isNotesWindow
          zIndex={notesZIndex}
          onClose={() => setNotesWindowOpen(false)}
          onMinimize={() => setNotesWindowOpen(false)}
          onFocus={handleFocusNotes}
        >
          <NotesPanel
            notes={notes}
            onAddNote={handleAddNote}
            onTogglePin={handleTogglePin}
            onDeleteNote={handleDeleteNote}
          />
        </FloatingWindow>
      )}

      {/* Document Viewer Window */}
      {openDocument && demoDocuments[openDocument] && (
        <div
          className="documentViewerWindow"
          style={{
            position: 'fixed',
            top: 100,
            left: 280,
            width: 600,
            height: 550,
            zIndex: documentZIndex,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
          onClick={handleFocusDocument}
        >
          <DocumentViewer
            document={demoDocuments[openDocument]}
            onClose={handleCloseDocument}
            onAddToSession={handleAddDocumentToSession}
            hasActiveSession={!!activeWindowId}
          />
        </div>
      )}

      {/* Sidebar Rails */}
      <LeftRail
        isOpen={leftRailOpen}
        onToggle={() => setLeftRailOpen(!leftRailOpen)}
        onFileSelect={handleOpenDocument}
      />
      <RightRail
        isOpen={rightRailOpen}
        onToggle={() => setRightRailOpen(!rightRailOpen)}
        sessions={sessions}
        onSessionClick={handleOpenSession}
        activeSessionId={activeWindowId}
      />

      {/* Global persistent input bar */}
      <GlobalInputBar
        activeSessionId={activeWindowId}
        activeSessionTitle={activeWindowId ? getSession(activeWindowId)?.title : undefined}
        onMessage={handleSessionMessage}
        onCommand={handleCommand}
        disabled={activeWindowId ? openWindows.get(activeWindowId)?.isThinking : false}
      />

      {/* Keyboard hints (terminal view only) */}
      {view === 'terminal' && <KeyboardHints />}
    </div>
  )
}

export default App
