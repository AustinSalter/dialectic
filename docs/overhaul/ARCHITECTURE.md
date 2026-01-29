# Dialectic Desktop Architecture

## Terminal Integration

Dialectic embeds Claude Code via a terminal emulator. The UI orchestrates — Claude Code reasons.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DIALECTIC WINDOW                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                         VISTA                                │    │
│  │    ┌──────────────┐              ┌──────────────────────┐   │    │
│  │    │ Files Palette│              │ Sessions Palette     │   │    │
│  │    └──────────────┘              └──────────────────────┘   │    │
│  │                                                              │    │
│  │         ┌────────────────────────────────────┐              │    │
│  │         │       Session Window               │              │    │
│  │         │  ┌──────────────────────────────┐  │              │    │
│  │         │  │     Embedded Terminal        │  │              │    │
│  │         │  │     (xterm.js + Claude Code) │  │              │    │
│  │         │  └──────────────────────────────┘  │              │    │
│  │         └────────────────────────────────────┘              │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  › [Persistent Input — sends to active terminal]            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
dialectic/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entry
│   │   ├── terminal.rs          # PTY management
│   │   ├── session.rs           # Session file watching
│   │   └── commands.rs          # Tauri commands
│   └── Cargo.toml
│
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── Vista.tsx            # Background landscape
│   │   ├── Terminal.tsx         # xterm.js wrapper
│   │   ├── SessionWindow.tsx    # Floating window with terminal
│   │   ├── Palette.tsx          # Snappable file/session palettes
│   │   ├── KanbanBoard.tsx      # Board view
│   │   └── PersistentInput.tsx  # Bottom input line
│   │
│   ├── hooks/
│   │   ├── useTerminal.ts       # Terminal instance management
│   │   ├── useSession.ts        # Session state from file watching
│   │   └── useClaudeCode.ts     # Command orchestration
│   │
│   ├── lib/
│   │   ├── sessionParser.ts     # Parse session.json updates
│   │   └── commandBuilder.ts    # Build Claude Code commands
│   │
│   └── stores/
│       ├── sessions.ts          # Zustand store
│       └── ui.ts                # UI state (palette positions, etc)
│
├── skills/
│   └── dialectic/
│       └── SKILL.md             # The harness skill
│
└── sessions/                    # User session data
    └── [session-id]/
        ├── session.json
        ├── context/
        ├── claims/
        ├── tensions/
        └── thesis/
```

---

## Terminal Integration (Rust + xterm.js)

### PTY Management (src-tauri/src/terminal.rs)

```rust
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct TerminalManager {
    sessions: HashMap<String, Arc<Mutex<PtySession>>>,
}

pub struct PtySession {
    pty: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    cwd: PathBuf,
}

impl TerminalManager {
    /// Spawn a new Claude Code session for a dialectic session
    pub async fn spawn_session(
        &mut self,
        session_id: &str,
        session_dir: PathBuf,
        skill_dir: PathBuf,
    ) -> Result<(), Error> {
        let pty_system = native_pty_system();
        
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        
        // Build Claude Code command with skill directory
        let mut cmd = CommandBuilder::new("claude");
        cmd.cwd(&session_dir);
        
        // Auto-load the dialectic skill
        cmd.args(&["--add-dir", skill_dir.to_str().unwrap()]);
        
        let child = pair.slave.spawn_command(cmd)?;
        
        self.sessions.insert(session_id.to_string(), Arc::new(Mutex::new(PtySession {
            pty: pair.master,
            child,
            cwd: session_dir,
        })));
        
        Ok(())
    }
    
    /// Send a command to an active session
    pub async fn send_command(
        &self,
        session_id: &str,
        command: &str,
    ) -> Result<(), Error> {
        if let Some(session) = self.sessions.get(session_id) {
            let mut session = session.lock().await;
            session.pty.write_all(command.as_bytes())?;
            session.pty.write_all(b"\n")?;
        }
        Ok(())
    }
    
