use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::context::budget::{ThresholdStatus, WORKING_BUDGET, THRESHOLD_WARN_USER};

#[derive(Error, Debug)]
pub enum WatcherError {
    #[error("Watcher error: {0}")]
    Notify(#[from] notify::Error),
    #[error("Session not being watched: {0}")]
    NotWatched(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
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

lazy_static::lazy_static! {
    static ref WATCHER_MANAGER: Mutex<WatcherManager> = Mutex::new(WatcherManager::new());
}

/// Initialize lazy_static at module load
#[cfg(not(feature = "lazy_static"))]
mod lazy_static {
    pub struct LazyCell<T> {
        init: fn() -> T,
        value: std::sync::OnceLock<T>,
    }

    impl<T> LazyCell<T> {
        pub const fn new(init: fn() -> T) -> Self {
            Self {
                init,
                value: std::sync::OnceLock::new(),
            }
        }
    }

    impl<T> std::ops::Deref for LazyCell<T> {
        type Target = T;

        fn deref(&self) -> &Self::Target {
            self.value.get_or_init(self.init)
        }
    }

    macro_rules! lazy_static {
        ($(static ref $name:ident: $ty:ty = $init:expr;)*) => {
            $(
                static $name: $crate::watcher::lazy_static::LazyCell<$ty> =
                    $crate::watcher::lazy_static::LazyCell::new(|| $init);
            )*
        };
    }
    pub(crate) use lazy_static;
}

/// Event payload sent to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUpdatedEvent {
    pub session_id: String,
    pub path: String,
    pub change_type: String,
}

/// Budget alert event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAlertEvent {
    pub session_id: String,
    pub status: String,
    pub percentage: u8,
    pub used: u32,
    pub total: u32,
}

#[tauri::command]
pub fn watch_session(app: AppHandle, session_id: String, session_dir: String) -> Result<(), WatcherError> {
    let mut manager = WATCHER_MANAGER.lock();

    // If already watching, return early
    if manager.watchers.contains_key(&session_id) {
        return Ok(());
    }

    let session_json_path = PathBuf::from(&session_dir).join("session.json");
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    // Create watcher with event handler
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
                        let _ = app_clone.emit(&event_name, payload);

                        // Check budget and emit alert if needed
                        if let Ok(content) = fs::read_to_string(path) {
                            if let Ok(session) = serde_json::from_str::<crate::session::Session>(&content) {
                                if let Some(budget) = session.context_budget {
                                    let status = budget.threshold_status();
                                    let pct = budget.usage_percentage();

                                    // Only emit alert for warn_user or higher
                                    if pct >= THRESHOLD_WARN_USER {
                                        let status_str = match status {
                                            ThresholdStatus::Normal => "normal",
                                            ThresholdStatus::AutoCompress => "auto_compress",
                                            ThresholdStatus::WarnUser => "warn_user",
                                            ThresholdStatus::ForceCompress => "force_compress",
                                        };

                                        let alert_event = format!("budget-alert-{}", session_id_clone);
                                        let alert_payload = BudgetAlertEvent {
                                            session_id: session_id_clone.clone(),
                                            status: status_str.to_string(),
                                            percentage: pct,
                                            used: budget.total_used(),
                                            total: WORKING_BUDGET,
                                        };
                                        let _ = app_clone.emit(&alert_event, alert_payload);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => eprintln!("Watch error: {:?}", e),
        }
    })?;

    // Watch the session directory
    let watch_dir = session_json_path.parent()
        .ok_or_else(|| WatcherError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Session path has no parent directory"
        )))?;
    watcher.watch(watch_dir, RecursiveMode::NonRecursive)?;

    manager.watchers.insert(
        session_id.clone(),
        WatcherHandle {
            _watcher: watcher,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn unwatch_session(session_id: String) -> Result<(), WatcherError> {
    let mut manager = WATCHER_MANAGER.lock();

    if manager.watchers.remove(&session_id).is_none() {
        return Err(WatcherError::NotWatched(session_id));
    }

    Ok(())
}
