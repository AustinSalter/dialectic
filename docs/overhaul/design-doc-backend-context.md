# Dialectic: Rust Backend & Context Management

Design document for whitepaper sections on the Rust backend (file indexing, Obsidian integration) and Context Management architecture.

---

## V. The Rust Backend

The desktop app needed infrastructure that Claude Code couldn't provide: persistent file indexing, real-time vault synchronization, and context budget enforcement. A Tauri/Rust backend handles these concerns, leaving the reasoning loop to the LLM.

### File Indexing & Session Persistence

Each session lives in a self-contained directory:

```
~/.config/dialectic/sessions/sess_01HXK4N.../
├── session.json          # Full state (claims, tensions, thesis)
├── context/              # Source materials
├── claims/               # Extracted positions
├── tensions/             # Contradictions
└── thesis/               # Synthesized docs + triggers
```

The backend watches `session.json` for changes. A 2-second debounce prevents event floods when the reasoning loop writes multiple updates in quick succession. Close the app, reopen next week—state resumes from disk.

Session IDs use ULIDs (Universally Unique Lexicographically Sortable Identifiers). They're URL-safe, collision-resistant, and sort chronologically—useful when you have fifty half-formed strategic threads.

### Obsidian Integration

Strategic reasoning doesn't happen in a vacuum. Most users have years of notes, reading summaries, and prior thinking in tools like Obsidian. The backend indexes these vaults without modifying them—read-only by design.

```
OBSIDIAN INDEXING (TWO-PASS)
────────────────────────────────────────────────────────────────

  PASS 1: FORWARD SCAN
  ─────────────────────
  Walk vault → Parse each .md:
  ├── Extract title, tags, summary
  ├── Extract [[wiki-links]]
  └── Build title→path + tag→paths maps

  PASS 2: BACKLINK RESOLUTION
  ──────────────────────────
  For each forward link:
  ├── Resolve target (exact → fuzzy)
  └── Add reverse reference

  Result: Bidirectional link graph.
  "What references this note?" is O(1).
```

The two-pass approach enables bidirectional link resolution. When you ask "what else have I written about this topic?", the answer is instant—backlinks are precomputed, not searched.

**Query syntax** is minimal:

```
@notes/path/to/note    → Direct path lookup
@note-title            → Title search (exact, then partial)
@#tag                  → Tag-based search (returns multiple)
```

A vault watcher triggers re-indexing when files change. Same debounce pattern—you edit a note in Obsidian, the index updates within seconds.

### Reference Document Handling

External documents (PDFs, reports, transcripts) need different treatment than personal notes. The backend applies a three-tier strategy based on size:

```
DOCUMENT HANDLING HEURISTICS
────────────────────────────────────────────────────────────────

  SIZE           HANDLING         RATIONALE
  ────────────   ──────────────   ─────────────────────────────
  < 4K tokens    FULL             Load entirely. No loss.
  4K - 20K       SUMMARIZED       Summary + section index.
                                  On-demand retrieval.
  > 20K          CHUNKED          Chunk, embed, semantic search.
                                  Load only relevant sections.
```

**Chunking** respects document structure. Markdown splits at headers. Code splits at function boundaries. Plain text splits at paragraph breaks. Each chunk carries metadata: section heading, position, token count.

**Embeddings** enable semantic search within large documents. The current implementation uses TF-IDF (no ML dependencies)—production will upgrade to `fastembed`. Chunks are ranked by cosine similarity; only the most relevant sections consume context budget.

---

## VI. Context Management

LLMs have finite context windows. Strategic reasoning generates unbounded artifacts—claims, critiques, synthesis attempts, prior session history. Without active management, context fills, reasoning degrades, and the user either starts over or loses continuity.

The context management system treats tokens as a scarce resource. It allocates budgets, tracks consumption, and triggers compression before the window overflows.

### The Token Budget Model

```
CONTEXT WINDOW ALLOCATION
────────────────────────────────────────────────────────────────

  TOTAL CONTEXT WINDOW              100,000 tokens
  ─────────────────────────────────────────────────
  Reserved for output                28,000 tokens
  ─────────────────────────────────────────────────
  WORKING BUDGET                     72,000 tokens

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │   Paper Trail    Reference    Obsidian   ───────┼─── Reasoning
  │   (history)      (docs)       (notes)           │    (scratch)
  │                                                 │
  └─────────────────────────────────────────────────┘
```

