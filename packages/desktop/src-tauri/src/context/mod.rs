//! Context Management Module
//!
//! Handles intelligent context management that balances three competing context sources
//! (Paper Trail, Obsidian, Reference Documents) within a ~100K token budget.

pub mod budget;
pub mod classification;
pub mod compression;
pub mod tokens;

// Re-export public types for external use
pub use budget::{ContextBudget, BudgetStatus, SourceStatus, ThresholdStatus, ContextSource};
pub use budget::context_get_budget_constants;
pub use classification::{SessionClassification, BudgetAllocation, TokenBudgets, ClassificationSignals};
pub use classification::{context_get_allocation, context_classify_session};
pub use compression::{PaperTrail, PaperTrailTier, ThesisHead, KeyClaim, SessionSummary, HistoricalSummary};
pub use compression::{CompressionTrigger, CompressionRequest, ArchiveReason};
pub use compression::{context_check_compression_triggers, context_create_compression_request};
pub use tokens::{context_count_tokens, context_count_tokens_batch, context_estimate_tokens};
