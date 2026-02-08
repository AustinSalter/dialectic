//! Obsidian Vault Indexer
//!
//! Scans and indexes an Obsidian vault for semantic search.
//! Read-only: never modifies the user's vault.

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Global vault index
static VAULT_INDEX: RwLock<Option<VaultIndex>> = RwLock::new(None);

#[derive(Error, Debug)]
pub enum ObsidianError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Vault not configured")]
    NotConfigured,
    #[error("Invalid vault path: {0}")]
    InvalidPath(String),
    #[error("Note not found: {0}")]
    NoteNotFound(String),
}

impl Serialize for ObsidianError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Indexed note metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteIndex {
    /// Relative path from vault root
    pub path: String,
    /// Note title (filename without .md)
    pub title: String,
    /// First paragraph/summary
    pub summary: String,
    /// Outgoing links [[target]]
    pub links: Vec<String>,
    /// Backlinks (notes that link to this one)
    pub backlinks: Vec<String>,
    /// Tags #tag
    pub tags: Vec<String>,
    /// Last modified
    pub modified: DateTime<Utc>,
    /// Token count estimate
    pub token_count: u32,
}

/// Full vault index
#[derive(Debug, Clone, Default)]
pub struct VaultIndex {
    /// Vault root path
    pub vault_path: PathBuf,
    /// Indexed notes by path
    pub notes: HashMap<String, NoteIndex>,
    /// Title to path mapping for quick lookup
    pub title_to_path: HashMap<String, String>,
    /// Tag to paths mapping
    pub tag_to_paths: HashMap<String, Vec<String>>,
    /// Last full index timestamp
    pub last_indexed: DateTime<Utc>,
}

impl VaultIndex {
    pub fn new(vault_path: PathBuf) -> Self {
        Self {
            vault_path,
            notes: HashMap::new(),
            title_to_path: HashMap::new(),
            tag_to_paths: HashMap::new(),
            last_indexed: Utc::now(),
        }
    }

    /// Index a single note file
    fn index_note(&mut self, path: &Path) -> Result<(), ObsidianError> {
        let content = fs::read_to_string(path)?;
        let relative_path = path.strip_prefix(&self.vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        let title = path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| relative_path.clone());

        // Extract first paragraph as summary
        let summary = extract_summary(&content);

        // Extract links [[target]] or [[target|alias]]
        let links = extract_links(&content);

        // Extract tags #tag
        let tags = extract_tags(&content);

        // Get file metadata
        let metadata = fs::metadata(path)?;
        let modified: DateTime<Utc> = metadata.modified()
            .map(|t| t.into())
            .unwrap_or_else(|_| Utc::now());

        // Estimate tokens (~4 chars per token)
        let token_count = (content.len() as f64 / 4.0).ceil() as u32;

        let note = NoteIndex {
            path: relative_path.clone(),
            title: title.clone(),
            summary,
            links,
            tags: tags.clone(),
            backlinks: Vec::new(), // Filled in second pass
            modified,
            token_count,
        };

        // Update mappings
        self.title_to_path.insert(title.to_lowercase(), relative_path.clone());

        for tag in &tags {
            self.tag_to_paths
                .entry(tag.clone())
                .or_insert_with(Vec::new)
                .push(relative_path.clone());
        }

        self.notes.insert(relative_path, note);
        Ok(())
    }

    /// Build backlink graph (second pass)
    fn build_backlinks(&mut self) {
        // Collect all forward links first
        let forward_links: Vec<(String, Vec<String>)> = self.notes.iter()
            .map(|(path, note)| (path.clone(), note.links.clone()))
            .collect();

        // For each note's links, add backlinks to targets
        for (source_path, links) in forward_links {
            for link in links {
                // Try to resolve link to a path
                let target_path = self.resolve_link(&link);
                if let Some(target) = target_path {
                    if let Some(note) = self.notes.get_mut(&target) {
                        if !note.backlinks.contains(&source_path) {
                            note.backlinks.push(source_path.clone());
                        }
                    }
                }
            }
        }
    }

    /// Resolve a [[link]] to a path
    fn resolve_link(&self, link: &str) -> Option<String> {
        // Remove alias if present: [[target|alias]] -> target
        let target = link.split('|').next().unwrap_or(link).trim();

        // Try exact path match
        if self.notes.contains_key(target) {
            return Some(target.to_string());
        }

        // Try with .md extension
        let with_md = format!("{}.md", target);
        if self.notes.contains_key(&with_md) {
            return Some(with_md);
        }

        // Try title lookup
        if let Some(path) = self.title_to_path.get(&target.to_lowercase()) {
            return Some(path.clone());
        }

        None
    }
}

