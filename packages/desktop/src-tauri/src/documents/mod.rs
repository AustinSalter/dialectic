//! Reference Document Management Module
//!
//! Handles document chunking, embedding, and retrieval for reference materials.

pub mod chunker;
pub mod embeddings;
pub mod retriever;

// Re-export key public types
pub use chunker::{
    Chunk, ChunkedDocument, ChunkerError, DocumentHandling, DocumentPersistence, FileEntry,
    SectionIndex,
};
pub use embeddings::{ChunkEmbedding, Embedding, EmbeddingError};
pub use retriever::{ReferenceDocument, RetrieverError, SearchResult};
