# Dialectic

**A workbench for high-stakes thinking.**

Dialectic is a desktop application that provides a focused UI for strategic reasoning — powered by Claude Code under the hood, with a methodology codified as skills and hooks.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALECTIC DESKTOP (Tauri v2 + React 19)                        │
├─────────────────────────────────────────────────────────────────┤
│  Vista UI — landscape backgrounds, calm space                   │
│  Kanban Board — workflow visualization (Spark → Ship)           │
│  Floating Windows — session conversations with embedded terminal│
│  Snappable Rails — files, sessions, notes                       │
├─────────────────────────────────────────────────────────────────┤
│  Embedded Terminal (xterm.js + portable-pty)                    │
│  └── Claude Code (user's own installation)                      │
│      └── dialectic-plugin (skills + hooks + CLI)                │
├─────────────────────────────────────────────────────────────────┤
│  Rust Backend (68 IPC commands)                                 │
│  ├── Session — persistence, forking, conversation continuity    │
│  ├── Context — token budget, classification, compression        │
│  ├── Documents — chunking, embeddings, retrieval                │
│  ├── Obsidian — vault indexing, keyword + semantic search        │
│  ├── CDG — claim dependency graph, coherence metrics            │
│  ├── Chroma — vector DB sidecar, 6 collections, agentic memory │
│  └── Terminal — PTY management, command allowlist                │
└─────────────────────────────────────────────────────────────────┘
```

**You bring:** Claude Code (with your own API key or Max subscription)
**We provide:** The thinking methodology, the UI, the knowledge layer

## The Plugin System

Dialectic's reasoning methodology is packaged as a Claude Code plugin (v1.6.0) with three components:

### 1. Skills

**Workflow Skills** (Kanban stages):

| Skill | Purpose |
|-------|---------|
| `/spark` | Start analysis — brainstorm, gather sources, establish framing |
| `/shape` | Form positions on claims through probing questions |
| `/stress-test` | Challenge assumptions, surface contradictions |
| `/sharpen` | Crystallize thesis with confidence calibration |

**Reasoning Skills**:

| Skill | Purpose |
|-------|---------|
| `/dialectic <question>` | Multi-pass reasoning with expansion, compression, critique cycles |
| `/cancel-dialectic` | Terminate an active dialectic reasoning loop |
| `/pitfalls [check\|stases]` | Audit for cognitive biases (confirmation, narrative fallacy, etc.) |

**Context Management**:

| Skill | Purpose |
|-------|---------|
| `/brief resume <id>` | Resume session, inject context scratchpad |
| `/brief budget` | Show token budget status |
| `/brief compact` | Trigger context compression |
| `/brief vault <query>` | Search Obsidian vault |

**Utility**:

| Skill | Purpose |
|-------|---------|
| `/tui-debug` | Debug TUI rendering and terminal state |

### 2. Hooks

| Hook | Purpose |
|------|---------|
| `pre-submit` | Injects budget status at start of every turn |
| `stop` | Manages dialectic loop continuation/termination |

### 3. CLI (`dialectic-cli`)

A Rust CLI binary that skills and hooks shell out to:

```bash
# Session management
dialectic session budget <id>     # Get budget status (JSON)
dialectic session resume <id>     # Get resume context (JSON)
dialectic session list            # List all sessions

# Obsidian vault
dialectic vault search "<query>"  # Search Obsidian vault
dialectic vault note <path>       # Get note content
dialectic vault configure <path>  # Configure vault path
dialectic vault index             # Index the configured vault

# Token counting
dialectic tokens count "<text>"   # Count tokens

# Compression
dialectic compress suggest <id>   # Get compression suggestions

# Claim Dependency Graph
dialectic cdg metrics <id>        # Compute all CDG metrics
dialectic cdg strata <id>         # Compute claim strata
dialectic cdg orphans <id>        # List orphan claims
dialectic cdg diff <id>           # Compare current vs last snapshot
dialectic cdg add-edge <id> --source <s> --target <t> --type <type>
dialectic cdg resolve <id> --edge-index <n> --status <resolved|accepted>
dialectic cdg snapshot <id> --pass-id <label>
```

## Knowledge Layer

### Chroma Vector DB

Managed ChromaDB sidecar with 6 collections, graceful offline fallback to feature-hash embeddings:

| Collection | Purpose |
|------------|---------|
| `documents` | Reference document chunks |
| `obsidian` | Vault note embeddings |
| `memory_semantic` | Factual knowledge and concepts |
| `memory_procedural` | How-to and process knowledge |
| `memory_episodic` | Session events and outcomes |
| `web_sources` | JSONL-mined web references |

### Document Processing

Three handling strategies based on document size: **full** (inject verbatim), **summarized** (compress to summary), and **chunked** (split + embed). 256-dimension feature-hash embeddings with Chroma-first retrieval and local fallback.

### Obsidian Integration

Vault indexing with incremental file watching, keyword and semantic search across notes, mention resolution, and related-note discovery. 12 IPC commands.

### Agentic Memory

Three memory types — semantic (facts), procedural (processes), episodic (events) — with cross-collection search for contextual retrieval. Write, read, list, delete, and stats commands.

### JSONL Mining

Extracts web source references from Claude Code conversation logs and indexes them into the `web_sources` collection.

## Claim Dependency Graph

The CDG tracks structural relationships between claims and computes coherence metrics:

**5 edge types:** SUPPORT, REQUIRE, TENSION, DERIVE, QUALIFY — each with type weights and user-assigned confidence.

**4 strata** (computed from REQUIRE-path topology):
- **Core** — the thesis anchor (unique sink of REQUIRE paths)
- **Structural** — claims with a REQUIRE path to Core
- **Evidential** — SUPPORT edges to Structural nodes
- **Peripheral** — everything else

**Coherence metrics:** Structural Dependence Density (SDD), Orphan Ratio, Core Reachability, Tension Resolution Rate (TRR), Load-Bearing Ratio (LBR), and a weighted composite coherence score.

TENSION edges carry resolution status (Unresolved / Resolved / Accepted) with bonus multipliers that feed into the composite score.

See [`packages/desktop/COHERENCE.md`](packages/desktop/COHERENCE.md) for the formal model.

## Context Management

5-tier paper trail compression (HEAD → KEY_EVIDENCE → RECENT → HISTORICAL → ARCHIVED), 72K working token budget with auto-compression thresholds, session classification (Fit / Adjacent / NetNew / Quick) for allocation tuning.

The `pre-submit` hook injects budget status every turn. When usage crosses 70%, auto-compression kicks in; at 95%, it's mandatory.

See [`docs/CONTEXT-MANAGEMENT.md`](docs/CONTEXT-MANAGEMENT.md) for the full tier diagram and budget threshold table.

## Multi-Pass Reasoning

The `/dialectic` skill implements iterative reasoning through expansion, compression, and critique cycles:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  EXPANSION  │────▶│ COMPRESSION │────▶│   CRITIQUE  │
│  (diverge)  │     │  (converge) │     │  (decide)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────┐
                    ▼                          ▼      ▼
              [CONTINUE]                 [CONCLUDE] [PIVOT]
              loop back                  synthesis  reframe
```

Critique techniques include inversion, second-order effects, falsification, base rates, incentive audit, and adversary simulation.

See [`docs/DIALECTIC.md`](docs/DIALECTIC.md) for the full methodology.

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/claude-code) installed
- Node.js 20+ and Rust (for development)
- ChromaDB (optional — app works offline with feature-hash fallback)