The 72,000-token working budget divides across four pools:

- **Paper Trail**: Prior session history, locked claims, thesis snapshots
- **Reference Docs**: External documents relevant to this analysis
- **Obsidian**: Notes pulled from the user's vault
- **Reasoning**: Space for expansion/compression/critique passes

The allocation isn't fixed—it adapts to session type.

### Session Classification

Not all strategic questions need the same context mix. A quick factual lookup shouldn't load years of thesis history. A continuation of prior analysis shouldn't waste budget on exploration space.

```
SESSION CLASSIFICATION
────────────────────────────────────────────────────────────────

  CLASSIFICATION   SIGNAL                    BUDGET SHAPE
  ─────────────    ─────────────────────     ────────────────────
  FIT              Similarity ≥ 0.8 to       Paper Trail: 40%
                   existing thesis           Obsidian: 20%
                                             Reference: 10%
                                             Reasoning: 30%

  ADJACENT         Similarity 0.4-0.8 OR     Paper Trail: 20%
                   has paper trail           Obsidian: 30%
                                             Reference: 20%
                                             Reasoning: 30%

  NET_NEW          Low similarity, no        Paper Trail: 5%
                   prior work                Obsidian: 15%
                                             Reference: 20%
                                             Reasoning: 60%

  QUICK            User-marked OR no         Paper Trail: 0%
                   keywords/thesis match     Obsidian: 5%
                                             Reference: 35%
                                             Reasoning: 60%
```

A `FIT` session—continuing prior analysis—gets 40% of budget for paper trail. A `NET_NEW` session—fresh exploration—gets 60% for reasoning. The classification triggers automatically based on semantic similarity to existing theses.

### Compression Triggers

Even with smart allocation, budgets fill. The system uses progressive pressure—automatic intervention at 70%, warnings at 85%, forced compression at 95%:

```
COMPRESSION THRESHOLDS
────────────────────────────────────────────────────────────────

  USAGE     THRESHOLD           ACTION
  ───────   ─────────────────   ────────────────────────────────
  < 70%     NOMINAL             Continue normally.

  70-85%    AUTO_COMPRESS       Compress Tier 4 (historical).
                                User doesn't see this.

  85-95%    WARN_USER           "Budget at 87%. Recommend
                                archiving older sessions."

  > 95%     FORCE_COMPRESS      Mandatory compression.
                                "Archiving sessions X, Y, Z
                                to continue."
```

### Paper Trail Tiers

Paper trail—the accumulated history of prior reasoning—compresses in tiers. The core thesis never compresses. Evidence that informed it rarely compresses. Older session logs compress aggressively.

```
PAPER TRAIL TIER SYSTEM
────────────────────────────────────────────────────────────────

  TIER 1: HEAD                          ~500 tokens
  ──────────────                        ──────────────
  Core thesis, confidence, triggers.    Always loaded.
  Locked intent. Never compressed.      Immutable.

  TIER 2: KEY_EVIDENCE                  ~1,500 tokens
  ────────────────────                  ──────────────
  Verbatim claims marked [KEY].         Always loaded.
  Evidence the thesis depends on.       Rarely compressed.

  TIER 3: RECENT                        ~3,000 tokens
  ──────────────                        ──────────────
  Last 2-3 session reasoning traces.    Compress after
  Active working memory.                7 days if older.

  TIER 4: HISTORICAL                    ~1,000 tokens
  ────────────────────                  ──────────────
  Older compressed sessions.            Compress after
  One-paragraph summaries.              30 days.

  TIER 5: ARCHIVED                      0 tokens
  ────────────────                      ──────────────
  Full logs on disk.                    Never loaded.
  Searchable if needed.                 Reference only.
```

The insight: **immutable core, compressible periphery**. Tier 1-2 are decision anchors—the thesis and its foundations. Tier 3-5 provide pressure relief. You can always search archives, but they don't consume reasoning budget.

