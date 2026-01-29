/**
 * Dialectic V2Upgrade
 *
 * Floating window system with vista backgrounds.
 * Two views: Terminal (default) and Board.
 */

import { useState, useCallback, useEffect } from 'react'
import { Header, type View } from './components/Layout'
import { Vista, VistaScrollButton, type VistaType, vistaOrder } from './components/Vista'
import { TerminalView, XTerminal } from './components/Terminal'
import { invoke } from '@tauri-apps/api/core'
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
import { pickFolder } from './lib/folderPicker'

// Demo document content
const demoDocuments: Record<string, DocumentContent> = {
  '/research/wang-letters.md': {
    id: 'wang-letters',
    title: "Wang's Hard Tech Thesis",
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
    title: "Dalio's World Order Cycles",
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

// Map session state to workflow skill command
function getSkillForState(state: SessionState): string | null {
  switch (state) {
    case 'backlog':
      return '/gather'
    case 'exploring':
      return '/shape'
    case 'tensions':
      return '/stress-test'
    case 'synthesizing':
      return '/synthesize'
    case 'formed':
      return null // Completed, no skill needed
    default:
      return null
  }
}

// Session window state
interface SessionWindowState {
  zIndex: number
  isFullscreen: boolean
  isThinking: boolean
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  workingDir: string | null    // Terminal working directory
  terminalActive: boolean      // Whether this is a terminal session
  initialCommand: string | null // Command to inject on terminal start
}

// Z-index management - start above empty state (5) and window base (50)
let nextZIndex = 60

// Demo sessions for dev mode - provides sample data for demos
function createDemoSessions(): Session[] {
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  return [
    // SPARK column (backlog)
    {
      id: 'demo-session-1',
      title: 'DeepSeek R1 vs OpenAI o1',
      category: 'ai-infrastructure' as SessionCategory,
      state: 'backlog' as SessionState,
      mode: 'idea' as const,
      claimCount: 0,
      tensionCount: 0,
      summary: 'Compare reasoning capabilities and cost structures',
      createdAt: hourAgo,
      updatedAt: hourAgo,
    },
    {
      id: 'demo-session-2',
      title: 'Tariff Impact on TSMC',
      category: 'geopolitical' as SessionCategory,
      state: 'backlog' as SessionState,
      mode: 'decision' as const,
      claimCount: 0,
      tensionCount: 0,
      summary: 'Analyze supply chain risks from new trade policies',
      createdAt: dayAgo,
      updatedAt: dayAgo,
    },
    // EXPLORE column
    {
      id: 'demo-session-3',
      title: 'Nvidia Blackwell Demand Signals',
      category: 'ai-infrastructure' as SessionCategory,
      state: 'exploring' as SessionState,
      mode: 'idea' as const,
      claimCount: 8,
      tensionCount: 1,
      summary: 'Tracking enterprise adoption and hyperscaler orders',
      createdAt: twoDaysAgo,
      updatedAt: hourAgo,
    },
    {
      id: 'demo-session-4',
      title: 'Grid Capacity for AI Datacenters',
      category: 'energy-power' as SessionCategory,
      state: 'exploring' as SessionState,
      mode: 'decision' as const,
      claimCount: 12,
      tensionCount: 2,
      summary: 'Power constraints vs compute buildout trajectories',
      createdAt: weekAgo,
      updatedAt: dayAgo,
    },
    // TENSIONS column
    {
      id: 'demo-session-5',
      title: 'China AI Chip Self-Sufficiency',
      category: 'geopolitical' as SessionCategory,
      state: 'tensions' as SessionState,
      mode: 'idea' as const,
      claimCount: 15,
      tensionCount: 4,
      summary: 'SMIC progress vs export control effectiveness',
      createdAt: weekAgo,
      updatedAt: twoDaysAgo,
    },
    // FORMING column
    {
      id: 'demo-session-6',
      title: 'Microsoft Copilot ROI Thesis',
      category: 'ai-infrastructure' as SessionCategory,
      state: 'synthesizing' as SessionState,
      mode: 'decision' as const,
      claimCount: 18,
      tensionCount: 3,
      summary: 'Enterprise productivity gains vs subscription costs',
      createdAt: weekAgo,
      updatedAt: dayAgo,
    },
    // SHIP column (formed)
    {
      id: 'demo-session-7',
      title: 'Renewable Intermittency Solutions',
      category: 'energy-power' as SessionCategory,
      state: 'formed' as SessionState,
      mode: 'idea' as const,
      claimCount: 22,
      tensionCount: 0,
      summary: 'Battery storage and grid flexibility technologies',
      createdAt: weekAgo,
      updatedAt: twoDaysAgo,
    },
  ]
}

// Load sessions with demo data fallback for dev mode
function loadSessionsWithDemo(): Session[] {
  const saved = loadSessions()
  if (saved.length === 0 && import.meta.env.DEV) {
    const demo = createDemoSessions()
    saveSessions(demo)
    return demo
  }
  return saved
}

function App() {
  const [view, setView] = useState<View>('terminal')
  const [sessions, setSessions] = useState<Session[]>(() => loadSessionsWithDemo())

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

  // View change handler - clears floating windows when switching to Board
  const handleViewChange = useCallback((newView: View) => {
    setView(newView)
    if (newView === 'board') {
      // Close all floating windows
      setOpenWindows(new Map())
      setActiveWindowId(null)
      setNotesWindowOpen(false)
      setOpenDocument(null)
    }
  }, [])

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
  // If state is provided (from Kanban), inject the appropriate workflow skill
  const handleOpenSession = useCallback((sessionId: string, state?: SessionState) => {
    const session = sessions.find((s) => s.id === sessionId)

    setOpenWindows((prev) => {
      // If already open, just focus it
      if (prev.has(sessionId)) {
        const updated = new Map(prev)
        const existing = updated.get(sessionId)!
        updated.set(sessionId, { ...existing, zIndex: nextZIndex++ })
        return updated
      }

      // Check if this is a terminal session (summary is a path)
      const isTerminalSession = session?.summary?.startsWith('/')
      const workingDir = isTerminalSession ? session.summary : null

      // Build initial command if state provided and terminal session
      let initialCommand: string | null = null
      if (isTerminalSession && state) {
        const skill = getSkillForState(state)
        if (skill) {
          // Inject skill command with session ID
          initialCommand = `${skill} ${sessionId}`
        }
      }

      // Open new window
      const updated = new Map(prev)
      updated.set(sessionId, {
        zIndex: nextZIndex++,
        isFullscreen: false,
        isThinking: false,
        messages: [],
        workingDir: workingDir ?? null,
        terminalActive: isTerminalSession ?? false,
        initialCommand,
      })
      return updated
    })
    setActiveWindowId(sessionId)
  }, [sessions])

  // Close a session window
  const handleCloseSession = useCallback((sessionId: string) => {
    // Kill terminal if it was a terminal session
    const windowState = openWindows.get(sessionId)
    if (windowState?.terminalActive) {
      invoke('kill_terminal', { sessionId }).catch((err) => {
        console.warn('Failed to kill terminal:', err)
      })
    }

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

  // Create new session and open it (conversation mode)
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

  // Create new terminal session with folder picker
  const handleNewSessionWithFolder = useCallback((path: string, name: string) => {
    const newSession = createSession({
      title: name,
      category: 'operational',
      summary: path,
      mode: 'idea',
    })

    setSessions((prev) => [...prev, newSession])

    // Open window with terminal active
    setOpenWindows((prev) => {
      const updated = new Map(prev)
      updated.set(newSession.id, {
        zIndex: nextZIndex++,
        isFullscreen: false,
        isThinking: false,
        messages: [],
        workingDir: path,
        terminalActive: true,
        initialCommand: null, // New sessions don't auto-inject a skill
      })
      return updated
    })
    setActiveWindowId(newSession.id)
  }, [])

  // Global keyboard shortcuts
  // Note: ⌘N and ⌘W conflict with browser/macOS, so use Shift+⌘ variants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea to avoid intercepting typing
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // ⌘K or / to switch to terminal view (unless typing in input)
      if ((e.metaKey && e.key === 'k') || (e.key === '/' && !isTyping)) {
        e.preventDefault()
        setView('terminal')
      }
      // ⌘B for Board view
      if (e.metaKey && e.key === 'b') {
        e.preventDefault()
        handleViewChange('board')
      }
      // ⇧⌘T for Terminal view (⌘T conflicts with browser new tab)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setView('terminal')
      }
      // ⌥⌘N for new terminal session with folder picker (⌘N and ⇧⌘N conflict with browser)
      // Use e.code because Option+N produces "ñ" as e.key on Mac
      if (e.metaKey && e.altKey && e.code === 'KeyN') {
        e.preventDefault()
        pickFolder().then((folder) => {
          if (folder) {
            handleNewSessionWithFolder(folder.path, folder.name)
          }
        })
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
  }, [handleNewSessionWithFolder, activeWindowId, handleCloseSession, handleToggleNotesWindow])

  // Get session by ID helper
  const getSession = (sessionId: string) => sessions.find((s) => s.id === sessionId)

  return (
    <div className="app">
      <Header
        currentView={view}
        onViewChange={handleViewChange}
        onNewSession={handleNewSession}
        onNewSessionWithFolder={handleNewSessionWithFolder}
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
            showBear={openWindows.size === 0}
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
            status={{ type: windowState.terminalActive ? 'terminal' : (session.tensionCount > 0 ? 'tensions' : 'active'), count: session.tensionCount }}
            initialPosition={{ x: 100 + (openWindows.size * 20), y: 80 + (openWindows.size * 20) }}
            initialSize={{ width: 700, height: 500 }}
            isFullscreen={windowState.isFullscreen}
            zIndex={windowState.zIndex}
            onClose={() => handleCloseSession(sessionId)}
            onMinimize={() => handleCloseSession(sessionId)}
            onMaximize={() => handleToggleFullscreen(sessionId)}
            onFocus={() => handleFocusSession(sessionId)}
          >
            {windowState.terminalActive && windowState.workingDir ? (
              <XTerminal
                sessionId={sessionId}
                workingDir={windowState.workingDir}
                onClose={() => handleCloseSession(sessionId)}
                initialCommand={windowState.initialCommand ?? undefined}
              />
            ) : (
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
            )}
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
        <FloatingWindow
          id={`doc-${demoDocuments[openDocument].id}`}
          title={demoDocuments[openDocument].title}
          initialPosition={{ x: 280, y: 100 }}
          initialSize={{ width: 600, height: 550 }}
          zIndex={documentZIndex}
          onClose={handleCloseDocument}
          onFocus={handleFocusDocument}
        >
          <DocumentViewer
            document={demoDocuments[openDocument]}
            onClose={handleCloseDocument}
            onAddToSession={handleAddDocumentToSession}
            hasActiveSession={!!activeWindowId}
            embedded
          />
        </FloatingWindow>
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
        onNewSessionWithFolder={handleNewSessionWithFolder}
        disabled={activeWindowId ? openWindows.get(activeWindowId)?.isThinking : false}
      />

      {/* Keyboard hints (terminal view only) */}
      {view === 'terminal' && <KeyboardHints />}
    </div>
  )
}

export default App
