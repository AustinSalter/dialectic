use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::session::Session;
use crate::context::budget::ThresholdStatus;
use crate::chroma::memory::{extract_session_markers, index_session_artifact, MemoryType};

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

/// Budget alert payload sent to frontend when threshold is exceeded
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAlertPayload {
    pub session_id: String,
    pub status: String,
    pub percentage: u8,
    pub used: u32,
    pub total: u32,
}

/// Scan .dialectic-output/ for distill artifacts and index them to Chroma.
/// Finds the most recent run subdirectory and indexes memo-final.md, spine.yaml, thesis-history.md.
fn scan_and_index_distill_output(session_id: String, working_dir: &Path, app: &AppHandle) {
    let output_dir = working_dir.join(".dialectic-output");
    if !output_dir.exists() {
        return;
    }

    let sid = session_id.clone();
    let app_clone = app.clone();

    // Find the most recent run directory (names contain timestamps, so sort by name desc)
    let latest_run = match fs::read_dir(&output_dir) {
        Ok(entries) => {
            let mut dirs: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .collect();
            dirs.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
            dirs.into_iter().next().map(|e| e.path())
        }
        Err(_) => None,
    };

    let run_dir = match latest_run {
        Some(d) => d,
        None => return,
    };

    tracing::info!(session_id = %sid, run_dir = %run_dir.display(), "Scanning distill output");

    // Define artifact→memory type mapping
    let artifacts: &[(&str, MemoryType)] = &[
        ("memo-final.md", MemoryType::Semantic),
        ("spine.yaml", MemoryType::Episodic),
        ("thesis-history.md", MemoryType::Procedural),
    ];

    for (filename, memory_type) in artifacts {
        let artifact_path = run_dir.join(filename);
        if artifact_path.exists() {
            if let Ok(content) = fs::read_to_string(&artifact_path) {
                let sid = sid.clone();
                let fname = filename.to_string();
                let mt = *memory_type;
                tauri::async_runtime::spawn(async move {
                    index_session_artifact(&sid, &fname, &content, mt).await;
                });
            }
        }
    }

    // Emit distill completion event
    let event_name = format!("session-distill-{}", session_id);
    let _ = app_clone.emit(&event_name, serde_json::json!({
        "sessionId": session_id,
        "runDir": run_dir.to_string_lossy(),
    }));
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
                for path in &event.paths {
                    let filename = path.file_name().map(|n| n.to_string_lossy().to_string());
                    let filename = match filename {
                        Some(f) => f,
                        None => continue,
                    };

                    match filename.as_str() {
                        "session.json" => {
                            // Existing handling: emit event, budget alerts, marker extraction
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

                            if let Ok(content) = fs::read_to_string(path) {
                                if let Ok(session) = serde_json::from_str::<Session>(&content) {
                                    // Check context budget and emit alert if threshold exceeded
                                    if let Some(ref budget) = session.context_budget {
                                        let status = budget.threshold_status();
                                        if status != ThresholdStatus::Normal {
                                            let total = budget.paper_trail_budget + budget.obsidian_budget + budget.reference_budget;
                                            let alert = BudgetAlertPayload {
                                                session_id: session_id_clone.clone(),
                                                status: match status {
                                                    ThresholdStatus::Normal => "normal",
                                                    ThresholdStatus::AutoCompress => "auto_compress",
                                                    ThresholdStatus::WarnUser => "warn_user",
                                                    ThresholdStatus::ForceCompress => "force_compress",
                                                }.to_string(),
                                                percentage: budget.usage_percentage(),
                                                used: budget.total_used(),
                                                total,
                                            };
                                            let alert_event = format!("budget-alert-{}", session_id_clone);
                                            tracing::info!(session_id = %session_id_clone, status = %alert.status, pct = alert.percentage, "Budget threshold exceeded");
                                            if let Err(e) = app_clone.emit(&alert_event, alert) {
                                                tracing::warn!(error = %e, "Failed to emit budget alert");
                                            }
                                        }
                                    }

                                    // Extract semantic markers to Chroma (best-effort, async)
                                    let has_markers = session.claims.iter().any(|c| c.marker.is_some());
                                    let has_unresolved = session.tensions.iter().any(|t| t.resolution.is_none());
                                    let has_thesis = session.thesis.is_some();
                                    if has_markers || has_unresolved || has_thesis {
                                        let session_for_markers = session.clone();
                                        tauri::async_runtime::spawn(async move {
                                            extract_session_markers(&session_for_markers).await;
                                        });
                                    }

                                    // On status "formed", scan distill output and trigger JSONL mining
                                    if session.status == crate::session::SessionStatus::Formed {
                                        let working_dir = std::path::PathBuf::from(&session.working_dir);
                                        scan_and_index_distill_output(
                                            session_id_clone.clone(),
                                            &working_dir,
                                            &app_clone,
                                        );

                                        // Trigger JSONL mining if conversation_id is set
                                        if let Some(ref conv_id) = session.conversation_id {
                                            let sid = session.id.clone();
                                            let cid = conv_id.clone();
                                            let working_dir_str = session.working_dir.clone();
                                            tauri::async_runtime::spawn(async move {
                                                crate::chroma::jsonl_miner::mine_session_if_possible(&sid, &cid, &working_dir_str).await;
                                            });
                                        }
                                    }
                                } else {
                                    tracing::debug!(session_id = %session_id_clone, "Skipping extraction: session.json parse failed (likely mid-write)");
                                }
                            }
                        }
                        "state.json" => {
                            // Index state.json as episodic memory
                            if let Ok(content) = fs::read_to_string(path) {
                                let sid = session_id_clone.clone();
                                tauri::async_runtime::spawn(async move {
                                    index_session_artifact(&sid, "state.json", &content, MemoryType::Episodic).await;
                                });
                            }
                        }
                        "scratchpad.md" => {
                            // Index scratchpad.md as episodic memory
                            if let Ok(content) = fs::read_to_string(path) {
                                let sid = session_id_clone.clone();
                                tauri::async_runtime::spawn(async move {
                                    index_session_artifact(&sid, "scratchpad.md", &content, MemoryType::Episodic).await;
                                });
                            }
                        }
                        _ => {}
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