```
COMPRESSION FLOW
────────────────────────────────────────────────────────────────

  Day 0                           Day 30
  ─────                           ──────

  ┌─────────┐                     ┌─────────┐
  │ SESSION │                     │  HEAD   │ ← Thesis preserved
  │  FULL   │                     └────┬────┘
  │ 4,000   │                          │
  │ tokens  │      ───────►       ┌────┴────┐
  └─────────┘      compress       │SUMMARY  │ ← Key claims kept
                                  │  200    │
                                  │ tokens  │
                                  └────┬────┘
                                       │
                                  ┌────┴────┐
                                  │ARCHIVED │ ← Full log on disk
                                  │ 0 tokens│   (searchable)
                                  └─────────┘

  The system ages gracefully. Old reasoning doesn't
  crowd out current thinking.
```

### Compression Triggers as Data

Compression isn't just a background process—it surfaces actionable information:

```rust
CompressionTrigger::SessionToSummary {
    session_id: "sess_01HXK...",
    age_days: 14
}

CompressionTrigger::SummaryToArchive {
    session_ids: vec!["sess_01HW...", "sess_01HX..."],
    reason: ArchiveReason::ConfidenceAdvance  // Thesis confidence jumped
}

CompressionTrigger::ForceCompress {
    tier: 4,
    tokens_to_free: 2000
}
```

When a thesis's confidence advances significantly, older exploratory sessions become less relevant—archive reason becomes a signal, not just a policy.

---

## VII. Architecture Patterns

### Global State via RwLock

The backend manages several long-lived resources: file watchers, vault indexes, document stores, embedding caches. Each uses the same pattern:

```rust
static VAULT_INDEX: RwLock<Option<VaultIndex>> = RwLock::new(None);

fn ensure_indexed(vault_path: &Path) -> Result<()> {
    let mut guard = VAULT_INDEX.write();
    if guard.is_none() {
        *guard = Some(build_index(vault_path)?);
    }
    Ok(())
}
```

Read locks (concurrent) for queries. Write locks (exclusive) for updates. Lazy initialization avoids startup overhead.

### Dual Interface Pattern

Every module exposes two interfaces:

```rust
// Rust function — testable, composable
pub fn search_vault(query: &str, budget: u32) -> Result<Vec<Note>, VaultError>

// Tauri command — callable from frontend
#[tauri::command]
pub fn vault_search(query: String, budget: u32) -> Result<Vec<Note>, VaultError>
```

Slight duplication, but enables testing without the Tauri runtime.

### Token Counting with Cache

