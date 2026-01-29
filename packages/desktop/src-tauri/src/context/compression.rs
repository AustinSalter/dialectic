//! Compression trigger detection and tier management
//!
//! Implements the Paper Trail tier system with automatic compression triggers.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

/// Paper Trail tiers for compression management
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaperTrailTier {
    /// Tier 1: HEAD - Current state, core claim, triggers, locked intent (~500 tokens)
    /// Always loaded, never compressed
    Head,
    /// Tier 2: KEY_EVIDENCE - Verbatim claims marked [KEY] (~1,500 tokens)
    /// Always loaded, never compressed
    KeyEvidence,
    /// Tier 3: RECENT - Last 2-3 session reasoning traces (~3,000 tokens)
    /// If relevant, compressed after 7 days
    Recent,
    /// Tier 4: HISTORICAL - Compressed older sessions (~1,000 tokens)
    /// On demand, compressed after 30 days
    Historical,
    /// Tier 5: ARCHIVED - Full logs, searchable but not loaded (0 tokens in context)
    /// Never loaded, permanent archive
    Archived,
}

impl PaperTrailTier {
    /// Get target token budget for this tier
    pub fn target_tokens(&self) -> u32 {
        match self {
            PaperTrailTier::Head => 500,
            PaperTrailTier::KeyEvidence => 1500,
            PaperTrailTier::Recent => 3000,
            PaperTrailTier::Historical => 1000,
            PaperTrailTier::Archived => 0,
        }
    }

    /// Check if this tier should be loaded by default
    pub fn is_auto_loaded(&self) -> bool {
        matches!(self, PaperTrailTier::Head | PaperTrailTier::KeyEvidence)
    }

    /// Check if this tier can be compressed
    pub fn is_compressible(&self) -> bool {
        matches!(self, PaperTrailTier::Recent | PaperTrailTier::Historical)
    }
}

/// Thesis HEAD - always loaded, never compressed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThesisHead {
    /// Core thesis claim
    pub core_claim: String,
    /// Current confidence level (0.0-1.0)
    pub confidence: f32,
    /// Triggers that would change the thesis
    pub triggers: Vec<String>,
    /// Locked intent/constraints
    pub locked_intent: Option<String>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Token count (cached)
    pub token_count: u32,
}

impl Default for ThesisHead {
    fn default() -> Self {
        Self {
            core_claim: String::new(),
            confidence: 0.0,
            triggers: Vec::new(),
            locked_intent: None,
            updated_at: Utc::now(),
            token_count: 0,
        }
    }
}

/// Key evidence claim - verbatim, never compressed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyClaim {
    pub id: String,
    /// Verbatim content
    pub content: String,
    /// Source reference
    pub source: String,
    /// When added
    pub added_at: DateTime<Utc>,
    /// Why this is key
    pub reason: Option<String>,
    /// Token count (cached)
    pub token_count: u32,
}

/// Session summary for tier 3/4
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    /// Original session date
    pub session_date: DateTime<Utc>,
    /// Last referenced
    pub last_referenced: Option<DateTime<Utc>>,
    /// Compressed summary
    pub summary: String,
    /// Key decisions/outcomes
    pub key_outcomes: Vec<String>,
    /// Token count (cached)
    pub token_count: u32,
    /// Current tier
    pub tier: PaperTrailTier,
}

/// Historical summary for tier 4
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalSummary {
    /// Covered session IDs
    pub session_ids: Vec<String>,
    /// Date range
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    /// Compressed summary
    pub summary: String,
    /// Token count
    pub token_count: u32,
}

/// Complete paper trail for a thesis
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperTrail {
    /// Tier 1: HEAD
    pub head: ThesisHead,
    /// Tier 2: KEY_EVIDENCE
    pub key_evidence: Vec<KeyClaim>,
    /// Tier 3: RECENT sessions
    pub recent_sessions: Vec<SessionSummary>,
    /// Tier 4: HISTORICAL summaries
    pub historical_summaries: Vec<HistoricalSummary>,
    /// Tier 5: ARCHIVED paths (not loaded, just references)
    pub archive_paths: Vec<String>,
}

