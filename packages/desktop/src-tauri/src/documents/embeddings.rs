//! Local Embeddings using Feature Hashing
//!
//! Generates embeddings for document chunks for semantic search.
//! Uses the hashing trick to produce fixed-size vectors without maintaining
//! a vocabulary map. Embeddings are stable: the same text always produces
//! the same vector regardless of what other documents exist.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use thiserror::Error;

/// Dimensionality of the embedding vectors.
const EMBEDDING_DIM: usize = 256;

#[derive(Error, Debug)]
pub enum EmbeddingError {
    #[error("Embedding model not initialized")]
    NotInitialized,
    #[error("Embedding generation failed: {0}")]
    GenerationFailed(String),
}

impl Serialize for EmbeddingError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Embedding vector
pub type Embedding = Vec<f32>;

/// Embedding cache
static EMBEDDING_CACHE: RwLock<Option<EmbeddingCache>> = RwLock::new(None);

/// Cache for pre-computed document chunk embeddings.
#[derive(Default)]
struct EmbeddingCache {
    /// Chunk ID to embedding
    embeddings: HashMap<String, Embedding>,
}

/// Embedding result for a chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEmbedding {
    pub chunk_id: String,
    pub embedding: Embedding,
}

/// Initialize the embedding cache (idempotent).
pub fn initialize_embeddings() {
    let mut cache = EMBEDDING_CACHE.write();
    if cache.is_none() {
        *cache = Some(EmbeddingCache::default());
    }
}

/// Hash a token to a bucket index in `[0, EMBEDDING_DIM)`.
fn hash_token(token: &str) -> usize {
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    (hasher.finish() as usize) % EMBEDDING_DIM
}

/// Generate embedding for text using feature hashing.
///
/// Each token is hashed to a fixed bucket in `[0, 256)`. The resulting
/// term-frequency vector is L2-normalized. This is a pure function — the
/// same input always produces the same output regardless of global state.
pub fn generate_embedding(text: &str) -> Result<Embedding, EmbeddingError> {
    // Tokenize
    let tokens: Vec<&str> = text.split_whitespace()
        .map(|t| t.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|t| !t.is_empty())
        .collect();

    if tokens.is_empty() {
        return Ok(vec![0.0; EMBEDDING_DIM]);
    }

    // Build term-frequency vector via feature hashing
    let mut tf = vec![0.0f32; EMBEDDING_DIM];

    for token in &tokens {
        let idx = hash_token(&token.to_lowercase());
        tf[idx] += 1.0;
    }

    // L2 normalize
    let norm: f32 = tf.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in &mut tf {
            *x /= norm;
        }
    }

    Ok(tf)
}

/// Generate embeddings for multiple chunks
pub fn generate_embeddings_batch(texts: &[&str]) -> Result<Vec<Embedding>, EmbeddingError> {
    texts.iter()
        .map(|t| generate_embedding(t))
        .collect()
}

/// Store embedding in cache
pub fn cache_embedding(chunk_id: &str, embedding: Embedding) {
    initialize_embeddings();
    let mut cache = EMBEDDING_CACHE.write();
    if let Some(ref mut c) = *cache {
        c.embeddings.insert(chunk_id.to_string(), embedding);
    }
}

/// Get cached embedding
pub fn get_cached_embedding(chunk_id: &str) -> Option<Embedding> {
    let cache = EMBEDDING_CACHE.read();
    cache.as_ref()?.embeddings.get(chunk_id).cloned()
}

/// Calculate cosine similarity between two embeddings
pub fn cosine_similarity(a: &Embedding, b: &Embedding) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

/// Find most similar embeddings to query
pub fn find_similar(
    query_embedding: &Embedding,
    candidates: &[(String, Embedding)],
    top_k: usize,
) -> Vec<(String, f32)> {
    let mut scored: Vec<_> = candidates.iter()
        .map(|(id, emb)| (id.clone(), cosine_similarity(query_embedding, emb)))
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);
    scored
}

/// Clear embedding cache
pub fn clear_cache() {
    let mut cache = EMBEDDING_CACHE.write();
    if let Some(ref mut c) = *cache {
        c.embeddings.clear();
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn documents_generate_embedding(text: String) -> Result<Embedding, EmbeddingError> {
    generate_embedding(&text)
}

#[tauri::command]
pub fn documents_cosine_similarity(a: Embedding, b: Embedding) -> f32 {
    cosine_similarity(&a, &b)
}

#[tauri::command]
pub fn documents_cache_embedding(chunk_id: String, embedding: Embedding) {
    cache_embedding(&chunk_id, embedding)
}

#[tauri::command]
pub fn documents_get_cached_embedding(chunk_id: String) -> Option<Embedding> {
    get_cached_embedding(&chunk_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_embedding() {
        let embedding = generate_embedding("Hello world this is a test").unwrap();
        assert_eq!(embedding.len(), EMBEDDING_DIM);
    }

    #[test]
    fn test_embedding_stability() {
        // Generate embedding for text A
        let emb1 = generate_embedding("The quick brown fox").unwrap();

        // Generate embeddings for unrelated text (would grow vocabulary in old impl)
        let _ = generate_embedding("completely different words zebra giraffe quantum");
        let _ = generate_embedding("another set of unique vocabulary items here");

        // Generate embedding for text A again — must be identical
        let emb2 = generate_embedding("The quick brown fox").unwrap();

        assert_eq!(emb1, emb2, "Embeddings for the same text must be identical regardless of intermediate calls");
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        assert!(cosine_similarity(&a, &b).abs() < 0.001);
    }

    #[test]
    fn test_cache_embedding() {
        let embedding = vec![1.0, 2.0, 3.0];
        cache_embedding("test_chunk", embedding.clone());

        let retrieved = get_cached_embedding("test_chunk");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), embedding);
    }

    #[test]
    fn test_find_similar() {
        let query = vec![1.0, 0.0, 0.0];
        let candidates = vec![
            ("a".to_string(), vec![1.0, 0.0, 0.0]),
            ("b".to_string(), vec![0.0, 1.0, 0.0]),
            ("c".to_string(), vec![0.7, 0.7, 0.0]),
        ];

        let results = find_similar(&query, &candidates, 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "a"); // Most similar
    }
}
