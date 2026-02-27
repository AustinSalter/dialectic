//! Agentic Memory
//!
//! Three memory types stored as Chroma collections:
//! - Semantic: facts, preferences, context (cross-session)
//! - Procedural: learned strategies (cross-session)
//! - Episodic: past results and plans (cross-session)

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;
use tracing::{info, warn, debug};

use super::client::{ChromaError, get_client, embed_documents, embed_query};
use super::collections::*;
use crate::session::Session;

#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("Chroma error: {0}")]
    Chroma(#[from] ChromaError),
    #[error("Memory not found: {0}")]
    NotFound(String),
    #[error("Invalid memory type: {0}")]
    InvalidType(String),
}

impl Serialize for MemoryError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Memory type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryType {
    Semantic,
    Procedural,
    Episodic,
}

impl MemoryType {
    pub fn collection_name(&self) -> &'static str {
        match self {
            MemoryType::Semantic => COLLECTION_MEMORY_SEMANTIC,
            MemoryType::Procedural => COLLECTION_MEMORY_PROCEDURAL,
            MemoryType::Episodic => COLLECTION_MEMORY_EPISODIC,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::Semantic => "semantic",
            MemoryType::Procedural => "procedural",
            MemoryType::Episodic => "episodic",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, MemoryError> {
        match s {
            "semantic" => Ok(MemoryType::Semantic),
            "procedural" => Ok(MemoryType::Procedural),
            "episodic" => Ok(MemoryType::Episodic),
            _ => Err(MemoryError::InvalidType(s.to_string())),
        }
    }
}

/// Core metadata fields that cannot be overridden by extra_metadata
const RESERVED_METADATA_KEYS: &[&str] = &["type", "created_at", "access_count", "last_accessed"];

/// A memory record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRecord {
    pub id: String,
    pub memory_type: MemoryType,
    pub content: String,
    pub metadata: Value,
    pub relevance: Option<f32>,
}

/// Write a memory to the appropriate collection
pub async fn write_memory(
    memory_type: MemoryType,
    id: &str,
    content: &str,
    extra_metadata: Option<Value>,
) -> Result<(), MemoryError> {
    let client = get_client();
    let collection_name = memory_type.collection_name();
    let collection = client.get_or_create_collection(collection_name, None).await?;

    let now = Utc::now().to_rfc3339();

    // Read existing metadata to preserve created_at and access_count across upserts
    let existing_meta = client.get(
        &collection.id,
        Some(vec![id.to_string()]),
        None,
        None,
        None,
        None,
        Some(vec!["metadatas".to_string()]),
    ).await.ok().and_then(|r| {
        if r.ids.is_empty() { return None; }
        r.metadatas.and_then(|m| m.into_iter().next()).flatten()
    });

    // Merge extra metadata first, filtering out reserved keys
    let mut metadata = json!({});
    if let Some(extra) = extra_metadata {
        if let Some(obj) = extra.as_object() {
            for (k, v) in obj {
                if !RESERVED_METADATA_KEYS.contains(&k.as_str()) {
                    metadata[k] = v.clone();
                }
            }
        }
    }

    // Set core fields after merge so they cannot be overridden
    metadata["type"] = json!(memory_type.as_str());
    metadata["last_accessed"] = json!(now);

    // Preserve created_at and access_count from existing record, or initialize defaults
    if let Some(ref existing) = existing_meta {
        if let Some(created) = existing.get("created_at") {
            metadata["created_at"] = created.clone();
        } else {
            metadata["created_at"] = json!(now);
        }
        if let Some(count) = existing.get("access_count") {
            metadata["access_count"] = count.clone();
        } else {
            metadata["access_count"] = json!(0_i64);
        }
    } else {
        metadata["created_at"] = json!(now);
        metadata["access_count"] = json!(0_i64);
    }

    let embeddings = embed_documents(&[content.to_string()]);

    client.upsert(
        &collection.id,
        vec![id.to_string()],
        Some(vec![content.to_string()]),
        Some(embeddings),
        Some(vec![metadata]),
    ).await?;

    info!(memory_type = %memory_type.as_str(), id = %id, "Wrote memory");
    Ok(())
}

