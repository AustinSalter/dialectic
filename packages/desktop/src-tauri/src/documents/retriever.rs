//! Document Retrieval
//!
//! Retrieves relevant chunks from documents based on query.
//! Uses Chroma for semantic search when available, falling back
//! to in-memory feature-hash search when Chroma is offline.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use ulid::Ulid;

use super::chunker::{chunk_document, ChunkedDocument, DocumentHandling, DocumentPersistence, ChunkerError, Chunk};
use super::embeddings::{generate_embedding, cache_embedding, cosine_similarity, Embedding};
use crate::session::validate_session_id;
use crate::chroma::client::{get_client, ChromaError};
use crate::chroma::collections::{
    COLLECTION_DOCUMENTS, chunk_id, document_chunk_metadata, session_filter, document_filter,
};

/// Global document store (in-memory fallback + metadata tracking)
static DOCUMENT_STORE: RwLock<Option<DocumentStore>> = RwLock::new(None);

#[derive(Error, Debug)]
pub enum RetrieverError {
    #[error("Document not found: {0}")]
    NotFound(String),
    #[error("Chunker error: {0}")]
    Chunker(#[from] ChunkerError),
    #[error("Store not initialized")]
    NotInitialized,
    #[error("Invalid session ID")]
    InvalidSessionId,
    #[error("Embedding generation failed: {0}")]
    EmbeddingFailed(String),
    #[error("Chroma error: {0}")]
    ChromaError(String),
}

impl Serialize for RetrieverError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<ChromaError> for RetrieverError {
    fn from(e: ChromaError) -> Self {
        RetrieverError::ChromaError(e.to_string())
    }
}

/// Document store — keeps metadata in memory, chunks in Chroma
#[derive(Default)]
struct DocumentStore {
    sessions: HashMap<String, SessionDocuments>,
}

/// Documents for a session
#[derive(Default)]
struct SessionDocuments {
    documents: HashMap<String, StoredDocument>,
}

/// Stored document with chunks and optional local embeddings (fallback)
struct StoredDocument {
    document: ChunkedDocument,
    persistence: DocumentPersistence,
    /// Fallback embeddings for when Chroma is offline
    chunk_embeddings: Vec<(u32, Embedding)>,
}

/// Reference document metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceDocument {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub total_tokens: u32,
    pub loaded_tokens: u32,
    pub handling: DocumentHandling,
    pub persistence: DocumentPersistence,
    pub chunk_count: u32,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub doc_id: String,
    pub chunk_index: u32,
    pub content: String,
    pub section: Option<String>,
    pub score: f32,
    pub token_count: u32,
}

/// Initialize the document store
fn ensure_initialized() {
    let mut store = DOCUMENT_STORE.write();
    if store.is_none() {
        *store = Some(DocumentStore::default());
    }
}

/// Cached Chroma availability check (5-second TTL)
static CHROMA_AVAILABLE: AtomicBool = AtomicBool::new(false);
static CHROMA_CHECKED_AT: AtomicU64 = AtomicU64::new(0);
const CHROMA_CACHE_TTL_MS: u64 = 5_000;

async fn chroma_available() -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let last_check = CHROMA_CHECKED_AT.load(Ordering::Relaxed);

    if now.saturating_sub(last_check) < CHROMA_CACHE_TTL_MS {
        return CHROMA_AVAILABLE.load(Ordering::Relaxed);
    }

    let client = get_client();
    let available = client.heartbeat().await.is_ok();
    CHROMA_AVAILABLE.store(available, Ordering::Relaxed);
    CHROMA_CHECKED_AT.store(now, Ordering::Relaxed);
    available
}