### Install

```bash
# Clone
git clone https://github.com/AustinSalter/dialectic.git
cd dialectic

# Install dependencies
npm install

# Build the CLI
cd packages/desktop/src-tauri
cargo build --release --bin dialectic-cli

# Add CLI to path (or copy to /usr/local/bin)
export PATH="$PATH:$(pwd)/target/release"
```

### Run

```bash
# Development mode (from packages/desktop/)
npm run tauri:dev

# Or build for release
npm run tauri:build
```

### Install the Plugin

The dialectic-plugin provides skills and hooks for Claude Code:

```bash
# Option 1: Symlink to Claude Code plugins directory
ln -s $(pwd)/.claude-plugin ~/.claude/plugins/dialectic

# Option 2: Copy to plugins directory
cp -r .claude-plugin ~/.claude/plugins/dialectic
```

See the [dialectic-plugin repository](https://github.com/AustinSalter/dialectic-plugin) for standalone installation.

## Project Structure

```
dialectic/
├── packages/
│   ├── desktop/                   # Main Tauri application
│   │   ├── src/                   # React frontend
│   │   │   ├── components/
│   │   │   │   ├── Board/         # Kanban board
│   │   │   │   ├── Conversation/  # Session conversation view
│   │   │   │   ├── DocumentViewer/# Document rendering
│   │   │   │   ├── Kanban/        # Kanban internals
│   │   │   │   ├── KeyboardHints/ # Shortcut overlay
│   │   │   │   ├── Layout/        # App layout shell
│   │   │   │   ├── Notes/         # Note editor
│   │   │   │   ├── Rails/         # Snappable side panels
│   │   │   │   ├── Terminal/      # xterm.js integration
│   │   │   │   ├── Vista/         # Landscape backgrounds
│   │   │   │   └── Window/        # Floating windows
│   │   │   └── hooks/
│   │   │       ├── useBudgetMonitor.ts
│   │   │       ├── useDraggable.ts
│   │   │       ├── useSessionWatcher.ts
│   │   │       └── useTerminal.ts
│   │   │
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── main.rs         # Tauri entry, 68 IPC commands
│   │           ├── lib.rs          # Shared library for CLI
│   │           ├── session.rs      # Session CRUD, forking, prepare_launch
│   │           ├── terminal.rs     # PTY management, command allowlist
│   │           ├── watcher.rs      # File watching + session events
│   │           ├── cdg.rs          # Claim Dependency Graph
│   │           ├── context/
│   │           │   ├── budget.rs
│   │           │   ├── classification.rs
│   │           │   ├── compression.rs
│   │           │   └── tokens.rs
│   │           ├── documents/
│   │           │   ├── chunker.rs
│   │           │   ├── embeddings.rs
│   │           │   └── retriever.rs
│   │           ├── obsidian/
│   │           │   ├── indexer.rs
│   │           │   ├── query.rs
│   │           │   └── watcher.rs
│   │           ├── chroma/
│   │           │   ├── sidecar.rs
│   │           │   ├── client.rs
│   │           │   ├── collections.rs
│   │           │   ├── search.rs
│   │           │   ├── memory.rs
│   │           │   └── jsonl_miner.rs
│   │           └── bin/
│   │               └── dialectic.rs  # CLI binary
│   │
│   ├── shared/                    # Shared utilities
│   └── web/                       # Web interface
│
├── .claude-plugin/                # Claude Code plugin
│   ├── plugin.json                # Plugin manifest (v1.6.0)
│   ├── skills/
│   │   ├── dialectic/             # Multi-pass reasoning
│   │   ├── cancel-dialectic/      # Loop cancellation
│   │   ├── spark/                 # Workflow: ideation
│   │   ├── shape/                 # Workflow: position-forming
│   │   ├── stress-test/           # Workflow: adversarial critique
│   │   ├── sharpen/               # Workflow: thesis crystallization
│   │   ├── pitfalls/              # Cognitive bias detection
│   │   ├── brief/                 # Context management
│   │   └── tui-debug/             # TUI debugging
│   └── hooks/
│       ├── pre-submit-hook.sh     # Budget injection
│       └── stop-hook.sh           # Loop management
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DIALECTIC.md
    ├── EXPERIMENTS.md
    └── CONTEXT-MANAGEMENT.md
```

## Security

CSP enabled, session ID validation (rejects path traversal), path containment with canonicalization, terminal command allowlist (shells + claude only), rehype-sanitize on all rendered markdown, API keys in sessionStorage only.

See [`packages/desktop/security-review.md`](packages/desktop/security-review.md) for the full findings and remaining TODOs.

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture and design decisions |
| [`docs/DIALECTIC.md`](docs/DIALECTIC.md) | Full dialectic reasoning methodology |
| [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md) | Experiment log and results |
| [`docs/CONTEXT-MANAGEMENT.md`](docs/CONTEXT-MANAGEMENT.md) | Paper trail tiers, budget thresholds, session classification |
| [`packages/desktop/COHERENCE.md`](packages/desktop/COHERENCE.md) | CDG formal model and coherence metrics |

## Philosophy

**Copilot, not Agent.** Dialectic augments your judgment. It surfaces what you might miss, challenges what you assume, structures what you conclude. It does not decide for you.

**Tension is Signal.** Unresolved contradictions aren't failures. They're the interesting parts. The system preserves them rather than papering over them.

**The Obvious Decisions Don't Need This.** Use Dialectic for decisions where the frame itself might be wrong — where you need to be argued with, not agreed with.

## Related Repositories

- [dialectic-plugin](https://github.com/AustinSalter/dialectic-plugin) — Standalone Claude Code plugin (skills + hooks)

## License

MIT
