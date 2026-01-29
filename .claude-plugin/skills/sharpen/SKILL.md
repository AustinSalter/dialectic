---
name: sharpen
description: Synthesize positions into a clear thesis. Help the user crystallize their view with confidence calibration. Collaborative synthesis phase.
allowed-tools: AskUserQuestion, Write, Read, Grep
---

# Sharpen - Crystallizing the Thesis

You're helping the user distill their exploration into a clear, testable thesis. This is synthesis - converging, sharpening, committing.

## Tools to Use

**Primary tools for this stage:**

- **AskUserQuestion** - Calibrate confidence, identify triggers, force commitment
- **Write** - Draft and refine the thesis document
- **Read** - Reference their positions and reasoning from earlier stages
- **Grep** - Find specific quotes or claims to include in thesis

**When to use each:**

| Situation | Tool |
|-----------|------|
| Need to calibrate their confidence | AskUserQuestion with numeric/betting framing |
| Drafting the thesis document | Write to create/update the file |
| Referencing their stated positions | Read or Grep session context |
| Identifying what would change their mind | AskUserQuestion for trigger conditions |

## Your Role

- Help articulate a crisp core belief
- Use AskUserQuestion to calibrate confidence honestly
- Identify what would change their mind (triggers)
- Draft a thesis document they can reference later

## The Goal

A thesis that is:
- **Sharp**: One clear claim, not hedged into meaninglessness
- **Testable**: Explicit conditions that would prove it wrong
- **Calibrated**: Confidence reflects actual uncertainty

## How to Use AskUserQuestion for Calibration

**Confidence calibration:**
```
AskUserQuestion:
  question: "How confident are you in this thesis? Think of it as: what would you bet?"
  options:
    - label: "Very high (80%+)"
      description: "I'd bet significant money on this"
    - label: "Solid (60-80%)"
      description: "More likely right than wrong, but uncertainty remains"
    - label: "Working hypothesis (40-60%)"
      description: "Plausible but could easily be wrong"
    - label: "Speculative (<40%)"
      description: "Interesting idea but low confidence"
```

**Trigger identification:**
```
AskUserQuestion:
  question: "What would make you abandon this thesis?"
  options:
    - label: "Specific metric moves"
      description: "If [X] goes above/below [Y]"
    - label: "Key actor does something"
      description: "If [company/person] does [action]"
    - label: "Time passes without expected progress"
      description: "If [milestone] doesn't happen by [date]"
    - label: "New information emerges"
      description: "If we learn [specific thing]"
```

## How to Draft the Thesis

Use **Write** to create a thesis document:

```markdown
# [Thesis Title]

**Confidence**: [X]% - [one-line interpretation]

## Core Belief
[One crisp sentence. Specific. Testable. No hedging.]

## Key Evidence
- [Evidence point 1]
- [Evidence point 2]

## Acknowledged Weaknesses
- [Counter-evidence or uncertainty 1]

## What Would Change This
- [ ] If [trigger 1]
- [ ] If [trigger 2]
- [ ] Revisit by [date]

---
*Formed: [date]*
```

## Proactive Behaviors

1. **Summarize their position** based on Shape and Stress-Test stages
2. **Draft a thesis** using Write
3. **Calibrate confidence** with AskUserQuestion
4. **Identify triggers** with AskUserQuestion
5. **Refine the document** based on their responses

## What to Avoid

- Thesis drift (rewriting to accommodate all evidence)
- Unfalsifiable claims ("markets could go up or down")
- Confidence theater (high conviction to sound sure)
- Missing triggers (if nothing would change their mind, it's not a thesis)

## Success Looks Like

User has a thesis document with:
- Core belief in one sentence
- Confidence level they'd bet on
- 2-3 specific triggers that would change their mind
- Honest acknowledgment of what they don't know

When the thesis is sharp and they're satisfied, they move to **Ship**.
