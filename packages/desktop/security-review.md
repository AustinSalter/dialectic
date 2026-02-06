# Dialectic Security Review

**Date:** 2026-02-05
**Scope:** Full codebase — Rust backend (`src-tauri/src/`) and TypeScript frontend (`src/`)
**Purpose:** Assess readiness for desktop distribution to friends/early users

---

## What Was Fixed (This Review)

| Fix | Severity | Files |
|-----|----------|-------|
| Content Security Policy enabled | CRITICAL | `tauri.conf.json` |
| Session ID validation (`validate_session_id`) | CRITICAL | `session.rs` |
| Terminal command allowlist (shells + claude only) | CRITICAL | `terminal.rs` |
| API key moved to sessionStorage (in-memory only) | CRITICAL | `claude.ts`, `storage.ts` |
| **BYOK pipeline removed (11 files deleted)** | **CRITICAL** | `claude.ts`, `ingest.ts`, `interview.ts`, `tensions.ts`, `chat.ts`, `draft.ts`, `synthesis.ts`, `skillExecutor.ts`, `triggerMonitor.ts`, `tools.ts`, `Chat/index.ts`, `storage.ts` |
| `rehype-sanitize` added to ReactMarkdown | HIGH | `Entry.tsx`, `DocumentViewer.tsx` |
| Path containment in document chunker/retriever | HIGH | `chunker.rs`, `retriever.rs` |
| Path containment in Obsidian note read | HIGH | `query.rs` |
| Obsidian vault config canonicalized + home-dir check | HIGH | `indexer.rs` |
| Obsidian watcher validated against configured vault | HIGH | `watcher.rs` |
| Session watcher directory canonicalized | HIGH | `watcher.rs` |
| Terminal working directory canonicalized | HIGH | `terminal.rs` |
| Session working directory canonicalized | HIGH | `session.rs` |
| UTF-8 safe string truncation (2 locations) | MEDIUM | `indexer.rs`, `query.rs` |
| `bytes` crate updated (RUSTSEC-2026-0007) | MEDIUM | `Cargo.lock` |
| `default-run = "dialectic-tauri"` | N/A | `Cargo.toml` |

---

## The API Key Problem

### Why was there a plaintext API key in localStorage?

`claude.ts` is a **BYOK (Bring Your Own Key) browser client** that calls the Anthropic API directly from the WebView using `fetch()`. It sends:

```
'anthropic-dangerous-direct-browser-access': 'true'
```

This header exists because Anthropic's API blocks browser-origin requests by default. The header is an explicit opt-in to an unsafe mode — it was designed for quick prototyping, not production apps.

Seven lib modules call this client: `ingest.ts`, `interview.ts`, `tensions.ts`, `chat.ts`, `skillExecutor.ts`, `draft.ts`, and `synthesis.ts`. These appear to be from an **earlier architecture** where the app was a browser-based reasoning pipeline.

**None of these modules are called from any React component in the current UI.** The current UI is terminal-native — it spawns Claude Code in a PTY and communicates through the terminal. The BYOK pipeline is dead code.

### What this means

The entire `claude.ts` module and its 7 consumers are **vestigial**. The app evolved from "browser calls Claude API directly" to "embedded terminal runs Claude Code," but the old BYOK plumbing was never removed. This left:

1. A plaintext API key on disk (localStorage persists to SQLite in the WebView data dir)
2. A `dangerous-direct-browser-access` header in production code
3. ~350 lines of unused API client code
4. 7 lib modules with no UI consumers

### Recommendation

**Delete `claude.ts` and the unused lib modules entirely.** If BYOK direct-API features are needed in the future, proxy them through the Rust backend so the key never touches the WebView. For now, Claude Code handles its own authentication through its own config.

Modules to evaluate for removal:
- `src/lib/claude.ts` — BYOK API client
- `src/lib/ingest.ts` — claim extraction via API (not the Tauri IPC ingest)
- `src/lib/interview.ts` — Socratic interview via API
- `src/lib/tensions.ts` — tension detection via API
- `src/lib/chat.ts` — chat completion via API
- `src/lib/draft.ts` — thesis drafting via API
- `src/lib/synthesis.ts` — thesis synthesis via API
- `src/lib/skillExecutor.ts` — skill execution via API
- `src/lib/storage.ts` — API key functions (keep the rest)

---

## Remaining Findings

### HIGH — Fix Before Wider Distribution

#### ~~1. SSRF in `web_fetch` tool~~ RESOLVED
~~**File:** `src/lib/tools.ts`~~ — Deleted with BYOK pipeline removal (2026-02-06).

#### ~~2. SSRF in `ingestSource`~~ RESOLVED
~~**File:** `src/lib/ingest.ts`~~ — Deleted with BYOK pipeline removal (2026-02-06).

#### ~~3. No `rehype-sanitize` on ReactMarkdown~~ RESOLVED
`rehype-sanitize` added to both `Entry.tsx` and `DocumentViewer.tsx` (2026-02-06).

### MEDIUM