Token counts are expensive (tiktoken isn't free) and frequently repeated. A hash-based cache with LRU eviction handles this:

```
TOKEN_CACHE
────────────────────────────────────────────────────────────────

  "quarterly results exceeded..."  →  hash: 0x7A3F...  →  127 tokens
                                         ↓
                              ┌──────────────────┐
                              │  HashMap<u64,u32>│
                              │  max: 10,000     │
                              │  evict: 50% LRU  │
                              └──────────────────┘
```

A quick heuristic (4 chars ≈ 1 token) provides early-out for "definitely exceeds budget" checks.

---

---

## VIII. CLI Interface

The backend exposes functionality through a `dialectic` CLI binary, enabling integration with Claude Code skills and hooks without requiring MCP servers.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│                                                                 │
│  ┌────────────────┐   ┌──────────────────┐   ┌───────────────┐ │
│  │  /brief Skill  │   │  pre-submit hook │   │  /dialectic   │ │
│  │  (session mgmt)│   │  (budget inject) │   │  (reasoning)  │ │
│  └───────┬────────┘   └────────┬─────────┘   └───────────────┘ │
│          │ shells out          │ shells out                    │
│          ▼                     ▼                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              dialectic CLI (JSON output)                │   │
│  │  dialectic session budget | vault search | tokens count │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼ reads session files / calls lib
┌──────────────────────────────────────────────────────────────────┐
│  RUST BACKEND (Tauri) - existing modules                        │
│  context/budget.rs | context/tokens.rs | obsidian/query.rs      │
└──────────────────────────────────────────────────────────────────┘
```

### CLI Commands

```
DIALECTIC CLI COMMANDS
────────────────────────────────────────────────────────────────

  SESSION MANAGEMENT
  ─────────────────────

  dialectic session budget <session_id>
  → {"used": 45000, "total": 72000, "pct": 62, "status": "normal"}

  dialectic session list
  → [{"id": "sess_xxx", "title": "...", "status": "exploring"}]

  dialectic session resume <session_id>
  → {"thesis": "...", "scratchpad": {...}, "suggested_action": "..."}

  VAULT SEARCH
  ─────────────

  dialectic vault search "<query>" [--budget N]
  → [{"path": "...", "title": "...", "relevance": 0.8}]

  dialectic vault note "<path>" [--max-tokens N]
  → {"content": "...", "tokens": 500, "truncated": false}

  dialectic vault configure "<path>"
  → {"status": "configured"}

  dialectic vault index
  → {"notes_indexed": 150, "errors": [], "last_indexed": "..."}

  TOKEN COUNTING
  ──────────────

  dialectic tokens count "<text>"
  → {"tokens": 127}

  COMPRESSION
  ───────────

  dialectic compress suggest <session_id>
  → {"triggers": [...], "tokens_freeable": 2000, "budget_status": "warn_user"}
```

All commands output JSON for easy parsing by skills and hooks.

### Skills Integration

The `/brief` skill wraps CLI commands with human-friendly formatting:

```
/brief COMMANDS
────────────────────────────────────────────────────────────────

  /brief resume <id>    Resume session, inject scratchpad
  /brief budget         Show current budget status
  /brief compact        Trigger compression analysis
  /brief vault <query>  Search Obsidian vault
```

Example: `/brief budget` shells out to `dialectic session budget <id>`, then formats the JSON response:

```
## Budget Status

✓ **62%** (44,640 / 72,000 tokens) [normal]

### Breakdown by Source

| Source | Used | Budget | % |
|--------|------|--------|---|
| Paper Trail | 12,000 | 28,800 | 42% |
| Obsidian | 8,640 | 14,400 | 60% |
| Reference | 24,000 | 28,800 | 83% |
```

### Pre-Submit Hook

The `pre-submit-hook.sh` injects budget status at the start of every Claude Code turn:

```bash
#!/bin/bash
# Read session_id from .claude/dialectic/state.json
# Call: dialectic session budget <id>
# Output one line:

✓ BUDGET: 62% (44,640/72,000 tokens) [normal]
🔶 BUDGET: 73% (52,560/72,000 tokens) [auto_compress]
⚠️ BUDGET: 87% (62,640/72,000 tokens) [warn_user]
⛔ BUDGET: 96% (69,120/72,000 tokens) [force_compress]
```

Claude sees budget status at the start of every response, enabling proactive compression.

### UI Wiring

The Tauri app injects CLI commands directly into the terminal:

```typescript
// Kanban card click → inject /brief resume
onClick={(sessionId) => {
  invoke('write_to_terminal', {
    sessionId: terminalSession,
    data: `/brief resume ${sessionId}\n`
  })
}}

// Budget alert → auto-inject compact
listen(`budget-alert-${sessionId}`, (event) => {
  if (event.payload.status === 'force_compress') {
    invoke('write_to_terminal', {
      sessionId,
      data: '/brief compact --tier 4\n'
    })
  }
})
```

The watcher emits budget alerts when thresholds are crossed:

```rust
// watcher.rs: Emit budget alert on session update
if pct >= THRESHOLD_WARN_USER {
    app.emit(&format!("budget-alert-{}", session_id), BudgetAlertEvent {
        session_id,
        status: "warn_user",
        percentage: pct,
        used: budget.total_used(),
        total: WORKING_BUDGET,
    });
}
```

### Build Configuration

The CLI binary shares code with the Tauri app via a library crate:

```toml
# Cargo.toml
[lib]
name = "dialectic_lib"
path = "src/lib.rs"

[[bin]]
name = "dialectic"
path = "src/bin/dialectic.rs"

[[bin]]
name = "dialectic-tauri"
path = "src/main.rs"
```

This enables testing context management logic without the Tauri runtime.

---

## Summary

The Rust backend handles infrastructure the reasoning loop can't: file watching, vault indexing, document chunking, and context budget enforcement. The context management system treats tokens as scarce, classifies sessions by their relationship to prior work, allocates budgets adaptively, and compresses proactively.

The CLI interface bridges the gap between Claude Code and the backend, enabling skills and hooks to access context management without MCP complexity.

The result: strategic reasoning that accumulates across sessions without drowning in its own history.
