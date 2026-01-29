---
name: synthesize
description: Transform a dialectic session into a structured, falsifiable thesis with confidence scoring and explicit invalidation triggers. Use after /stress-test completes.
argument-hint: [session-id]
---

# SYNTHESIZE Stage - Thesis Crystallization

## Purpose
Transform a dialectic session (claims, positions, resolved tensions) into a structured, falsifiable thesis. The thesis captures the user's developed belief with confidence scoring and explicit invalidation triggers.

## Core Principle

**Theses must be falsifiable to be useful.**

A thesis that cannot be wrong is not a thesis - it's a tautology or an unfalsifiable belief. Confidence is non-monotonic: a thesis can and should lose confidence when counter-evidence appears.

---

## Multi-Pass Synthesis Protocol

### Pass 1: Divergent Exploration

Explore the space of possible theses:

**Guiding Questions**:
- What is the strongest claim the user seems committed to?
- What worldview do their positions collectively imply?
- How did tension resolutions shape their final position?
- Is there a sharper formulation than the user explicitly stated?

**Semantic Markers**:
```
[CANDIDATE] Possible thesis formulation: ...
[WORLDVIEW] User's positions imply this mental model: ...
[RESOLUTION_SHAPES] The way user resolved TENSION-X led to: ...
[SHARPENING] User said X, but the sharper version is: ...
```

Generate 3-5 candidate thesis framings before converging.

### Pass 2: Convergent Crystallization

Select the single strongest thesis:

**Selection Criteria**:
1. **Falsifiability**: Can we specify conditions that would disprove it?
2. **Evidence grounding**: Is it supported by session claims?
3. **Coherence**: Does it integrate tension resolutions?
4. **Sharpness**: Is it specific enough to be tested?
5. **Actionability**: Does it have implications for decisions?

### Pass 3: Trigger Generation

Generate explicit conditions that would invalidate the thesis:

**Trigger Types**:

1. **Disconfirming Evidence**: What observations would prove this wrong?
2. **Environmental Shifts**: What world changes would invalidate assumptions?
3. **Assumption Failures**: What does this thesis assume that could be wrong?
4. **Time-Bound Triggers**: When should this be revisited?

**Quality Criteria**:
- Must be OBSERVABLE (not abstract)
- Must be SPECIFIC (not "if things change")
- Should include TIMEFRAMES where applicable

### Pass 4: Final Essay Polish

Transform into publication-ready prose:

1. Sharp opening stating the thesis crisply
2. Evidence organized for maximum impact
3. User voice preserved in quotes
4. Counter-evidence engaged honestly
5. "What Would Change This" as actionable checklist

---

## Confidence Scoring

| Range | Interpretation | Criteria |
|-------|----------------|----------|
| 0.90+ | High conviction | Multiple confirming evidence, tensions resolved, clear mechanism |
| 0.70-0.89 | Solid thesis | Good evidence base, some uncertainty, clear reasoning |
| 0.50-0.69 | Working hypothesis | Reasonable basis, significant unresolved tensions |
| <0.50 | Speculative | Major tensions unresolved, limited evidence |

**Calibration**:
- No evidence against → LOWER confidence (suspicious)
- Unresolved tensions → LOWER confidence
- Clear triggers → HIGHER confidence (falsifiable = better)

---

## Output Format

```json
{
  "id": "THESIS-{timestamp}",
  "title": "Short descriptive title",
  "confidence": 0.XX,
  "core_belief": "One crisp sentence. Specific. Testable. No hedging.",
  "evidence_for": [
    "Specific evidence point with reasoning",
    "Another concrete supporting point"
  ],
  "evidence_against": [
    "Acknowledged counter-evidence or limitation"
  ],
  "triggers": [
    "If X happens, this thesis is likely wrong",
    "If we observe Y, confidence should decrease",
    "Revisit after {milestone}"
  ]
}
```

---

## Final Essay Format

```markdown
---
id: thesis-{session-id}
title: "{title}"
confidence: {0.XX}
triggers:
  - type: disconfirming
    condition: "..."
    fired: false
---

# {Title}

[Sharp opening paragraph stating the thesis]

## The Argument

[Main body with evidence. User quotes integrated:]

When asked about this, I noted: *"[Actual user quote]"*

## Evidence Supporting This

- {Key evidence points}

## The Strongest Objection

[Honestly engage the best counter-argument]

## What Would Change This

- [ ] If {specific condition}, reconsider
- [ ] If {metric moves to threshold}, confidence decreases
- [ ] Revisit after {milestone}

---
*Confidence: {N}%*
```

---

## Anti-Patterns to Avoid

1. **Thesis Drift**: Rewriting thesis to accommodate all evidence
2. **Unfalsifiable Formulation**: "Markets could go up or down"
3. **Confidence Theater**: High confidence to signal conviction
4. **Missing Mechanism**: Stating what without why
5. **Evidence Asymmetry**: All evidence_for, no evidence_against
6. **Trigger-Free Thesis**: No falsification conditions
