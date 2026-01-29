//! Token counting using tiktoken-rs for Claude-compatible token estimation.
//!
//! Uses cl100k_base encoding which is compatible with Claude models.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use tiktoken_rs::cl100k_base;

/// Global token cache to avoid recounting identical content
static TOKEN_CACHE: RwLock<Option<TokenCache>> = RwLock::new(None);

/// Cache for token counts, keyed by content hash
pub struct TokenCache {
    cache: HashMap<u64, u32>,
    max_size: usize,
}

impl TokenCache {
    pub fn new(max_size: usize) -> Self {
        Self {
            cache: HashMap::with_capacity(max_size),
            max_size,
        }
    }

    /// Get cached token count for content hash
    pub fn get(&self, hash: u64) -> Option<u32> {
        self.cache.get(&hash).copied()
    }

    /// Store token count for content hash
    pub fn insert(&mut self, hash: u64, count: u32) {
        // Simple LRU: if at capacity, clear half the cache
        if self.cache.len() >= self.max_size {
            let keys_to_remove: Vec<_> = self.cache.keys().take(self.max_size / 2).copied().collect();
            for key in keys_to_remove {
                self.cache.remove(&key);
            }
        }
        self.cache.insert(hash, count);
    }
}

/// Initialize the token cache
fn ensure_cache_initialized() {
    let mut cache = TOKEN_CACHE.write();
    if cache.is_none() {
        *cache = Some(TokenCache::new(10000)); // Cache up to 10k entries
    }
}

/// Hash content for cache lookup
fn hash_content(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

/// Count tokens in text using cl100k_base encoding.
///
/// Results are cached by content hash to avoid recounting identical content.
pub fn count_tokens(text: &str) -> u32 {
    if text.is_empty() {
        return 0;
    }

    ensure_cache_initialized();
    let content_hash = hash_content(text);

    // Check cache first
    {
        let cache = TOKEN_CACHE.read();
        if let Some(ref c) = *cache {
            if let Some(count) = c.get(content_hash) {
                return count;
            }
        }
    }

    // Count tokens using tiktoken
    let bpe = match cl100k_base() {
        Ok(bpe) => bpe,
        Err(_) => return estimate_tokens_quick(text), // Fallback to estimate
    };
    let tokens = bpe.encode_with_special_tokens(text);
    let count = tokens.len() as u32;

    // Cache the result
    {
        let mut cache = TOKEN_CACHE.write();
        if let Some(ref mut c) = *cache {
            c.insert(content_hash, count);
        }
    }

    count
}

/// Count tokens for multiple pieces of text
pub fn count_tokens_batch(texts: &[&str]) -> Vec<u32> {
    texts.iter().map(|t| count_tokens(t)).collect()
}

/// Estimate tokens without caching (for one-off estimates)
pub fn estimate_tokens_quick(text: &str) -> u32 {
    // Quick estimate: ~4 chars per token on average
    // This is less accurate but very fast
    (text.len() as f64 / 4.0).ceil() as u32
}

/// Check if text exceeds a token limit
pub fn exceeds_token_limit(text: &str, limit: u32) -> bool {
    // Use quick estimate first for efficiency
    let quick_estimate = estimate_tokens_quick(text);
    if quick_estimate < limit / 2 {
        return false; // Definitely under
    }
    if quick_estimate > limit * 2 {
        return true; // Definitely over
    }
    // Need accurate count
    count_tokens(text) > limit
}

/// Clear the token cache (useful for testing or memory pressure)
pub fn clear_token_cache() {
    let mut cache = TOKEN_CACHE.write();
    if let Some(ref mut c) = *cache {
        c.cache.clear();
    }
}

/// Get cache statistics
pub fn get_cache_stats() -> (usize, usize) {
    let cache = TOKEN_CACHE.read();
    match *cache {
        Some(ref c) => (c.cache.len(), c.max_size),
        None => (0, 0),
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn context_count_tokens(text: String) -> u32 {
    count_tokens(&text)
}

#[tauri::command]
pub fn context_count_tokens_batch(texts: Vec<String>) -> Vec<u32> {
    texts.iter().map(|t| count_tokens(t)).collect()
}

#[tauri::command]
pub fn context_estimate_tokens(text: String) -> u32 {
    estimate_tokens_quick(&text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_tokens_empty() {
        assert_eq!(count_tokens(""), 0);
    }

    #[test]
    fn test_count_tokens_simple() {
        let count = count_tokens("Hello, world!");
        assert!(count > 0);
        assert!(count < 10); // Should be around 4 tokens
    }

    #[test]
    fn test_count_tokens_cached() {
        let text = "This is a test sentence for caching.";
        let count1 = count_tokens(text);
        let count2 = count_tokens(text);
        assert_eq!(count1, count2);
    }

    #[test]
    fn test_estimate_tokens_quick() {
        let text = "Hello world this is a test";
        let estimate = estimate_tokens_quick(text);
        let actual = count_tokens(text);
        // Estimate should be within 2x of actual
        assert!(estimate <= actual * 2);
        assert!(estimate >= actual / 2);
    }

    #[test]
    fn test_exceeds_token_limit() {
        let short_text = "Hi";
        let long_text = "This is a much longer piece of text that should definitely exceed a very small token limit.";

        assert!(!exceeds_token_limit(short_text, 100));
        assert!(exceeds_token_limit(long_text, 5));
    }
}
