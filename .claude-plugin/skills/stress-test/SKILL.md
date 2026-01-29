---
name: stress-test
description: Apply adversarial critique to identify contradictions, frame conflicts, and commitment tensions in user positions. Generates tension cards for resolution. Use after /shape interview completes.
argument-hint: [session-id]
---

# STRESS-TEST Stage - Adversarial Tension Identification

## Purpose
Apply genuinely adversarial critique to identify contradictions, frame conflicts, and commitment tensions in user positions. Generate tension cards with opposing sides.

## Core Principle

**Critique must be genuinely adversarial, not performative.**

Most AI critique is agreeable - it raises "concerns" that validate the user's frame while appearing thorough. This is worse than useless.

Genuine adversarial critique:
- Finds actual contradictions, not rhetorical ones
- Exposes frame conflicts the user cannot see
- Identifies commitments the user hasn't acknowledged
- Surfaces evidence the user is ignoring
- Questions whether coherent narrative masks confusion

---

## Six Questioning Techniques

### 1. Socratic Examination
**Question the foundations.**
- What assumptions does this position rest on?
- Are those assumptions consistent with other positions?

### 2. Steel-Manning + Critique
**Construct the strongest opposing view, then test if it's addressed.**
- What's the best argument against this position?
- Has the user actually engaged with that argument?

### 3. Second-Order Probing
**Follow implications forward.**
- If this position is true, what else must be true?
- Does the user accept those downstream implications?

### 4. Frame Conflict Detection
**Identify incompatible analytical lenses.**
- What mental model is the user applying here?
- Is it the same model they apply to related claims?

### 5. Commitment Mapping
**Surface implicit commitments.**
- By holding this position, what is the user implicitly committed to?
- Do those commitments conflict with other positions?

### 6. Counter-Factual Stress Testing
**Test robustness to changing conditions.**
- Under what conditions would this position be wrong?
- What evidence would change their mind?

---

## Multi-Pass Critique Process

### Pass 1: Divergent Scan
Apply all six techniques. Mark findings with semantic tags:

```
[CONTRADICTION] User agrees with X but also with Y, which are incompatible
[FRAME_CONFLICT] Position on CLAIM-1 uses efficiency frame, CLAIM-3 uses fairness frame
[HIDDEN_COMMITMENT] Agreeing with CLAIM-2 implies accepting Z
[IGNORED_COUNTER] Strongest argument against this position is not addressed
[NARRATIVE_MASK] These positions form a coherent story but the story assumes...
[UNFALSIFIABLE] No evidence could change this position
```

### Pass 2: Tension Crystallization
From tagged findings, crystallize into discrete tensions:

For each genuine tension:
1. Articulate both sides clearly and charitably
2. Identify which claims it connects
3. Explain why resolution is required

### Pass 3: Card Generation
Output tension cards:

```json
{
  "id": "TENSION-1",
  "description": "User accepts both market efficiency and persistent alpha",
  "sides": [
    "Markets are efficient - prices reflect all available information",
    "Skilled investors consistently generate alpha through superior analysis"
  ],
  "claim_refs": ["CLAIM-2", "CLAIM-5"],
  "resolved": false
}
```

### Pass 4: Essay Refinement
Integrate user quotes and tension resolutions into the evolving essay:

1. Replace `[USER_QUOTE: ...]` placeholders with actual responses
2. Weave quotes naturally - user voice should feel integrated
3. Incorporate resolutions where user resolved a tension
4. Acknowledge trade-offs where tensions remain unresolved

---

## Resolution Flow

When user clicks "Resolve tension":

1. Present both sides clearly
2. Ask: "How do you resolve this conflict?"
3. Probe their resolution:
   - Does it actually address both sides?
   - Or does it dismiss one side without engaging?
   - What are they giving up to achieve resolution?
4. If genuine: mark resolved with reasoning
5. If evasion: surface this and re-engage

**Signs of genuine resolution**:
- User acknowledges trade-offs
- User specifies conditions where each side applies
- User updates their position on underlying claims

**Signs of evasion**:
- "It depends" without specifying on what
- Dismissing one side as obviously wrong
- Reframing the tension instead of resolving it

---

## Progression to /synthesize

Ready for synthesis when:
- Critical tensions resolved OR explicitly accepted as trade-offs
- User has confronted (not evaded) each major conflict
- Frame conflicts acknowledged and reconciled
- Essay draft captures the user's refined thinking
