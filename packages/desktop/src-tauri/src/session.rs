use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use thiserror::Error;
use ulid::Ulid;

use crate::cdg::{CdgEdge, CdgSnapshot};
use crate::context::{ContextBudget, SessionClassification, PaperTrail};

#[derive(Error, Debug)]
pub enum SessionError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Session not found: {0}")]
    NotFound(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("Invalid session ID")]
    InvalidSessionId,
    #[error("Path escapes allowed directory")]
    PathEscape,
    #[error("App data directory not found")]
    NoAppDataDir,
}

/// Validate that a session ID contains only safe characters (alphanumeric, dash, underscore).
/// Rejects any path traversal attempts (/, \, ..).
pub fn validate_session_id(session_id: &str) -> Result<(), SessionError> {
    if session_id.is_empty() {
        return Err(SessionError::InvalidSessionId);
    }
    if session_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        Ok(())
    } else {
        Err(SessionError::InvalidSessionId)
    }
}

/// Validate that a resolved path is contained within the expected base directory.
/// Canonicalizes both paths and checks that the candidate starts with the base.
pub fn validate_path_containment(base: &std::path::Path, candidate: &std::path::Path) -> Result<PathBuf, SessionError> {
    let canonical_base = base.canonicalize().map_err(|_| SessionError::InvalidPath(base.display().to_string()))?;
    let canonical_candidate = candidate.canonicalize().map_err(|_| SessionError::InvalidPath(candidate.display().to_string()))?;
    if canonical_candidate.starts_with(&canonical_base) {
        Ok(canonical_candidate)
    } else {
        Err(SessionError::PathEscape)
    }
}

impl Serialize for SessionError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Session status corresponding to Kanban columns
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Backlog,     // Spark
    Exploring,   // Shape
    Tensions,    // Stress-Test
    Synthesizing,// Sharpen
    Formed,      // Ship
}

impl Default for SessionStatus {
    fn default() -> Self {
        SessionStatus::Backlog
    }
}

/// Session mode
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionMode {
    Idea,
    Decision,
}

impl Default for SessionMode {
    fn default() -> Self {
        SessionMode::Idea
    }
}

/// Context file reference
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextFile {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub added_at: DateTime<Utc>,
}

/// Claim extracted from sources
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Claim {
    pub id: String,
    pub content: String,
    pub source_id: String,
    pub marker: Option<String>, // [INSIGHT], [EVIDENCE], [RISK], [COUNTER]
    pub created_at: DateTime<Utc>,
}

/// Tension between claims
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tension {
    pub id: String,
    pub claim_a_id: String,
    pub claim_b_id: String,
    pub description: String,
    pub resolution: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Thesis output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Thesis {
    pub content: String,
    pub confidence: f32,
    pub updated_at: DateTime<Utc>,
}

/// Pass tracking for audit trail
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pass {
    pub id: String,
    pub pass_type: String, // "expansion", "compression", "critique"
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub token_count: Option<u32>,
}

/// Terminal state within session
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TerminalState {
    pub pid: Option<u32>,
    pub running: bool,
    pub last_command: Option<String>,
}

/// Reference document attached to session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionReferenceDoc {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub token_count: u32,
    pub handling: String,  // "full", "summarized", "chunked"
    pub persistence: String, // "ephemeral", "cached", "permanent"
}

/// Main session structure persisted to session.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub title: String,
    pub status: SessionStatus,
    pub mode: SessionMode,

    // Paths
    pub working_dir: String,
    pub is_project_local: bool,

    // Timestamps
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_resumed: Option<DateTime<Utc>>,

    // Content
    #[serde(default)]
    pub context_files: Vec<ContextFile>,
    #[serde(default)]
    pub claims: Vec<Claim>,
    #[serde(default)]
    pub tensions: Vec<Tension>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thesis: Option<Thesis>,
    #[serde(default)]
    pub passes: Vec<Pass>,

    // Terminal state
    #[serde(default)]
    pub terminal: TerminalState,

    // Context management (Sprint 2)
    #[serde(default)]
    pub context_budget: Option<ContextBudget>,
    #[serde(default)]
    pub paper_trail: Option<PaperTrail>,
    #[serde(default)]
    pub reference_docs: Vec<SessionReferenceDoc>,

    // Claim Dependency Graph
    #[serde(default)]
    pub cdg_edges: Vec<CdgEdge>,
    #[serde(default)]
    pub cdg_snapshots: Vec<CdgSnapshot>,

    // Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// Input for creating a new session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub title: String,
    #[serde(default)]
    pub mode: SessionMode,
    pub working_dir: Option<String>,
    pub category: Option<String>,
    pub summary: Option<String>,
}

