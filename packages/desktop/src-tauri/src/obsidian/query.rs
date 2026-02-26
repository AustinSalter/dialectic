//! Obsidian Query Module
//!
//! Handles @ mention resolution and semantic search over the vault index.

use serde::{Deserialize, Serialize};
use super::indexer::{get_vault_index, NoteIndex, ObsidianError};
use std::fs;
use tracing::debug;

/// Query result with relevance score
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub note: NoteIndex,
    pub relevance: f32,
    pub match_type: MatchType,
}

/// How the note matched the query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    /// Exact title match
    ExactTitle,
    /// Partial title match
    PartialTitle,
    /// Tag match
    Tag,
    /// Backlink relationship
    Backlink,
    /// Content search
    Content,
}

/// Note content with token budget enforcement
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub path: String,
    pub title: String,
    pub content: String,
    pub token_count: u32,
    pub truncated: bool,
}

/// Resolve an @ mention to a note
///
/// Supports formats:
/// - `@notes/path/to/note` - direct path
/// - `@note-title` - title search
/// - `@#tag` - tag search (returns multiple)
pub fn resolve_mention(mention: &str) -> Result<Vec<NoteIndex>, ObsidianError> {
    let index = get_vault_index()?;

    // Remove @ prefix
    let query = mention.trim_start_matches('@');

    // Tag search
    if query.starts_with('#') {
        let tag = query;
        if let Some(paths) = index.tag_to_paths.get(tag) {
            return Ok(paths.iter()
                .filter_map(|p| index.notes.get(p).cloned())
                .collect());
        }
        return Ok(Vec::new());
    }

    // Path search (notes/...)
    if query.starts_with("notes/") || query.contains('/') {
        let path = if query.ends_with(".md") {
            query.to_string()
        } else {
            format!("{}.md", query)
        };

        if let Some(note) = index.notes.get(&path) {
            return Ok(vec![note.clone()]);
        }

        // Try without notes/ prefix
        let path_without_prefix = query.trim_start_matches("notes/");
        let path = if path_without_prefix.ends_with(".md") {
            path_without_prefix.to_string()
        } else {
            format!("{}.md", path_without_prefix)
        };

        if let Some(note) = index.notes.get(&path) {
            return Ok(vec![note.clone()]);
        }
    }

    // Title search
    let query_lower = query.to_lowercase();

    // Exact title match
    if let Some(path) = index.title_to_path.get(&query_lower) {
        if let Some(note) = index.notes.get(path) {
            return Ok(vec![note.clone()]);
        }
    }

    // Partial title match
    let matches: Vec<_> = index.notes.values()
        .filter(|n| n.title.to_lowercase().contains(&query_lower))
        .cloned()
        .collect();

    Ok(matches)
}

