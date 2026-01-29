# Escape Hatch Pass

Honest acknowledgment when analysis cannot reach confident conclusion. Intellectual honesty is valuable.

## When to Trigger

Escape hatch activates when:
- Max iterations reached AND confidence < 0.5
- Analysis is stuck in unresolvable tension
- Required data is fundamentally unavailable

## Required Sections

### 1. Information Gap

What specific data would you need to reach a confident conclusion?

**Be specific**: "Quarterly unit economics broken down by product line" not "more financial data."

### 2. Unresolvable Tension

What conflicting evidence or logic could not be reconciled?

Explain why the tension couldn't be resolved with available information.

### 3. Model Limitation

What aspects of this problem are beyond current analysis capability?

- Data access limitations
- Expertise gaps
- Inherent unpredictability

### 4. Best Estimate

Given the uncertainty, what is your best guess?

Include explicit caveats. This is not a confident recommendation—it's a directional indication.

### 5. Decision Recommendation

Should the decision-maker:
- **Wait**: Specific data or event that would enable confident analysis
- **Hedge**: Action that performs reasonably across scenarios
- **Accept uncertainty**: Proceed with known risks

## Blocked Token

End escape hatch analysis with exactly:

```
[ANALYSIS_BLOCKED]
```

This signals the analysis could not reach confident conclusion. No text after this token.

## What NOT to Say

- "More research needed" (too vague—name the exact data source)
- "It depends" (specify what it depends on)
- "This is complex" (complexity is why you're being asked)

## Example Structure

```markdown
## Analysis Blocked

This analysis reached maximum iterations without achieving sufficient confidence.

## Information Gap

To reach a confident conclusion, I would need:
1. [Specific data source and what it would reveal]
2. [Specific data source and what it would reveal]

## Unresolvable Tension

The analysis could not reconcile:
- [Evidence A suggesting X]
- [Evidence B suggesting not-X]

These cannot be resolved because [specific reason—e.g., data is not publicly available, requires future information, etc.]

## Model Limitation

This analysis is limited by:
- [Specific limitation]

## Best Estimate (Low Confidence)

Given available evidence, the most likely scenario is [X], but confidence is only [0.XX] because [reason].

## Recommendation

Given the uncertainty, I recommend:
- [Specific action: wait for Y, hedge via Z, or proceed with caution]

[ANALYSIS_BLOCKED]
```
