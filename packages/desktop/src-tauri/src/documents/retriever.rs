//! Document Retrieval
//!
//! Retrieves relevant chunks from documents based on query.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;
use ulid::Ulid;

use super::chunker::{chunk_document, ChunkedDocument, DocumentHandling, DocumentPersistence, ChunkerError, Chunk};
use super::embeddings::{generate_embedding, cache_embedding, cosine_similarity, Embedding};
use crate::session::validate_session_id;

/// Global document store
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
}

impl Serialize for RetrieverError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Document store
#[derive(Default)]
struct DocumentStore {
    /// Session ID to documents
    sessions: HashMap<String, SessionDocuments>,
}

/// Documents for a session
#[derive(Default)]
struct SessionDocuments {
    documents: HashMap<String, StoredDocument>,
}

/// Stored document with embeddings
struct StoredDocument {
    document: ChunkedDocument,
    persistence: DocumentPersistence,
    chunk_embeddings: Vec<(u32, Embedding)>, // (chunk_index, embedding)
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

/// Add a reference document to a session
pub fn add_reference(
    session_id: &str,
    path: &str,
    persistence: DocumentPersistence,
) -> Result<ReferenceDocument, RetrieverError> {
    ensure_initialized();

    let doc_id = Ulid::new().to_string();
    let chunked = chunk_document(Path::new(path), &doc_id)?;

    // Generate embeddings for chunks
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

    // Store document
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
pub fn remove_reference(session_id: &str, doc_id: &str) -> Result<(), RetrieverError> {
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

/// Search within a document
pub fn search_document(
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

    // Generate query embedding
    let query_embedding = generate_embedding(query)
        .map_err(|e| RetrieverError::EmbeddingFailed(e.to_string()))?;

    // Score all chunks
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

    // Sort by score
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(top_k);

    Ok(results)
}

/// Search across all documents in a session
pub fn search_all_documents(
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

    // Generate query embedding
    let query_embedding = generate_embedding(query)
        .map_err(|e| RetrieverError::EmbeddingFailed(e.to_string()))?;

    // Collect all chunks from all documents
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

    // Sort by score
    all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

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
pub fn clear_ephemeral(session_id: &str) {
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
pub fn clear_session(session_id: &str) {
    let mut store = DOCUMENT_STORE.write();
    if let Some(ref mut s) = *store {
        s.sessions.remove(session_id);
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn documents_add_reference(
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
    add_reference(&session_id, &canonical.to_string_lossy(), persistence)
}

#[tauri::command]
pub fn documents_remove_reference(
    session_id: String,
    doc_id: String,
) -> Result<(), RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    remove_reference(&session_id, &doc_id)
}

#[tauri::command]
pub fn documents_list_references(session_id: String) -> Result<Vec<ReferenceDocument>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    list_references(&session_id)
}

#[tauri::command]
pub fn documents_search_document(
    session_id: String,
    doc_id: String,
    query: String,
    top_k: usize,
) -> Result<Vec<SearchResult>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    search_document(&session_id, &doc_id, &query, top_k)
}

#[tauri::command]
pub fn documents_search_all(
    session_id: String,
    query: String,
    top_k: usize,
    token_budget: u32,
) -> Result<Vec<SearchResult>, RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    search_all_documents(&session_id, &query, top_k, token_budget)
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
pub fn documents_clear_ephemeral(session_id: String) -> Result<(), RetrieverError> {
    validate_session_id(&session_id).map_err(|_| RetrieverError::InvalidSessionId)?;
    clear_ephemeral(&session_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Integration tests would require file system setup
    // Unit tests for utility functions

    #[test]
    fn test_ensure_initialized() {
        ensure_initialized();
        let store = DOCUMENT_STORE.read();
        assert!(store.is_some());
    }
}
