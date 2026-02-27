//! Chroma Sidecar Lifecycle Management
//!
//! Spawns, monitors, and manages the Chroma server process.
//! The sidecar is a Chroma server (either system-installed or PyInstaller-bundled)
//! running on localhost:8000 with persistent storage at ~/.dialectic/chroma/.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use thiserror::Error;
use tracing::{info, warn, error, debug};

/// Sidecar state
static SIDECAR: Mutex<Option<ChromaSidecar>> = Mutex::new(None);

/// Default Chroma server port
pub const CHROMA_PORT: u16 = 8000;

/// Maximum restart attempts before giving up
const MAX_RESTART_ATTEMPTS: u32 = 3;

/// Base backoff duration for restarts
const BASE_BACKOFF_MS: u64 = 1000;

#[derive(Error, Debug)]
pub enum SidecarError {
    #[error("Sidecar not found at: {0}")]
    NotFound(String),
    #[error("Sidecar failed to start: {0}")]
    StartFailed(String),
    #[error("Sidecar not running")]
    NotRunning,
    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Max restart attempts exceeded")]
    MaxRestartsExceeded,
}

impl Serialize for SidecarError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Sidecar health status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
    pub uptime_seconds: Option<u64>,
    pub restart_count: u32,
    pub persist_directory: String,
}

/// Manages the Chroma sidecar process
struct ChromaSidecar {
    process: Option<Child>,
    binary_path: PathBuf,
    persist_dir: PathBuf,
    port: u16,
    started_at: Option<Instant>,
    restart_count: u32,
}

impl ChromaSidecar {
    fn new(binary_path: PathBuf, persist_dir: PathBuf) -> Self {
        Self {
            process: None,
            binary_path,
            persist_dir,
            port: CHROMA_PORT,
            started_at: None,
            restart_count: 0,
        }
    }

    fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.process {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    self.process = None;
                    self.started_at = None;
                    false
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }

    fn start(&mut self) -> Result<(), SidecarError> {
        if self.is_running() {
            return Ok(());
        }

        // Ensure persist directory exists
        std::fs::create_dir_all(&self.persist_dir)
            .map_err(SidecarError::Io)?;

        // Redirect stderr to a log file for debugging
        let log_path = self.persist_dir.join("chroma.log");
        let stderr_target = match File::create(&log_path) {
            Ok(f) => {
                debug!(path = %log_path.display(), "Redirecting chroma stderr to log file");
                Stdio::from(f)
            }
            Err(e) => {
                warn!(error = %e, "Could not create chroma log file, suppressing stderr");
                Stdio::null()
            }
        };

        let child = Command::new(&self.binary_path)
            .args([
                "run",
                "--host", "127.0.0.1",
                "--port", &self.port.to_string(),
                "--path", &self.persist_dir.to_string_lossy(),
            ])
            .stdout(Stdio::null())
            .stderr(stderr_target)
            .spawn()
            .map_err(|e| SidecarError::StartFailed(format!(
                "Failed to spawn {}: {}",
                self.binary_path.display(), e
            )))?;

        self.process = Some(child);
        self.started_at = Some(Instant::now());

        Ok(())
    }

    fn stop(&mut self) -> Result<(), SidecarError> {
        if let Some(ref mut child) = self.process {
            // Try graceful shutdown via kill command on Unix
            #[cfg(unix)]
            {
                let pid = child.id();
                // Send SIGTERM via kill command
                let _ = Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .output();

                // Wait up to 5 seconds for graceful shutdown
                debug!("Waiting for graceful sidecar shutdown");
                let deadline = Instant::now() + Duration::from_secs(5);
                loop {
                    match child.try_wait() {
                        Ok(Some(_)) => break,
                        Ok(None) if Instant::now() < deadline => {
                            std::thread::sleep(Duration::from_millis(100));
                        }
                        _ => {
                            // Force kill if graceful shutdown failed
                            warn!("Forced SIGKILL on chroma sidecar");
                            let _ = child.kill();
                            let _ = child.wait();
                            break;
                        }
                    }
                }
            }
            #[cfg(not(unix))]
            {
                let _ = child.kill();
                let _ = child.wait();
            }

            self.process = None;
            self.started_at = None;
        }

        Ok(())
    }

    fn status(&mut self) -> SidecarStatus {
        let running = self.is_running();
        let pid = self.process.as_ref().map(|p| p.id());
        let uptime = self.started_at.map(|s| s.elapsed().as_secs());

        SidecarStatus {
            running,
            port: self.port,
            pid,
            uptime_seconds: uptime,
            restart_count: self.restart_count,
            persist_directory: self.persist_dir.to_string_lossy().to_string(),
        }
    }
}

impl Drop for ChromaSidecar {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// Get the default persist directory (~/.dialectic/chroma/)
pub fn default_persist_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".dialectic")
        .join("chroma")
}

