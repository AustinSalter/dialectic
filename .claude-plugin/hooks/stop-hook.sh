#!/bin/bash
# Dialectic Reasoning Stop Hook
# Blocks exit and re-feeds prompt until CONCLUDE or max iterations

STATE_DIR=".claude/dialectic"
STATE_FILE="$STATE_DIR/state.json"
PROMPT_FILE="$STATE_DIR/prompt.md"

# Check if dialectic loop is active
if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No active loop, allow exit
fi

# Read state
DECISION=$(jq -r '.decision // ""' "$STATE_FILE" 2>/dev/null)
ITERATION=$(jq -r '.iteration // 0' "$STATE_FILE" 2>/dev/null)
MAX_ITERATIONS=$(jq -r '.max_iterations // 5' "$STATE_FILE" 2>/dev/null)
CONFIDENCE=$(jq -r '.thesis.confidence // 0' "$STATE_FILE" 2>/dev/null)
THESIS=$(jq -r '.thesis.current // ""' "$STATE_FILE" 2>/dev/null | head -c 100)

# Check for completion
if [ "$DECISION" = "conclude" ] || [ "$DECISION" = "CONCLUDE" ]; then
  echo ""
  echo "================================================"
  echo "  Dialectic reasoning complete!"
  echo "  Final confidence: $CONFIDENCE"
  echo "  Iterations: $ITERATION"
  echo "================================================"
  rm -rf "$STATE_DIR"
  exit 0
fi

# Check iteration limit
if [ "$ITERATION" -ge "$MAX_ITERATIONS" ]; then
  echo ""
  echo "================================================"
  echo "  Max iterations reached ($ITERATION/$MAX_ITERATIONS)"
  echo "  Running escape hatch for final synthesis..."
  echo "================================================"
  # Update decision to conclude so next pass does synthesis
  jq '.decision = "conclude"' "$STATE_FILE" > "$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"

  echo ""
  echo "Continue the dialectic reasoning cycle. Max iterations reached - run ESCAPE-HATCH and SYNTHESIS passes. Read state from .claude/dialectic/state.json."
  echo ""

  exit 1  # One more pass for synthesis
fi

# Continue loop - increment iteration and re-feed
NEW_ITERATION=$((ITERATION + 1))
jq ".iteration = $NEW_ITERATION" "$STATE_FILE" > "$STATE_FILE.tmp"
mv "$STATE_FILE.tmp" "$STATE_FILE"

echo ""
echo "================================================"
echo "  Dialectic iteration $NEW_ITERATION / $MAX_ITERATIONS"
echo "  Current confidence: $CONFIDENCE"
echo "  Thesis: ${THESIS}..."
echo "  Decision: $DECISION -> continuing"
echo "================================================"
echo ""
echo "Continue the dialectic reasoning cycle. Read state from .claude/dialectic/state.json and proceed with iteration $NEW_ITERATION."
echo ""

exit 1  # Block exit, continue loop
