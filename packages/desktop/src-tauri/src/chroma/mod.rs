//! Chroma Vector Database Integration
//!
//! Manages a Chroma sidecar process and provides semantic search,
//! agentic memory, and collection management for Dialectic.

pub mod sidecar;
pub mod client;
pub mod collections;
pub mod search;
pub mod memory;