/// Resolve the sidecar binary path.
/// In development, looks for `chroma` on PATH.
/// In production, uses the Tauri sidecar path.
pub fn resolve_binary_path(app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, SidecarError> {
    // Try Tauri sidecar resolution first
    if let Some(handle) = app_handle {
        use tauri::Manager;
        if let Ok(resource_dir) = handle.path().resource_dir() {
            let sidecar_path = resource_dir.join("binaries").join(sidecar_binary_name());
            if sidecar_path.exists() {
                info!(path = %sidecar_path.display(), "Resolved chroma binary from Tauri resource");
                return Ok(sidecar_path);
            }
        }
    }

    // Fallback: look for `chroma` on PATH (development mode)
    warn!("Chroma binary not in resources, falling back to PATH");
    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("which").arg("chroma").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }
    }

    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("where").arg("chroma").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines().next().unwrap_or("").trim().to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }
    }

    Err(SidecarError::NotFound(
        "Chroma binary not found. Install with: pip install chromadb".to_string()
    ))
}

/// Get the platform-specific sidecar binary name
fn sidecar_binary_name() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "chroma-aarch64-apple-darwin" }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "chroma-x86_64-apple-darwin" }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "chroma-x86_64-pc-windows-msvc.exe" }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "chroma-x86_64-unknown-linux-gnu" }
    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
    )))]
    { "chroma" }
}

/// Initialize and start the Chroma sidecar
pub fn start_sidecar(app_handle: Option<&tauri::AppHandle>) -> Result<(), SidecarError> {
    let binary_path = resolve_binary_path(app_handle)?;
    let persist_dir = default_persist_dir();

    let mut sidecar = SIDECAR.lock();
    let sc = sidecar.get_or_insert_with(|| ChromaSidecar::new(binary_path.clone(), persist_dir));
    // Update binary path in case it changed (e.g., dev → bundled)
    sc.binary_path = binary_path;
    sc.start()?;
    let pid = sc.process.as_ref().map(|p| p.id()).unwrap_or(0);
    let persist_dir = &sc.persist_dir;
    info!(pid = pid, port = 8000, persist_dir = %persist_dir.display(), "Started chroma sidecar");
    Ok(())
}

/// Stop the Chroma sidecar
pub fn stop_sidecar() -> Result<(), SidecarError> {
    info!("Stopping chroma sidecar");
    let mut sidecar = SIDECAR.lock();
    if let Some(ref mut sc) = *sidecar {
        sc.stop()?;
    }
    *sidecar = None;
    Ok(())
}

/// Restart the sidecar with exponential backoff
pub fn restart_sidecar() -> Result<(), SidecarError> {
    // Read restart_count and compute backoff while holding the lock briefly
    let (restart_count, backoff) = {
        let sidecar = SIDECAR.lock();
        match sidecar.as_ref() {
            Some(sc) => {
                if sc.restart_count >= MAX_RESTART_ATTEMPTS {
                    error!("Max sidecar restart attempts exceeded");
                    return Err(SidecarError::MaxRestartsExceeded);
                }
                warn!(attempt = sc.restart_count + 1, "Restarting chroma sidecar");
                let backoff = Duration::from_millis(
                    BASE_BACKOFF_MS * 2u64.pow(sc.restart_count)
                );
                (sc.restart_count, backoff)
            }
            None => return Ok(()),
        }
    };

    // Sleep without holding the lock
    std::thread::sleep(backoff);

    // Re-acquire lock for stop/start
    let mut sidecar = SIDECAR.lock();
    if let Some(ref mut sc) = *sidecar {
        // Re-check in case another thread restarted while we slept
        if sc.restart_count != restart_count {
            return Ok(());
        }
        sc.stop()?;
        sc.restart_count += 1;
        sc.start()?;
    }
    Ok(())
}

/// Get the current sidecar status
pub fn get_sidecar_status() -> SidecarStatus {
    let mut sidecar = SIDECAR.lock();
    match sidecar.as_mut() {
        Some(sc) => {
            let status = sc.status();
            debug!(running = status.running, pid = ?status.pid, "Sidecar status query");
            status
        }
        None => SidecarStatus {
            running: false,
            port: CHROMA_PORT,
            pid: None,
            uptime_seconds: None,
            restart_count: 0,
            persist_directory: default_persist_dir().to_string_lossy().to_string(),
        },
    }
}

/// Check if sidecar is running
pub fn is_sidecar_running() -> bool {
    let mut sidecar = SIDECAR.lock();
    sidecar.as_mut().map(|sc| sc.is_running()).unwrap_or(false)
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub async fn chroma_start_sidecar(app: tauri::AppHandle) -> Result<SidecarStatus, SidecarError> {
    start_sidecar(Some(&app))?;

    // Wait for health check (up to 10 seconds)
    let client = super::client::get_client();
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut last_err = String::new();
    let mut attempt = 0u32;

    while Instant::now() < deadline {
        attempt += 1;
        match client.heartbeat().await {
            Ok(_) => {
                info!("Chroma sidecar healthy after {} attempts", attempt);
                return Ok(get_sidecar_status());
            }
            Err(e) => {
                last_err = e.to_string();
                debug!(attempt = attempt, error = %e, "Chroma health probe failed");
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        }
    }

    error!("Chroma sidecar health check timed out");
    Err(SidecarError::HealthCheckFailed(last_err))
}

#[tauri::command]
pub async fn chroma_stop_sidecar() -> Result<(), SidecarError> {
    stop_sidecar()
}

#[tauri::command]
pub fn chroma_get_status() -> SidecarStatus {
    get_sidecar_status()
}