/// Extract first paragraph as summary
fn extract_summary(content: &str) -> String {
    // Skip YAML frontmatter if present
    let content = if content.starts_with("---") {
        content.split("---").nth(2).unwrap_or(content).trim()
    } else {
        content.trim()
    };

    // Get first non-empty paragraph
    content.split("\n\n")
        .find(|p| !p.trim().is_empty() && !p.starts_with('#'))
        .map(|p| {
            // Limit to ~200 chars
            if p.len() > 200 {
                let mut end = 200;
                while end > 0 && !p.is_char_boundary(end) {
                    end -= 1;
                }
                format!("{}...", &p[..end])
            } else {
                p.to_string()
            }
        })
        .unwrap_or_default()
}

/// Extract [[links]] from content
fn extract_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut in_link = false;
    let mut current_link = String::new();

    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if i + 1 < chars.len() && chars[i] == '[' && chars[i + 1] == '[' {
            in_link = true;
            current_link.clear();
            i += 2;
            continue;
        }

        if i + 1 < chars.len() && chars[i] == ']' && chars[i + 1] == ']' {
            if in_link && !current_link.is_empty() {
                // Remove alias: [[target|alias]] -> target
                let target = current_link.split('|').next().unwrap_or(&current_link);
                links.push(target.to_string());
            }
            in_link = false;
            current_link.clear();
            i += 2;
            continue;
        }

        if in_link {
            current_link.push(chars[i]);
        }

        i += 1;
    }

    links
}

/// Extract #tags from content
fn extract_tags(content: &str) -> Vec<String> {
    let mut tags = Vec::new();

    for word in content.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            // Remove trailing punctuation
            let tag = word.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_');
            if tag.len() > 1 {
                tags.push(tag.to_string());
            }
        }
    }

    tags.sort();
    tags.dedup();
    tags
}

/// Configure vault path (validation only, no indexing)
pub fn configure_vault(vault_path: &str) -> Result<(), ObsidianError> {
    let path = PathBuf::from(vault_path);

    if !path.exists() {
        return Err(ObsidianError::InvalidPath("Path does not exist".to_string()));
    }

    // Canonicalize to resolve symlinks and prevent traversal
    let canonical_path = path.canonicalize()
        .map_err(|_| ObsidianError::InvalidPath("Cannot resolve path".to_string()))?;

    if !canonical_path.is_dir() {
        return Err(ObsidianError::InvalidPath("Path is not a directory".to_string()));
    }

    // Ensure path is under the user's home directory
    if let Some(home) = dirs::home_dir() {
        if !canonical_path.starts_with(&home) {
            return Err(ObsidianError::InvalidPath("Vault must be within home directory".to_string()));
        }
    }

    // Check for .obsidian folder (indicates this is an Obsidian vault)
    let obsidian_dir = canonical_path.join(".obsidian");
    if !obsidian_dir.exists() {
        return Err(ObsidianError::InvalidPath("Not an Obsidian vault (no .obsidian folder)".to_string()));
    }

    // Initialize empty index
    let mut index = VAULT_INDEX.write();
    *index = Some(VaultIndex::new(canonical_path));

    Ok(())
}

/// Index the vault into Chroma for semantic search (best-effort, non-blocking)
pub async fn index_vault_to_chroma() -> u32 {
    let notes_data: Vec<(String, String, String, Vec<String>, u32, String)> = {
        let index = VAULT_INDEX.read();
        match index.as_ref() {
            Some(vault) => vault.notes.values().map(|note| {
                // Read the full content for Chroma indexing
                let full_path = vault.vault_path.join(&note.path);
                let content = fs::read_to_string(&full_path).unwrap_or_else(|_| note.summary.clone());
                (
                    note.path.clone(),
                    note.title.clone(),
                    content,
                    note.tags.clone(),
                    note.token_count,
                    note.modified.to_rfc3339(),
                )
            }).collect(),
            None => Vec::new(),
        }
    };

    if notes_data.is_empty() {
        return 0;
    }

    let client = crate::chroma::client::get_client();
    let collection = match client.get_or_create_collection(
        crate::chroma::collections::COLLECTION_OBSIDIAN, None
    ).await {
        Ok(c) => c,
        Err(_) => return 0,
    };

    // Chunk notes into batches of 50 for Chroma upsert
    let mut indexed = 0u32;
    for batch in notes_data.chunks(50) {
        let ids: Vec<String> = batch.iter()
            .map(|(path, ..)| format!("obsidian_{}", path.replace('/', "_")))
            .collect();

        let documents: Vec<String> = batch.iter()
            .map(|(_, _, content, ..)| content.clone())
            .collect();

        let metadatas: Vec<serde_json::Value> = batch.iter()
            .map(|(path, title, _, tags, token_count, modified)| {
                crate::chroma::collections::obsidian_chunk_metadata(
                    path, title, tags, *token_count, modified,
                )
            })
            .collect();

        match client.upsert(
            &collection.id,
            ids,
            Some(documents),
            None,
            Some(metadatas),
        ).await {
            Ok(_) => indexed += batch.len() as u32,
            Err(e) => {
                eprintln!("Chroma obsidian indexing batch failed: {}", e);
            }
        }
    }

    indexed
}

