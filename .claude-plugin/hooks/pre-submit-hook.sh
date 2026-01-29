#!/bin/bash
# Dialectic Pre-Submit Hook
# Injects budget status at the start of every turn when a session is active

STATE_DIR=".claude/dialectic"
STATE_FILE="$STATE_DIR/state.json"

# Check if dialectic session is active
if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No active session, nothing to inject
fi

# Read session_id from state
SESSION_ID=$(jq -r '.session_id // ""' "$STATE_FILE" 2>/dev/null)

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  exit 0  # No session_id, skip
fi

# Extract just the ID part if it includes "sess_" or "dialectic-" prefix
SESSION_ID=$(echo "$SESSION_ID" | sed -E 's/^(sess_|dialectic-)//')

# Try to get budget from CLI
# Note: dialectic binary must be in PATH or we use a relative path
DIALECTIC_BIN="${DIALECTIC_BIN:-dialectic}"

# Check if dialectic CLI is available
if ! command -v "$DIALECTIC_BIN" &> /dev/null; then
  # Try the local target directory
  DIALECTIC_BIN="./packages/desktop/src-tauri/target/debug/dialectic"
  if [ ! -x "$DIALECTIC_BIN" ]; then
    # Fallback: just show session is active
    echo "Session: $SESSION_ID (budget check unavailable)"
    exit 0
  fi
fi

# Get budget status
BUDGET_JSON=$("$DIALECTIC_BIN" session budget "$SESSION_ID" 2>/dev/null)

if [ $? -ne 0 ]; then
  # CLI failed, show minimal info
  echo "Session: $SESSION_ID (budget check failed)"
  exit 0
fi

# Parse JSON output
PCT=$(echo "$BUDGET_JSON" | jq -r '.pct // 0')
USED=$(echo "$BUDGET_JSON" | jq -r '.used // 0')
TOTAL=$(echo "$BUDGET_JSON" | jq -r '.total // 72000')
STATUS=$(echo "$BUDGET_JSON" | jq -r '.status // "normal"')

# Format used/total with thousands separator
USED_FMT=$(printf "%'d" "$USED" 2>/dev/null || echo "$USED")
TOTAL_FMT=$(printf "%'d" "$TOTAL" 2>/dev/null || echo "$TOTAL")

# Status emoji and indicator
case "$STATUS" in
  "normal")
    EMOJI="✓"
    ;;
  "auto_compress" | "autocompress")
    EMOJI="🔶"
    ;;
  "warn_user" | "warnuser")
    EMOJI="⚠️"
    ;;
  "force_compress" | "forcecompress")
    EMOJI="⛔"
    ;;
  *)
    EMOJI="•"
    ;;
esac

# Output single-line budget status
echo "$EMOJI BUDGET: $PCT% ($USED_FMT/$TOTAL_FMT tokens) [$STATUS]"

exit 0
