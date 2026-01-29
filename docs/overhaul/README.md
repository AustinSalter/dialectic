# Dialectic

**A workbench for high-stakes thinking.**

Dialectic is a desktop application that provides a beautiful, focused UI for strategic reasoning — powered by Claude Code under the hood.

## The Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALECTIC DESKTOP (Tauri + React)                              │
├─────────────────────────────────────────────────────────────────┤
│  Vista UI — landscape background, calm space                    │
│  Floating Windows — session conversations                       │
│  Snappable Rails — files, sessions                              │
│  Kanban Board — workflow visualization                          │
├─────────────────────────────────────────────────────────────────┤
│  Skills + Hooks Layer — the methodology                         │
│  ├── /dialectic — Multi-pass reasoning                          │
│  ├── /brief — Context management                                │
│  ├── pre-submit hook — Budget injection                         │
│  └── stop hook — Loop management                                │
├─────────────────────────────────────────────────────────────────┤
│  dialectic CLI — JSON backend for skills                        │
│  └── session | vault | tokens | compress commands               │
├─────────────────────────────────────────────────────────────────┤
│  Embedded Terminal (xterm.js)                                   │
│  └── Claude Code (user's own installation)                      │
└─────────────────────────────────────────────────────────────────┘
```

**You bring:** Claude Code (with your own API key or Max subscription)
**We provide:** The thinking methodology, the UI, the workflow

## Plugin System

The dialectic-plugin provides skills and hooks for Claude Code:

### Skills

| Skill | Purpose |
|-------|---------|
| `/dialectic <question>` | Multi-pass reasoning with expansion, compression, critique |
| `/brief resume <id>` | Resume session, inject context scratchpad |
| `/brief budget` | Show token budget status |
| `/brief compact` | Trigger context compression |
| `/brief vault <query>` | Search Obsidian vault |

### Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `pre-submit` | Every turn | Inject budget status line |
| `stop` | Response complete | Manage dialectic loop continuation |

### CLI

The `dialectic` CLI binary provides JSON output for skills and hooks:

```bash
dialectic session budget <id>     # Budget status
dialectic session resume <id>     # Resume context
dialectic session list            # List sessions
dialectic vault search "<query>"  # Search Obsidian
dialectic vault note "<path>"     # Get note content
dialectic tokens count "<text>"   # Count tokens
dialectic compress suggest <id>   # Compression suggestions
```

## Why This Architecture?

### No Pricing Problem
Users already pay for Claude Code. Dialectic is a client, not a service. No API keys to manage, no usage to subsidize, no billing to implement.

### Skills = Product
The value is in the *methodology* — the multi-pass harness, the critique techniques, the tension surfacing, the synthesis patterns. These are codified as Claude Code skills that guide the reasoning.

### Power When You Need It
The embedded terminal means power users can always drop to raw Claude Code. Run any command, explore freely, then come back to the guided workflow.

### Ships Faster
No Python backend. No WebSocket infrastructure. No database. Just Tauri + React + terminal embedding + file watching.

## Installation

1. Install [Claude Code](https://docs.anthropic.com/claude-code)
2. Download Dialectic
3. Install the plugin (symlink or copy `.claude-plugin/` to `~/.claude/plugins/dialectic`)
4. Open Dialectic — it spawns Claude Code sessions automatically

Or install the plugin standalone from [dialectic-plugin](https://github.com/AustinSalter/dialectic-plugin).

## Usage

### Start a Session
Click `+` or `⌥⌘N`. Select a folder for the session working directory.

### The Workflow

| Column | Phase | Command | What Happens |
|--------|-------|---------|--------------|
| **Spark** | New | — | Empty session, ready for input |
| **Shape** | Exploring | `/dialectic` | Multi-pass expansion and compression |
| **Stress-Test** | Tensions | `/dialectic` with critique | Structured questioning |
| **Sharpen** | Synthesizing | `/dialectic` conclude | Form thesis |
| **Ship** | Formed | — | Final thesis with confidence |

### Context Commands

| Command | Purpose |
|---------|---------|
| `/brief resume <id>` | Resume session with scratchpad |
| `/brief budget` | Check token budget status |
| `/brief compact` | Trigger compression |
| `/brief vault "<query>"` | Search Obsidian vault |

### Budget Status

The pre-submit hook shows budget at the start of every turn:

```
✓ BUDGET: 62% (44,640/72,000 tokens) [normal]
🔶 BUDGET: 73% (52,560/72,000 tokens) [auto_compress]
⚠️ BUDGET: 87% (62,640/72,000 tokens) [warn_user]
⛔ BUDGET: 96% (69,120/72,000 tokens) [force_compress]
```

### Direct Terminal Access
Click into any session window to access the terminal directly. All Claude Code commands work. The harness commands are implemented as skills that Claude Code loads automatically.

## File Structure

Each session lives in its own directory:

```
~/.config/dialectic/sessions/
└── sess_01HXK4N.../
    ├── session.json      # State (watched by UI)
    ├── context/          # Source materials
    ├── claims/           # Extracted claims
    ├── tensions/         # Identified tensions
    └── thesis/           # Synthesized documents
```

The UI watches `session.json` for changes. When Claude Code writes to it (via the skill), the UI updates automatically.

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Desktop app architecture |
| [design-doc-backend-context.md](./design-doc-backend-context.md) | Rust backend, token budgets, CLI interface |
| [CONTEXT_MANAGEMENT.md](./CONTEXT_MANAGEMENT.md) | Session resume, scratchpad format |
| [SKILL.md](./SKILL.md) | Multi-pass reasoning skill |

## Philosophy

**Copilot, not Agent.** Dialectic augments your judgment. It surfaces what you might miss, challenges what you assume, structures what you conclude. It does not decide for you.

**Tension is Signal.** Unresolved contradictions aren't failures. They're the interesting parts. The system preserves them rather than papering over them.

**The Obvious Decisions Don't Need This.** Use Dialectic for decisions where the frame itself might be wrong — where you need to be argued with, not agreed with.

---

## Development

```bash
# Install dependencies
npm install

# Build CLI
cd packages/desktop/src-tauri
cargo build --release --bin dialectic

# Run in development
npm run tauri dev

# Build for release
npm run tauri build
```

### Tech Stack

- **Tauri** — Rust backend, system integration
- **React + TypeScript** — Frontend UI
- **xterm.js** — Terminal emulation
- **portable-pty** — PTY management (Rust)
- **clap** — CLI argument parsing
- **tiktoken-rs** — Token counting
- **Claude Code** — The reasoning engine (user-provided)

---

Built for people who think for a living.
