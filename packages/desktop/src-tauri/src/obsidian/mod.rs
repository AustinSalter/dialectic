//! Obsidian Integration Module
//!
//! Read-only integration with user's Obsidian vault for semantic note retrieval.

pub mod indexer;
pub mod query;
pub mod watcher;

// Re-export public types
pub use indexer::*;
pub use query::*;
pub use watcher::*;
