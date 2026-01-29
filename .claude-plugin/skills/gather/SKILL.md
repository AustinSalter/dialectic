---
name: gather
description: Extract key claims from source material with exact quote positions for @ reference highlighting. Use at the start of a session after ingesting source material.
argument-hint: [source-file or URL]
---

# GATHER Stage - Claim Extraction

## Purpose
Extract key claims from source material with exact quote positions for @ reference highlighting.

## Activation
- User runs `/gather` with source material
- Source text has been fetched and parsed

## Multi-Pass Extraction

### Pass 1: Divergent Scan
Read the full source and identify candidate claims using semantic markers:

```
[CLAIM] Central argument about X
[EVIDENCE] Supporting quote: "..."
[FRAMEWORK] Mental model being used
[COUNTER] Tension or counterpoint
```

Look for:
- Core thesis statements (what is the author arguing?)
- Frameworks or mental models (what lens are they using?)
- Meta observations (what are they saying about discourse itself?)
- Counterarguments (what tensions do they acknowledge?)

### Pass 2: Convergent Selection
From candidates, select 3-7 most decision-relevant claims:

Priority order:
1. Core thesis (always include at least one)
2. Frameworks that shape interpretation
3. Counter-arguments that create tension
4. Meta observations if particularly salient

### Pass 3: Quote Extraction
For each selected claim:
1. Find the EXACT verbatim quote in source text
2. Calculate character offsets (quote_start, quote_end)
3. Verify snippet is substring of source

## Output Format

```json
[
  {
    "id": "CLAIM-1",
    "text": "Summary of the claim in analyst's words (1-2 sentences)",
    "type": "core_thesis",
    "snippet": "Exact verbatim quote from source text",
    "quote_start": 1234,
    "quote_end": 1456
  }
]
```

## Claim Types

| Type | Description | Example |
|------|-------------|---------|
| `core_thesis` | Central argument or main point | "The Great Rotation is underway" |
| `framework` | Mental model or analytical lens | "Hammer vs rising sea" |
| `meta` | Commentary about discourse itself | "The consensus has shifted" |
| `counter` | Counterargument or tension | "However, this assumes..." |

## Evaluation Criteria

Loop until:
- 3-7 claims extracted
- Each claim has a valid type
- Each snippet is an EXACT substring of source text
- Character offsets are correct (verified by substring check)
- At least one core_thesis claim exists
- Claims cover diverse aspects (not all same type)

## @ Reference Integration

The extracted claims enable @ reference highlighting:
- User sees `@CLAIM-1` in chat/terminal
- Clicking scrolls SourceViewer to quote_start position
- Passage from quote_start to quote_end is highlighted

## Next Stage

After GATHER, transition to `/shape` to generate interview questions.
