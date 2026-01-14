# SYNTHESIZE Stage - Thesis Crystallization

## Purpose
Transform a dialectic session (claims, positions, resolved tensions) into a structured, falsifiable thesis. The thesis captures the user's developed belief with confidence scoring and explicit invalidation triggers.

## Activation
- Session has claims (GATHER complete)
- User has taken positions (SHAPE complete)
- Critical tensions resolved or acknowledged (CRITIQUE complete)
- User issues `synthesize` command or session moves to synthesizing state

## Core Principle

**Theses must be falsifiable to be useful.**

A thesis that cannot be wrong is not a thesis - it's a tautology or an unfalsifiable belief. The synthesis phase exists to crystallize beliefs into testable form with explicit conditions that would invalidate them.

Key insight from reasoning-harness: **Confidence is non-monotonic**. A thesis can and should lose confidence when counter-evidence appears or triggers fire. This is a feature, not a bug.

---

## Multi-Pass Synthesis Protocol

### Pass 1: Divergent Exploration

Explore the space of possible theses that emerge from the session:

**Guiding Questions**:
- What is the strongest claim the user seems committed to?
- What worldview do their positions collectively imply?
- How did tension resolutions shape their final position?
- What would a skeptic identify as their core belief?
- Is there a sharper formulation than the user explicitly stated?

**Semantic Markers**:
```
[CANDIDATE] Possible thesis formulation: ...
[WORLDVIEW] User's positions imply this mental model: ...
[RESOLUTION_SHAPES] The way user resolved TENSION-X led to: ...
[SHARPENING] User said X, but the sharper version is: ...
```

**Divergent Goal**: Generate 3-5 candidate thesis framings before converging.

### Pass 2: Convergent Crystallization

Select the single strongest thesis and structure it rigorously:

**Selection Criteria**:
1. **Falsifiability**: Can we specify conditions that would disprove it?
2. **Evidence grounding**: Is it supported by session claims and positions?
3. **Coherence**: Does it integrate tension resolutions?
4. **Sharpness**: Is it specific enough to be tested?
5. **Actionability**: Does it have implications for decisions?

**Structuring the Thesis**:

| Field | Requirement |
|-------|-------------|
| `title` | 5-10 words, captures essence |
| `confidence` | 0.0-1.0, calibrated per scoring rules |
| `core_belief` | One crisp, testable sentence |
| `evidence_for` | 2-5 concrete supporting points |
| `evidence_against` | 1-3 acknowledged counter-evidence |
| `triggers` | 2-5 falsifiable conditions |

### Pass 3: Trigger Generation

Generate explicit conditions that would invalidate or weaken the thesis:

**Trigger Types**:

1. **Disconfirming Evidence**: What observations would prove this wrong?
   - "If X metric moves to Y, this thesis is likely wrong"
   - "If company Z does W, the premise fails"

2. **Environmental Shifts**: What world changes would invalidate assumptions?
   - "If regulation changes to X, reconsider"
   - "If market structure shifts to Y, thesis no longer applies"

3. **Assumption Failures**: What does this thesis assume that could be wrong?
   - "This assumes X remains true - if X changes, update"
   - "Thesis rests on Y being the causal mechanism - if Z instead, revise"

4. **Time-Bound Triggers**: When should this be revisited?
   - "If no progress toward X by date Y, confidence should decrease"
   - "Revisit after earnings/event/milestone"

**Quality Criteria for Triggers**:
- Must be OBSERVABLE (not abstract)
- Must be SPECIFIC (not "if things change")
- Should include TIMEFRAMES where applicable
- Should cover both near-term and structural risks

---

## Confidence Scoring Rules

Confidence reflects genuine uncertainty, not conviction signaling.

