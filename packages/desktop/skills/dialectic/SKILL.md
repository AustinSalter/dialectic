# Dialectic Harness Skill

> Strategic thinking through structured multi-pass reasoning

## Overview

This skill implements the Dialectic methodology: a multi-pass reasoning harness for thesis formation and decision-making. It transforms single-pass AI responses into iterative refinement cycles that surface tensions, challenge assumptions, and synthesize defensible positions.

## Commands

### `/harness [question]`
Run the full multi-pass harness on a question or thesis.

**Example:**
```
/harness Should we expand into the EU market given current regulatory headwinds?
```

### `/gather [source]`
Extract claims from source material (URL, file, or pasted text).

**Example:**
```
/gather https://danwang.co/2023-letter/
/gather ./research/dalio-changing-world-order.md
```

### `/shape`
Run the interview pass — explore positions, surface assumptions, identify what's actually being claimed.

### `/critique`
Run structured critique using the six questioning techniques.

### `/synthesize`
Compress insights into a thesis document with confidence scores and revision triggers.

### `/tension [claim1] vs [claim2]`
Explicitly surface and analyze a tension between two claims.

---

## Multi-Pass Methodology

### Pass Structure

Each harness run follows this cycle:

```
EXPANSION → COMPRESSION → CRITIQUE → SYNTHESIS
    ↓            ↓            ↓           ↓
 Diverge     Converge     Challenge    Resolve
```

**Pass 1 — Expansion (Divergent)**
- Explore the question space broadly
- Surface assumptions, stakeholders, second-order effects
- Use semantic markers to tag insights
- Target: 600-800 words, maximize coverage

**Pass 2 — Compression (Convergent)**
- Identify the 3-5 most decision-relevant insights
- Preserve marked content, discard noise
- Target: 200-300 words, maximize signal density

**Pass 3 — Critique (Adversarial)**
- Apply six structured questioning techniques
- Identify tensions and unresolved contradictions
- Challenge the strongest-seeming conclusions
- Target: Surface at least 2 genuine tensions

**Pass 4 — Synthesis (Resolution)**
- Resolve or acknowledge tensions
- Produce thesis document with confidence scores
- Define revision triggers
- Target: Defensible position with clear caveats

### Semantic Markers

Use these markers to tag content during expansion:

| Marker | Use When |
|--------|----------|
| `[INSIGHT]` | Non-obvious conclusion worth preserving |
| `[EVIDENCE]` | Concrete data point or citation |
| `[RISK]` | Potential failure mode or downside |
| `[COUNTER]` | Argument against the emerging thesis |
| `[PATTERN]` | Recurring structure across domains |
| `[DECISION]` | Concrete action recommendation |
| `[TENSION]` | Unresolved contradiction |
| `[ASSUMPTION]` | Unstated belief load-bearing the argument |

### Critique Techniques

Apply these six techniques during the critique pass:

1. **Inversion**: "What if the opposite were true? What would we expect to see?"

2. **Second-Order Effects**: "If this thesis is correct, what happens next? And after that?"

3. **Falsification**: "What evidence would disprove this? Are we looking for it?"

4. **Base Rates**: "What do historical priors suggest? How often does this type of thing succeed/fail?"

5. **Incentive Audit**: "Who benefits from this being believed? What are they not saying?"

6. **Adversary Simulation**: "How would a smart, motivated skeptic attack this position?"

### Termination Criteria

The harness terminates when ANY of these conditions are met:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| Saturation | Δ confidence < 5% for 2 cycles | No new signal |
| Confidence | ≥ 0.75 AND tensions resolved | Good enough |
| Max cycles | 5 passes | Cost control |

---

## Output Format

### Thesis Document

After synthesis, produce a document in this structure:

```markdown
# [Thesis Title]

## Position
[One paragraph stating the thesis clearly]

## Confidence: [0.0-1.0]
[Brief justification for the score]

## Key Evidence
- [EVIDENCE] ...
- [EVIDENCE] ...

## Risks Acknowledged
- [RISK] ...
- [RISK] ...

## Tensions
### [Resolved]
- [Tension]: [How resolved]

### [Unresolved]
- [Tension]: [Why it remains open]

## Revision Triggers
If any of these occur, revisit this thesis:
- [ ] [Specific observable event]
- [ ] [Specific observable event]

## Audit Trail
- Pass 1: [Summary of expansion]
- Pass 2: [Summary of compression]
- Pass 3: [Key critiques surfaced]
- Pass 4: [Resolution decisions]
```

### Tension Document

When surfacing tensions via `/tension`:

```markdown
# Tension: [Short name]

## Claim A
[Full statement of first position]
Source: [Attribution]

## Claim B
[Full statement of opposing position]
Source: [Attribution]

## Analysis
[Why these genuinely conflict, not just superficially]

## Resolution Attempts
- [ ] [Possible resolution path 1]
- [ ] [Possible resolution path 2]

## Stakes
[What depends on resolving this correctly]
```

---

## Session Integration

This skill reads session context from the current working directory:

### Expected Files

```
./session.json       # Session metadata (auto-generated)
./context/           # Source materials
./claims/            # Extracted claims
./tensions/          # Identified tensions
./thesis/            # Synthesized documents
```

### session.json Schema

```json
{
  "id": "uuid",
  "title": "Session Title",
  "status": "gathering" | "shaping" | "critiquing" | "synthesized",
  "created": "ISO timestamp",
  "updated": "ISO timestamp",
  "context_files": ["./context/file1.md", "./context/file2.pdf"],
  "claims": [
    {
      "id": "claim-uuid",
      "text": "Claim text",
      "source": "file or url",
      "confidence": 0.0-1.0,
      "markers": ["INSIGHT", "EVIDENCE"]
    }
  ],
  "tensions": [
    {
      "id": "tension-uuid",
      "claim_a": "claim-uuid",
      "claim_b": "claim-uuid",
      "status": "open" | "resolved",
      "resolution": "optional resolution text"
    }
  ],
  "thesis": {
    "position": "thesis text",
    "confidence": 0.0-1.0,
    "revision_triggers": ["trigger 1", "trigger 2"]
  },
  "passes": [
    {
      "type": "expansion" | "compression" | "critique" | "synthesis",
      "timestamp": "ISO timestamp",
      "summary": "Brief summary of what happened"
    }
  ]
}
```

---

## Workflow Examples

### Thesis Formation (from sources)

```bash
# 1. Add source materials to context
/gather ./research/wang-china-letters.md
/gather ./research/dalio-world-order.pdf

# 2. Shape the emerging thesis through interview
/shape
# Claude asks clarifying questions, surfaces positions

# 3. Run structured critique
/critique

# 4. Synthesize into defensible thesis
/synthesize
```

### Decision Analysis (from question)

```bash
# 1. Run full harness on a decision question
/harness Should we acquire CompetitorX given their technical debt?

# Claude runs all passes automatically, outputs thesis document
```

### Tension Resolution

```bash
# 1. Surface a specific tension
/tension "China's debt crisis will cause economic collapse" vs "Manufacturing capabilities create durable advantages"

# Claude analyzes the tension, suggests resolution paths
```

---

## Philosophy

**Copilot, not Agent.** This skill augments your judgment. It surfaces what you might miss, challenges what you assume, and structures what you conclude. It does not decide for you.

**The Obvious Decisions Don't Need This.** Use the harness for decisions where the frame itself might be wrong — where you need to be argued with, not agreed with.

**Tension is Signal.** Unresolved contradictions aren't failures. They're the interesting parts. The skill preserves them rather than papering over them.
