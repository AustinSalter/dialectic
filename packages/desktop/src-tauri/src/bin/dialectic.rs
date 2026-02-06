//! Dialectic CLI
//!
//! Command-line interface for session management, vault queries, and token counting.
//! Designed for use by Claude Code skills and hooks.

use clap::{Parser, Subcommand};

// Compression estimation constants
/// Estimated tokens freed when summarizing a session (tier 3 -> tier 4)
const ESTIMATED_SESSION_SUMMARY_SAVINGS: u32 = 500;
/// Estimated tokens freed per session when archiving summaries (tier 4 -> tier 5)
const ESTIMATED_ARCHIVE_SAVINGS_PER_SESSION: u32 = 300;
/// Target budget percentage after compression (below auto_compress threshold)
const COMPRESSION_TARGET_PCT: f64 = 0.65;
use serde::Serialize;
use chrono::Utc;
use dialectic_lib::{
    // Session
    SessionStatus, load_session_cli, list_sessions_cli, save_session_cli,
    // Context
    BudgetStatus, ThresholdStatus, WORKING_BUDGET,
    check_compression_triggers, CompressionTrigger,
    // Tokens
    count_tokens,
    // Obsidian
    configure_vault, index_vault, query_notes, get_note_content,
    // CDG
    EdgeType, ResolutionStatus, CdgEdge, CdgSnapshot,
    compute_strata, compute_metrics, find_orphans, compute_pass_diff,
};

#[derive(Parser)]
#[command(name = "dialectic")]
#[command(about = "Dialectic CLI - Context management for Claude Code", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Session management commands
    Session {
        #[command(subcommand)]
        action: SessionAction,
    },
    /// Obsidian vault commands
    Vault {
        #[command(subcommand)]
        action: VaultAction,
    },
    /// Token counting commands
    Tokens {
        #[command(subcommand)]
        action: TokensAction,
    },
    /// Compression management commands
    Compress {
        #[command(subcommand)]
        action: CompressAction,
    },
    /// Claim Dependency Graph commands
    Cdg {
        #[command(subcommand)]
        action: CdgAction,
    },
}

#[derive(Subcommand)]
enum SessionAction {
    /// Get budget status for a session
    Budget {
        /// Session ID (without sess_ prefix)
        session_id: String,
    },
    /// List all sessions
    List,
    /// Get resume context for a session
    Resume {
        /// Session ID (without sess_ prefix)
        session_id: String,
    },
}

#[derive(Subcommand)]
enum VaultAction {
    /// Search the Obsidian vault
    Search {
        /// Search query
        query: String,
        /// Token budget for results (default: 5000)
        #[arg(short, long, default_value = "5000")]
        budget: u32,
    },
    /// Get note content
    Note {
        /// Path to note (relative to vault)
        path: String,
        /// Maximum tokens to return (default: 2000)
        #[arg(short, long, default_value = "2000")]
        max_tokens: u32,
    },
    /// Configure vault path
    Configure {
        /// Path to Obsidian vault
        path: String,
    },
    /// Index the configured vault
    Index,
}

#[derive(Subcommand)]
enum TokensAction {
    /// Count tokens in text
    Count {
        /// Text to count (or - to read from stdin)
        text: String,
    },
}

#[derive(Subcommand)]
enum CompressAction {
    /// Suggest compression actions for a session
    Suggest {
        /// Session ID (without sess_ prefix)
        session_id: String,
    },
}

#[derive(Subcommand)]
enum CdgAction {
    /// Compute and display all CDG metrics
    Metrics {
        /// Session ID
        session_id: String,
    },
    /// Add an edge between two claims
    AddEdge {
        /// Session ID
        session_id: String,
        /// Source claim ID
        #[arg(long)]
        source: String,
        /// Target claim ID
        #[arg(long)]
        target: String,
        /// Edge type: support, require, tension, derive, qualify
        #[arg(long, name = "type")]
        edge_type: String,
        /// Edge weight (0.0-1.0)
        #[arg(long, default_value = "1.0")]
        weight: f32,
        /// Resolution status for tension edges: unresolved, resolved, accepted
        #[arg(long)]
        resolution: Option<String>,
    },
    /// Resolve or accept a tension edge
    Resolve {
        /// Session ID
        session_id: String,
        /// Edge index in cdg_edges array
        #[arg(long)]
        edge_index: usize,
        /// Resolution status: resolved or accepted
        #[arg(long)]
        status: String,
    },
    /// List orphan claims (degree 0)
    Orphans {
        /// Session ID
        session_id: String,
    },
    /// Compute and display strata for all claims
    Strata {
        /// Session ID
        session_id: String,
    },
    /// Compare current metrics vs last snapshot
    Diff {
        /// Session ID
        session_id: String,
    },
    /// Take a snapshot of current metrics (for later diff)
    Snapshot {
        /// Session ID
        session_id: String,
        /// Pass ID to label this snapshot
        #[arg(long)]
        pass_id: String,
    },
}

