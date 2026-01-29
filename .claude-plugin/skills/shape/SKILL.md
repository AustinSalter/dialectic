---
name: shape
description: Generate probing questions that force position-taking on extracted claims. Creates interview questions and a draft essay structure. Use after /gather completes.
argument-hint: [session-id]
---

# SHAPE Stage - Dialectic Interview

## Purpose
Generate probing questions that force the user to take a strategic position on extracted claims. The goal is to surface implicit assumptions and establish conviction levels.

## Activation
- GATHER stage complete (claims extracted)
- Session transitions to "exploring" state

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

### Pass 3: Draft Essay Generation
Using the claims and prioritized questions, generate a **first-draft essay** that:

1. **Opens with tension**: Lead with the core tension or insight from the source
2. **Weaves in claims as evidence**: Reference @CLAIM-N tags as supporting points
3. **Leaves placeholders for user quotes**: Mark where user responses will strengthen the argument
4. **Ends with open questions**: What the interview will explore

## Output Format

```json
{
  "questions": [
    {
      "id": "Q1",
      "text": "How do you read @CLAIM-1's assertion?",
      "claim_ref": "CLAIM-1",
      "options": [
        { "label": "Structural shift", "description": "Long-term realignment underway" },
        { "label": "Cyclical correction", "description": "Normal rebalancing, will reverse" },
        { "label": "Narrative not data", "description": "Media amplification, not actual flows" }
      ]
    }
  ],
  "essay_draft": "## Opening Hook\n[State the core tension]...\n\n[USER_QUOTE: Position on @CLAIM-1 will go here]"
}
```

## Position Classification

User responses are classified into position types:

| Type | Description | Indicators |
|------|-------------|------------|
| `confirms` | User agrees/strengthens the claim | "Strong signal", "Act now", "High conviction" |
| `challenges` | User disagrees/weakens the claim | "Noise", "Ignore", "Flawed", "Skeptical" |
| `nuances` | User adds complexity | "Hedge", "Monitor", "Depends", "Partially" |

## Next Stage

After all questions answered, transition to `/critique` to identify tensions.
