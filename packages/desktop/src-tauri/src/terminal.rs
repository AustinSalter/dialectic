use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty, Child};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TerminalError {
    #[error("PTY error: {0}")]
    Pty(String),
    #[error("Terminal not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Terminal already running: {0}")]
    AlreadyRunning(String),
}

impl Serialize for TerminalError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Terminal spawn configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalConfig {
    pub session_id: String,
    pub working_dir: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub cols: u16,
    pub rows: u16,
}

/// Terminal state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalState {
    pub session_id: String,
    pub pid: u32,
    pub running: bool,
}

/// Internal terminal handle
struct TerminalHandle {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    session_id: String,
}

/// Global terminal manager
struct TerminalManager {
    terminals: HashMap<String, Arc<Mutex<TerminalHandle>>>,
}

impl TerminalManager {
    fn new() -> Self {
        Self {
            terminals: HashMap::new(),
        }
    }
}

lazy_static::lazy_static! {
    static ref TERMINAL_MANAGER: Mutex<TerminalManager> = Mutex::new(TerminalManager::new());
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
                static $name: $crate::terminal::lazy_static::LazyCell<$ty> =
                    $crate::terminal::lazy_static::LazyCell::new(|| $init);
            )*
        };
    }
    pub(crate) use lazy_static;
}

#[tauri::command]
pub fn spawn_terminal(app: AppHandle, config: TerminalConfig) -> Result<TerminalState, TerminalError> {
    let mut manager = TERMINAL_MANAGER.lock();

    // Check if terminal already exists for this session
    if manager.terminals.contains_key(&config.session_id) {
        return Err(TerminalError::AlreadyRunning(config.session_id));
    }

    // Create PTY
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    // Build command - default to user's shell
    let mut cmd = if let Some(command) = config.command {
        let mut cmd = CommandBuilder::new(&command);
        if let Some(args) = config.args {
            cmd.args(args);
        }
        cmd
    } else {
        // Default to shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        CommandBuilder::new(shell)
    };

    // Set working directory
    cmd.cwd(&config.working_dir);

    // Spawn child process
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let pid = child.process_id().unwrap_or(0);

    // Get writer for later use
    let writer = pair.master.take_writer()
        .map_err(|e: anyhow::Error| TerminalError::Pty(e.to_string()))?;

    // Store handle
    let session_id = config.session_id.clone();
    let handle = Arc::new(Mutex::new(TerminalHandle {
        master: pair.master,
        writer,
        child,
        session_id: session_id.clone(),
    }));

    manager.terminals.insert(session_id.clone(), handle.clone());

    // Spawn reader thread to emit output events
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    let handle_clone = handle.clone();

    thread::spawn(move || {
        let mut reader = {
            let handle = handle_clone.lock();
            match handle.master.try_clone_reader() {
                Ok(r) => r,
                Err(_) => return,
            }
        };

        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let event_name = format!("terminal-output-{}", session_id_clone);
                    let _ = app_clone.emit(&event_name, data);
                }
                Err(_) => break,
            }
        }

        // Emit terminal closed event
        let event_name = format!("terminal-closed-{}", session_id_clone);
        let _ = app_clone.emit(&event_name, ());

        // Clean up
        let mut manager = TERMINAL_MANAGER.lock();
        manager.terminals.remove(&session_id_clone);
    });

    Ok(TerminalState {
        session_id,
        pid,
        running: true,
    })
}

#[tauri::command]
pub fn write_to_terminal(session_id: String, data: String) -> Result<(), TerminalError> {
    let manager = TERMINAL_MANAGER.lock();

    let handle = manager
        .terminals
        .get(&session_id)
        .ok_or_else(|| TerminalError::NotFound(session_id.clone()))?;

    let mut handle = handle.lock();
    handle
        .writer
        .write_all(data.as_bytes())
        .map_err(TerminalError::Io)?;

    Ok(())
}

#[tauri::command]
pub fn resize_terminal(session_id: String, cols: u16, rows: u16) -> Result<(), TerminalError> {
    let manager = TERMINAL_MANAGER.lock();

    let handle = manager
        .terminals
        .get(&session_id)
        .ok_or_else(|| TerminalError::NotFound(session_id.clone()))?;

    let handle = handle.lock();
    handle
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn kill_terminal(session_id: String) -> Result<(), TerminalError> {
    let mut manager = TERMINAL_MANAGER.lock();

    let handle = manager
        .terminals
        .remove(&session_id)
        .ok_or_else(|| TerminalError::NotFound(session_id.clone()))?;

    let mut handle = handle.lock();
    let _ = handle.child.kill();

    Ok(())
}

#[tauri::command]
pub fn get_terminal_state(session_id: String) -> Result<Option<TerminalState>, TerminalError> {
    let manager = TERMINAL_MANAGER.lock();

    if let Some(handle) = manager.terminals.get(&session_id) {
        let handle = handle.lock();
        let pid = handle.child.process_id().unwrap_or(0);
        Ok(Some(TerminalState {
            session_id,
            pid,
            running: true,
        }))
    } else {
        Ok(None)
    }
}
