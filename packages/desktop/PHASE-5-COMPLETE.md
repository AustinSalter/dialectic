# Phase 5: Structured Logging (tracing) — Complete

## What Changed

Added structured `tracing` calls across all 10 Rust backend modules that previously had zero or minimal observability. Every `eprintln!` call (4 total) has been replaced with proper tracing macros.

### Files Modified (10 files, ~70 log points added)

| File | Lines | Prior tracing | Added |
|------|-------|---------------|-------|
| `chroma/sidecar.rs` | 380 | 0 | 12 calls (info/warn/error/debug) |
| `chroma/client.rs` | 435 | 0 | 11 calls (info/warn/error/debug) |
| `chroma/collections.rs` | 147 | 0 | 2 calls (info/debug) |
| `chroma/search.rs` | 272 | 1 eprintln! | 6 calls (info/warn/debug); replaced eprintln! |
| `chroma/memory.rs` | 377 | 0 | 8 calls (info/warn/debug) |
| `documents/retriever.rs` | 762 | 1 eprintln! | 9 calls (info/warn/debug); replaced eprintln! |
| `terminal.rs` | 321 | 0 | 6 calls (info/warn/debug/trace) |
| `session.rs` | 725 | 2 warns | 8 calls (info/warn/debug) |
| `obsidian/indexer.rs` | 510 | 2 eprintln! | 2 calls (info/warn); replaced both eprintln! |
| `obsidian/query.rs` | 441 | 0 | 2 calls (debug) |

### Files NOT Touched (as planned)

- `main.rs` — already has subscriber init + 1 error call
- `watcher.rs` — already fully instrumented (6 calls)
- `bin/dialectic.rs` — 2 `println!` calls are intentional CLI stdout output
- `Cargo.toml` — `tracing` and `tracing-subscriber` already present

## Pattern Used

Followed `watcher.rs` style throughout:
- Structured fields: `tracing::info!(session_id = %id, count = n, "Message")`
- `%` for Display, `?` for Debug
- No `#[instrument]` — explicit calls only
- Level guidelines: `error` for failures, `warn` for degraded paths/destructive ops, `info` for lifecycle events, `debug` for queries/status, `trace` for high-frequency write ops

## Deviations from Plan

1. **sidecar.rs `start_sidecar`**: The plan called for logging pid/port/persist_dir inside the `start_sidecar` public function. Since `ChromaSidecar::start()` doesn't return pid, the log was placed after `sc.start()` succeeds, reading pid from `sc.process`.

2. **terminal.rs command display**: `config.command` is moved into `CommandBuilder`, so `cmd_display` is captured before the match to avoid a borrow-after-move error.

3. **Log placement**: Some logs (e.g., `remove_reference`, `clear_ephemeral`, `clear_session`) are placed at function entry rather than after completion, since the operations are best-effort with no meaningful return value to log.

## Verification

### Compilation
```
cargo check  # from packages/desktop/src-tauri/ — clean (warnings only, pre-existing)
```

### No eprintln! remaining
```
grep -rn "eprintln!" src/  # returns 0 results
```

### println! only in CLI binary
```
grep -rn "println!" src/  # returns only bin/dialectic.rs lines (intentional CLI output)
```

### Runtime verification
Set `RUST_LOG=dialectic=debug` to see structured logs for:
- Sidecar start/health/stop lifecycle
- Collection init and queries
- Session create/load/list/delete
- Terminal spawn/kill
- Memory read/write/clear
- Document retrieval with Chroma/fallback path
- Obsidian indexing and search