// ============ Output Types ============

#[derive(Serialize)]
struct BudgetOutput {
    used: u32,
    total: u32,
    pct: u8,
    status: String,
    paper_trail_used: u32,
    paper_trail_budget: u32,
    obsidian_used: u32,
    obsidian_budget: u32,
    reference_used: u32,
    reference_budget: u32,
}

#[derive(Serialize)]
struct SessionListItem {
    id: String,
    title: String,
    status: String,
    updated: String,
}

#[derive(Serialize)]
struct ResumeOutput {
    session_id: String,
    title: String,
    status: String,
    thesis: Option<String>,
    thesis_confidence: Option<f32>,
    scratchpad: Option<ScratchpadOutput>,
    suggested_action: String,
}

#[derive(Serialize)]
struct ScratchpadOutput {
    core_claim: String,
    triggers: Vec<String>,
    locked_intent: Option<String>,
    key_evidence_count: usize,
    recent_sessions_count: usize,
}

#[derive(Serialize)]
struct VaultSearchResult {
    path: String,
    title: String,
    relevance: f32,
    summary: String,
    token_count: u32,
}

#[derive(Serialize)]
struct NoteOutput {
    path: String,
    title: String,
    content: String,
    tokens: u32,
    truncated: bool,
}

#[derive(Serialize)]
struct TokenCountOutput {
    tokens: u32,
}

#[derive(Serialize)]
struct CompressSuggestOutput {
    triggers: Vec<String>,
    tokens_freeable: u32,
    budget_status: String,
}

#[derive(Serialize)]
struct ErrorOutput {
    error: String,
}

// ============ Main ============

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Session { action } => handle_session(action),
        Commands::Vault { action } => handle_vault(action),
        Commands::Tokens { action } => handle_tokens(action),
        Commands::Compress { action } => handle_compress(action),
        Commands::Cdg { action } => handle_cdg(action),
    };

    match result {
        Ok(json) => println!("{}", json),
        Err(e) => {
            let error = ErrorOutput { error: e.to_string() };
            println!("{}", serde_json::to_string(&error).unwrap());
            std::process::exit(1);
        }
    }
}

// ============ Handlers ============

fn handle_session(action: SessionAction) -> Result<String, Box<dyn std::error::Error>> {
    match action {
        SessionAction::Budget { session_id } => {
            let session = load_session_cli(&session_id)?;

            let budget = session.context_budget.unwrap_or_default();
            let status: BudgetStatus = (&budget).into();

            let output = BudgetOutput {
                used: status.total_used,
                total: WORKING_BUDGET,
                pct: status.usage_percentage,
                status: format!("{:?}", status.threshold_status).to_lowercase(),
                paper_trail_used: status.paper_trail.used,
                paper_trail_budget: status.paper_trail.budget,
                obsidian_used: status.obsidian.used,
                obsidian_budget: status.obsidian.budget,
                reference_used: status.reference.used,
                reference_budget: status.reference.budget,
            };

            Ok(serde_json::to_string(&output)?)
        }

        SessionAction::List => {
            let sessions = list_sessions_cli()?;

            let items: Vec<SessionListItem> = sessions.iter().map(|s| SessionListItem {
                id: s.id.clone(),
                title: s.title.clone(),
                status: format!("{:?}", s.status).to_lowercase(),
                updated: s.updated.to_rfc3339(),
            }).collect();

            Ok(serde_json::to_string(&items)?)
        }

        SessionAction::Resume { session_id } => {
            let session = load_session_cli(&session_id)?;

            let scratchpad = session.paper_trail.as_ref().map(|pt| ScratchpadOutput {
                core_claim: pt.head.core_claim.clone(),
                triggers: pt.head.triggers.clone(),
                locked_intent: pt.head.locked_intent.clone(),
                key_evidence_count: pt.key_evidence.len(),
                recent_sessions_count: pt.recent_sessions.len(),
            });

            let suggested_action = match session.status {
                SessionStatus::Backlog => "Begin exploration with /dialectic to develop initial thesis",
                SessionStatus::Exploring => "Continue /dialectic exploration to find tensions",
                SessionStatus::Tensions => "Analyze tensions, run /dialectic with critique focus",
                SessionStatus::Synthesizing => "Synthesize findings into coherent thesis",
                SessionStatus::Formed => "Review and finalize thesis, consider export",
            };

            let output = ResumeOutput {
                session_id: session.id.clone(),
                title: session.title.clone(),
                status: format!("{:?}", session.status).to_lowercase(),
                thesis: session.thesis.as_ref().map(|t| t.content.clone()),
                thesis_confidence: session.thesis.as_ref().map(|t| t.confidence),
                scratchpad,
                suggested_action: suggested_action.to_string(),
            };

            Ok(serde_json::to_string(&output)?)
        }
    }
}

