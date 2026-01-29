# Scratchpad Format Reference

The scratchpad is the working memory injected when resuming a session.

## Format

```markdown
## Session: {title}

**Status**: {backlog|exploring|tensions|synthesizing|formed}
**Confidence**: {0.0-1.0}
**Last Updated**: {ISO timestamp}

---

### Core Claim (HEAD)

{The current thesis statement - always loaded, never compressed}

### Triggers

What would change this thesis:
- {trigger 1}
- {trigger 2}
- {trigger 3}

### Locked Intent

{Optional: constraints that must be preserved regardless of analysis direction}

---

### Key Evidence ({count} items)

Verbatim claims marked [KEY]:

1. **{source}**: "{verbatim quote}"
   - Why key: {reason}

2. **{source}**: "{verbatim quote}"
   - Why key: {reason}

---

### Recent Sessions ({count})

Brief summaries of last 2-3 reasoning traces:

**Session {date}**: {one-line summary}
- Key outcome: {decision/insight}

---

### Suggested Action

Based on current status ({status}):

{Action recommendation tailored to session phase}
```

## Tier Loading

| Tier | Content | Tokens | When Loaded |
|------|---------|--------|-------------|
| HEAD | Core claim, triggers, locked intent | ~500 | Always |
| KEY_EVIDENCE | Verbatim [KEY] claims | ~1,500 | Always |
| RECENT | Last 2-3 session traces | ~3,000 | If relevant |
| HISTORICAL | Older compressed summaries | ~1,000 | On demand |
| ARCHIVED | Full logs (not in context) | 0 | Searchable only |

## Example Scratchpad

```markdown
## Session: Product Market Fit for AI Code Tools

**Status**: exploring
**Confidence**: 0.62
**Last Updated**: 2024-01-15T14:30:00Z

---

### Core Claim (HEAD)

AI code tools will commoditize within 18 months, making UX and workflow integration
the primary differentiators rather than model capability.

### Triggers

What would change this thesis:
- Evidence of sustainable model capability moats (fine-tuning, proprietary data)
- Major developer platform lock-in (GitHub/VS Code exclusive features)
- Regulatory barriers creating compliance advantages

### Locked Intent

Focus on B2B developer tools market. Consumer/hobbyist segment out of scope.

---

### Key Evidence (2 items)

1. **Gartner 2024 Report**: "By 2026, 80% of enterprise developers will use AI assistants,
   but differentiation will shift from accuracy to workflow integration."
   - Why key: Authoritative source on commoditization timeline

2. **Stack Overflow Survey**: "Developers cite context switching, not model quality,
   as primary friction with current AI tools."
   - Why key: Validates UX hypothesis over model capability

---

### Recent Sessions (1)

**2024-01-14**: Explored competitive landscape of AI code tools
- Key outcome: Identified 3 distinct positioning strategies (IDE-native, cloud-native, hybrid)

---

### Suggested Action

Based on current status (exploring):

Continue /dialectic exploration to identify tensions between commoditization thesis
and evidence of potential moats. Specifically explore: fine-tuning economics and
whether workflow integration itself becomes commoditized.
```
