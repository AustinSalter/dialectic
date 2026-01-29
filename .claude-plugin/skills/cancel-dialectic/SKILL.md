---
name: cancel-dialectic
description: Cancel active dialectic reasoning loop
disable-model-invocation: true
---

# Cancel Dialectic Reasoning

Clean up and exit the dialectic reasoning loop.

## Steps

1. Check if `.claude/dialectic/` directory exists
2. If it exists:
   - Read `.claude/dialectic/state.json` to report current iteration and confidence
   - Remove the entire `.claude/dialectic/` directory
   - Confirm cancellation to user with summary of where analysis stopped
3. If it doesn't exist:
   - Inform user that no active dialectic loop was found

## Example Output

```
Dialectic loop cancelled.

Session: dialectic-1706384400
Stopped at: Iteration 3/5
Last confidence: 0.72
Last thesis: "NVIDIA's datacenter dominance..."

State files cleaned up. You can start a new /dialectic session.
```

This allows normal session exit without the stop hook re-feeding.