fn handle_vault(action: VaultAction) -> Result<String, Box<dyn std::error::Error>> {
    match action {
        VaultAction::Search { query, budget } => {
            let results = query_notes(&query, budget)?;

            let items: Vec<VaultSearchResult> = results.iter().map(|r| VaultSearchResult {
                path: r.note.path.clone(),
                title: r.note.title.clone(),
                relevance: r.relevance,
                summary: r.note.summary.clone(),
                token_count: r.note.token_count,
            }).collect();

            Ok(serde_json::to_string(&items)?)
        }

        VaultAction::Note { path, max_tokens } => {
            let content = get_note_content(&path, max_tokens)?;

            let output = NoteOutput {
                path: content.path,
                title: content.title,
                content: content.content,
                tokens: content.token_count,
                truncated: content.truncated,
            };

            Ok(serde_json::to_string(&output)?)
        }

        VaultAction::Configure { path } => {
            configure_vault(&path)?;
            Ok(r#"{"status": "configured"}"#.to_string())
        }

        VaultAction::Index => {
            let stats = index_vault()?;
            Ok(serde_json::to_string(&stats)?)
        }
    }
}

fn handle_tokens(action: TokensAction) -> Result<String, Box<dyn std::error::Error>> {
    match action {
        TokensAction::Count { text } => {
            let input = if text == "-" {
                // Read from stdin
                use std::io::Read;
                let mut buffer = String::new();
                std::io::stdin().read_to_string(&mut buffer)?;
                buffer
            } else {
                text
            };

            let tokens = count_tokens(&input);
            let output = TokenCountOutput { tokens };

            Ok(serde_json::to_string(&output)?)
        }
    }
}

fn handle_compress(action: CompressAction) -> Result<String, Box<dyn std::error::Error>> {
    match action {
        CompressAction::Suggest { session_id } => {
            let session = load_session_cli(&session_id)?;

            let budget = session.context_budget.unwrap_or_default();
            let paper_trail = session.paper_trail.unwrap_or_default();

            let budget_pressure = budget.threshold_status() != ThresholdStatus::Normal;
            let tokens_to_free = if budget_pressure {
                // Calculate how many tokens to free to get below auto_compress threshold
                let target = (WORKING_BUDGET as f64 * COMPRESSION_TARGET_PCT) as u32;
                budget.total_used().saturating_sub(target)
            } else {
                0
            };

            let triggers = check_compression_triggers(&paper_trail, budget_pressure, tokens_to_free);

            let trigger_descriptions: Vec<String> = triggers.iter().map(|t| match t {
                CompressionTrigger::None => "No compression needed".to_string(),
                CompressionTrigger::SessionToSummary { session_id, age_days } => {
                    format!("Session {} is {} days old - consider summarizing", session_id, age_days)
                }
                CompressionTrigger::SummaryToArchive { session_ids, reason } => {
                    format!("Archive {} sessions ({:?})", session_ids.len(), reason)
                }
                CompressionTrigger::ForceCompress { tier, tokens_to_free } => {
                    format!("Force compress {:?} tier to free {} tokens", tier, tokens_to_free)
                }
            }).collect();

            let tokens_freeable: u32 = triggers.iter().map(|t| match t {
                CompressionTrigger::ForceCompress { tokens_to_free, .. } => *tokens_to_free,
                CompressionTrigger::SessionToSummary { .. } => ESTIMATED_SESSION_SUMMARY_SAVINGS,
                CompressionTrigger::SummaryToArchive { session_ids, .. } => {
                    (session_ids.len() as u32) * ESTIMATED_ARCHIVE_SAVINGS_PER_SESSION
                }
                CompressionTrigger::None => 0,
            }).sum();

            let output = CompressSuggestOutput {
                triggers: trigger_descriptions,
                tokens_freeable,
                budget_status: format!("{:?}", budget.threshold_status()).to_lowercase(),
            };

            Ok(serde_json::to_string(&output)?)
        }
    }
}

fn handle_cdg(action: CdgAction) -> Result<String, Box<dyn std::error::Error>> {
    match action {
        CdgAction::Metrics { session_id } => {
            let session = load_session_cli(&session_id)?;
            let metrics = compute_metrics(&session.claims, &session.cdg_edges);
            Ok(serde_json::to_string(&metrics)?)
        }

        CdgAction::AddEdge {
            session_id,
            source,
            target,
            edge_type,
            weight,
            resolution,
        } => {
            let mut session = load_session_cli(&session_id)?;

            // Validate claim IDs exist
            let claim_ids: std::collections::HashSet<&str> =
                session.claims.iter().map(|c| c.id.as_str()).collect();
            if !claim_ids.contains(source.as_str()) {
                return Err(format!("Source claim '{}' not found in session", source).into());
            }
            if !claim_ids.contains(target.as_str()) {
                return Err(format!("Target claim '{}' not found in session", target).into());
            }

            let parsed_type = match edge_type.to_lowercase().as_str() {
                "support" => EdgeType::Support,
                "require" => EdgeType::Require,
                "tension" => EdgeType::Tension,
                "derive" => EdgeType::Derive,
                "qualify" => EdgeType::Qualify,
                other => return Err(format!("Unknown edge type: '{}'. Use: support, require, tension, derive, qualify", other).into()),
            };

            let parsed_resolution = match &resolution {
                Some(r) => match r.to_lowercase().as_str() {
                    "unresolved" => Some(ResolutionStatus::Unresolved),
                    "resolved" => Some(ResolutionStatus::Resolved),
                    "accepted" => Some(ResolutionStatus::Accepted),
                    other => return Err(format!("Unknown resolution: '{}'. Use: unresolved, resolved, accepted", other).into()),
                },
                None => {
                    if parsed_type == EdgeType::Tension {
                        Some(ResolutionStatus::Unresolved)
                    } else {
                        None
                    }
                }
            };

            let clamped_weight = weight.clamp(0.0, 1.0);

            let edge = CdgEdge {
                source_claim_id: source,
                target_claim_id: target,
                edge_type: parsed_type,
                weight: clamped_weight,
                resolution: parsed_resolution,
                created_at: Utc::now(),
            };

            session.cdg_edges.push(edge);
            session.updated = Utc::now();
            save_session_cli(&session)?;

            Ok(serde_json::to_string(&serde_json::json!({
                "status": "added",
                "edge_count": session.cdg_edges.len()
            }))?)
        }

        CdgAction::Resolve {
            session_id,
            edge_index,
            status,
        } => {
            let mut session = load_session_cli(&session_id)?;

            if edge_index >= session.cdg_edges.len() {
                return Err(format!(
                    "Edge index {} out of range (session has {} edges)",
                    edge_index,
                    session.cdg_edges.len()
                )
                .into());
            }

            let edge = &session.cdg_edges[edge_index];
            if edge.edge_type != EdgeType::Tension {
                return Err(format!(
                    "Edge at index {} is {:?}, not TENSION. Only tension edges can be resolved.",
                    edge_index, edge.edge_type
                )
                .into());
            }

            let parsed_status = match status.to_lowercase().as_str() {
                "resolved" => ResolutionStatus::Resolved,
                "accepted" => ResolutionStatus::Accepted,
                other => {
                    return Err(
                        format!("Unknown status: '{}'. Use: resolved, accepted", other).into(),
                    )
                }
            };

            session.cdg_edges[edge_index].resolution = Some(parsed_status);
            session.updated = Utc::now();
            save_session_cli(&session)?;

            Ok(serde_json::to_string(&serde_json::json!({
                "status": "resolved",
                "edge_index": edge_index
            }))?)
        }

        CdgAction::Orphans { session_id } => {
            let session = load_session_cli(&session_id)?;
            let orphans = find_orphans(&session.claims, &session.cdg_edges);
            Ok(serde_json::to_string(&serde_json::json!({
                "orphans": orphans,
                "count": orphans.len(),
                "total_claims": session.claims.len()
            }))?)
        }

        CdgAction::Strata { session_id } => {
            let session = load_session_cli(&session_id)?;
            let strata = compute_strata(&session.claims, &session.cdg_edges);
            Ok(serde_json::to_string(&strata)?)
        }

        CdgAction::Diff { session_id } => {
            let session = load_session_cli(&session_id)?;
            let current = compute_metrics(&session.claims, &session.cdg_edges);

            match session.cdg_snapshots.last() {
                Some(snapshot) => {
                    let diff = compute_pass_diff(&current, snapshot);
                    Ok(serde_json::to_string(&diff)?)
                }
                None => {
                    Ok(serde_json::to_string(&serde_json::json!({
                        "error": "No previous snapshot. Use 'cdg snapshot' to create one.",
                        "current": current
                    }))?)
                }
            }
        }

        CdgAction::Snapshot {
            session_id,
            pass_id,
        } => {
            let mut session = load_session_cli(&session_id)?;
            let metrics = compute_metrics(&session.claims, &session.cdg_edges);

            let snapshot = CdgSnapshot {
                pass_id: pass_id.clone(),
                metrics: metrics.clone(),
                timestamp: Utc::now(),
            };

            session.cdg_snapshots.push(snapshot);
            session.updated = Utc::now();
            save_session_cli(&session)?;

            Ok(serde_json::to_string(&serde_json::json!({
                "status": "snapshot_created",
                "pass_id": pass_id,
                "metrics": metrics,
                "snapshot_count": session.cdg_snapshots.len()
            }))?)
        }
    }
}
