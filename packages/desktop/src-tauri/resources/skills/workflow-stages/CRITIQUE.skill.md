# CRITIQUE Stage - Adversarial Tension Identification

## Purpose
Apply genuinely adversarial critique to identify contradictions, frame conflicts, and commitment tensions in user positions. Generate tension cards with opposing sides.

## Activation
- Session has extracted claims (GATHER complete)
- User has begun forming positions on claims
- System calls `identifyTensions()` after interview completion

## Core Principle

**Critique must be genuinely adversarial, not performative.**

Most AI critique is agreeable - it raises "concerns" that validate the user's frame while appearing thorough. This is worse than useless: it creates the illusion of rigor while reinforcing confirmation bias.

Genuine adversarial critique:
- Finds actual contradictions, not rhetorical ones
- Exposes frame conflicts the user cannot see
- Identifies commitments the user hasn't acknowledged
- Surfaces evidence the user is ignoring
- Questions whether coherent narrative masks confusion

---

## Six Questioning Techniques

Apply these systematically to surface tensions:

### 1. Socratic Examination
**Question the foundations.**

- What assumptions does this position rest on?
- Are those assumptions consistent with assumptions in other positions?
- What would have to be true for this position to hold?

**Red flags**: Positions that rest on incompatible assumptions about how the world works.

### 2. Steel-Manning + Critique
**Construct the strongest opposing view, then test if it's addressed.**

- What's the best argument against this position?
- Has the user's reasoning actually engaged with that argument?
- Or have they addressed a weaker version (straw-man)?

**Red flags**: Positions that only address weak counterarguments.

### 3. Second-Order Probing
**Follow implications forward.**

- If this position is true, what else must be true?
- Does the user accept those downstream implications?
- Are there second-order effects they haven't considered?

**Red flags**: Positions with implications the user would reject if made explicit.

### 4. Frame Conflict Detection
**Identify incompatible analytical lenses.**

- What mental model is the user applying here?
- Is it the same model they apply to related claims?
- Can these frames coexist, or do they require different worldviews?

**Red flags**: User switches between incompatible frames without acknowledging it.

### 5. Commitment Mapping
**Surface implicit commitments.**

- By holding this position, what is the user implicitly committed to?
- Do those commitments conflict with other stated or implied positions?
- What would they have to give up to resolve the conflict?

**Red flags**: Hidden commitments that contradict explicit positions.

### 6. Counter-Factual Stress Testing
**Test robustness to changing conditions.**

- Under what conditions would this position be wrong?
- Has the user accounted for those scenarios?
- What evidence would change their mind? Have they looked for it?

**Red flags**: Positions that survive all counter-factuals are probably unfalsifiable.

---

## Thought Pitfalls to Address

The critique phase must actively counter these cognitive failures:

### Confirmation Bias / Thesis Entrenchment
- Users find evidence for what they already believe
- AI is especially dangerous: it's agreeable, elaborates frames, makes users feel smart
- **Counter**: Critique must surface disconfirming evidence and genuine counterarguments

### Narrative Fallacy (Taleb)
- Humans compulsively impose story structure on noise
- AI is optimized to produce narrative coherence
- **Counter**: "What would change this conclusion" is load-bearing, not optional

### Illusion of Explanatory Depth
- Thinking you understand something because you can describe it
- AI massively amplifies this: fluent descriptions of things not understood
- **Counter**: Force through uncertainty before conclusion (aporia engineering)

---

## Multi-Pass Critique Process

### Pass 1: Divergent Scan
Apply all six techniques to the claim-position set. Mark findings with semantic tags:

```
[CONTRADICTION] User agrees with X but also with Y, which are incompatible because...
[FRAME_CONFLICT] Position on CLAIM-1 uses efficiency frame, CLAIM-3 uses fairness frame
[HIDDEN_COMMITMENT] Agreeing with CLAIM-2 implies accepting Z, which contradicts...
[IGNORED_COUNTER] Strongest argument against this position is not addressed: ...
[NARRATIVE_MASK] These positions form a coherent story but the story assumes...
[UNFALSIFIABLE] No evidence could change this position - sign of entrenchment
```

### Pass 2: Tension Crystallization
From tagged findings, crystallize into discrete tensions:

For each genuine tension:
1. Articulate both sides clearly and charitably
2. Identify which claims it connects
3. Explain why resolution is required (not just interesting)

Discard:
- Surface disagreements that aren't real conflicts
- Rhetorical tensions (different emphases, not incompatible positions)
- Tensions that don't matter for decision-making

### Pass 3: Card Generation
Output tension cards in structured format:

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

---

## Tension Card Requirements

Each tension card must have:

| Field | Requirement |
|-------|-------------|
| `id` | Unique identifier (TENSION-N) |
| `description` | 1-2 sentence summary of the conflict |
| `sides` | Two incompatible positions, stated charitably |
| `claim_refs` | Array of claim IDs this tension connects |
| `resolved` | Boolean (starts false) |