| Range | Interpretation | Criteria |
|-------|----------------|----------|
| 0.90+ | High conviction | Multiple confirming evidence, tensions resolved coherently, strong causal model, clear mechanism |
| 0.70-0.89 | Solid thesis | Good evidence base, some unresolved uncertainty, clear reasoning chain |
| 0.50-0.69 | Working hypothesis | Reasonable basis, significant unresolved tensions, needs more data |
| <0.50 | Speculative | Major tensions unresolved, limited evidence, treat as exploration |

**Confidence Calibration**:
- A thesis with NO evidence against should have LOWER confidence (suspicious)
- A thesis with unresolved tensions should have LOWER confidence
- A thesis with clear triggers should have HIGHER confidence (falsifiable = better)
- Confidence should reflect what you'd bet, not what you hope

**Non-Monotonic Updates**:
Confidence can and should decrease when:
- A trigger condition fires
- New counter-evidence emerges
- Original evidence ages or becomes stale
- Assumptions prove wrong

---

## Thesis Output Format

```json
{
  "id": "THESIS-{timestamp}",
  "title": "Short descriptive title",
  "confidence": 0.XX,
  "core_belief": "One crisp sentence. Specific. Testable. No hedging.",
  "evidence_for": [
    "Specific evidence point from session with reasoning",
    "Another concrete supporting point"
  ],
  "evidence_against": [
    "Acknowledged counter-evidence or limitation",
    "Known uncertainty or weakness"
  ],
  "triggers": [
    "If X happens, this thesis is likely wrong",
    "If we observe Y, confidence should decrease",
    "This assumes Z - if Z changes, reconsider"
  ],
  "created_at": "ISO timestamp"
}
```

---

### Pass 4: Final Essay Polish

Transform the refined essay into publication-ready prose:

**Inputs:**
- Refined essay from CRITIQUE stage (with user quotes already woven in)
- Structured thesis JSON (title, confidence, evidence, triggers)

**Process:**

1. **Sharp opening**: Rewrite the hook to state the thesis crisply
2. **Evidence organization**: Arrange points for maximum impact
3. **User voice preservation**: Ensure quotes flow naturally
4. **Honest objection engagement**: Counter-evidence is engaged, not hidden
5. **Trigger section**: "What Would Change This" as actionable checklist
6. **Confidence reflection**: Language should match calibrated confidence

**Quality criteria:**
- Reads as compelling strategic memo
- User's voice preserved in quotes
- Every paragraph earns its place
- Falsifiable and actionable
- Triggers are specific and monitorable

**Output format:**
```markdown
---
id: thesis-{session-id}
title: "{title}"
confidence: {0.XX}
triggers:
  - type: disconfirming
    condition: "..."
    fired: false
  - type: time_bound
    condition: "..."
    fired: false
created: {ISO timestamp}
updated: {ISO timestamp}
---

# {Title}

[Sharp opening paragraph stating the thesis - no throat-clearing]

## The Argument

[Main body with evidence organized for impact. User quotes integrated naturally:]

When asked about this directly, I noted: *"[Actual user quote from interview]"*

[Continue building the argument with @CLAIM-N references as needed]

## Evidence Supporting This

[Bullet points of key evidence, tied to source claims]

## The Strongest Objection

[Honestly engage the best counter-argument. Not a straw-man.]

As I acknowledged during our discussion: *"[User quote that shows genuine engagement with counter-evidence]"*

## What Would Change This

[Trigger conditions as checkboxes - these drive ongoing monitoring]

- [ ] If {specific observable condition}, reconsider
- [ ] If {metric moves to threshold}, confidence should decrease
- [ ] Revisit after {time-bound milestone}

---
*Confidence: {N}% - {one-line interpretation of confidence level}*
```

The final essay is a viewable `.md` file that captures the user's crystallized position with their own voice woven in.

---

## Synthesis Quality Checklist

Before finalizing thesis AND essay, verify:

