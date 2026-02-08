//! Chroma Collection Schemas
//!
//! Defines the collection architecture for Dialectic and provides
//! helpers for collection lifecycle management.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::client::{ChromaClient, ChromaError, CollectionInfo};

/// Well-known collection names
pub const COLLECTION_DOCUMENTS: &str = "documents";
pub const COLLECTION_OBSIDIAN: &str = "obsidian";
pub const COLLECTION_MEMORY_SEMANTIC: &str = "memory_semantic";
pub const COLLECTION_MEMORY_PROCEDURAL: &str = "memory_procedural";
pub const COLLECTION_MEMORY_EPISODIC: &str = "memory_episodic";

/// All collections managed by Dialectic
pub const ALL_COLLECTIONS: &[&str] = &[
    COLLECTION_DOCUMENTS,
    COLLECTION_OBSIDIAN,
    COLLECTION_MEMORY_SEMANTIC,
    COLLECTION_MEMORY_PROCEDURAL,
    COLLECTION_MEMORY_EPISODIC,
];

/// Collection status info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionStatus {
    pub name: String,
    pub exists: bool,
    pub record_count: u32,
}

/// Ensure all Dialectic collections exist
pub async fn ensure_all_collections(client: &ChromaClient) -> Result<Vec<CollectionInfo>, ChromaError> {
    let mut collections = Vec::new();
    for name in ALL_COLLECTIONS {
        let collection = client.get_or_create_collection(name, None).await?;
        collections.push(collection);
    }
    Ok(collections)
}

/// Get status of all collections
pub async fn get_collection_status(client: &ChromaClient) -> Result<Vec<CollectionStatus>, ChromaError> {
    let existing = client.list_collections().await?;
    let existing_names: std::collections::HashSet<String> = existing.iter().map(|c| c.name.clone()).collect();

    let mut statuses = Vec::new();
    for name in ALL_COLLECTIONS {
        let exists = existing_names.contains(*name);
        let record_count = if exists {
            if let Some(coll) = existing.iter().find(|c| c.name == *name) {
                client.count(&coll.id).await.unwrap_or(0)
            } else {
                0
            }
        } else {
            0
        };

        statuses.push(CollectionStatus {
            name: name.to_string(),
            exists,
            record_count,
        });
    }

    Ok(statuses)
}

/// Build metadata for a document chunk
pub fn document_chunk_metadata(
    session_id: &str,
    doc_id: &str,
    chunk_index: u32,
    section: Option<&str>,
    file_type: &str,
    persistence: &str,
) -> Value {
    let mut meta = json!({
        "session_id": session_id,
        "doc_id": doc_id,
        "chunk_index": chunk_index as i64,
        "file_type": file_type,
        "persistence": persistence,
    });
    if let Some(sec) = section {
        meta["section"] = json!(sec);
    }
    meta
}

/// Build metadata for an Obsidian note chunk
pub fn obsidian_chunk_metadata(
    path: &str,
    title: &str,
    tags: &[String],
    token_count: u32,
    modified: &str,
) -> Value {
    json!({
        "path": path,
        "title": title,
        "tags": tags.join(","),
        "token_count": token_count as i64,
        "modified": modified,
    })
}

/// Build a chunk ID from components
pub fn chunk_id(collection: &str, doc_id: &str, chunk_index: u32) -> String {
    format!("{}_{}_{}", collection, doc_id, chunk_index)
}

/// Build a session-scoped where filter
pub fn session_filter(session_id: &str) -> Value {
    json!({ "session_id": { "$eq": session_id } })
}

/// Build a document-scoped where filter
pub fn document_filter(session_id: &str, doc_id: &str) -> Value {
    json!({
        "$and": [
            { "session_id": { "$eq": session_id } },
            { "doc_id": { "$eq": doc_id } }
        ]
    })
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub async fn chroma_ensure_collections() -> Result<Vec<String>, ChromaError> {
    let client = super::client::get_client();
    let collections = ensure_all_collections(&client).await?;
    Ok(collections.into_iter().map(|c| c.name).collect())
}

#[tauri::command]
pub async fn chroma_get_collection_status() -> Result<Vec<CollectionStatus>, ChromaError> {
    let client = super::client::get_client();
    get_collection_status(&client).await
}