    /// Read output from a session (for xterm.js)
    pub async fn read_output(
        &self,
        session_id: &str,
    ) -> Result<Vec<u8>, Error> {
        if let Some(session) = self.sessions.get(session_id) {
            let session = session.lock().await;
            let mut buf = vec![0u8; 4096];
            let n = session.pty.read(&mut buf)?;
            buf.truncate(n);
            Ok(buf)
        } else {
            Ok(vec![])
        }
    }
}
```

### Tauri Commands (src-tauri/src/commands.rs)

```rust
use tauri::State;

#[tauri::command]
async fn create_session(
    session_id: String,
    title: String,
    terminal_manager: State<'_, TerminalManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Create session directory
    let sessions_dir = app_handle.path_resolver()
        .app_data_dir()
        .unwrap()
        .join("sessions")
        .join(&session_id);
    
    std::fs::create_dir_all(&sessions_dir).map_err(|e| e.to_string())?;
    
    // Initialize session.json
    let session = Session {
        id: session_id.clone(),
        title,
        status: SessionStatus::Gathering,
        created: chrono::Utc::now(),
        updated: chrono::Utc::now(),
        context_files: vec![],
        claims: vec![],
        tensions: vec![],
        thesis: None,
        passes: vec![],
    };
    
    let session_file = sessions_dir.join("session.json");
    std::fs::write(&session_file, serde_json::to_string_pretty(&session).unwrap())
        .map_err(|e| e.to_string())?;
    
    // Create subdirectories
    std::fs::create_dir_all(sessions_dir.join("context")).ok();
    std::fs::create_dir_all(sessions_dir.join("claims")).ok();
    std::fs::create_dir_all(sessions_dir.join("tensions")).ok();
    std::fs::create_dir_all(sessions_dir.join("thesis")).ok();
    
    // Get skill directory
    let skill_dir = app_handle.path_resolver()
        .resolve_resource("skills/dialectic")
        .unwrap();
    
    // Spawn Claude Code session
    terminal_manager.spawn_session(&session_id, sessions_dir, skill_dir).await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn send_to_session(
    session_id: String,
    command: String,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    terminal_manager.send_command(&session_id, &command).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_context_files(
    session_id: String,
    files: Vec<String>,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    // Send /add commands for each file
    for file in files {
        let cmd = format!("/add {}", file);
        terminal_manager.send_command(&session_id, &cmd).await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn run_harness_command(
    session_id: String,
    command: HarnessCommand,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    let cmd = match command {
        HarnessCommand::Gather { source } => format!("/gather {}", source),
        HarnessCommand::Shape => "/shape".to_string(),
        HarnessCommand::Critique => "/critique".to_string(),
        HarnessCommand::Synthesize => "/synthesize".to_string(),
        HarnessCommand::Full { question } => format!("/harness {}", question),
        HarnessCommand::Tension { claim_a, claim_b } => {
            format!("/tension \"{}\" vs \"{}\"", claim_a, claim_b)
        }
    };
    
    terminal_manager.send_command(&session_id, &cmd).await
        .map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
enum HarnessCommand {
    Gather { source: String },
    Shape,
    Critique,
    Synthesize,
    Full { question: String },
    Tension { claim_a: String, claim_b: String },
}
```

---

## Frontend Integration

### Terminal Component (src/components/Terminal.tsx)

```tsx
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';

interface TerminalProps {
  sessionId: string;
  onOutput?: (data: string) => void;
}

export function Terminal({ sessionId, onOutput }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const terminal = new XTerm({
      theme: {
        background: 'rgba(38, 36, 33, 0.97)',
        foreground: '#B5B0A8',
        cursor: '#C4836A',
        cursorAccent: '#1F1E1B',
        selection: 'rgba(166, 93, 63, 0.3)',
        // Warm palette
        black: '#1F1E1B',
        red: '#A65D3F',
        green: '#6A8670',
        yellow: '#C4836A',
        blue: '#7A7672',
        magenta: '#8B5A42',
        cyan: '#6A9078',
        white: '#D9D4CA',
      },
      fontFamily: '"IBM Plex Mono", "Cousine", monospace',
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
    });
    
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    
    terminalRef.current = terminal;
    
    // Listen for terminal output from Tauri
    const unlisten = listen<Uint8Array>(`terminal-output-${sessionId}`, (event) => {
      const data = new TextDecoder().decode(event.payload);
      terminal.write(data);
      onOutput?.(data);
    });
    
    // Send terminal input to Tauri
    terminal.onData((data) => {
      invoke('terminal_input', { sessionId, data });
    });
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);
    
    return () => {
      unlisten.then(fn => fn());
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [sessionId]);
  
  return (
    <div 
      ref={containerRef} 
      className="terminal-container"
      style={{
        width: '100%',
        height: '100%',
        padding: '8px',
      }}
    />
  );
}
```

### Session Hook with File Watching (src/hooks/useSession.ts)

```tsx
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';

interface Session {
  id: string;
  title: string;
  status: 'gathering' | 'shaping' | 'critiquing' | 'synthesized';
  claims: Claim[];
  tensions: Tension[];
  thesis: Thesis | null;
  passes: Pass[];
}

export function useSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initial load
    invoke<Session>('get_session', { sessionId })
      .then(setSession)
      .finally(() => setLoading(false));
    
    // Watch for file changes (Tauri watches session.json)
    const unlisten = listen<Session>(`session-updated-${sessionId}`, (event) => {
      setSession(event.payload);
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [sessionId]);
  
  // Derive UI state from session status
  const currentPhase = session?.status ?? 'gathering';
  const hasThesis = session?.thesis != null;
  const openTensions = session?.tensions.filter(t => t.status === 'open') ?? [];
  
  return {
    session,
    loading,
    currentPhase,
    hasThesis,
    openTensions,
  };
}
```

### Kanban Auto-Loading (src/hooks/useKanbanSession.ts)

```tsx
import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

type KanbanColumn = 'inbox' | 'gathering' | 'shaping' | 'critiquing' | 'synthesized';

export function useKanbanSession() {
  /**
   * When a card is selected, load appropriate context into Claude Code
   */
  const selectCard = useCallback(async (
    sessionId: string,
    column: KanbanColumn,
    contextFiles: string[],
  ) => {
    // 1. Focus the session's terminal
    await invoke('focus_session', { sessionId });
    
    // 2. Load context files if not already loaded
    await invoke('load_context_files', { sessionId, files: contextFiles });
    
    // 3. Based on column, suggest the next harness command
    switch (column) {
      case 'inbox':
        // New session — prompt for question or source
        // No auto-command, just focus
        break;
        
      case 'gathering':
        // Already has context, suggest /shape
        await invoke('send_to_session', {
          sessionId,
          command: '# Ready to shape. Run /shape to begin interview.',
        });
        break;
        
      case 'shaping':
        // Interview in progress, suggest /critique when done
        await invoke('send_to_session', {
          sessionId,
          command: '# Continue exploring. Run /critique when ready to challenge.',
        });
        break;
        
      case 'critiquing':
        // Critique in progress, suggest /synthesize
        await invoke('send_to_session', {
          sessionId,
          command: '# Review tensions. Run /synthesize to form thesis.',
        });
        break;
        
      case 'synthesized':
        // Thesis exists — show it, allow revision
        await invoke('send_to_session', {
          sessionId,
          command: '# Thesis complete. Ask questions or run /critique to revise.',
        });
        break;
    }
  }, []);
  
  /**
   * When a card is moved to a new column, auto-run the appropriate command
   */
  const moveCard = useCallback(async (
    sessionId: string,
    fromColumn: KanbanColumn,
    toColumn: KanbanColumn,
  ) => {
    // Only auto-run when moving forward in the workflow
    const columnOrder: KanbanColumn[] = [
      'inbox', 'gathering', 'shaping', 'critiquing', 'synthesized'
    ];
    
    const fromIndex = columnOrder.indexOf(fromColumn);
    const toIndex = columnOrder.indexOf(toColumn);
    
    if (toIndex <= fromIndex) {
      // Moving backward — don't auto-run, just update status
      await invoke('update_session_status', { sessionId, status: toColumn });
      return;
    }
    
    // Moving forward — run the command for the new phase
    const command = {
      'gathering': null, // Manual — user adds sources
      'shaping': '/shape',
      'critiquing': '/critique',
      'synthesized': '/synthesize',
    }[toColumn];
    
    if (command) {
      await invoke('run_harness_command', {
        sessionId,
        command: { type: command.slice(1) }, // Remove leading /
      });
    }
  }, []);
  
  return { selectCard, moveCard };
}
```

### Persistent Input Integration (src/components/PersistentInput.tsx)

```tsx
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useSessionStore } from '../stores/sessions';

export function PersistentInput() {
  const [value, setValue] = useState('');
  const activeSessionId = useSessionStore(s => s.activeSessionId);
  
  const handleSubmit = useCallback(async () => {
    if (!value.trim() || !activeSessionId) return;
    
    const trimmed = value.trim();
    
    // Check if it's a harness command
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.split(' ');
      const argString = args.join(' ');
      
      switch (cmd) {
        case '/harness':
          await invoke('run_harness_command', {
            sessionId: activeSessionId,
            command: { Full: { question: argString } },
          });
          break;
        case '/gather':
          await invoke('run_harness_command', {
            sessionId: activeSessionId,
            command: { Gather: { source: argString } },
          });
          break;
        case '/shape':
          await invoke('run_harness_command', {
            sessionId: activeSessionId,
            command: 'Shape',
          });
          break;
        case '/critique':
          await invoke('run_harness_command', {
            sessionId: activeSessionId,
            command: 'Critique',
          });
          break;
        case '/synthesize':
          await invoke('run_harness_command', {
            sessionId: activeSessionId,
            command: 'Synthesize',
          });
          break;
        default:
          // Pass through to Claude Code as-is
          await invoke('send_to_session', {
            sessionId: activeSessionId,
            command: trimmed,
          });
      }
    } else {
      // Regular input — send to terminal
      await invoke('send_to_session', {
        sessionId: activeSessionId,
        command: trimmed,
      });
    }
    
    setValue('');
  }, [value, activeSessionId]);
  
  return (
    <div className="persistent-input">
      <div className="input-box">
        <span className="prompt">›</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={activeSessionId ? 'Ask a question or run /harness...' : 'Select a session...'}
          disabled={!activeSessionId}
        />
      </div>
    </div>
  );
}
```

---

## Session Workflow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KANBAN BOARD                                                               │
├──────────┬──────────┬───────────┬────────────┬─────────────────────────────┤
│  INBOX   │ GATHER   │  SHAPE    │  CRITIQUE  │  SYNTHESIZED                │
│          │          │           │            │                             │
│ ┌──────┐ │ ┌──────┐ │ ┌───────┐ │ ┌────────┐ │ ┌─────────────────────────┐ │
│ │ New  │ │ │Dalio │ │ │Power  │ │ │Semi-   │ │ │ Trade Policy            │ │
│ │      │ │ │vs    │ │ │Brokers│ │ │conduct-│ │ │ ────────────            │ │
│ │      │ │ │Wang  │ │ │       │ │ │ors     │ │ │ Confidence: 0.78        │ │
│ └──────┘ │ └──────┘ │ └───────┘ │ └────────┘ │ │ 2 triggers              │ │
│          │          │           │            │ └─────────────────────────┘ │
│          │ 3 claims │ exploring │ 2 tensions │                             │
└──────────┴──────────┴───────────┴────────────┴─────────────────────────────┘
                │            │           │              │
                ↓            ↓           ↓              ↓
           /gather       /shape    /critique      /synthesize
```

**Card Selection:**
1. Click card → focuses session terminal
2. Context files auto-loaded via `/add`
3. Prompt shows suggested next command

**Card Drag:**
1. Drag card to next column
2. Auto-runs the phase command
3. Session status updates from `session.json` watch

---

## What This Gets You

1. **No backend** — Claude Code IS the backend
2. **No API keys** — Users bring their own (Claude Code handles auth)
3. **No pricing** — You ship the methodology, not the compute
4. **Skills = IP** — Your harness techniques are the product
5. **File watching** — UI reacts to Claude Code's file outputs
6. **Real terminal** — Power users can drop to raw Claude Code anytime