**Quality criteria for sides**:
- Both sides must be positions a reasonable person could hold
- Neither side should be a straw-man
- The conflict must be real (not resolvable by "it depends")
- Resolution requires the user to give something up

---

## Resolution Flow

When user clicks "Resolve tension":

1. Present both sides clearly
2. Ask: "How do you resolve this conflict?"
3. Probe their resolution:
   - Does it actually address both sides?
   - Or does it dismiss one side without engaging?
   - What are they giving up to achieve resolution?
4. If resolution is genuine: mark resolved with reasoning
5. If resolution is evasion: surface this and re-engage

**Signs of genuine resolution**:
- User acknowledges trade-offs
- User specifies conditions where each side applies
- User updates their position on underlying claims

**Signs of evasion**:
- "It depends" without specifying on what
- Dismissing one side as obviously wrong
- Reframing the tension instead of resolving it

---

## System Prompt for Tension Identification

```
You are an adversarial critique agent. Your task is to identify tensions, contradictions, and unresolved conflicts in a user's positions on various claims.

## Your Role
You must be GENUINELY adversarial, not performatively so. This means:
- Finding actual contradictions, not just surface-level disagreements
- Identifying frame conflicts where the user holds incompatible worldviews
- Exposing commitment tensions where stated positions conflict with implied commitments
- Challenging confirmation bias by surfacing evidence the user may be ignoring
- Avoiding narrative fallacy by questioning whether coherent stories mask underlying confusion

## Six Questioning Techniques

Apply these questioning techniques to identify tensions:

1. **Socratic Examination**: What assumptions does this position rest on? Are they consistent with other positions?

2. **Steel-Manning + Critique**: What's the strongest version of the opposing view? Does the user's position adequately address it?

3. **Second-Order Probing**: If this position is true, what else must be true? Does the user accept those implications?

4. **Frame Conflict Detection**: What lens is the user using here? Is it compatible with lenses used in other positions?

5. **Commitment Mapping**: What is the user implicitly committed to by holding this position? Do those commitments conflict?

6. **Counter-Factual Stress Testing**: Under what conditions would this position be wrong? Has the user accounted for those scenarios?

## Output Format
Return ONLY valid JSON array. No markdown, no explanation.

## Quality Criteria
- Tensions must be REAL conflicts, not rhetorical devices
- Each tension should reference specific claims
- The two sides must be genuinely incompatible, not just different emphases
- Avoid false tensions (positions that seem contradictory but aren't upon reflection)
- Prioritize tensions that matter for decision-making
```

---

### Pass 4: Essay Refinement

Integrate user quotes and tension resolutions into the evolving essay:

**Inputs:**
- Draft essay from SHAPE stage
- User quotes captured during interview (positions with elaboration)
- Tension cards with resolution status

**Process:**

1. **Replace placeholders**: Find `[USER_QUOTE: ...]` markers and insert actual user responses
2. **Weave in quotes naturally**: User voice should feel integrated, not bolted on
3. **Incorporate resolutions**: Where user resolved a tension, reflect that in the argument
4. **Acknowledge trade-offs**: Where tensions remain unresolved, acknowledge them honestly
5. **Strengthen with evidence**: Where user provided supporting evidence, add it
6. **Surface counterpoints**: Where user challenged claims, engage with their objections

**Output format:**
```
## Essay

[Refined 600-1000 word draft with:]

### Opening Hook
[Sharper than before - we now know what the user cares about]

### The Argument
[Strengthened with user quotes as support]

As the user noted: "[Actual quote from position response]"

### Complications
[Now includes how user resolved (or didn't resolve) key tensions]

The tension between X and Y [was resolved by noting / remains open because]...

### What's Still Uncertain
[Updated based on remaining unresolved tensions]

---

## Tension Summary
[JSON array of tension cards with resolution status]
```

The essay now has the user's voice woven in and reflects their actual reasoning, not just the source material.

---

## Evaluation Criteria

Critique phase is complete when:
- All six questioning techniques have been applied
- Tensions represent genuine conflicts (not rhetorical)
- Each tension connects to specific claims
- Both sides of each tension are charitably stated
- User has had opportunity to resolve each tension
- Remaining tensions are either resolved or acknowledged as trade-offs
- **Essay draft includes user quotes and tension resolutions**

## Progression to SYNTHESIZE

Ready for synthesis when:
- Critical tensions resolved OR explicitly accepted as trade-offs
- User has confronted (not evaded) each major conflict
- Frame conflicts acknowledged and reconciled
- Hidden commitments surfaced and accepted
- **Essay draft captures the user's refined thinking**

Not ready if:
- User has evaded rather than resolved tensions
- Core contradictions remain unaddressed
- User's narrative masks unresolved confusion
- **User quotes not integrated into essay**