impl PaperTrail {
    /// Get total loaded token count
    pub fn total_tokens(&self) -> u32 {
        let head = self.head.token_count;
        let key_evidence: u32 = self.key_evidence.iter().map(|k| k.token_count).sum();
        let recent: u32 = self.recent_sessions.iter().map(|s| s.token_count).sum();
        let historical: u32 = self.historical_summaries.iter().map(|h| h.token_count).sum();
        head + key_evidence + recent + historical
    }

    /// Get token count by tier
    pub fn tokens_by_tier(&self, tier: PaperTrailTier) -> u32 {
        match tier {
            PaperTrailTier::Head => self.head.token_count,
            PaperTrailTier::KeyEvidence => self.key_evidence.iter().map(|k| k.token_count).sum(),
            PaperTrailTier::Recent => self.recent_sessions.iter().map(|s| s.token_count).sum(),
            PaperTrailTier::Historical => self.historical_summaries.iter().map(|h| h.token_count).sum(),
            PaperTrailTier::Archived => 0,
        }
    }
}

/// Compression trigger result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompressionTrigger {
    /// No compression needed
    None,
    /// Session should be summarized (7 day rule)
    SessionToSummary {
        session_id: String,
        age_days: i64,
    },
    /// Summary should be archived (30 day rule or confidence advancement)
    SummaryToArchive {
        session_ids: Vec<String>,
        reason: ArchiveReason,
    },
    /// Force compression due to budget pressure
    ForceCompress {
        tier: PaperTrailTier,
        tokens_to_free: u32,
    },
}

/// Reason for archiving
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArchiveReason {
    /// 30 days without reference
    Age,
    /// Thesis advanced 2+ confidence bands
    ConfidenceAdvancement,
    /// Budget pressure
    BudgetPressure,
    /// User requested
    UserRequested,
}

/// Check for compression triggers in the paper trail
pub fn check_compression_triggers(
    paper_trail: &PaperTrail,
    budget_pressure: bool,
    tokens_to_free: u32,
) -> Vec<CompressionTrigger> {
    let mut triggers = Vec::new();
    let now = Utc::now();

    // Check recent sessions for 7-day rule
    for session in &paper_trail.recent_sessions {
        if session.tier == PaperTrailTier::Recent {
            let last_ref = session.last_referenced.unwrap_or(session.session_date);
            let days_since = (now - last_ref).num_days();
            if days_since >= 7 {
                triggers.push(CompressionTrigger::SessionToSummary {
                    session_id: session.session_id.clone(),
                    age_days: days_since,
                });
            }
        }
    }

    // Check for 30-day archive candidates
    let archive_candidates: Vec<_> = paper_trail.recent_sessions.iter()
        .filter(|s| {
            let last_ref = s.last_referenced.unwrap_or(s.session_date);
            (now - last_ref).num_days() >= 30
        })
        .map(|s| s.session_id.clone())
        .collect();

    if !archive_candidates.is_empty() {
        triggers.push(CompressionTrigger::SummaryToArchive {
            session_ids: archive_candidates,
            reason: ArchiveReason::Age,
        });
    }

    // Budget pressure forces immediate compression
    if budget_pressure && tokens_to_free > 0 {
        // Determine which tier to compress first
        let recent_tokens = paper_trail.tokens_by_tier(PaperTrailTier::Recent);
        let historical_tokens = paper_trail.tokens_by_tier(PaperTrailTier::Historical);

        if historical_tokens > 0 {
            triggers.push(CompressionTrigger::ForceCompress {
                tier: PaperTrailTier::Historical,
                tokens_to_free,
            });
        } else if recent_tokens > 0 {
            triggers.push(CompressionTrigger::ForceCompress {
                tier: PaperTrailTier::Recent,
                tokens_to_free,
            });
        }
    }

    triggers
}

/// Compression request to be executed by Claude Code
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionRequest {
    /// What tier is being compressed
    pub source_tier: PaperTrailTier,
    /// Target tier after compression
    pub target_tier: PaperTrailTier,
    /// Content to compress
    pub content: String,
    /// Maximum tokens for output
    pub max_output_tokens: u32,
    /// What to preserve (key claims, decisions, etc.)
    pub preserve: Vec<String>,
    /// Reason for compression
    pub reason: ArchiveReason,
}