/// Try to index chunks into Chroma. Returns the collection ID on success.
async fn index_to_chroma(
    session_id: &str,
    doc_id: &str,
    chunked: &ChunkedDocument,
    persistence: &DocumentPersistence,
) -> Option<String> {
    let client = get_client();

    let collection = match client.get_or_create_collection(COLLECTION_DOCUMENTS, None).await {
        Ok(c) => c,
        Err(_) => return None,
    };

    let persistence_str = match persistence {
        DocumentPersistence::Ephemeral => "ephemeral",
        DocumentPersistence::Cached => "cached",
        DocumentPersistence::Permanent => "permanent",
    };

    let file_type = std::path::Path::new(&chunked.path)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Batch upsert chunks
    let ids: Vec<String> = chunked.chunks.iter()
        .map(|c| chunk_id(COLLECTION_DOCUMENTS, doc_id, c.index))
        .collect();

    let documents: Vec<String> = chunked.chunks.iter()
        .map(|c| c.content.clone())
        .collect();

    let metadatas: Vec<serde_json::Value> = chunked.chunks.iter()
        .map(|c| document_chunk_metadata(
            session_id,
            doc_id,
            c.index,
            c.section.as_deref(),
            &file_type,
            persistence_str,
        ))
        .collect();

    match client.upsert(
        &collection.id,
        ids,
        Some(documents),
        None, // Let Chroma generate embeddings
        Some(metadatas),
    ).await {
        Ok(_) => Some(collection.id.clone()),
        Err(e) => {
            eprintln!("Failed to index to Chroma: {}", e);
            None
        }
    }
}

/// Add a reference document to a session
pub async fn add_reference(
    session_id: &str,
    path: &str,
    persistence: DocumentPersistence,
) -> Result<ReferenceDocument, RetrieverError> {
    ensure_initialized();

    let doc_id = Ulid::new().to_string();
    let chunked = chunk_document(Path::new(path), &doc_id)?;

    // Try Chroma first (best-effort, fall back to local embeddings)
    let _ = index_to_chroma(session_id, &doc_id, &chunked, &persistence).await;

    // Generate local fallback embeddings regardless
    let mut chunk_embeddings = Vec::new();
    for chunk in &chunked.chunks {
        let cache_key = format!("{}_{}", doc_id, chunk.index);
        if let Ok(embedding) = generate_embedding(&chunk.content) {
            cache_embedding(&cache_key, embedding.clone());
            chunk_embeddings.push((chunk.index, embedding));
        }
    }

    let loaded_tokens: u32 = chunked.chunks.iter().map(|c| c.token_count).sum();
    let chunk_count = chunked.chunks.len() as u32;

    let reference = ReferenceDocument {
        id: doc_id.clone(),
        filename: chunked.filename.clone(),
        path: chunked.path.clone(),
        total_tokens: chunked.total_tokens,
        loaded_tokens,
        handling: chunked.handling,
        persistence,
        chunk_count,
    };

    // Store metadata
    {
        let mut store = DOCUMENT_STORE.write();
        let store = store.as_mut().ok_or(RetrieverError::NotInitialized)?;

        let session = store.sessions
            .entry(session_id.to_string())
            .or_insert_with(SessionDocuments::default);

        session.documents.insert(doc_id, StoredDocument {
            document: chunked,
            persistence,
            chunk_embeddings,
        });
    }

    Ok(reference)
}

/// Remove a reference document from a session
pub async fn remove_reference(session_id: &str, doc_id: &str) -> Result<(), RetrieverError> {
    // Remove from Chroma
    let client = get_client();
    if let Ok(collection) = client.get_collection(COLLECTION_DOCUMENTS).await {
        let filter = document_filter(session_id, doc_id);
        let _ = client.delete(&collection.id, None, Some(filter)).await;
    }

    // Remove from in-memory store
    let mut store = DOCUMENT_STORE.write();
    let store = store.as_mut().ok_or(RetrieverError::NotInitialized)?;

    if let Some(session) = store.sessions.get_mut(session_id) {
        session.documents.remove(doc_id);
    }

    Ok(())
}

/// Get all reference documents for a session
pub fn list_references(session_id: &str) -> Result<Vec<ReferenceDocument>, RetrieverError> {
    let store = DOCUMENT_STORE.read();
    let store = store.as_ref().ok_or(RetrieverError::NotInitialized)?;

    let session = match store.sessions.get(session_id) {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };

    let references = session.documents.iter()
        .map(|(id, stored)| {
            let loaded_tokens: u32 = stored.document.chunks.iter()
                .map(|c| c.token_count)
                .sum();

            ReferenceDocument {
                id: id.clone(),
                filename: stored.document.filename.clone(),
                path: stored.document.path.clone(),
                total_tokens: stored.document.total_tokens,
                loaded_tokens,
                handling: stored.document.handling,
                persistence: stored.persistence,
                chunk_count: stored.document.chunks.len() as u32,
            }
        })
        .collect();

    Ok(references)
}