#### ~~4. ReDoS via user-supplied regex~~ RESOLVED
~~**File:** `src/lib/tools.ts`~~ — Deleted with BYOK pipeline removal (2026-02-06).

#### 5. API/WebSocket URLs overridable via localStorage
**Files:** `src/lib/useHarness.ts:36`, `src/lib/api.ts:431-434`

Both `harness_ws_url` and `cannon_api_config` can be overridden via localStorage. If any code injection can set localStorage values, all API/WebSocket traffic redirects to a malicious server.

**Fix:** Gate behind `import.meta.env.DEV` for production builds.

#### 6. Session ID interpolated into terminal command
**File:** `src/hooks/useBudgetMonitor.ts:113-116`

```typescript
data: `/brief resume ${dialecticSessionId}\n`
```

If `dialecticSessionId` contained shell metacharacters, this could lead to command injection in the terminal. Unlikely given session IDs are ULIDs, but defense-in-depth says validate anyway.

**Fix:** Validate session ID format matches `^[A-Z0-9]+$` before interpolation.

#### 7. Unbounded stdin read in CLI binary
**File:** `src-tauri/src/bin/dialectic.rs:343-344`

`read_to_string` reads entire stdin with no size limit. Piping a multi-GB stream causes OOM.

**Fix:** Read up to a bounded limit (e.g., 10 MB).

#### 8. Unbounded vault indexing
**File:** `src-tauri/src/obsidian/indexer.rs:295-314`

Recursively reads every `.md` file with no limit on count or individual file size. A vault with thousands of large files could OOM.

**Fix:** Add per-file size limit (e.g., 1 MB) and max note count (e.g., 10,000).

#### 9. Unbounded embedding vocabulary growth
**File:** `src-tauri/src/documents/embeddings.rs:83-88`

Each unique word grows the vocabulary HashMap without bound. The TF vector allocated on each `generate_embedding` call grows proportionally.

**Fix:** Cap vocabulary at a fixed maximum (e.g., 50,000 terms).

### LOW

#### 10. Information leakage in error messages
**Files:** `session.rs:262`, `indexer.rs:337`

Absolute filesystem paths leaked in error messages and `IndexStats.errors`. Reveals internal directory structure.

**Fix:** Strip base directory prefix from paths in user-facing output.

#### 11. TOCTOU in directory creation
**File:** `session.rs:300-303`

`if !dir.exists() { create_dir_all }` — race window, though `create_dir_all` is idempotent so harmless in practice.

**Fix:** Remove the `exists()` check; just call `create_dir_all` directly.

#### 12. `get_related_notes` exponential fanout
**File:** `obsidian/query.rs:221-263`

Recursive with `depth: u8` (max 255). Depth 5+ on a well-connected vault produces exponential note expansion.

**Fix:** Cap depth to 3. Add max result count.

#### 13. Backend data cast without runtime validation
**Files:** `src/lib/api.ts:666`, `src/lib/useHarness.ts:159`

WebSocket messages parsed and cast via `as` with no schema validation. Comment explicitly says "We trust the backend."

**Fix:** Add Zod schema validation for WebSocket messages. Low priority since the WebSocket connects to localhost.

---

## Not Actionable (Informational)

### GTK3 unmaintained warnings in cargo audit
19 warnings from `atk`, `gdk`, `gtk`, `glib` etc. These are Linux-only transitive dependencies pulled in by Tauri's `wry` crate. Not compiled on macOS. Cannot be fixed without upstream Tauri migration to GTK4.

### `glib` unsoundness (RUSTSEC-2024-0429)
Same — Linux-only, not reachable on macOS.

---

## Architecture Recommendations

### ~~1. Remove the BYOK pipeline~~ DONE (2026-02-06)
11 files deleted, storage.ts cleaned. Removed ~1000 lines of dead code, all API key management, and the `anthropic-dangerous-direct-browser-access` attack surface.

### 2. Code signing + notarization
Required for distribution beyond "right-click > Open Anyway":
- Apple Developer account ($99/year)
- Developer ID Application certificate
- Notarization via `xcrun notarytool`
- Tauri supports this via env vars: `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

### 3. Auto-updater
Without this, users must manually re-download every update:
- `tauri-plugin-updater`
- Signed update manifests
- GitHub Releases as the update server (free, works with Tauri out of the box)

### 4. Fix the app identifier inconsistency
`tauri.conf.json` says `com.dialectic.app`, `session.rs` says `com.dialectic.dev`. This means the CLI binary looks for app data in a different location than the GUI. Pick one and use it everywhere.

---

## Threat Model

**Assumptions:**
- Single-user desktop app (not multi-tenant)
- User controls their own machine
- Obsidian vault is trusted content
- Claude Code is a trusted binary
- App runs with normal user permissions
- Distribution is to friends/early users, not general public

**Primary threats:**
1. Malicious content in Claude responses (XSS via markdown rendering)
2. Prompt injection causing unintended tool use (SSRF, file reads)
3. Local privilege escalation via terminal command injection
4. Data exfiltration of session content if machine is compromised

**Out of scope:**
- Nation-state attacks
- Physical access attacks
- Supply chain attacks on npm/cargo registries