/// Read memories relevant to a query
pub async fn read_memories(
    memory_type: MemoryType,
    query: &str,
    n_results: u32,
) -> Result<Vec<MemoryRecord>, MemoryError> {
    let truncated: String = query.chars().take(100).collect();
    debug!(memory_type = %memory_type.as_str(), query = %truncated, n_results = n_results, "Reading memories");
    let client = get_client();
    let collection_name = memory_type.collection_name();
    let collection = match client.get_collection(collection_name).await {
        Ok(c) => c,
        Err(ChromaError::CollectionNotFound(_)) => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };

    let count = client.count(&collection.id).await?;
    if count == 0 {
        return Ok(Vec::new());
    }

    let query_embeddings = embed_query(query);

    let result = client.query(
        &collection.id,
        Some(query_embeddings),
        None,
        n_results.min(count), // Don't request more than exist
        None,
        None,
        Some(vec!["documents".to_string(), "metadatas".to_string(), "distances".to_string()]),
    ).await?;

    let mut records = Vec::new();
    let mut ids_to_update = Vec::new();
    let mut metadatas_to_update = Vec::new();

    let now = Utc::now().to_rfc3339();

    for (query_idx, ids) in result.ids.iter().enumerate() {
        for (result_idx, id) in ids.iter().enumerate() {
            let content = result.documents.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .and_then(|d| d.clone())
                .unwrap_or_default();

            let metadata = result.metadatas.as_ref()
                .and_then(|m| m.get(query_idx))
                .and_then(|m| m.get(result_idx))
                .and_then(|m| m.clone())
                .unwrap_or(Value::Null);

            let distance = result.distances.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .copied()
                .unwrap_or(f32::MAX);

            let relevance = 1.0 / (1.0 + distance);

            // Track access count update
            let access_count = metadata.get("access_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let mut updated_meta = metadata.clone();
            updated_meta["access_count"] = json!(access_count + 1);
            updated_meta["last_accessed"] = json!(now);
            ids_to_update.push(id.clone());
            metadatas_to_update.push(updated_meta.clone());

            records.push(MemoryRecord {
                id: id.clone(),
                memory_type,
                content,
                metadata: updated_meta,
                relevance: Some(relevance),
            });
        }
    }

    // Best-effort: update access counts (don't fail the read if this errors)
    if !ids_to_update.is_empty() {
        let _ = client.upsert(
            &collection.id,
            ids_to_update,
            None,
            None,
            Some(metadatas_to_update),
        ).await;
    }

    debug!(count = records.len(), "Memory read results");
    Ok(records)
}

/// Read all memories of a given type
pub async fn list_memories(
    memory_type: MemoryType,
    limit: Option<u32>,
) -> Result<Vec<MemoryRecord>, MemoryError> {
    let client = get_client();
    let collection_name = memory_type.collection_name();
    let collection = match client.get_collection(collection_name).await {
        Ok(c) => c,
        Err(ChromaError::CollectionNotFound(_)) => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };

    let result = client.get(
        &collection.id,
        None,
        None,
        None,
        limit,
        None,
        Some(vec!["documents".to_string(), "metadatas".to_string()]),
    ).await?;

    let mut records = Vec::new();
    for (idx, id) in result.ids.iter().enumerate() {
        let content = result.documents.as_ref()
            .and_then(|d| d.get(idx))
            .and_then(|d| d.clone())
            .unwrap_or_default();

        let metadata = result.metadatas.as_ref()
            .and_then(|m| m.get(idx))
            .and_then(|m| m.clone())
            .unwrap_or(Value::Null);

        records.push(MemoryRecord {
            id: id.clone(),
            memory_type,
            content,
            metadata,
            relevance: None,
        });
    }

    debug!(memory_type = %memory_type.as_str(), count = records.len(), "Listed memories");
    Ok(records)
}

/// Delete a specific memory
pub async fn delete_memory(memory_type: MemoryType, id: &str) -> Result<(), MemoryError> {
    let client = get_client();
    let collection_name = memory_type.collection_name();
    let collection = match client.get_collection(collection_name).await {
        Ok(c) => c,
        Err(ChromaError::CollectionNotFound(_)) => return Ok(()), // Nothing to delete
        Err(e) => return Err(e.into()),
    };

    client.delete(
        &collection.id,
        Some(vec![id.to_string()]),
        None,
    ).await?;

    info!(memory_type = %memory_type.as_str(), id = %id, "Deleted memory");
    Ok(())
}

/// Clear all memories of a given type
pub async fn clear_memories(memory_type: MemoryType) -> Result<(), MemoryError> {
    let client = get_client();
    let collection_name = memory_type.collection_name();
    // Delete and recreate the collection
    client.delete_collection(collection_name).await?;
    client.get_or_create_collection(collection_name, None).await?;
    warn!(memory_type = %memory_type.as_str(), "Cleared all memories (destructive)");
    Ok(())
}

/// Get memory stats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStats {
    pub semantic_count: u32,
    pub procedural_count: u32,
    pub episodic_count: u32,
    pub total: u32,
}

