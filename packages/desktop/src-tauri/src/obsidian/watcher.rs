//! Obsidian Vault File Watcher
//!
//! Monitors vault for changes and triggers re-indexing.

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::indexer::{index_vault, ObsidianError};

/// Global vault watcher
static VAULT_WATCHER: RwLock<Option<VaultWatcher>> = RwLock::new(None);

/// Vault watcher state
struct VaultWatcher {
    _debouncer: Debouncer<RecommendedWatcher>,
    vault_path: PathBuf,
}

/// File change event for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultChangeEvent {
    pub paths: Vec<String>,
    pub reindexed: bool,
}

/// Start watching the vault for changes
pub fn start_watching(app: AppHandle, vault_path: PathBuf) -> Result<(), ObsidianError> {
    // Stop existing watcher if any
    stop_watching();

    let app_handle = app.clone();

    // Create debouncer with 2 second delay
    let mut debouncer = new_debouncer(
        Duration::from_secs(2),
        move |result: Result<Vec<DebouncedEvent>, notify::Error>| {
            if let Ok(events) = result {
                let paths: Vec<String> = events.iter()
                    .filter_map(|e| e.path.to_str().map(|s| s.to_string()))
                    .filter(|p| p.ends_with(".md"))
                    .collect();

                if !paths.is_empty() {
                    // Re-index vault
                    let reindexed = index_vault().is_ok();

                    // Emit event to frontend
                    let event = VaultChangeEvent { paths, reindexed };
                    let _ = app_handle.emit("vault-changed", &event);
                }
            }
        },
    ).map_err(|e| ObsidianError::Io(std::io::Error::new(
        std::io::ErrorKind::Other,
        e.to_string(),
    )))?;

    // Watch the vault directory
    debouncer.watcher().watch(&vault_path, RecursiveMode::Recursive)
        .map_err(|e| ObsidianError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        )))?;

    // Store watcher
    let mut watcher = VAULT_WATCHER.write();
    *watcher = Some(VaultWatcher {
        _debouncer: debouncer,
        vault_path,
    });

    Ok(())
}

/// Stop watching the vault
pub fn stop_watching() {
    let mut watcher = VAULT_WATCHER.write();
    *watcher = None;
}

/// Check if vault is being watched
pub fn is_watching() -> bool {
    VAULT_WATCHER.read().is_some()
}

/// Get the currently watched vault path
pub fn get_watched_path() -> Option<PathBuf> {
    VAULT_WATCHER.read().as_ref().map(|w| w.vault_path.clone())
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn obsidian_start_watching(app: AppHandle, vault_path: String) -> Result<(), ObsidianError> {
    // Canonicalize and validate path matches the configured vault
    let canonical_path = PathBuf::from(&vault_path).canonicalize()
        .map_err(|_| ObsidianError::InvalidPath("Cannot resolve vault path".to_string()))?;

    // Verify this is the currently configured vault
    if let Some(configured_vault) = super::indexer::get_vault_index().ok().map(|i| i.vault_path) {
        let configured_canonical = configured_vault.canonicalize()
            .map_err(|_| ObsidianError::InvalidPath("Cannot resolve configured vault path".to_string()))?;
        if canonical_path != configured_canonical {
            return Err(ObsidianError::InvalidPath("Path does not match configured vault".to_string()));
        }
    }

    start_watching(app, canonical_path)
}

#[tauri::command]
pub fn obsidian_stop_watching() {
    stop_watching()
}

#[tauri::command]
pub fn obsidian_is_watching() -> bool {
    is_watching()
}

#[tauri::command]
pub fn obsidian_get_watched_path() -> Option<String> {
    get_watched_path().map(|p| p.to_string_lossy().to_string())
}
