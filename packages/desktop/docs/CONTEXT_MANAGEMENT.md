# Context Management & Session Resume

## The Problem

Multi-pass reasoning requires accumulating context across turns. Claude Code conversations can:
- Hit context limits
- Be interrupted
- Need to resume later

We need to persist state outside the conversation.

## Solution: File-Based Scratchpad

```
.dialectic/
└── sess_1705847293/
    ├── session.json          # Full state (watched for changes)
    ├── context/              # Source materials
    │   ├── dalio.md
    │   └── wang.md
    ├── claims/               # Extracted claims (individual files)
    │   ├── claim_001.md
    │   └── claim_002.md
    ├── tensions/             # Identified tensions
    │   └── tension_001.md
    └── thesis/               # Synthesized documents
        └── thesis_v1.md
```

### session.json Schema

```typescript
interface Session {
  // Identity
  id: string;
  title: string;
  status: "gathering" | "shaping" | "critiquing" | "synthesized";
  created: string;
  updated: string;

  // Workflow state
  cycle: number;
  context_files: string[];

  // Accumulated content
  claims: Claim[];
  tensions: Tension[];
  thesis: Thesis | null;
  passes: Pass[];

  // Scratchpad (semantic marker accumulation)
  insights: string[];
  evidence: string[];
  risks: string[];
  counters: string[];
  patterns: string[];
  questions: string[];

  // Confidence tracking
  confidence_history: number[];
  current_confidence: number;

  // Termination state
  cycle_insights: number[];  // For diminishing returns detection
}
```

## Context Loading Strategy

### On Session Resume

When resuming via `/resume <session_id>`:

1. **Load session.json** — Full state including scratchpad
2. **Render scratchpad** — Inject as system context
3. **Load context files** — Via Claude Code's `/add` command
4. **Show suggested action** — Based on status

```typescript
async function resumeSession(sessionId: string) {
  const session = loadSession(sessionId);

  // Render accumulated context
  const scratchpad = renderScratchpad(session);

  // Claude Code will see this in its context
  return `
# Resuming: ${session.title}

${scratchpad}

**Last activity**: ${session.updated}
**Suggested next**: ${suggestNextAction(session)}
  `;
}
```

### Context Window Management

The scratchpad compresses context naturally:

| Pass | Action | Context Impact |
|------|--------|----------------|
| Expansion | Generate 2000+ words | +2000 tokens |
| Compression | Distill to markers | -1500 tokens (net +500) |
| Critique | Add counters | +800 tokens |
| Synthesis | Final output | Resets to thesis only |

Each cycle **nets ~500-1000 tokens** of persistent insights, not the full expansion output.

### When Context Gets Too Large

If session.json accumulates too much:

1. **Archive old passes** — Keep summaries, drop full content
2. **Compress markers** — Merge redundant insights
3. **Split session** — Create child session with inherited thesis

```typescript
function compactSession(session: Session): Session {
  // Keep only unique insights
  session.insights = [...new Set(session.insights)];
  session.evidence = [...new Set(session.evidence)];

  // Archive passes older than 2 cycles
  session.passes = session.passes.filter(p => {
    const passAge = session.cycle - (p.cycle || 0);
    return passAge <= 2;
  });

  return session;
}
```

## Session Resume Patterns

### Pattern 1: Direct Resume

```
/resume sess_1705847293
```

Loads full state, shows scratchpad, suggests next action.

### Pattern 2: Fork Session

```
/harness "Follow-up: What about ASML's role?"
```

If context references a previous session, creates a **child session** that inherits:
- Parent thesis as context
- Relevant claims
- Open tensions

### Pattern 3: Merge Sessions

```
/tension "Position from Session A" vs "Position from Session B"
```

Creates a new session that pulls claims from both parents.

## Plugin State vs Claude Code State

| State | Managed By | Persists |
|-------|-----------|----------|
| Conversation | Claude Code | Until closed |
| Scratchpad | Plugin (session.json) | Forever |
| Context files | Claude Code `/add` | Until closed |
| Thesis | Plugin (thesis/*.md) | Forever |

The plugin persists everything Claude Code would lose on conversation close.

## UI Integration (Tauri)

The Tauri app watches session.json:

```typescript
// Tauri backend watches for changes
watcher.on('change', (path) => {
  if (path.endsWith('session.json')) {
    const session = JSON.parse(fs.readFileSync(path));
    // Emit to frontend
    emit('session-updated', session);
  }
});
```

UI reacts to changes:
- **Claims added** → Update claim list
- **Tension created** → Show tension card
- **Status changed** → Move kanban card
- **Confidence updated** → Update progress indicator

## Auto-Loading from Kanban

When user selects a card in the UI:

```typescript
async function selectSession(sessionId: string) {
  // 1. Load session
  const session = loadSession(sessionId);

  // 2. Send resume command to Claude Code terminal
  await sendToTerminal(`/resume ${sessionId}`);

  // 3. Auto-add context files
  for (const file of session.context_files) {
    await sendToTerminal(`/add ${file}`);
  }

  // 4. Based on column, prime for next action
  if (session.status === 'gathering') {
    // Show "Run /shape when ready"
  } else if (session.status === 'shaping') {
    // Show "Run /critique when ready"
  }
}
```

When user **drags** card to next column:

```typescript
async function moveCard(sessionId: string, toColumn: Status) {
  const commands = {
    'shaping': '/shape',
    'critiquing': '/critique',
    'synthesized': '/synthesize',
  };

  const cmd = commands[toColumn];
  if (cmd) {
    await sendToTerminal(cmd);
  }
}
```

## The Full Loop

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER                                      │
│                           │                                       │
│                    Selects card in UI                             │
│                           ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                      TAURI (Rust)                                 │
│                           │                                       │
│          Load session.json → Send /resume to terminal             │
│                           ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                   EMBEDDED TERMINAL                               │
│                           │                                       │
│              Claude Code receives /resume                         │
│              Plugin loads session state                           │
│              Scratchpad rendered to context                       │
│                           ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                    CLAUDE CODE                                    │
│                           │                                       │
│              User converses, runs /shape, /critique               │
│              Plugin extracts markers → session.json               │
│                           ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                    FILE WATCHER                                   │
│                           │                                       │
│              session.json changed                                 │
│              Emit event to frontend                               │
│                           ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                    REACT UI                                       │
│                           │                                       │
│              Update kanban card (new tensions, confidence)        │
│              User sees progress without leaving terminal          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Session never lost** — File-based persistence
2. **Context efficient** — Only markers survive, not full output
3. **Resumable** — Pick up where you left off
4. **UI-synced** — Changes reflect immediately
5. **Claude Code native** — Uses existing `/add` for context loading
6. **No backend** — All state is local files