pub async fn get_memory_stats() -> Result<MemoryStats, MemoryError> {
    debug!("Getting memory stats");
    let client = get_client();

    let mut counts = [0u32; 3];
    for (i, name) in [
        COLLECTION_MEMORY_SEMANTIC,
        COLLECTION_MEMORY_PROCEDURAL,
        COLLECTION_MEMORY_EPISODIC,
    ].iter().enumerate() {
        if let Ok(collection) = client.get_collection(name).await {
            counts[i] = client.count(&collection.id).await.unwrap_or(0);
        }
    }

    Ok(MemoryStats {
        semantic_count: counts[0],
        procedural_count: counts[1],
        episodic_count: counts[2],
        total: counts.iter().sum(),
    })
}

// ============ ARTIFACT INDEXING ============

/// Index a session artifact (state.json, scratchpad.md, distill output) to Chroma memory.
/// Best-effort: logs warnings on failure, does not propagate errors.
pub async fn index_session_artifact(
    session_id: &str,
    filename: &str,
    content: &str,
    memory_type: MemoryType,
) {
    let id = format!("{}::artifact::{}", session_id, filename);
    let prefix = match memory_type {
        MemoryType::Semantic => "[ARTIFACT:SEMANTIC]",
        MemoryType::Procedural => "[ARTIFACT:PROCEDURAL]",
        MemoryType::Episodic => "[ARTIFACT:EPISODIC]",
    };

    // Truncate content to 8000 chars to avoid oversized embeddings
    let truncated: String = content.chars().take(8000).collect();
    let doc = format!("{} {} -- artifact '{}' from session {}", prefix, truncated, filename, session_id);

    let metadata = json!({
        "session_id": session_id,
        "source_type": "artifact",
        "artifact_name": filename,
    });

    match write_memory(memory_type, &id, &doc, Some(metadata)).await {
        Ok(()) => {
            info!(session_id = %session_id, filename = %filename, memory_type = %memory_type.as_str(), "Indexed session artifact");
        }
        Err(e) => {
            warn!(session_id = %session_id, filename = %filename, error = %e, "Failed to index session artifact");
        }
    }
}

// ============ EXTRACTION ============

/// Map a semantic marker string (e.g. "[INSIGHT]") to a MemoryType.
/// Returns None for unknown markers.
fn marker_to_memory_type(marker: &str) -> Option<MemoryType> {
    let normalized = marker.trim().trim_matches(|c| c == '[' || c == ']');
    match normalized.to_uppercase().as_str() {
        "INSIGHT" | "EVIDENCE" | "PATTERN" | "ASSUMPTION" => Some(MemoryType::Semantic),
        "DECISION" | "RISK" => Some(MemoryType::Procedural),
        "COUNTER" | "TENSION" | "THREAD" | "QUESTION" => Some(MemoryType::Episodic),
        _ => None,
    }
}