/// Get the app data directory path from AppHandle (Tauri)
fn get_app_data_path(app: &AppHandle) -> Result<PathBuf, SessionError> {
    app.path()
        .app_data_dir()
        .map_err(|_| SessionError::NoAppDataDir)
}

/// Atomic write: write to a .tmp sibling then rename into place.
/// Prevents corruption if the process crashes mid-write.
fn atomic_write(path: &std::path::Path, contents: &str) -> Result<(), SessionError> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Application identifier - must match tauri.conf.json
const APP_IDENTIFIER: &str = "com.dialectic.dev";

/// Get app data directory for CLI use (no AppHandle)
/// Uses the standard Tauri app data location
pub fn get_app_data_dir_cli() -> Result<PathBuf, SessionError> {
    let base = dirs::data_dir().ok_or(SessionError::NoAppDataDir)?;
    Ok(base.join(APP_IDENTIFIER))
}

/// Get session directory for CLI use
/// Accepts session_id with or without "sess_" prefix
pub fn get_session_dir_cli(session_id: &str) -> Result<PathBuf, SessionError> {
    let base = get_app_data_dir_cli()?;
    // Strip prefix if present to normalize
    let normalized_id = session_id.trim_start_matches("sess_");
    validate_session_id(normalized_id)?;
    Ok(base.join("sessions").join(format!("sess_{}", normalized_id)))
}

/// Load session from disk for CLI use
pub fn load_session_cli(session_id: &str) -> Result<Session, SessionError> {
    let session_dir = get_session_dir_cli(session_id)?;
    let session_path = session_dir.join("session.json");

    if !session_path.exists() {
        return Err(SessionError::NotFound(session_id.to_string()));
    }

    let content = fs::read_to_string(&session_path)?;
    let session: Session = serde_json::from_str(&content)?;

    Ok(session)
}

/// Save session to disk for CLI use
pub fn save_session_cli(session: &Session) -> Result<(), SessionError> {
    let session_dir = get_session_dir_cli(&session.id)?;
    let session_path = session_dir.join("session.json");
    let content = serde_json::to_string_pretty(session)?;
    atomic_write(&session_path, &content)?;
    Ok(())
}

