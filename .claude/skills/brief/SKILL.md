---
name: brief
description: Session context management for Dialectic. Resume sessions, check budget status, trigger compression, and search the Obsidian vault. Use when managing context across reasoning sessions.
---

# Brief - Session Context Management

Quick reference commands for session management, budget monitoring, and vault search.

## Commands

| Command | Purpose | CLI Backend |
|---------|---------|-------------|
| `/brief resume <id>` | Resume session, inject scratchpad | `dialectic session resume <id>` |
| `/brief budget` | Show current budget status | `dialectic session budget <id>` |
| `/brief compact [--tier N]` | Trigger compression | `dialectic compress suggest <id>` |
| `/brief vault <query>` | Search Obsidian vault | `dialectic vault search "<query>"` |

## Architecture

```
/brief skill → shells out to → dialectic CLI → reads session files / calls lib
```

The CLI binary (`dialectic`) provides JSON output that the skill formats for human display.

## Usage

### Resume a Session

```
/brief resume 01HXYZ...
```

Loads session context including:
- Current thesis and confidence
- Paper trail HEAD (core claim, triggers, locked intent)
- Key evidence count
- Suggested next action based on session status

### Check Budget

```
/brief budget
```

Shows:
- Total tokens used vs available
- Usage percentage with status indicator
- Breakdown by source (paper trail, obsidian, reference)
- Threshold warnings if applicable

### Compact Context

```
/brief compact
/brief compact --tier 4
```

Analyzes compression opportunities:
- Sessions eligible for summarization (7-day rule)
- Summaries eligible for archival (30-day rule)
- Forced compression if budget pressure exists

### Search Vault

```
/brief vault "strategic planning"
```

Searches the configured Obsidian vault:
- Returns notes ranked by relevance
- Respects token budget
- Shows title, path, and summary preview

## Session State

Active session ID is stored in `.claude/dialectic/state.json`:

```json
{
  "session_id": "sess_01HXYZ..."
}
```

If no active session, commands will prompt to select or create one.

## Budget Thresholds

| Percentage | Status | Action |
|------------|--------|--------|
| < 70% | Normal | No action needed |
| 70-84% | Auto Compress | Tier 4 auto-compressed |
| 85-94% | Warn User | Alert shown, suggest manual compression |
| 95%+ | Force Compress | Automatic aggressive compression |

## Working Memory Format

When resuming, the scratchpad provides:

```
## Session: {title}
Status: {status} | Confidence: {confidence}

### Core Claim
{thesis head}

### Triggers (what would change this thesis)
- {trigger 1}
- {trigger 2}

### Key Evidence
{count} items preserved

### Suggested Action
{action based on session status}
```

## Related Skills

- `/dialectic` - Multi-pass reasoning (uses brief for context)
- `/cancel-dialectic` - Stop active reasoning loop