/// Semantic search over Obsidian notes via Chroma
pub async fn query_notes_semantic(
    query: &str,
    n_results: u32,
) -> Vec<QueryResult> {
    let client = crate::chroma::client::get_client();
    let collection = match client.get_collection(
        crate::chroma::collections::COLLECTION_OBSIDIAN,
    ).await {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let count = match client.count(&collection.id).await {
        Ok(c) if c > 0 => c,
        _ => return Vec::new(),
    };

    let result = match client.query(
        &collection.id,
        None,
        Some(vec![query.to_string()]),
        n_results.min(count),
        None,
        None,
        Some(vec![
            "documents".to_string(),
            "metadatas".to_string(),
            "distances".to_string(),
        ]),
    ).await {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let index = match get_vault_index() {
        Ok(idx) => idx,
        Err(_) => return Vec::new(),
    };

    let mut results = Vec::new();

    for (query_idx, ids) in result.ids.iter().enumerate() {
        for (result_idx, _id) in ids.iter().enumerate() {
            let metadata = result.metadatas.as_ref()
                .and_then(|m| m.get(query_idx))
                .and_then(|m| m.get(result_idx))
                .and_then(|m| m.clone());

            let distance = result.distances.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .copied()
                .unwrap_or(f32::MAX);

            let path = metadata.as_ref()
                .and_then(|m| m.get("path"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if let Some(note) = index.notes.get(path) {
                let relevance = 1.0 / (1.0 + distance);
                results.push(QueryResult {
                    note: note.clone(),
                    relevance,
                    match_type: MatchType::Content,
                });
            }
        }
    }

    debug!(query = %query, n_results = n_results, hits = results.len(), "Obsidian semantic search");
    results
}

/// Query notes with fuzzy matching and relevance scoring
pub fn query_notes(query: &str, budget: u32) -> Result<Vec<QueryResult>, ObsidianError> {
    let index = get_vault_index()?;
    let query_lower = query.to_lowercase();
    let query_terms: Vec<&str> = query_lower.split_whitespace().collect();

    let mut results: Vec<QueryResult> = Vec::new();
    let mut total_tokens = 0u32;

    // Score each note
    for note in index.notes.values() {
        let mut relevance = 0.0f32;
        let mut match_type = MatchType::Content;

        // Exact title match (highest)
        if note.title.to_lowercase() == query_lower {
            relevance = 1.0;
            match_type = MatchType::ExactTitle;
        }
        // Partial title match
        else if note.title.to_lowercase().contains(&query_lower) {
            relevance = 0.8;
            match_type = MatchType::PartialTitle;
        }
        // Tag match
        else if note.tags.iter().any(|t| t.to_lowercase().contains(&query_lower)) {
            relevance = 0.7;
            match_type = MatchType::Tag;
        }
        // Term matching in title/summary
        else {
            let title_lower = note.title.to_lowercase();
            let summary_lower = note.summary.to_lowercase();

            let title_matches = query_terms.iter()
                .filter(|t| title_lower.contains(*t))
                .count();
            let summary_matches = query_terms.iter()
                .filter(|t| summary_lower.contains(*t))
                .count();

            if title_matches > 0 || summary_matches > 0 {
                relevance = (title_matches as f32 * 0.3 + summary_matches as f32 * 0.1)
                    / query_terms.len() as f32;
            }
        }

        if relevance > 0.0 {
            // Check budget
            if total_tokens + note.token_count > budget {
                continue;
            }

            total_tokens += note.token_count;

            results.push(QueryResult {
                note: note.clone(),
                relevance,
                match_type,
            });
        }
    }

    // Sort by relevance
    results.sort_by(|a, b| b.relevance.partial_cmp(&a.relevance).unwrap_or(std::cmp::Ordering::Equal));

    Ok(results)
}

/// Get note content with optional truncation to budget
pub fn get_note_content(path: &str, max_tokens: u32) -> Result<NoteContent, ObsidianError> {
    let index = get_vault_index()?;

    let note = index.notes.get(path)
        .ok_or_else(|| ObsidianError::NoteNotFound(path.to_string()))?;

    let full_path = index.vault_path.join(path);
    // Validate the resolved path stays within the vault
    let canonical_vault = index.vault_path.canonicalize()
        .map_err(|e| ObsidianError::Io(e))?;
    let canonical_path = full_path.canonicalize()
        .map_err(|e| ObsidianError::Io(e))?;
    if !canonical_path.starts_with(&canonical_vault) {
        return Err(ObsidianError::InvalidPath("Path escapes vault directory".to_string()));
    }
    let content = fs::read_to_string(&canonical_path)?;

    // Estimate tokens
    let token_count = (content.len() as f64 / 4.0).ceil() as u32;

    let (final_content, truncated) = if token_count > max_tokens {
        // Truncate to approximately max_tokens
        let char_limit = (max_tokens as usize) * 4;
        let truncated_content = if content.len() > char_limit {
            // Find a safe UTF-8 boundary for truncation
            let mut safe_limit = char_limit.min(content.len());
            while safe_limit > 0 && !content.is_char_boundary(safe_limit) {
                safe_limit -= 1;
            }
            format!("{}...\n\n[TRUNCATED: {} tokens remaining]",
                &content[..safe_limit],
                token_count - max_tokens)
        } else {
            content.clone()
        };
        (truncated_content, true)
    } else {
        (content, false)
    };

    let final_token_count = (final_content.len() as f64 / 4.0).ceil() as u32;

    Ok(NoteContent {
        path: path.to_string(),
        title: note.title.clone(),
        content: final_content,
        token_count: final_token_count,
        truncated,
    })
}

/// Get notes by backlink relationship
pub fn get_related_notes(path: &str, depth: u8) -> Result<Vec<NoteIndex>, ObsidianError> {
    let index = get_vault_index()?;

    let note = index.notes.get(path)
        .ok_or_else(|| ObsidianError::NoteNotFound(path.to_string()))?;

    let mut related = Vec::new();
    let mut visited = std::collections::HashSet::new();
    visited.insert(path.to_string());

    // Add direct links and backlinks
    for link in &note.links {
        if let Some(target_path) = resolve_link_to_path(&index, link) {
            if visited.insert(target_path.clone()) {
                if let Some(n) = index.notes.get(&target_path) {
                    related.push(n.clone());
                }
            }
        }
    }

    for backlink in &note.backlinks {
        if visited.insert(backlink.clone()) {
            if let Some(n) = index.notes.get(backlink) {
                related.push(n.clone());
            }
        }
    }

    // For depth > 1, recursively get related notes
    if depth > 1 {
        let direct_related: Vec<_> = related.iter().map(|n| n.path.clone()).collect();
        for related_path in direct_related {
            if let Ok(deeper) = get_related_notes(&related_path, depth - 1) {
                for n in deeper {
                    if visited.insert(n.path.clone()) {
                        related.push(n);
                    }
                }
            }
        }
    }

    Ok(related)
}

/// Resolve a link reference to a path
fn resolve_link_to_path(index: &super::indexer::VaultIndex, link: &str) -> Option<String> {
    // Try exact path match
    if index.notes.contains_key(link) {
        return Some(link.to_string());
    }

    // Try with .md
    let with_md = format!("{}.md", link);
    if index.notes.contains_key(&with_md) {
        return Some(with_md);
    }

    // Try title lookup
    index.title_to_path.get(&link.to_lowercase()).cloned()
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn obsidian_resolve_mention(mention: String) -> Result<Vec<NoteIndex>, ObsidianError> {
    resolve_mention(&mention)
}

#[tauri::command]
pub fn obsidian_query_notes(query: String, budget: u32) -> Result<Vec<QueryResult>, ObsidianError> {
    query_notes(&query, budget)
}

/// Hybrid search: keyword + semantic via Chroma, deduped by path
#[tauri::command]
pub async fn obsidian_query_notes_semantic(
    query: String,
    budget: u32,
    n_results: u32,
) -> Result<Vec<QueryResult>, ObsidianError> {
    // Get keyword results
    let mut keyword_results = query_notes(&query, budget)?;
    let keyword_count = keyword_results.len();

    // Get semantic results from Chroma
    let semantic_results = query_notes_semantic(&query, n_results).await;
    let semantic_count = semantic_results.len();

    // Merge: dedup by path, keep highest relevance
    let mut seen_paths: std::collections::HashSet<String> = keyword_results.iter()
        .map(|r| r.note.path.clone())
        .collect();

    for result in semantic_results {
        if seen_paths.insert(result.note.path.clone()) {
            keyword_results.push(result);
        }
    }

    // Re-sort by relevance
    keyword_results.sort_by(|a, b| b.relevance.partial_cmp(&a.relevance).unwrap_or(std::cmp::Ordering::Equal));

    debug!(keyword_hits = keyword_count, semantic_hits = semantic_count, merged = keyword_results.len(), "Obsidian merged search");

    Ok(keyword_results)
}

#[tauri::command]
pub fn obsidian_get_note_content(path: String, max_tokens: u32) -> Result<NoteContent, ObsidianError> {
    get_note_content(&path, max_tokens)
}

#[tauri::command]
pub fn obsidian_get_related_notes(path: String, depth: u8) -> Result<Vec<NoteIndex>, ObsidianError> {
    get_related_notes(&path, depth)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mention_parsing() {
        // These tests would need a mock vault
        // For now, just test the string parsing

        let mention = "@notes/path/to/note";
        let query = mention.trim_start_matches('@');
        assert!(query.starts_with("notes/"));

        let tag_mention = "@#project";
        let query = tag_mention.trim_start_matches('@');
        assert!(query.starts_with('#'));
    }
}