impl CompressionRequest {
    /// Create a session→summary compression request
    pub fn session_to_summary(session_id: &str, content: &str) -> Self {
        Self {
            source_tier: PaperTrailTier::Recent,
            target_tier: PaperTrailTier::Historical,
            content: content.to_string(),
            max_output_tokens: 500, // Target ~500 tokens per session summary
            preserve: vec!["decisions".to_string(), "outcomes".to_string(), "key_claims".to_string()],
            reason: ArchiveReason::Age,
        }
    }

    /// Create a summary→archive compression request
    pub fn summary_to_archive(summaries: &[SessionSummary]) -> Self {
        let content = summaries.iter()
            .map(|s| format!("[{}] {}", s.session_id, s.summary))
            .collect::<Vec<_>>()
            .join("\n\n");

        Self {
            source_tier: PaperTrailTier::Historical,
            target_tier: PaperTrailTier::Archived,
            content,
            max_output_tokens: 200, // Very compressed
            preserve: vec!["key_decisions".to_string()],
            reason: ArchiveReason::Age,
        }
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn context_check_compression_triggers(
    paper_trail: PaperTrail,
    budget_pressure: bool,
    tokens_to_free: u32,
) -> Vec<CompressionTrigger> {
    check_compression_triggers(&paper_trail, budget_pressure, tokens_to_free)
}

#[tauri::command]
pub fn context_create_compression_request(
    source_tier: PaperTrailTier,
    target_tier: PaperTrailTier,
    content: String,
    max_output_tokens: u32,
    reason: ArchiveReason,
) -> CompressionRequest {
    CompressionRequest {
        source_tier,
        target_tier,
        content,
        max_output_tokens,
        preserve: vec!["decisions".to_string(), "outcomes".to_string()],
        reason,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tier_target_tokens() {
        assert_eq!(PaperTrailTier::Head.target_tokens(), 500);
        assert_eq!(PaperTrailTier::Archived.target_tokens(), 0);
    }

    #[test]
    fn test_tier_auto_loaded() {
        assert!(PaperTrailTier::Head.is_auto_loaded());
        assert!(PaperTrailTier::KeyEvidence.is_auto_loaded());
        assert!(!PaperTrailTier::Recent.is_auto_loaded());
    }

    #[test]
    fn test_tier_compressible() {
        assert!(!PaperTrailTier::Head.is_compressible());
        assert!(!PaperTrailTier::KeyEvidence.is_compressible());
        assert!(PaperTrailTier::Recent.is_compressible());
        assert!(PaperTrailTier::Historical.is_compressible());
    }

    #[test]
    fn test_compression_trigger_detection() {
        let now = Utc::now();
        let eight_days_ago = now - Duration::days(8);

        let paper_trail = PaperTrail {
            recent_sessions: vec![
                SessionSummary {
                    session_id: "old_session".to_string(),
                    session_date: eight_days_ago,
                    last_referenced: None,
                    summary: "An old session".to_string(),
                    key_outcomes: vec![],
                    token_count: 500,
                    tier: PaperTrailTier::Recent,
                }
            ],
            ..Default::default()
        };

        let triggers = check_compression_triggers(&paper_trail, false, 0);
        assert!(!triggers.is_empty());

        match &triggers[0] {
            CompressionTrigger::SessionToSummary { session_id, age_days } => {
                assert_eq!(session_id, "old_session");
                assert!(*age_days >= 7);
            }
            _ => panic!("Expected SessionToSummary trigger"),
        }
    }

    #[test]
    fn test_budget_pressure_triggers() {
        let paper_trail = PaperTrail {
            historical_summaries: vec![
                HistoricalSummary {
                    session_ids: vec!["s1".to_string()],
                    start_date: Utc::now(),
                    end_date: Utc::now(),
                    summary: "Historical".to_string(),
                    token_count: 500,
                }
            ],
            ..Default::default()
        };

        let triggers = check_compression_triggers(&paper_trail, true, 1000);
        assert!(triggers.iter().any(|t| matches!(t, CompressionTrigger::ForceCompress { .. })));
    }
}
