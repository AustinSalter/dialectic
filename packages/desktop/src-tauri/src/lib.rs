// Dialectic Library
// Exports core modules for use by both Tauri app and CLI binary

pub mod cdg;
pub mod context;
pub mod obsidian;
pub mod session;

// Re-export commonly used types for CLI
pub use context::budget::{
    ContextBudget, BudgetStatus, SourceStatus, ThresholdStatus, ContextSource,
    TOTAL_BUDGET, OUTPUT_RESERVED, WORKING_BUDGET,
    THRESHOLD_AUTO_COMPRESS, THRESHOLD_WARN_USER, THRESHOLD_FORCE_COMPRESS,
};
pub use context::classification::{SessionClassification, BudgetAllocation, TokenBudgets};
pub use context::compression::{
    PaperTrail, PaperTrailTier, ThesisHead, KeyClaim, SessionSummary, HistoricalSummary,
    CompressionTrigger, CompressionRequest, ArchiveReason,
    check_compression_triggers,
};
pub use context::tokens::{count_tokens, count_tokens_batch, estimate_tokens_quick};

pub use obsidian::query::{QueryResult, MatchType, NoteContent, query_notes, get_note_content};
pub use obsidian::indexer::{NoteIndex, VaultIndex, ObsidianError, IndexStats, configure_vault, index_vault, get_vault_index};

pub use session::{
    Session, SessionStatus, SessionMode, SessionError,
    get_app_data_dir_cli, get_session_dir_cli, load_session_cli, list_sessions_cli,
    save_session_cli,
};

pub use cdg::{
    EdgeType, ClaimStratum, ResolutionStatus, CdgEdge, CdgMetrics, CdgSnapshot, PassDiff,
    compute_strata, compute_metrics, find_orphans, compute_pass_diff,
};