/// Index the entire vault
pub fn index_vault() -> Result<IndexStats, ObsidianError> {
    let mut index = VAULT_INDEX.write();
    let vault = index.as_mut().ok_or(ObsidianError::NotConfigured)?;

    // Clear existing index
    vault.notes.clear();
    vault.title_to_path.clear();
    vault.tag_to_paths.clear();

    // Walk the vault directory
    let mut stats = IndexStats::default();
    index_directory(&vault.vault_path.clone(), vault, &mut stats)?;

    // Build backlinks
    vault.build_backlinks();
    vault.last_indexed = Utc::now();

    stats.last_indexed = vault.last_indexed;

    Ok(stats)
}

/// Recursively index a directory
fn index_directory(dir: &Path, index: &mut VaultIndex, stats: &mut IndexStats) -> Result<(), ObsidianError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        // Skip hidden files and .obsidian
        if path.file_name()
            .map(|n| n.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
        {
            continue;
        }

        if path.is_dir() {
            index_directory(&path, index, stats)?;
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            match index.index_note(&path) {
                Ok(()) => stats.notes_indexed += 1,
                Err(e) => {
                    stats.errors.push(format!("{}: {}", path.display(), e));
                }
            }
        }
    }

    Ok(())
}

/// Get the current vault index
pub fn get_vault_index() -> Result<VaultIndex, ObsidianError> {
    let index = VAULT_INDEX.read();
    index.clone().ok_or(ObsidianError::NotConfigured)
}

/// Index statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub notes_indexed: u32,
    pub errors: Vec<String>,
    pub last_indexed: DateTime<Utc>,
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn obsidian_configure_vault(vault_path: String) -> Result<(), ObsidianError> {
    configure_vault(&vault_path)
}

#[tauri::command]
pub async fn obsidian_index_vault() -> Result<IndexStats, ObsidianError> {
    let stats = index_vault()?;

    // Best-effort Chroma indexing (don't fail if Chroma is offline)
    let chroma_indexed = index_vault_to_chroma().await;
    if chroma_indexed > 0 {
        eprintln!("Indexed {} notes to Chroma", chroma_indexed);
    }

    Ok(stats)
}

#[tauri::command]
pub fn obsidian_get_stats() -> Result<IndexStats, ObsidianError> {
    let index = VAULT_INDEX.read();
    let vault = index.as_ref().ok_or(ObsidianError::NotConfigured)?;

    Ok(IndexStats {
        notes_indexed: vault.notes.len() as u32,
        errors: Vec::new(),
        last_indexed: vault.last_indexed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_summary() {
        let content = "# Title\n\nThis is the first paragraph.\n\nThis is the second.";
        assert_eq!(extract_summary(content), "This is the first paragraph.");
    }

    #[test]
    fn test_extract_summary_with_frontmatter() {
        let content = "---\ntitle: Test\n---\n\nActual content here.";
        assert_eq!(extract_summary(content), "Actual content here.");
    }

    #[test]
    fn test_extract_links() {
        let content = "Check out [[other note]] and [[folder/nested|nested note]].";
        let links = extract_links(content);
        assert_eq!(links, vec!["other note", "folder/nested"]);
    }

    #[test]
    fn test_extract_tags() {
        let content = "This has #tag1 and #tag-2 and #tag_3.";
        let tags = extract_tags(content);
        assert!(tags.contains(&"#tag1".to_string()));
        assert!(tags.contains(&"#tag-2".to_string()));
        assert!(tags.contains(&"#tag_3".to_string()));
    }
}
