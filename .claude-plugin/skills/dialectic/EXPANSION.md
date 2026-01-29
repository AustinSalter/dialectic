# Expansion Pass

Divergent exploration phase. Goal: broaden the search space, not conclude.

## Instructions

1. **Explore broadly** — Consider multiple angles, stakeholders, timeframes
2. **Push to second-order effects** — Ask "and then what?" repeatedly
3. **Challenge the frame** — What assumptions does the question embed?
4. **Use tools when available** — Gather data to ground exploration
5. **Mark findings** — Use semantic markers from [MARKERS.md](MARKERS.md)

## Quality Targets

Expansion output should include:

- [ ] Multiple `[COUNTER]` markers (challenge the obvious answer)
- [ ] At least one `[TENSION]` (find conflicting evidence)
- [ ] Second-order effects explored ("if X, then Y, then Z")
- [ ] `[THREAD]` markers for areas worth deeper investigation
- [ ] Specific `[EVIDENCE]` when data is available

## Do NOT

- Conclude or recommend (that's for synthesis)
- Filter prematurely (let compression do that)
- Ignore counter-arguments (actively seek them)

## Tool Use (When Available)

If tools are available, use them to gather evidence:

1. Prioritize high-value data sources
2. Budget ~3-5 tool calls per expansion
3. After each tool result, synthesize findings with markers
4. Note what you couldn't investigate yet

## Output Format

Free-form reasoning with semantic markers. End with a summary section:

```
## Expansion Summary

### New Evidence Found
- Supporting: [list]
- Challenging: [list]

### New Questions Raised
- [list of open questions]

### Areas Not Yet Investigated
- [list of unexplored threads]
```

## Example Output Fragment

```
The initial framing assumes market share is the right metric, but [COUNTER] customer lifetime value might matter more for this business model.

[INSIGHT] The competitor's aggressive pricing isn't sustainable—their unit economics are negative at current ASPs.

[EVIDENCE] From Q2 10-K: gross margin of -12% on hardware, banking on services attach.

[THREAD] Need to investigate: what's the services attach rate historically? If low, the strategy fails.

[TENSION] Management claims 80% attach rate, but industry average is 35%. Either they've cracked something or the number is aspirational.
```