/// Extract marked claims, unresolved tensions, and thesis from a session
/// and upsert them into Chroma's agentic memory collections.
/// Best-effort: individual failures are logged and skipped.
pub async fn extract_session_markers(session: &Session) {
    let mut extracted = 0u32;
    let mut errors = 0u32;
    let session_title = &session.title;

    // Marked claims
    for claim in &session.claims {
        if let Some(ref marker) = claim.marker {
            let memory_type = match marker_to_memory_type(marker) {
                Some(mt) => mt,
                None => continue,
            };
            let id = format!("{}::{}", session.id, claim.id);
            let doc = format!("{} {} -- from session \"{}\"", marker, claim.content, session_title);
            let metadata = json!({
                "session_id": session.id,
                "session_title": session_title,
                "claim_id": claim.id,
                "marker": marker,
                "source_type": "claim",
            });
            match write_memory(memory_type, &id, &doc, Some(metadata)).await {
                Ok(()) => extracted += 1,
                Err(e) => {
                    warn!(claim_id = %claim.id, error = %e, "Failed to extract claim to memory");
                    errors += 1;
                }
            }
        }
    }

    // Unresolved tensions
    for tension in &session.tensions {
        if tension.resolution.is_some() {
            continue;
        }
        let id = format!("{}::tension::{}", session.id, tension.id);
        let doc = format!("[TENSION] Unresolved: {} -- from session \"{}\"", tension.description, session_title);
        let metadata = json!({
            "session_id": session.id,
            "session_title": session_title,
            "tension_id": tension.id,
            "claim_a_id": tension.claim_a_id,
            "claim_b_id": tension.claim_b_id,
            "source_type": "tension",
        });
        match write_memory(MemoryType::Episodic, &id, &doc, Some(metadata)).await {
            Ok(()) => extracted += 1,
            Err(e) => {
                warn!(tension_id = %tension.id, error = %e, "Failed to extract tension to memory");
                errors += 1;
            }
        }
    }

    // Thesis (only if confidence >= 0.5)
    if let Some(ref thesis) = session.thesis {
        if thesis.confidence >= 0.5 {
            let id = format!("{}::thesis", session.id);
            let doc = format!(
                "Thesis (confidence: {:.0}%): {} -- from session \"{}\"",
                thesis.confidence * 100.0,
                thesis.content,
                session_title,
            );
            let metadata = json!({
                "session_id": session.id,
                "session_title": session_title,
                "confidence": thesis.confidence,
                "source_type": "thesis",
            });
            match write_memory(MemoryType::Semantic, &id, &doc, Some(metadata)).await {
                Ok(()) => extracted += 1,
                Err(e) => {
                    warn!(error = %e, "Failed to extract thesis to memory");
                    errors += 1;
                }
            }
        }
    }

    info!(
        session_id = %session.id,
        extracted = extracted,
        errors = errors,
        "Session marker extraction complete"
    );
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub async fn chroma_write_memory(
    memory_type: String,
    id: String,
    content: String,
    metadata: Option<Value>,
) -> Result<(), MemoryError> {
    let mt = MemoryType::from_str(&memory_type)?;
    write_memory(mt, &id, &content, metadata).await
}

#[tauri::command]
pub async fn chroma_read_memories(
    memory_type: String,
    query: String,
    n_results: u32,
) -> Result<Vec<MemoryRecord>, MemoryError> {
    let mt = MemoryType::from_str(&memory_type)?;
    read_memories(mt, &query, n_results).await
}

#[tauri::command]
pub async fn chroma_list_memories(
    memory_type: String,
    limit: Option<u32>,
) -> Result<Vec<MemoryRecord>, MemoryError> {
    let mt = MemoryType::from_str(&memory_type)?;
    list_memories(mt, limit).await
}

#[tauri::command]
pub async fn chroma_delete_memory(
    memory_type: String,
    id: String,
) -> Result<(), MemoryError> {
    let mt = MemoryType::from_str(&memory_type)?;
    delete_memory(mt, &id).await
}

#[tauri::command]
pub async fn chroma_clear_memories(memory_type: String) -> Result<(), MemoryError> {
    let mt = MemoryType::from_str(&memory_type)?;
    clear_memories(mt).await
}

#[tauri::command]
pub async fn chroma_get_memory_stats() -> Result<MemoryStats, MemoryError> {
    get_memory_stats().await
}
