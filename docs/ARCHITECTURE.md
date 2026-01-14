# Architecture

## Dialetic: A Workbench for High-Stakes Thinking

This document describes the dual-workflow architecture for shaping ideas and making decisions.

---

## Two Workflows, One Harness

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DIALECTIC                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   IDEA WORKFLOW                         DECISION WORKFLOW                   │
│   (Thesis Formation)                    (Strategy Resolution)               │
│   ──────────────────                    ─────────────────────               │
│                                                                             │
│   Source Material                       Question + Context                  │
│        ↓                                        ↓                           │
│   ┌─────────┐                           ┌──────────────────┐                │
│   │ GATHER  │ ← Claim extraction        │  ROUTE (Pass 0)  │                │
│   └────┬────┘                           │  Thesis Router   │                │
│        ↓                                └────────┬─────────┘                │
│   ┌─────────┐                                    ↓                          │
│   │  SHAPE  │ ← Interview (positions)   ┌──────────────────┐                │
│   └────┬────┘                           │ FIT │ ADJ │ NEW  │                │
│        ↓                                │     Context       │                │
│   ┌─────────┐                           │     Budgets       │                │
│   │CRITIQUE │ ← Tension Resolution      └────────┬─────────┘                │
│   └────┬────┘                                    ↓                          │
│        ↓                                ┌──────────────────┐                │
│   ┌──────────┐                          │ REASON (Pass 1-N)│                │
│   │SYNTHESIZE│                          └────────┬─────────┘                │
│   └────┬─────┘                                   ↓                          │
│        ↓                                ┌──────────────────┐                │
│   ThesisDocument                        │ RESOLVE (Synth)  │                │
│   • confidence                          └────────┬─────────┘                │
│   • triggers                                     ↓                          │
│        ↓                                Answer + Evidence Trail             │
│        └──────────→ THESIS LIBRARY ←─────────────┘                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          SHARED: N-PASS HARNESS                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  Expansion → Compression → Critique → Synthesis                       │ │
│   │                                                                       │ │
│   │  Markers: [INSIGHT] [EVIDENCE] [RISK] [COUNTER] [PATTERN] [DECISION]  │ │
│   │  Priming Zone: 400-600 words optimal                                  │ │
│   │  Termination: saturation | confidence ≥ 0.75 | max-cycles             │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Shared Harness

Both workflows run on the same multi-pass reasoning engine.

### Multi-Pass Reasoning

Single-pass AI is structurally equivalent to written text—query in, output out, done. It cannot step back and ask whether it answered the right question. Multi-pass creates space for *aporia*—the productive confusion where reframing happens.

**Two-pass achieved 83% insight coverage at 300 tokens** (6x more efficient than verbose single-pass):
- **Pass 1 (Expansion)**: Divergent exploration with semantic markers
- **Pass 2+ (Compression)**: Convergent synthesis preserving decision-relevant content

### Semantic Markers

The harness uses semantic markers to identify and preserve decision-relevant content:

| Marker | Purpose | Extraction Priority |
|--------|---------|---------------------|
| `[INSIGHT]` | Non-obvious conclusions | High |
| `[EVIDENCE]` | Supporting data points | High |
| `[RISK]` | Potential failure modes | High |
| `[COUNTER]` | Arguments against | Critical |
| `[PATTERN]` | Recurring structures | Medium |
| `[DECISION]` | Action recommendations | High |

### Structured Critique

The critique pass uses six questioning techniques (validated to find 9x more flaws than naive "now critique this"):

1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are the downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack this?

### Termination Criteria

| Strategy | Condition | Rationale |
|----------|-----------|-----------|
| Saturation | Δconfidence < 0.05 for 2 cycles | No new signal |
| Threshold | confidence ≥ 0.75 + tensions resolved | Good enough |
| Max cycles | Hard limit (default: 5) | Cost control |

---

## Backend Architecture

### Harness Implementations

Two implementations are provided:

| File | Dependency | Use Case |
|------|------------|----------|
| `harness_lite.py` | Direct Anthropic API | Portable, no SDK needed |
| `harness.py` | Claude Agent SDK | Full subagent orchestration |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/ingest` | POST | Extract claims from URL/text |
| `/harness/run` | POST | Run multi-pass analysis (REST) |
| `/ws/harness` | WebSocket | Real-time streaming progress |

### Data Flow

```
Frontend                    Backend
   │                           │
   ├── POST /ingest ──────────→│ Extract claims
   │←── claims[] ──────────────│
   │                           │
   ├── WS /ws/harness ────────→│ Connect
   │←── event: started ────────│
   │←── event: pass_started ───│ For each pass:
   │←── event: pass_progress ──│   - Expansion
   │←── event: pass_completed ─│   - Compression
   │←── event: completed ──────│   - Critique
   │                           │   - Synthesis
   │                           │
   └── thesis_document ────────│
```

---

## Frontend Architecture

### Package Structure

```
packages/
├── shared/          # @dialectic/shared - Types & API client
├── web/             # @dialectic/web - React UI
└── desktop/         # @dialectic/desktop - Tauri wrapper
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `ChatThread` | Interview-style claim exploration |
| `KanbanBoard` | Session management |
| `HarnessProgress` | Real-time multi-pass visualization |
| `ThesisCard` | Synthesized thesis display |
| `ThesisViewer` | Full thesis document with triggers |
| `TensionCard` | Unresolved contradiction display |

---

## Philosophy

**Copilot, not Agent.** The system augments human judgment rather than replacing it.

**Prioritize over Predict.** The right question isn't "what will happen?" but "what should we do first given constraints?"

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