- [ ] **Sharp**: One clear claim, not hedged into meaninglessness
- [ ] **Testable**: Explicit triggers that would falsify it
- [ ] **Grounded**: Evidence ties to specific session claims and positions
- [ ] **Balanced**: Includes both evidence for AND against
- [ ] **Calibrated**: Confidence reflects genuine uncertainty
- [ ] **Coherent**: Integrates tension resolutions sensibly
- [ ] **Actionable**: Has implications for decisions

---

## Anti-Patterns to Avoid

### 1. Thesis Drift
Rewriting the thesis to accommodate all evidence, including counter-evidence. If evidence challenges the thesis, either lower confidence or acknowledge it in evidence_against - don't reframe to make everything fit.

### 2. Unfalsifiable Formulation
"Markets could go up or down" is not a thesis. "Cloud" words (might, could, potentially) without specifics make theses untestable. Force concreteness.

### 3. Confidence Theater
Assigning high confidence to signal conviction rather than reflect calibrated uncertainty. A 0.95 thesis should be something you'd bet heavily on with your own money.

### 4. Missing Mechanism
Stating what without why. A thesis should include or imply the causal mechanism - why this is true, not just that it is.

### 5. Evidence Asymmetry
All evidence_for, no evidence_against. This is a red flag for confirmation bias. Force acknowledgment of counter-evidence and limitations.

### 6. Trigger-Free Thesis
No falsification conditions. If you can't specify what would make it wrong, it's not a thesis - it's an unfalsifiable belief.

---

## Integration with Thesis Management

After synthesis, the thesis integrates with the thesis-management skill:

1. **Storage**: Save to thesis library with domain categorization
2. **Monitoring**: Track triggers for potential updates
3. **Validation**: Periodic review against new evidence
4. **Versioning**: Archive if wrong, supersede if updated

The synthesis phase creates the thesis; thesis-management maintains it over time.

---

## System Prompt for Synthesis

```
You are a thesis synthesis agent. Your task is to crystallize a user's dialectic session into a structured, testable thesis.

## Your Role
Transform claims, positions, and tension resolutions into a single falsifiable thesis. The thesis must be:
- SHARP: Specific and testable, not hedged
- GROUNDED: Tied to session evidence
- FALSIFIABLE: Has explicit invalidation triggers
- CALIBRATED: Confidence reflects uncertainty honestly

## Multi-Pass Process

Pass 1 (Divergent): Generate 3-5 candidate thesis framings
Pass 2 (Convergent): Select strongest, structure rigorously
Pass 3 (Triggers): Identify specific falsification conditions

## Output
Return ONLY valid JSON with:
- title: 5-10 word description
- confidence: 0.0-1.0 per calibration rules
- core_belief: One testable sentence
- evidence_for: 2-5 supporting points
- evidence_against: 1-3 counter-evidence points
- triggers: 2-5 falsifiable conditions

## Critical
- Confidence is non-monotonic - it can decrease
- No triggers = unfalsifiable = bad thesis
- Include evidence_against - pure confirmation is suspicious
```

---

## Progression to FORMED State

Thesis is ready for FORMED state when:
- Core belief is sharp and falsifiable
- Evidence includes both for AND against
- Triggers are specific and observable
- Confidence is calibrated, not inflated
- User confirms synthesis captures their position

Not ready if:
- Thesis is too hedged to test
- No falsification triggers
- Evidence is one-sided
- Confidence seems uncalibrated
- User rejects the framing

---

## Export Formats

Synthesized theses can be exported in multiple formats:

### Markdown (for notes/docs)
```markdown
# {title}

**Confidence**: {percent}% [{visual bar}]
**Created**: {date}

## Core Belief
{core_belief}

## Evidence For
- {point 1}
- {point 2}

## Evidence Against
- {counter 1}

## What Would Change This
- [ ] {trigger 1}
- [ ] {trigger 2}
```

### YAML (for thesis library)
```yaml
id: {thesis-id}
status: active
confidence: 0.XX
created: {date}
domain: {inferred domain}
---
# {title}
...
```

The export format preserves the structured nature of the thesis while making it readable and actionable.
