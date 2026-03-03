# Context Management

Dialectic manages context across sessions with a tiered paper trail system and token budget enforcement.

## Paper Trail Tiers

```
PAPER TRAIL TIERS
────────────────────────────────────────────────────────────────

  TIER 1: HEAD                          ~500 tokens
  Core thesis, confidence, triggers.    Always loaded.

  TIER 2: KEY_EVIDENCE                  ~1,500 tokens
  Verbatim claims marked [KEY].         Always loaded.

  TIER 3: RECENT                        ~3,000 tokens
  Last 2-3 session traces.              Compress after 7 days.

  TIER 4: HISTORICAL                    ~1,000 tokens
  Older compressed summaries.           Compress after 30 days.

  TIER 5: ARCHIVED                      0 tokens
  Full logs on disk.                    Searchable only.
```

## Budget Thresholds

Working budget: 72,000 tokens.

| Usage | Status | Action |
|-------|--------|--------|
| < 70% | Normal | Continue normally |
| 70-84% | Auto Compress | Tier 4 auto-compressed |
| 85-94% | Warn User | Alert shown in pre-submit hook |
| 95%+ | Force Compress | Mandatory compression triggered |

The `pre-submit` hook injects budget status at the start of every turn:

```
✓ BUDGET: 62% (44,640/72,000 tokens) [normal]
⚠️ BUDGET: 87% (62,640/72,000 tokens) [warn_user]
```

## Session Classification

Sessions are classified to determine context allocation:

| Category | Description | Allocation |
|----------|-------------|------------|
| Fit | Directly within existing thesis scope | Full context |
| Adjacent | Related but extends current scope | Moderate context |
| NetNew | Entirely new topic | Minimal prior context |
| Quick | Short-lived, single-turn sessions | Minimal allocation |

## Budget Composition

The 72K working budget is divided across:

- **Paper trail** — tiered compressed session history
- **Obsidian** — vault search results injected via `/brief vault`
- **Reference docs** — attached documents and their chunks

Each allocation is tracked independently and reported in the budget status.

## CLI Commands

```bash
dialectic session budget <id>     # Get budget status (JSON)
dialectic session resume <id>     # Get resume context (JSON)
dialectic compress suggest <id>   # Get compression suggestions
dialectic tokens count "<text>"   # Count tokens
```

## IPC Commands

The context subsystem exposes 8 Tauri commands:

- `context_count_tokens` / `context_count_tokens_batch` / `context_estimate_tokens`
- `context_get_allocation` / `context_classify_session`
- `context_get_budget_constants`
- `context_check_compression_triggers` / `context_create_compression_request`

## Source Files

```
packages/desktop/src-tauri/src/context/
├── budget.rs          # Budget constants, BudgetStatus, threshold logic
├── classification.rs  # Session category (Fit/Adjacent/NetNew/Quick), allocation
├── compression.rs     # Compression triggers, tier transitions
├── tokens.rs          # tiktoken-rs token counting
└── mod.rs
```