/// Shared helper: list sessions from a directory
fn list_sessions_from_dir(sessions_dir: &PathBuf) -> Result<Vec<Session>, SessionError> {
    if !sessions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    for entry in fs::read_dir(sessions_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            let session_json = path.join("session.json");
            if session_json.exists() {
                match fs::read_to_string(&session_json) {
                    Ok(content) => {
                        match serde_json::from_str::<Session>(&content) {
                            Ok(session) => sessions.push(session),
                            Err(e) => {
                                tracing::warn!(path = ?session_json, error = %e, "Failed to parse session");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(path = ?session_json, error = %e, "Failed to read session");
                    }
                }
            }
        }
    }

    // Sort by updated timestamp, most recent first
    sessions.sort_by(|a, b| b.updated.cmp(&a.updated));

    Ok(sessions)
}

/// List all sessions for CLI use
pub fn list_sessions_cli() -> Result<Vec<Session>, SessionError> {
    let base = get_app_data_dir_cli()?;
    let sessions_dir = base.join("sessions");
    list_sessions_from_dir(&sessions_dir)
}

/// Initialize app data directory structure
pub fn init_app_data_dir(app: &AppHandle) -> Result<(), SessionError> {
    let base = get_app_data_path(app)?;

    // Create directory structure
    let dirs = [
        base.join("sessions"),
        base.join("skills"),
        base.join("skills/dialectic"),
        base.join("config"),
    ];

    for dir in dirs {
        if !dir.exists() {
            fs::create_dir_all(&dir)?;
        }
    }

    // Create default preferences if not exists
    let prefs_path = base.join("config/preferences.json");
    if !prefs_path.exists() {
        let default_prefs = serde_json::json!({
            "theme": "dark",
            "defaultMode": "idea",
            "cliTool": "claude"
        });
        fs::write(&prefs_path, serde_json::to_string_pretty(&default_prefs)?)?;
    }

    Ok(())
}

/// Get session directory path
pub(crate) fn get_session_dir(app: &AppHandle, session_id: &str) -> Result<PathBuf, SessionError> {
    validate_session_id(session_id)?;
    let base = get_app_data_path(app)?;
    Ok(base.join("sessions").join(format!("sess_{}", session_id)))
}

/// Get session.json path for a session
fn get_session_json_path(app: &AppHandle, session_id: &str) -> Result<PathBuf, SessionError> {
    let session_dir = get_session_dir(app, session_id)?;
    Ok(session_dir.join("session.json"))
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, SessionError> {
    let path = get_app_data_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_skills_dir(app: AppHandle) -> Result<String, SessionError> {
    let base = get_app_data_path(&app)?;
    let skills_dir = base.join("skills");
    Ok(skills_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_session(app: AppHandle, input: CreateSessionInput) -> Result<Session, SessionError> {
    let session_id = Ulid::new().to_string();
    let now = Utc::now();

    // Determine working directory
    let is_project_local = input.working_dir.is_some();
    let working_dir = match input.working_dir {
        Some(dir) => {
            // Validate directory exists and canonicalize
            let path = PathBuf::from(&dir).canonicalize()
                .map_err(|_| SessionError::InvalidPath(dir.clone()))?;
            if !path.is_dir() {
                return Err(SessionError::InvalidPath(dir));
            }
            path.to_string_lossy().to_string()
        }
        None => {
            // Use app data directory
            let session_dir = get_session_dir(&app, &session_id)?;
            session_dir.to_string_lossy().to_string()
        }
    };

    let session = Session {
        id: session_id.clone(),
        title: input.title,
        status: SessionStatus::Backlog,
        mode: input.mode,
        working_dir: working_dir.clone(),
        is_project_local,
        created: now,
        updated: now,
        last_resumed: None,
        context_files: Vec::new(),
        claims: Vec::new(),
        tensions: Vec::new(),
        thesis: None,
        passes: Vec::new(),
        terminal: TerminalState::default(),
        context_budget: Some(ContextBudget::new(SessionClassification::NetNew)),
        paper_trail: Some(PaperTrail::default()),
        reference_docs: Vec::new(),
        cdg_edges: Vec::new(),
        cdg_snapshots: Vec::new(),
        category: input.category,
        summary: input.summary,
    };

    // Create session directory structure
    let session_dir = get_session_dir(&app, &session_id)?;
    fs::create_dir_all(&session_dir)?;
    fs::create_dir_all(session_dir.join("context"))?;
    fs::create_dir_all(session_dir.join("claims"))?;
    fs::create_dir_all(session_dir.join("tensions"))?;
    fs::create_dir_all(session_dir.join("thesis"))?;

    // Write session.json atomically
    let session_json = serde_json::to_string_pretty(&session)?;
    atomic_write(&session_dir.join("session.json"), &session_json)?;

    Ok(session)
}

#[tauri::command]
pub fn load_session(app: AppHandle, session_id: String) -> Result<Session, SessionError> {
    let session_path = get_session_json_path(&app, &session_id)?;

    if !session_path.exists() {
        return Err(SessionError::NotFound(session_id));
    }

    let content = fs::read_to_string(&session_path)?;
    let session: Session = serde_json::from_str(&content)?;

    Ok(session)
}

#[tauri::command]
pub fn list_sessions(app: AppHandle) -> Result<Vec<Session>, SessionError> {
    let base = get_app_data_path(&app)?;
    let sessions_dir = base.join("sessions");
    list_sessions_from_dir(&sessions_dir)
}

#[tauri::command]
pub fn update_session_status(
    app: AppHandle,
    session_id: String,
    status: SessionStatus,
) -> Result<Session, SessionError> {
    let session_path = get_session_json_path(&app, &session_id)?;
    if !session_path.exists() {
        return Err(SessionError::NotFound(session_id));
    }
    let content = fs::read_to_string(&session_path)?;
    let mut session: Session = serde_json::from_str(&content)?;
    session.status = status;
    session.updated = Utc::now();
    let updated = serde_json::to_string_pretty(&session)?;
    atomic_write(&session_path, &updated)?;
    Ok(session)
}

#[tauri::command]
pub fn delete_session(app: AppHandle, session_id: String) -> Result<(), SessionError> {
    let session_dir = get_session_dir(&app, &session_id)?;

    if !session_dir.exists() {
        return Err(SessionError::NotFound(session_id));
    }

    fs::remove_dir_all(&session_dir)?;

    Ok(())
}
