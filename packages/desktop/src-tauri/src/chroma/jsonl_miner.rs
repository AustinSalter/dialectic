//! JSONL Web Source Mining
//!
//! Parses Claude Code's JSONL conversation files to extract web search
//! and web fetch results, then indexes them into the web_sources Chroma
//! collection for cross-session retrieval.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use serde_json::Value;
use tracing::{info, warn, debug};

use super::client::{get_client, embed_documents};
use super::collections::COLLECTION_WEB_SOURCES;

/// A web source extracted from a JSONL file
#[derive(Debug, Clone)]
pub struct WebSource {
    pub url: Option<String>,
    pub title: Option<String>,
    pub query: Option<String>,
    pub content: String,
    pub source_type: String, // "web_search" or "web_fetch"
}

/// Result of mining a JSONL file
#[derive(Debug)]
pub struct MineResult {
    pub sources: Vec<WebSource>,
    pub tool_calls_found: usize,
}

/// Chunk size target for large web content (in chars, ~500 tokens)
const CHUNK_TARGET_CHARS: usize = 2000;

/// Max content length to process per source (chars)
const MAX_SOURCE_CONTENT: usize = 40_000;

/// Hash a URL to a short string for ID construction.
/// Uses FNV-1a (stable across Rust versions, unlike DefaultHasher).
fn hash_url(url: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325; // FNV offset basis
    for byte in url.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV prime
    }
    format!("{:016x}", hash)
}

