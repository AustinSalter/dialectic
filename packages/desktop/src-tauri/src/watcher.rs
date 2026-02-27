use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::sync::LazyLock;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::session::Session;
use crate::chroma::memory::extract_session_markers;

#[derive(Error, Debug)]
pub enum WatcherError {
    #[error("Watcher error: {0}")]
    Notify(#[from] notify::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Session error: {0}")]
    Session(String),
}

impl Serialize for WatcherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Watcher handle
struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

/// Global watcher manager
struct WatcherManager {
    watchers: HashMap<String, WatcherHandle>,
}

impl WatcherManager {
    fn new() -> Self {
        Self {
            watchers: HashMap::new(),
        }
    }
}

static WATCHER_MANAGER: LazyLock<Mutex<WatcherManager>> =
    LazyLock::new(|| Mutex::new(WatcherManager::new()));

/// Event payload sent to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUpdatedEvent {
    pub session_id: String,
    pub path: String,
    pub change_type: String,
}

#[tauri::command]
pub fn watch_session(app: AppHandle, session_id: String) -> Result<(), WatcherError> {
    // Check if already watching (short lock)
    {
        let manager = WATCHER_MANAGER.lock();
        if manager.watchers.contains_key(&session_id) {
            tracing::debug!(session_id = %session_id, "Session already watched, skipping");
            return Ok(());
        }
    }

    // Compute and validate session dir outside the lock
    let session_dir = crate::session::get_session_dir(&app, &session_id)
        .map_err(|e| WatcherError::Session(e.to_string()))?;

    let canonical_dir = session_dir.canonicalize()
        .map_err(WatcherError::Io)?;

    tracing::info!(session_id = %session_id, dir = %canonical_dir.display(), "Starting session watcher");

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    // Create watcher outside the lock (may do I/O)
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Only emit for session.json modifications
                for path in &event.paths {
                    if path.file_name().map(|n| n == "session.json").unwrap_or(false) {
                        let event_name = format!("session-updated-{}", session_id_clone);
                        let payload = SessionUpdatedEvent {
                            session_id: session_id_clone.clone(),
                            path: path.to_string_lossy().to_string(),
                            change_type: format!("{:?}", event.kind),
                        };
                        tracing::debug!(session_id = %session_id_clone, event = %event_name, "Emitting session-updated event");
                        if let Err(e) = app_clone.emit(&event_name, payload) {
                            tracing::warn!(session_id = %session_id_clone, error = %e, "Failed to emit session-updated event");
                        }

                        // Extract semantic markers to Chroma (best-effort, async)
                        if let Ok(content) = fs::read_to_string(path) {
                            if let Ok(session) = serde_json::from_str::<Session>(&content) {
                                let has_markers = session.claims.iter().any(|c| c.marker.is_some());
                                let has_unresolved = session.tensions.iter().any(|t| t.resolution.is_none());
                                let has_thesis = session.thesis.is_some();
                                if has_markers || has_unresolved || has_thesis {
                                    tauri::async_runtime::spawn(async move {
                                        extract_session_markers(&session).await;
                                    });
                                }
                            } else {
                                tracing::debug!(session_id = %session_id_clone, "Skipping extraction: session.json parse failed (likely mid-write)");
                            }
                        }
                    }
                }
            }
            Err(e) => tracing::warn!(error = %e, "Watch error"),
        }
    })?;

    // Start watching outside the lock
    watcher.watch(&canonical_dir, RecursiveMode::NonRecursive)?;

    // Insert into manager (short lock), checking again for races
    let mut manager = WATCHER_MANAGER.lock();
    if manager.watchers.contains_key(&session_id) {
        // Another thread beat us — drop the watcher we just created
        tracing::debug!(session_id = %session_id, "Session already watched by another thread, dropping duplicate");
        return Ok(());
    }
    manager.watchers.insert(
        session_id,
        WatcherHandle {
            _watcher: watcher,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn unwatch_session(session_id: String) -> Result<(), WatcherError> {
    let mut manager = WATCHER_MANAGER.lock();

    if manager.watchers.remove(&session_id).is_some() {
        tracing::info!(session_id = %session_id, "Stopped watching session");
    }

    // Idempotent: no error if session wasn't being watched
    Ok(())
}