/// Search within a document — tries Chroma first, falls back to local
pub async fn search_document(
    session_id: &str,
    doc_id: &str,
    query: &str,
    top_k: usize,
) -> Result<Vec<SearchResult>, RetrieverError> {
    // Try Chroma first
    if chroma_available().await {
        if let Ok(results) = search_document_chroma(session_id, doc_id, query, top_k).await {
            if !results.is_empty() {
                return Ok(results);
            }
        }
    }

    // Fallback to local feature-hash search
    search_document_local(session_id, doc_id, query, top_k)
}

/// Search via Chroma
async fn search_document_chroma(
    session_id: &str,
    doc_id: &str,
    query: &str,
    top_k: usize,
) -> Result<Vec<SearchResult>, RetrieverError> {
    let client = get_client();
    let collection = client.get_collection(COLLECTION_DOCUMENTS).await?;

    let filter = document_filter(session_id, doc_id);

    let result = client.query(
        &collection.id,
        None,
        Some(vec![query.to_string()]),
        top_k as u32,
        Some(filter),
        None,
        Some(vec![
            "documents".to_string(),
            "metadatas".to_string(),
            "distances".to_string(),
        ]),
    ).await?;

    let mut results = Vec::new();

    for (query_idx, ids) in result.ids.iter().enumerate() {
        for (result_idx, _id) in ids.iter().enumerate() {
            let content = result.documents.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .and_then(|d| d.clone())
                .unwrap_or_default();

            let metadata = result.metadatas.as_ref()
                .and_then(|m| m.get(query_idx))
                .and_then(|m| m.get(result_idx))
                .and_then(|m| m.clone());

            let distance = result.distances.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .copied()
                .unwrap_or(f32::MAX);

            let chunk_index = metadata.as_ref()
                .and_then(|m| m.get("chunk_index"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as u32;

            let section = metadata.as_ref()
                .and_then(|m| m.get("section"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let token_count = (content.len() as f64 / 4.0).ceil() as u32;
            let score = 1.0 / (1.0 + distance);

            results.push(SearchResult {
                doc_id: doc_id.to_string(),
                chunk_index,
                content,
                section,
                score,
                token_count,
            });
        }
    }

    Ok(results)
}

/// Search using local feature-hash embeddings (fallback)
fn search_document_local(
    session_id: &str,
    doc_id: &str,
    query: &str,
    top_k: usize,
) -> Result<Vec<SearchResult>, RetrieverError> {
    let store = DOCUMENT_STORE.read();
    let store = store.as_ref().ok_or(RetrieverError::NotInitialized)?;

    let session = store.sessions.get(session_id)
        .ok_or_else(|| RetrieverError::NotFound(session_id.to_string()))?;

    let stored = session.documents.get(doc_id)
        .ok_or_else(|| RetrieverError::NotFound(doc_id.to_string()))?;

    let query_embedding = generate_embedding(query)
        .map_err(|e| RetrieverError::EmbeddingFailed(e.to_string()))?;

    let mut results: Vec<SearchResult> = stored.chunk_embeddings.iter()
        .filter_map(|(chunk_index, embedding)| {
            let score = cosine_similarity(&query_embedding, embedding);
            if score <= 0.0 {
                return None;
            }

            stored.document.chunks.get(*chunk_index as usize)
                .map(|chunk| SearchResult {
                    doc_id: doc_id.to_string(),
                    chunk_index: *chunk_index,
                    content: chunk.content.clone(),
                    section: chunk.section.clone(),
                    score,
                    token_count: chunk.token_count,
                })
        })
        .collect();

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(top_k);

    Ok(results)
}

/// Search across all documents in a session
pub async fn search_all_documents(
    session_id: &str,
    query: &str,
    top_k: usize,
    token_budget: u32,
) -> Result<Vec<SearchResult>, RetrieverError> {
    // Try Chroma first
    if chroma_available().await {
        if let Ok(results) = search_all_chroma(session_id, query, top_k, token_budget).await {
            if !results.is_empty() {
                return Ok(results);
            }
        }
    }

    // Fallback to local
    search_all_local(session_id, query, top_k, token_budget)
}

/// Search all documents via Chroma
async fn search_all_chroma(
    session_id: &str,
    query: &str,
    top_k: usize,
    token_budget: u32,
) -> Result<Vec<SearchResult>, RetrieverError> {
    let client = get_client();
    let collection = client.get_collection(COLLECTION_DOCUMENTS).await?;

    let filter = session_filter(session_id);

    let result = client.query(
        &collection.id,
        None,
        Some(vec![query.to_string()]),
        (top_k * 2) as u32, // Request extra to allow budget filtering
        Some(filter),
        None,
        Some(vec![
            "documents".to_string(),
            "metadatas".to_string(),
            "distances".to_string(),
        ]),
    ).await?;

    let mut all_results = Vec::new();

    for (query_idx, ids) in result.ids.iter().enumerate() {
        for (result_idx, _id) in ids.iter().enumerate() {
            let content = result.documents.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .and_then(|d| d.clone())
                .unwrap_or_default();

            let metadata = result.metadatas.as_ref()
                .and_then(|m| m.get(query_idx))
                .and_then(|m| m.get(result_idx))
                .and_then(|m| m.clone());

            let distance = result.distances.as_ref()
                .and_then(|d| d.get(query_idx))
                .and_then(|d| d.get(result_idx))
                .copied()
                .unwrap_or(f32::MAX);

            let doc_id = metadata.as_ref()
                .and_then(|m| m.get("doc_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let chunk_index = metadata.as_ref()
                .and_then(|m| m.get("chunk_index"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as u32;

            let section = metadata.as_ref()
                .and_then(|m| m.get("section"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let token_count = (content.len() as f64 / 4.0).ceil() as u32;
            let score = 1.0 / (1.0 + distance);

            all_results.push(SearchResult {
                doc_id,
                chunk_index,
                content,
                section,
                score,
                token_count,
            });
        }
    }

    // Apply token budget
    let mut results = Vec::new();
    let mut total_tokens = 0u32;

    for result in all_results {
        if total_tokens + result.token_count > token_budget {
            break;
        }
        total_tokens += result.token_count;
        results.push(result);

        if results.len() >= top_k {
            break;
        }
    }

    Ok(results)
}

/// Search all documents locally (fallback)
fn search_all_local(
    session_id: &str,
    query: &str,
    top_k: usize,
    token_budget: u32,
) -> Result<Vec<SearchResult>, RetrieverError> {
    let store = DOCUMENT_STORE.read();
    let store = store.as_ref().ok_or(RetrieverError::NotInitialized)?;

    let session = match store.sessions.get(session_id) {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };

    let query_embedding = generate_embedding(query)
        .map_err(|e| RetrieverError::EmbeddingFailed(e.to_string()))?;

    let mut all_results: Vec<SearchResult> = Vec::new();

    for (doc_id, stored) in &session.documents {
        for (chunk_index, embedding) in &stored.chunk_embeddings {
            let score = cosine_similarity(&query_embedding, embedding);
            if score <= 0.0 {
                continue;
            }

            if let Some(chunk) = stored.document.chunks.get(*chunk_index as usize) {
                all_results.push(SearchResult {
                    doc_id: doc_id.to_string(),
                    chunk_index: *chunk_index,
                    content: chunk.content.clone(),
                    section: chunk.section.clone(),
                    score,
                    token_count: chunk.token_count,
                });
            }
        }
    }

    all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    let mut results = Vec::new();
    let mut total_tokens = 0u32;

    for result in all_results {
        if total_tokens + result.token_count > token_budget {
            break;
        }
        total_tokens += result.token_count;
        results.push(result);

        if results.len() >= top_k {
            break;
        }
    }

    Ok(results)
}

/// Get a specific chunk from a document
pub fn get_chunk(session_id: &str, doc_id: &str, chunk_index: u32) -> Result<Chunk, RetrieverError> {
    let store = DOCUMENT_STORE.read();
    let store = store.as_ref().ok_or(RetrieverError::NotInitialized)?;

    let session = store.sessions.get(session_id)
        .ok_or_else(|| RetrieverError::NotFound(session_id.to_string()))?;

    let stored = session.documents.get(doc_id)
        .ok_or_else(|| RetrieverError::NotFound(doc_id.to_string()))?;

    stored.document.chunks.get(chunk_index as usize)
        .cloned()
        .ok_or_else(|| RetrieverError::NotFound(format!("Chunk {} not found", chunk_index)))
}

/// Clear ephemeral documents from a session
pub async fn clear_ephemeral(session_id: &str) {
    // Remove ephemeral docs from Chroma
    let client = get_client();
    if let Ok(collection) = client.get_collection(COLLECTION_DOCUMENTS).await {
        let filter = serde_json::json!({
            "$and": [
                { "session_id": { "$eq": session_id } },
                { "persistence": { "$eq": "ephemeral" } }
            ]
        });
        let _ = client.delete(&collection.id, None, Some(filter)).await;
    }

    // Remove from in-memory store
    let mut store = DOCUMENT_STORE.write();
    if let Some(ref mut s) = *store {
        if let Some(session) = s.sessions.get_mut(session_id) {
            session.documents.retain(|_, stored| {
                stored.persistence != DocumentPersistence::Ephemeral
            });
        }
    }
}

/// Clear all documents from a session
pub async fn clear_session(session_id: &str) {
    // Remove from Chroma
    let client = get_client();
    if let Ok(collection) = client.get_collection(COLLECTION_DOCUMENTS).await {
        let filter = session_filter(session_id);
        let _ = client.delete(&collection.id, None, Some(filter)).await;
    }

    // Remove from in-memory store
    let mut store = DOCUMENT_STORE.write();
    if let Some(ref mut s) = *store {
        s.sessions.remove(session_id);
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub async fn documents_add_reference(
    session_id: String,
    path: String,
    persistence: DocumentPersistence,
) -> Result<ReferenceDocument, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    // Canonicalize and validate the path is under the user's home directory
    let canonical = std::path::Path::new(&path).canonicalize()
        .map_err(|e| RetrieverError::Chunker(super::chunker::ChunkerError::Io(e)))?;
    if let Some(home) = dirs::home_dir() {
        if !canonical.starts_with(&home) {
            return Err(RetrieverError::Chunker(super::chunker::ChunkerError::Io(
                std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Path must be within home directory"),
            )));
        }
    }
    add_reference(&session_id, &canonical.to_string_lossy(), persistence).await
}

#[tauri::command]
pub async fn documents_remove_reference(
    session_id: String,
    doc_id: String,
) -> Result<(), RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    remove_reference(&session_id, &doc_id).await
}

#[tauri::command]
pub fn documents_list_references(session_id: String) -> Result<Vec<ReferenceDocument>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    list_references(&session_id)
}

#[tauri::command]
pub async fn documents_search_document(
    session_id: String,
    doc_id: String,
    query: String,
    top_k: usize,
) -> Result<Vec<SearchResult>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    search_document(&session_id, &doc_id, &query, top_k).await
}

#[tauri::command]
pub async fn documents_search_all(
    session_id: String,
    query: String,
    top_k: usize,
    token_budget: u32,
) -> Result<Vec<SearchResult>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    search_all_documents(&session_id, &query, top_k, token_budget).await
}

#[tauri::command]
pub fn documents_get_chunk(
    session_id: String,
    doc_id: String,
    chunk_index: u32,
) -> Result<Chunk, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    get_chunk(&session_id, &doc_id, chunk_index)
}

#[tauri::command]
pub async fn documents_clear_ephemeral(session_id: String) -> Result<(), RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    clear_ephemeral(&session_id).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_initialized() {
        ensure_initialized();
        let store = DOCUMENT_STORE.read();
        assert!(store.is_some());
    }
}
