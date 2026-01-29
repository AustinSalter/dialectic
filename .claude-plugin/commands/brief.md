---
description: Session context management - resume, budget, compact, vault search
argument-hint: <command> [args]
---

# Brief - Context Management Commands

You are executing a session context management command. Parse the arguments and execute the appropriate action.

## Parse Arguments

The format is: `/brief <command> [args]`

Commands:
- `resume <session_id>` - Resume a session
- `budget` - Show current budget status
- `compact [--tier N]` - Trigger compression
- `vault <query>` - Search Obsidian vault

If no command provided, show help.

## Command: resume

**Arguments**: `<session_id>` (required)

Execute:
```bash
dialectic session resume $SESSION_ID
```

Parse the JSON output and format as a scratchpad:

```markdown
## Session: {title}

**Status**: {status}
**Confidence**: {thesis_confidence or "Not set"}
**Session ID**: {session_id}

---

### Core Claim (HEAD)

{scratchpad.core_claim or "No thesis established yet"}

### Triggers

{foreach scratchpad.triggers as trigger}
- {trigger}
{/foreach}

### Locked Intent

{scratchpad.locked_intent or "None"}

---

### Key Evidence

{scratchpad.key_evidence_count} items preserved

### Recent Sessions

{scratchpad.recent_sessions_count} session summaries available

---

### Suggested Action

{suggested_action}
```

## Command: budget

**Arguments**: None (uses active session from `.claude/dialectic/state.json`)

First, check if `.claude/dialectic/state.json` exists and read the session_id.

Execute:
```bash
dialectic session budget $SESSION_ID
```

Format the output with visual indicators:

```
## Budget Status

{status_emoji} **{pct}%** ({used:,} / {total:,} tokens) [{status}]

### Breakdown by Source

| Source | Used | Budget | % |
|--------|------|--------|---|
| Paper Trail | {paper_trail_used:,} | {paper_trail_budget:,} | {pct}% |
| Obsidian | {obsidian_used:,} | {obsidian_budget:,} | {pct}% |
| Reference | {reference_used:,} | {reference_budget:,} | {pct}% |
```

Status emoji mapping:
- `normal` → checkmark
- `auto_compress` → orange diamond
- `warn_user` → warning sign
- `force_compress` → stop sign

## Command: compact

**Arguments**: `[--tier N]` (optional, default: auto-detect)

Execute:
```bash
dialectic compress suggest $SESSION_ID
```

Show the compression opportunities:

```markdown
## Compression Analysis

**Budget Status**: {budget_status}
**Potential Tokens Freeable**: {tokens_freeable:,}

### Triggers

{foreach triggers as trigger}
- {trigger}
{/foreach}

### Recommended Action

{Based on triggers, recommend specific compression action}
```

If `--tier N` specified, target that specific tier for compression.

## Command: vault

**Arguments**: `<query>` (required)

Execute:
```bash
dialectic vault search "$QUERY"
```

Format results:

```markdown
## Vault Search: "{query}"

{foreach results as result}
### {result.title}
**Path**: `{result.path}`
**Relevance**: {result.relevance * 100}%
**Tokens**: {result.token_count:,}

{result.summary}

---
{/foreach}
```

## Command: help (default)

If no command or invalid command:

```markdown
## /brief - Context Management

| Command | Purpose |
|---------|---------|
| `/brief resume <id>` | Resume session, inject scratchpad |
| `/brief budget` | Show current budget status |
| `/brief compact [--tier N]` | Trigger compression |
| `/brief vault <query>` | Search Obsidian vault |

### Examples

```
/brief resume 01HXYZ...
/brief budget
/brief compact --tier 4
/brief vault "strategic planning"
```

See `.claude/skills/brief/SKILL.md` for full documentation.
```

## Error Handling

If the CLI command fails:
1. Show the error message from JSON output
2. Suggest common fixes (session doesn't exist, vault not configured, etc.)
3. Point to help command for usage

## Session State

Active session is stored in `.claude/dialectic/state.json`. If this file doesn't exist:
- For `resume`: use the provided session_id
- For `budget` and `compact`: prompt user to specify session or run `/brief resume <id>` first
