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
│   Source → EXPANSION → COMPRESSION → CRITIQUE → SYNTHESIS       │
│                                                                 │
│   Markers: [INSIGHT] [EVIDENCE] [RISK] [COUNTER]                │
│   Termination: saturation | confidence ≥ 0.75 | max-cycles      │
└─────────────────────────────────────────────────────────────────┘
```

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
│   └── desktop/          # Tauri wrapper (planned)
├── backend/
│   ├── harness.py        # SDK version (Claude Agent SDK)
│   ├── harness_lite.py   # Lite version (direct API)
│   ├── server_lite.py    # FastAPI server
│   ├── scratchpad.py     # Context accumulation
│   └── thesis_router.py  # Thesis routing logic
└── docs/
    ├── DIALECTIC.md      # Core concepts
    ├── ARCHITECTURE.md   # System design
    └── EXPERIMENTS.md    # Validation results
```

### Backend Options

| File | Use When |
|------|----------|
| `harness_lite.py` | Quick start, no SDK dependency |
| `harness.py` | Full subagent orchestration with Claude Agent SDK |

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
