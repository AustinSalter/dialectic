# Dialectic

**Strategic intelligence workbench for high-stakes decision-making.**

Dialectic is Claude Code for strategists—multi-pass reasoning that enables meta-level thinking unavailable in single-pass AI.

## Why Dialectic?

| What AI Does | What Strategists Need |
|--------------|----------------------|
| Retrieves similar content | Navigates causal relationships |
| Single-pass response | Iterative refinement |
| Answers questions | Challenges assumptions |
| Forgets everything | Compounds learning |

**Key Finding**: Multi-pass reasoning reaches different conclusions in 25% of cases—elevating reasoning from "company comparison" to "portfolio construction" level thinking.

## Two Modes

Dialectic V3 offers two distinct workflows:

| Mode | Purpose | Duration | Engine |
|------|---------|----------|--------|
| **Decision** | Deep analysis on bounded problems | ~10 min | harness_lite (direct API) |
| **Ideas** | Extended research and thesis development | Hours to days | SDK with session continuity |

- **Decision Mode**: Submit a problem with evidence, get a synthesis with conviction markers
- **Ideas Mode**: Multi-day thesis development with full tool access and session persistence

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.10+
- Anthropic API key

### Setup

```bash
# Clone
git clone https://github.com/AustinSalter/dialectic.git
cd dialectic

# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=your-key" > .env
```

### Run

```bash
# Terminal 1: Backend
cd backend && python server_lite.py

# Terminal 2: Frontend
npm run dev
```

Open http://localhost:5173

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          DIALECTIC                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   IDEAS MODE                         DECISION MODE              │
│   (Extended Research)                (Bounded Analysis)         │
│                                                                 │
│   Source Material                    Question + Context         │
│        ↓                                    ↓                   │
│   ┌─────────┐                       ┌──────────────┐            │
│   │ GATHER  │                       │ THESIS ROUTER│ ← Pass 0   │
│   └────┬────┘                       └──────┬───────┘            │
│        ↓                                   ↓                    │
│   ┌─────────┐                       ┌──────────────┐            │
│   │  SHAPE  │                       │ FIT│ADJ│NEW │            │
│   └────┬────┘                       └──────┬───────┘            │
│        ↓                                   ↓                    │
│   ┌─────────┐                       ┌──────────────┐            │
│   │CRITIQUE │ ← 6 techniques        │ N-PASS       │            │
│   └────┬────┘                       │ HARNESS      │            │
│        ↓                            └──────┬───────┘            │
│   ┌──────────┐                             ↓                    │
│   │SYNTHESIZE│                      Answer + Evidence           │
│   └────┬─────┘                                                  │
│        ↓                                                        │
│   ThesisDocument ──────────→ MEMORY LAYER ←─────────────────────│
│                                                                 │
│   Markers: [INSIGHT] [EVIDENCE] [RISK] [COUNTER] [PATTERN]      │
│   Termination: saturation | confidence ≥ 0.75 | max-cycles      │
└─────────────────────────────────────────────────────────────────┘
```

### Pass 0: Thesis Routing

Before analysis begins, queries are classified and relevant context loaded from memory:

| Route | When | Context Allocation |
|-------|------|-------------------|
| **FIT** | Matches existing thesis | 40% thesis, 30% data, 30% reasoning |
| **ADJACENT** | Relates to known pattern | 30% pattern, 40% data, 30% reasoning |
| **NET_NEW** | Fresh territory | 10% priors, 30% data, 60% reasoning |

### Validated Results

| Finding | Result |
|---------|--------|
| Multi-pass vs single-pass | 25% different conclusions |
| Multi-pass vs multi-agent (HBR cases) | 75% vs 50% correct |
| Two-pass compression efficiency | 6x more efficient (83% coverage at 300 tokens) |
| Structured vs naive critique | 9x more flaws found |
| Semantic marker extraction | 3x insights per token |
| SDK context accumulation | 14k vs 6k char synthesis |

### Structured Critique

The critique pass uses six questioning techniques (validated to find 9x more flaws than naive "now critique this"):

1. **Inversion**: What if the opposite were true?
2. **Second-Order**: What are the downstream effects?
3. **Falsification**: What evidence would disprove this?
4. **Base Rates**: What do historical priors suggest?
5. **Incentive Audit**: Who benefits from this being believed?
6. **Adversary Simulation**: How would a smart skeptic attack?

## Project Structure

```
dialectic/
├── packages/
│   ├── web/              # React frontend (Vite + TypeScript + Tailwind)
│   ├── shared/           # @dialectic/shared - Types & API client
│   └── desktop/          # @dialectic/desktop - Tauri wrapper
├── backend/
│   ├── server_lite.py    # FastAPI server (Decision Mode)
│   ├── harness_lite.py   # Direct API harness (fast, portable)
│   ├── harness.py        # SDK harness (Ideas Mode, richer context)
│   ├── scratchpad.py     # Anchored iterative compression state
│   ├── thesis_router.py  # Pass 0: FIT/ADJ/NEW routing
│   ├── memory.py         # Thesis, session, pattern persistence
│   ├── metrics.py        # Quality scoring for multi-pass output
│   └── compression_probes.py  # Eval framework (RACD probes)
├── skills/               # Claude Code skills
│   ├── workflow-stages/      # GATHER, SHAPE, CRITIQUE, SYNTHESIZE
│   ├── cognitive-pitfalls/   # Detects reasoning degradation
│   ├── reasoning-harness/    # Multi-pass prompts
│   ├── strategy-protocol/    # Decision framing
│   └── thesis-management/    # FIT/ADJ/NEW routing
├── memories/             # Persistent memory layer
│   ├── theses/           # Persistent beliefs (loaded by thesis_router)
│   ├── sessions/         # Past analyses (context for continuity)
│   └── patterns/         # Reusable frameworks (for ADJACENT queries)
└── docs/
    ├── DIALECTIC.md      # Core concepts & V3 architecture
    ├── ARCHITECTURE.md   # System design & data flow
    └── EXPERIMENTS.md    # Validation experiment results
```

### Backend Components

| File | Purpose | Mode |
|------|---------|------|
| `harness_lite.py` | Direct Anthropic API, no SDK dependency | Decision |
| `harness.py` | Claude Agent SDK with session continuity | Ideas |
| `scratchpad.py` | Key evidence preserved across cycles | Both |
| `thesis_router.py` | Pass 0: matches queries to existing theses/patterns | Both |
| `memory.py` | File-based thesis, session, pattern persistence | Both |
| `metrics.py` | Quality analysis (insight density, causal chains) | Both |

## Documentation

- [DIALECTIC.md](./docs/DIALECTIC.md) — Core concepts, V3 dual-mode architecture, session segments
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System design, data flow, backend/frontend architecture
- [EXPERIMENTS.md](./docs/EXPERIMENTS.md) — Validation experiments (EXP-004 through EXP-019)

## Philosophy

**Copilot, not Agent.** Augments human judgment rather than replacing it. Strategic decisions operate in domains of irreducible uncertainty.

**Prioritize over Predict.** The right question isn't "what will happen?" but "what should we do first given constraints?"

**Dialogue as First Principle.** User messages are sacred. They represent human thinking and should never be compressed away.

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this earns its keep.

## License

MIT
