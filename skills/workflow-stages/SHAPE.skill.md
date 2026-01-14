# SHAPE Stage - Dialectic Interview

## Purpose
Generate probing questions that force the user to take a strategic position on extracted claims. The goal is to surface implicit assumptions and establish conviction levels.

## Activation
- GATHER stage complete (claims extracted)
- Session transitions to "exploring" state
- User has reviewed source material

## Question Design Philosophy

### Force Position-Taking
Questions must require the user to commit to a perspective. Avoid:
- Yes/no questions
- Opinion polls ("Do you agree?")
- Comprehension checks

Instead use:
- "How would you act on @CLAIM-1?"
- "What does @CLAIM-2 imply for your thesis?"
- "If @CLAIM-3 is true, what follows?"

### Reference Specific Claims
Every question must reference a specific claim via `@CLAIM-N`:
- Creates explicit link to source material
- Enables highlight on hover/click
- Tracks which claims have been addressed

### Substantive Options
Options represent distinct strategic perspectives:

| Option Type | Purpose | Example |
|-------------|---------|---------|
| Conviction | Signal strength | "Strong signal", "Weak signal", "Noise" |
| Action | What to do | "Act now", "Monitor", "Hedge", "Ignore" |
| Frame | How to interpret | "Structural shift", "Cyclical", "Idiosyncratic" |
| Time | When relevant | "Short-term play", "Long-term thesis", "Already priced" |

### Implicit "Other"
Every question has an implicit "Other" option that triggers free-text input. Do not include "Other" in the options array.

## Multi-Pass Generation

### Pass 1: Claim Prioritization
Rank claims by interview value:
1. Core thesis claims (must address)
2. Counter claims (surface tensions)
3. Framework claims (establish lens)
4. Meta claims (if decision-relevant)

Select 2-4 claims for interview questions.

### Pass 2: Question Formulation
For each selected claim:
1. What decision does this claim inform?
2. What are the distinct positions one could take?
3. What would change if the user confirmed vs challenged it?

Generate question with 3-5 options.

### Pass 3: Balance Check
Ensure question set:
- Covers different claim types
- Offers variety in option types
- Doesn't lead toward a predetermined conclusion

## System Prompt

```
You are a dialectic interview assistant. Your task is to generate probing questions that force the user to take a strategic position on claims extracted from source material.

## Output Format
Return ONLY valid JSON array. No markdown, no explanation.

## Question Design Principles
1. Each question must reference a specific claim via @CLAIM-N
2. Options must represent distinct strategic perspectives (NOT yes/no)
3. Options should capture different ways to interpret or act on the claim
4. Include at least one option that challenges or nuances the claim
5. Generate 2-4 questions total, prioritizing the most decision-relevant claims

## Option Types (vary across questions)
- Conviction levels: "Strong signal", "Weak signal", "Noise"
- Action orientations: "Act now", "Monitor", "Hedge", "Ignore"
- Interpretation frames: Different ways to read the claim
- Time horizons: "Short-term play", "Long-term thesis", "Structural shift"

## JSON Schema
[
  {
    "id": "Q1",
    "text": "Question text referencing @CLAIM-N",
    "claim_ref": "CLAIM-1",
    "options": [
      { "label": "Short label", "description": "Optional longer description" },
      { "label": "Another position" },
      { "label": "Third perspective" }
    ]
  }
]

CRITICAL:
- claim_ref must match an existing claim ID exactly
- Options should be 3-5 substantive positions, not yes/no
- Question text should include @CLAIM-N reference
- "Other" is implicit and always available - don't include it
```

## Output Format

```json
[
  {
    "id": "Q1",
    "text": "How do you read @CLAIM-1's assertion that capital is rotating out of US assets?",
    "claim_ref": "CLAIM-1",
    "options": [
      { "label": "Structural shift", "description": "Long-term realignment underway" },
      { "label": "Cyclical correction", "description": "Normal rebalancing, will reverse" },
      { "label": "Narrative not data", "description": "Media amplification, not actual flows" },
      { "label": "Too early to tell", "description": "Signal unclear, need more data" }
    ]
  },
  {
    "id": "Q2",
    "text": "@CLAIM-3 suggests China's strategy differs fundamentally from US approach. Does this change your portfolio thesis?",
    "claim_ref": "CLAIM-3",
    "options": [
      { "label": "Yes, increase EM exposure" },
      { "label": "No, framework is flawed" },
      { "label": "Hedged - both could be right" },
      { "label": "Orthogonal to my thesis" }
    ]
  }
]
```

## Position Classification

User responses are classified into position types:

| Type | Description | Indicators |
|------|-------------|------------|
| `confirms` | User agrees/strengthens the claim | "Strong signal", "Act now", "High conviction" |
| `challenges` | User disagrees/weakens the claim | "Noise", "Ignore", "Flawed", "Skeptical" |
| `nuances` | User adds complexity | "Hedge", "Monitor", "Depends", "Partially" |

Classification enables:
- Tension detection (claim has both confirms and challenges)
- Conviction scoring (weighted by position types)
- Thesis synthesis (combine positions into coherent view)

## @ Reference Integration

Questions containing `@CLAIM-N` enable interactive highlighting:
- Rendering: Parse `@CLAIM-N` in question text, wrap in clickable span
- On click: Scroll SourceViewer to claim's quote_start position
- On hover: Show claim snippet as tooltip
- Visual: Different color per claim type (matches ClaimCard)

## Evaluation Criteria

Loop until:
- 2-4 questions generated
- Each question references a valid claim via @CLAIM-N
- Each question has 3-5 substantive options
- Options represent distinct positions (not variations of same)
- No yes/no or agree/disagree options
- Question set covers different claim types

## Error Handling

If generation fails:
1. Log raw Claude response for debugging
2. Attempt JSON repair (strip markdown fences)
3. Fallback: Generate single generic question for core_thesis claim
4. UI shows reduced question set with warning

### Pass 3: Draft Essay Generation

Using the claims and prioritized questions, generate a **first-draft essay** that:

1. **Opens with tension**: Lead with the core tension or insight from the source
2. **Weaves in claims as evidence**: Reference @CLAIM-N tags as supporting points
3. **Leaves placeholders for user quotes**: Mark where user responses will strengthen the argument
4. **Ends with open questions**: What the interview will explore

Output format:
```
## Essay

[500-800 word rough draft with the following structure:]

### Opening Hook
[State the core tension or insight that makes this worth reading]

### The Argument
[Main thesis with @CLAIM-N references as evidence]

[USER_QUOTE: Position on @CLAIM-1 will go here]

### Complications
[Acknowledge tensions or counterarguments from the source]

[USER_QUOTE: How user resolved tension X]

### Open Questions
[What remains uncertain - these drive the interview]

---

## Interview Questions
[JSON array of questions as defined above]
```

The essay is rough and incomplete by design - it will be refined as user quotes are captured in CRITIQUE and polished in SYNTHESIZE.

## Next Stage
After all questions answered, transition to CRITIQUE stage:
- Collect all positions and user quotes
- Identify tensions (conflicting positions)
- Weave user quotes into essay draft
- Stress-test the emerging thesis
