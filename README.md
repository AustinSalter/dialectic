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
│                     MULTI-PASS HARNESS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Pass 0: ROUTING (FIT/ADJ/NEW) → Load relevant thesis context  │
│                        ↓                                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  EXPANSION → COMPRESSION → CRITIQUE  (repeat N cycles)  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                        ↓                                        │
│   Pass N: SYNTHESIS → Final thesis with triggers                │
│                                                                 │
│   Markers: [INSIGHT] [EVIDENCE] [RISK] [COUNTER] [PATTERN]      │
│   Key Evidence: Critical facts preserved through compression    │
│   Termination: saturation | confidence ≥ 0.75 | max-cycles      │
└─────────────────────────────────────────────────────────────────┘
```

### Pass 0: Thesis Routing

Before analysis begins, queries are classified:

| Route | When | Context Allocation |
|-------|------|-------------------|
| **FIT** | Matches existing thesis | 40% thesis, 30% data, 30% reasoning |
| **ADJACENT** | Relates to known pattern | 30% pattern, 40% data, 30% reasoning |
| **NET_NEW** | Fresh territory | 10% priors, 60% reasoning, 30% data |

### Validated Results

| Finding | Result |
|---------|--------|
| Multi-pass vs single-pass | 25% different conclusions |
| Multi-pass vs multi-agent (HBR cases) | 75% vs 50% correct |
| Two-pass compression efficiency | 6x more efficient |
| Structured vs naive critique | 9x more flaws found |
| Semantic marker extraction | 3x insights per token |

## Project Structure

```
dialectic/
├── packages/
│   ├── web/              # React frontend
│   ├── shared/           # Shared types
│   └── desktop/          # Tauri desktop app
├── backend/
│   ├── server_lite.py    # FastAPI server
│   ├── harness_lite.py   # Direct API harness
│   ├── harness.py        # SDK harness (Claude Agent SDK)
│   ├── scratchpad.py     # Context accumulation + key evidence
│   ├── thesis_router.py  # Pass 0: FIT/ADJ/NEW routing
│   ├── memory.py         # File-based thesis/pattern persistence
│   ├── metrics.py        # Quality analysis (insight density, etc.)
│   └── compression_probes.py  # Eval framework for compression
├── skills/               # Claude Code skills
│   ├── workflow-stages/  # GATHER, SHAPE, CRITIQUE, SYNTHESIZE
│   ├── cognitive-pitfalls/   # Structured self-critique
│   ├── reasoning-harness/    # Multi-pass prompts
│   ├── strategy-protocol/    # Decision framing
│   └── thesis-management/    # FIT/ADJ/NEW routing
└── docs/
    ├── DIALECTIC.md      # Core concepts
    ├── ARCHITECTURE.md   # System design
    └── EXPERIMENTS.md    # Validation results
```

### Backend Components

| File | Purpose |
|------|---------|
| `harness_lite.py` | Direct Anthropic API, no SDK dependency |
| `harness.py` | Claude Agent SDK with subagents (expander, compressor, critic) |
| `scratchpad.py` | Accumulated context with semantic markers + key evidence (never compressed) |
| `thesis_router.py` | Pass 0 routing: matches queries to existing theses/patterns |
| `metrics.py` | InsightMetrics: causal chains, historical precedents, quantified predictions |

## Documentation

- [DIALECTIC.md](./docs/DIALECTIC.md) — Core thesis and validated findings
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System design and data flow
- [EXPERIMENTS.md](./docs/EXPERIMENTS.md) — Validation experiment results

## Philosophy

**Copilot, not Agent.** Augments human judgment rather than replacing it.

**Prioritize over Predict.** The right question isn't "what will happen?" but "what should we do first?"

**The Obvious Decisions Don't Need AI.** The non-obvious ones—where the frame itself might be wrong—that's where this earns its keep.

## License

MIT
