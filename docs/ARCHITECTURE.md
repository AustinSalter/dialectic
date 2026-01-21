# Architecture

## Dialectic: A Workbench for High-Stakes Thinking

This document describes the dual-workflow architecture for shaping ideas and making decisions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DIALECTIC                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   IDEAS MODE                              DECISION MODE                          │
│   (Extended Research)                     (Bounded Analysis)                     │
│   ─────────────────                       ──────────────────                     │
│                                                                                  │
│   Source Material                         Question + Context                     │
│        ↓                                         ↓                               │
│   ┌─────────┐                            ┌──────────────────┐                    │
│   │ GATHER  │ ← Claim extraction         │   THESIS ROUTER  │ ← Pass 0          │
│   └────┬────┘                            │   (memory.py)    │                    │
│        ↓                                 └────────┬─────────┘                    │
│   ┌─────────┐                                     ↓                              │
│   │  SHAPE  │ ← Interview positions      ┌──────────────────┐                    │
│   └────┬────┘                            │ FIT │ ADJ │ NEW  │                    │
│        ↓                                 │  Load relevant   │                    │
│   ┌─────────┐                            │  thesis/pattern  │                    │
│   │CRITIQUE │ ← 6 techniques             └────────┬─────────┘                    │
│   └────┬────┘                                     ↓                              │
│        ↓                                 ┌──────────────────┐                    │
│   ┌──────────┐                           │ N-PASS HARNESS   │                    │
│   │SYNTHESIZE│                           │ (harness_lite or │                    │
│   └────┬─────┘                           │  harness.py SDK) │                    │
│        ↓                                 └────────┬─────────┘                    │
│   ThesisDocument                                  ↓                              │
│   • confidence                           Answer + Evidence                       │
│   • triggers                                      ↓                              │
│        │                                          │                              │
│        └────────────→ MEMORY LAYER ←──────────────┘                              │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            MEMORY LAYER (memory.py)                              │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  /memories                                                               │   │
│   │  ├── theses/        Persistent beliefs → loaded by thesis_router        │   │
│   │  │   └── {domain}/{thesis}.md                                           │   │
│   │  ├── sessions/      Past analyses → context for continuity              │   │
│   │  │   └── {date}-{topic}.yaml                                            │   │
│   │  └── patterns/      Reusable frameworks → loaded for ADJACENT queries   │   │
│   │      └── {pattern}.md                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          QUALITY LOOP (cognitive-pitfalls)                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                          │   │
│   │   /pattern check  ─────→  Runs after expansion, before synthesis        │   │
│   │                                                                          │   │
│   │   Detects: Confirmation bias │ Narrative fallacy │ Recency bias         │   │
│   │            Illusion of depth │ Synonym drift │ Density collapse         │   │
│   │            Fluency overconfidence                                        │   │
│   │                                                                          │   │
│   │   If HIGH risk → triggers additional pass or refinement                 │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pass 0: Thesis Router

Before reasoning begins, the thesis router classifies the query and loads relevant context from memory.

```
Query → thesis_router.py → MemoryManager → Context Assembly → Pass 1
```

### Route Types

| Route | When | Context Budget |
|-------|------|----------------|
| **FIT** | Matches existing thesis | 40% thesis, 30% data, 30% reasoning |
| **ADJACENT** | Relates to known pattern | 30% pattern, 40% data, 30% reasoning |
| **NET_NEW** | Fresh territory | 10% priors, 30% data, 60% reasoning |

### Memory Integration

The router queries the memory layer:
1. **Thesis matching**: Semantic similarity to existing theses
2. **Pattern matching**: Known frameworks that apply
3. **Session context**: Recent work on related topics

This ensures the harness doesn't start from scratch when you've already formed beliefs.

---

## The N-Pass Harness

Both modes run on the same multi-pass reasoning engine.

### Multi-Pass Reasoning

Single-pass AI cannot step back and ask whether it answered the right question. Multi-pass creates space for *aporia*—the productive confusion where reframing happens.

**Two-pass achieved 83% insight coverage at 300 tokens** (6x more efficient than verbose single-pass):
- **Pass 1 (Expansion)**: Divergent exploration with semantic markers
- **Pass 2+ (Compression)**: Convergent synthesis preserving decision-relevant content

### Semantic Markers

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

## Quality Assurance: Cognitive Pitfalls

The `cognitive-pitfalls` skill runs at key points to detect reasoning degradation:

| Pitfall | Detection | Architectural Counter |
|---------|-----------|----------------------|
| Confirmation bias | All evidence points one way | Adversarial critique must be genuine |
| Narrative fallacy | Explanation too clean | Uncertainty structural, not cosmetic |
| Recency bias | Recent data dominates | Key evidence protected from crowding |
| Illusion of depth | Satisfying but shallow | Force uncertainty before conclusion |
| Synonym drift | Terms shift meaning | Semantic markers lock terminology |
| Density collapse | Insights buried in bloat | Compression with ruthlessness |
| Fluency overconfidence | Monotonic confidence | Non-monotonic trajectory required |

**Integration points:**
- Before synthesis pass
- After compression pass
- During critique phase
- Before thesis publication

---

## Backend Architecture

### Harness Implementations

| File | Dependency | Use Case |
|------|------------|----------|
| `harness_lite.py` | Direct Anthropic API | Decision Mode (fast, portable) |
| `harness.py` | Claude Agent SDK | Ideas Mode (richer context accumulation) |

### Core Modules

| File | Purpose |
|------|---------|
| `thesis_router.py` | Pass 0 context assembly (FIT/ADJ/NEW) |
| `memory.py` | Thesis, session, pattern persistence |
| `scratchpad.py` | Anchored iterative compression state |
| `metrics.py` | Quality scoring for multi-pass output |
| `server_lite.py` | FastAPI server for Decision Mode |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/ingest` | POST | Extract claims from URL/text |
| `/harness/run` | POST | Run multi-pass analysis (REST) |
| `/ws/harness` | WebSocket | Real-time streaming progress |

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

## Roadmap

### Phase 1: Current (Web + API)
- React frontend with FastAPI backend
- harness_lite for Decision Mode
- Manual skill invocation

### Phase 2: Desktop App
- Tauri wrapper for native experience
- Embedded harness skills
- Local memory persistence

### Phase 3: Claude Code Native
- Embed terminal in UI
- Run Claude Code directly with Dialectic skills
- Full SDK integration (harness.py)
- Memory layer as Claude Code context

---

## Philosophy

**Copilot, not Agent.** The system augments human judgment rather than replacing it.

**Prioritize over Predict.** The right question isn't "what will happen?" but "what should we do first given constraints?"

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this architecture earns its keep.