/// Parse a JSONL file and extract web sources.
pub fn parse_jsonl(jsonl_path: &Path) -> MineResult {
    let content = match std::fs::read_to_string(jsonl_path) {
        Ok(c) => c,
        Err(e) => {
            warn!(path = %jsonl_path.display(), error = %e, "Failed to read JSONL file");
            return MineResult { sources: Vec::new(), tool_calls_found: 0 };
        }
    };

    let parent_dir = jsonl_path.parent();
    let mut sources = Vec::new();
    let mut tool_calls_found = 0usize;

    // Collect all messages
    let messages: Vec<Value> = content.lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();

    // Build a map of tool_use_id → tool_result content
    let mut tool_results: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for msg in &messages {
        if let Some(content_arr) = msg.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
            for block in content_arr {
                if block.get("type").and_then(|t| t.as_str()) == Some("tool_result") {
                    if let Some(tool_use_id) = block.get("tool_use_id").and_then(|id| id.as_str()) {
                        let result_text = extract_tool_result_text(block, parent_dir);
                        tool_results.insert(tool_use_id.to_string(), result_text);
                    }
                }
            }
        }
    }

    // Find tool_use blocks for WebSearch and WebFetch
    for msg in &messages {
        if let Some(content_arr) = msg.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
            for block in content_arr {
                if block.get("type").and_then(|t| t.as_str()) != Some("tool_use") {
                    continue;
                }

                let tool_name = block.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let tool_use_id = block.get("id").and_then(|id| id.as_str()).unwrap_or("");
                let input = block.get("input");

                match tool_name {
                    "WebSearch" => {
                        tool_calls_found += 1;
                        let query = input.and_then(|i| i.get("query")).and_then(|q| q.as_str()).map(|s| s.to_string());
                        let result_content = tool_results.get(tool_use_id).cloned().unwrap_or_default();

                        if !result_content.is_empty() {
                            sources.push(WebSource {
                                url: None,
                                title: None,
                                query,
                                content: truncate_content(&result_content),
                                source_type: "web_search".to_string(),
                            });
                        }
                    }
                    "WebFetch" => {
                        tool_calls_found += 1;
                        let url = input.and_then(|i| i.get("url")).and_then(|u| u.as_str()).map(|s| s.to_string());
                        let prompt = input.and_then(|i| i.get("prompt")).and_then(|p| p.as_str()).map(|s| s.to_string());
                        let result_content = tool_results.get(tool_use_id).cloned().unwrap_or_default();

                        if !result_content.is_empty() {
                            sources.push(WebSource {
                                url,
                                title: prompt,
                                query: None,
                                content: truncate_content(&result_content),
                                source_type: "web_fetch".to_string(),
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    debug!(path = %jsonl_path.display(), tool_calls = tool_calls_found, sources = sources.len(), "Parsed JSONL");
    MineResult { sources, tool_calls_found }
}

/// Extract text content from a tool_result block, handling external file references.
fn extract_tool_result_text(block: &Value, parent_dir: Option<&Path>) -> String {
    // tool_result content can be a string or an array of content blocks
    if let Some(content) = block.get("content") {
        if let Some(s) = content.as_str() {
            return maybe_read_external(s, parent_dir);
        }
        if let Some(arr) = content.as_array() {
            let mut text = String::new();
            for item in arr {
                if let Some(t) = item.get("text").and_then(|t| t.as_str()) {
                    text.push_str(&maybe_read_external(t, parent_dir));
                    text.push('\n');
                }
            }
            return text;
        }
    }
    String::new()
}

/// If content contains "Full output saved to: <path>", read from the referenced file.
/// Only reads files under ~/.claude/ to prevent path traversal.
fn maybe_read_external(text: &str, parent_dir: Option<&Path>) -> String {
    if text.contains("Full output saved to:") || text.contains("full output saved to:") {
        let allowed_base = dirs::home_dir().map(|h| h.join(".claude"));

        for line in text.lines() {
            let line_lower = line.to_lowercase();
            if line_lower.contains("full output saved to:") {
                if let Some(idx) = line.find(':') {
                    let path_str = line[idx + 1..].trim();

                    // Try absolute path, then relative to parent dir
                    let candidates = [
                        Some(PathBuf::from(path_str)),
                        parent_dir.map(|p| p.join(path_str)),
                    ];

                    for candidate in candidates.iter().flatten() {
                        if let Ok(canonical) = candidate.canonicalize() {
                            // Only allow reads under ~/.claude/
                            if let Some(ref base) = allowed_base {
                                if !canonical.starts_with(base) {
                                    warn!(path = %canonical.display(), "Refusing to read external file outside ~/.claude/");
                                    continue;
                                }
                            } else {
                                continue; // No home dir, skip
                            }
                            if let Ok(content) = std::fs::read_to_string(&canonical) {
                                return content;
                            }
                        }
                    }
                }
            }
        }
    }

    text.to_string()
}

/// Truncate content to MAX_SOURCE_CONTENT characters
fn truncate_content(content: &str) -> String {
    if content.chars().count() <= MAX_SOURCE_CONTENT {
        content.to_string()
    } else {
        content.chars().take(MAX_SOURCE_CONTENT).collect()
    }
}

/// Hard limit: force-split if a chunk grows beyond 2x the target
const CHUNK_HARD_LIMIT: usize = CHUNK_TARGET_CHARS * 2;

/// Chunk text into pieces for Chroma indexing.
fn chunk_content(content: &str) -> Vec<(String, u32)> {
    if content.chars().count() <= CHUNK_TARGET_CHARS {
        return vec![(content.to_string(), 0)];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut chunk_idx = 0u32;

    for line in content.lines() {
        current.push_str(line);
        current.push('\n');

        if current.len() >= CHUNK_TARGET_CHARS {
            // Try to find a paragraph boundary in the second half
            let mid = current.len() / 2;
            if let Some(pos) = current[mid..].find("\n\n") {
                let split_at = mid + pos + 2;
                let first = current[..split_at].to_string();
                let rest = current[split_at..].to_string();
                chunks.push((first, chunk_idx));
                chunk_idx += 1;
                current = rest;
            } else if current.len() >= CHUNK_HARD_LIMIT {
                // No paragraph boundary found — hard-split at a newline or target size
                let split_at = if let Some(pos) = current[CHUNK_TARGET_CHARS..].find('\n') {
                    CHUNK_TARGET_CHARS + pos + 1
                } else {
                    CHUNK_TARGET_CHARS
                };
                let first: String = current.chars().take(split_at).collect();
                let rest: String = current.chars().skip(split_at).collect();
                chunks.push((first, chunk_idx));
                chunk_idx += 1;
                current = rest;
            }
        }
    }

    if !current.trim().is_empty() {
        chunks.push((current, chunk_idx));
    }

    chunks
}

/// Index extracted web sources into the web_sources Chroma collection.
pub async fn index_sources(session_id: &str, sources: &[WebSource]) {
    if sources.is_empty() {
        return;
    }

    let client = get_client();
    let collection = match client.get_or_create_collection(COLLECTION_WEB_SOURCES, None).await {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to get/create web_sources collection");
            return;
        }
    };

    let mut seen_urls: HashSet<String> = HashSet::new();
    let mut total_indexed = 0u32;

    for source in sources {
        // Dedup by URL within session
        let dedup_key = source.url.as_deref().unwrap_or(&source.content[..source.content.len().min(100)]);
        if !seen_urls.insert(format!("{}::{}", session_id, dedup_key)) {
            continue;
        }

        let url_hash = hash_url(dedup_key);
        let chunks = chunk_content(&source.content);

        for (chunk_content, chunk_idx) in &chunks {
            let id = format!("{}::web::{}::chunk_{}", session_id, url_hash, chunk_idx);

            let mut metadata = serde_json::json!({
                "session_id": session_id,
                "source_type": source.source_type,
                "chunk_index": *chunk_idx as i64,
            });
            if let Some(ref url) = source.url {
                metadata["url"] = serde_json::json!(url);
            }
            if let Some(ref title) = source.title {
                metadata["title"] = serde_json::json!(title);
            }
            if let Some(ref query) = source.query {
                metadata["query"] = serde_json::json!(query);
            }

            let ids = vec![id];
            let documents = vec![chunk_content.clone()];
            let embeddings = embed_documents(&documents);
            let metadatas = vec![metadata];

            match client.upsert(
                &collection.id,
                ids,
                Some(documents),
                Some(embeddings),
                Some(metadatas),
            ).await {
                Ok(_) => total_indexed += 1,
                Err(e) => {
                    warn!(error = %e, "Failed to index web source chunk");
                }
            }
        }
    }

    if total_indexed > 0 {
        info!(session_id = %session_id, chunks_indexed = total_indexed, sources = sources.len(), "Indexed web sources to Chroma");
    }
}

/// Mine web sources from a session's JSONL file and index to Chroma.
/// This is the main entry point called from other modules.
pub async fn mine_session_sources(session_id: &str, jsonl_path: &Path) {
    let result = parse_jsonl(jsonl_path);
    if result.sources.is_empty() {
        debug!(session_id = %session_id, "No web sources found in JSONL");
        return;
    }

    info!(session_id = %session_id, sources = result.sources.len(), tool_calls = result.tool_calls_found, "Mining web sources from JSONL");
    index_sources(session_id, &result.sources).await;
}

/// Convenience: find and mine the JSONL for a session given its conversation_id and working_dir.
/// Tries the exact project dir first, then scans all project dirs.
pub async fn mine_session_if_possible(session_id: &str, conversation_id: &str, working_dir: &str) {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return,
    };

    let projects_base = home.join(".claude").join("projects");

    // Try exact encoded working-dir path first
    let encoded = working_dir.replace('/', "-");
    let exact_dir = projects_base.join(&encoded);
    let jsonl_name = format!("{}.jsonl", conversation_id);

    if exact_dir.exists() {
        let jsonl_path = exact_dir.join(&jsonl_name);
        if jsonl_path.exists() {
            mine_session_sources(session_id, &jsonl_path).await;
            return;
        }
    }

    // Scan all project dirs for the JSONL file
    if let Ok(entries) = std::fs::read_dir(&projects_base) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let jsonl_path = entry.path().join(&jsonl_name);
                if jsonl_path.exists() {
                    mine_session_sources(session_id, &jsonl_path).await;
                    return;
                }
            }
        }
    }

    debug!(session_id = %session_id, conversation_id = %conversation_id, "JSONL file not found for mining");
}
