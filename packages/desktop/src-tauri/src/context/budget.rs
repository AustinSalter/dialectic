//! Token Budget Management
//!
//! Tracks and allocates context tokens across paper trail, obsidian, and reference sources.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use super::classification::{SessionClassification, TokenBudgets};

/// Total context window budget
pub const TOTAL_BUDGET: u32 = 100_000;
/// Reserved for output generation
pub const OUTPUT_RESERVED: u32 = 28_000;
/// Working budget for context
pub const WORKING_BUDGET: u32 = TOTAL_BUDGET - OUTPUT_RESERVED; // 72,000

/// Budget thresholds for death spiral prevention
pub const THRESHOLD_AUTO_COMPRESS: u8 = 70;
pub const THRESHOLD_WARN_USER: u8 = 85;
pub const THRESHOLD_FORCE_COMPRESS: u8 = 95;

/// Context budget tracking for a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextBudget {
    /// Session classification
    pub classification: SessionClassification,

    /// Paper trail budget and usage
    pub paper_trail_budget: u32,
    pub paper_trail_used: u32,

    /// Obsidian/webbed notes budget and usage
    pub obsidian_budget: u32,
    pub obsidian_used: u32,

    /// Reference documents budget and usage
    pub reference_budget: u32,
    pub reference_used: u32,

    /// Reasoning space budget
    pub reasoning_budget: u32,

    /// Last audit timestamp
    pub last_audit: DateTime<Utc>,
}

impl Default for ContextBudget {
    fn default() -> Self {
        Self::new(SessionClassification::NetNew)
    }
}

impl ContextBudget {
    /// Create a new context budget with the given classification
    pub fn new(classification: SessionClassification) -> Self {
        let alloc = classification.get_allocation();
        let budgets = alloc.to_token_budgets(WORKING_BUDGET);

        Self {
            classification,
            paper_trail_budget: budgets.paper_trail,
            paper_trail_used: 0,
            obsidian_budget: budgets.obsidian,
            obsidian_used: 0,
            reference_budget: budgets.reference,
            reference_used: 0,
            reasoning_budget: budgets.reasoning,
            last_audit: Utc::now(),
        }
    }

    /// Recalculate budgets after classification change
    pub fn reclassify(&mut self, classification: SessionClassification) {
        self.classification = classification;
        let alloc = classification.get_allocation();
        let budgets = alloc.to_token_budgets(WORKING_BUDGET);

        self.paper_trail_budget = budgets.paper_trail;
        self.obsidian_budget = budgets.obsidian;
        self.reference_budget = budgets.reference;
        self.reasoning_budget = budgets.reasoning;
        self.last_audit = Utc::now();
    }

    /// Get total tokens used across all sources
    pub fn total_used(&self) -> u32 {
        self.paper_trail_used + self.obsidian_used + self.reference_used
    }

    /// Get usage percentage (0-100)
    pub fn usage_percentage(&self) -> u8 {
        let total_budget = self.paper_trail_budget + self.obsidian_budget + self.reference_budget;
        if total_budget == 0 {
            return 0;
        }
        ((self.total_used() as u64 * 100) / total_budget as u64).min(100) as u8
    }

    /// Check which threshold we've crossed
    pub fn threshold_status(&self) -> ThresholdStatus {
        let pct = self.usage_percentage();
        if pct >= THRESHOLD_FORCE_COMPRESS {
            ThresholdStatus::ForceCompress
        } else if pct >= THRESHOLD_WARN_USER {
            ThresholdStatus::WarnUser
        } else if pct >= THRESHOLD_AUTO_COMPRESS {
            ThresholdStatus::AutoCompress
        } else {
            ThresholdStatus::Normal
        }
    }

    /// Get remaining budget for each source
    pub fn remaining(&self) -> TokenBudgets {
        TokenBudgets {
            paper_trail: self.paper_trail_budget.saturating_sub(self.paper_trail_used),
            obsidian: self.obsidian_budget.saturating_sub(self.obsidian_used),
            reference: self.reference_budget.saturating_sub(self.reference_used),
            reasoning: self.reasoning_budget,
        }
    }

    /// Check if we can add tokens to a source
    pub fn can_add(&self, source: ContextSource, tokens: u32) -> bool {
        match source {
            ContextSource::PaperTrail => self.paper_trail_used + tokens <= self.paper_trail_budget,
            ContextSource::Obsidian => self.obsidian_used + tokens <= self.obsidian_budget,
            ContextSource::Reference => self.reference_used + tokens <= self.reference_budget,
        }
    }

    /// Add tokens to a source (returns false if would exceed budget)
    pub fn add_tokens(&mut self, source: ContextSource, tokens: u32) -> bool {
        if !self.can_add(source, tokens) {
            return false;
        }
        match source {
            ContextSource::PaperTrail => self.paper_trail_used += tokens,
            ContextSource::Obsidian => self.obsidian_used += tokens,
            ContextSource::Reference => self.reference_used += tokens,
        }
        true
    }

    /// Remove tokens from a source
    pub fn remove_tokens(&mut self, source: ContextSource, tokens: u32) {
        match source {
            ContextSource::PaperTrail => {
                self.paper_trail_used = self.paper_trail_used.saturating_sub(tokens);
            }
            ContextSource::Obsidian => {
                self.obsidian_used = self.obsidian_used.saturating_sub(tokens);
            }
            ContextSource::Reference => {
                self.reference_used = self.reference_used.saturating_sub(tokens);
            }
        }
    }

    /// Record an audit
    pub fn record_audit(&mut self) {
        self.last_audit = Utc::now();
    }
}

/// Budget threshold status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThresholdStatus {
    /// Under 70% - normal operation
    Normal,
    /// 70-84% - auto-compress tier 4
    AutoCompress,
    /// 85-94% - warn user
    WarnUser,
    /// 95%+ - force compression
    ForceCompress,
}

/// Context source types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSource {
    PaperTrail,
    Obsidian,
    Reference,
}

/// Budget status for frontend display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetStatus {
    pub classification: SessionClassification,
    pub total_budget: u32,
    pub total_used: u32,
    pub usage_percentage: u8,
    pub threshold_status: ThresholdStatus,
    pub paper_trail: SourceStatus,
    pub obsidian: SourceStatus,
    pub reference: SourceStatus,
    pub reasoning_budget: u32,
    pub last_audit: DateTime<Utc>,
}

/// Status for individual context source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStatus {
    pub budget: u32,
    pub used: u32,
    pub remaining: u32,
    pub percentage: u8,
}

impl From<&ContextBudget> for BudgetStatus {
    fn from(budget: &ContextBudget) -> Self {
        let remaining = budget.remaining();

        let paper_trail_pct = if budget.paper_trail_budget > 0 {
            ((budget.paper_trail_used as u64 * 100) / budget.paper_trail_budget as u64) as u8
        } else {
            0
        };

        let obsidian_pct = if budget.obsidian_budget > 0 {
            ((budget.obsidian_used as u64 * 100) / budget.obsidian_budget as u64) as u8
        } else {
            0
        };

        let reference_pct = if budget.reference_budget > 0 {
            ((budget.reference_used as u64 * 100) / budget.reference_budget as u64) as u8
        } else {
            0
        };

        BudgetStatus {
            classification: budget.classification,
            total_budget: WORKING_BUDGET,
            total_used: budget.total_used(),
            usage_percentage: budget.usage_percentage(),
            threshold_status: budget.threshold_status(),
            paper_trail: SourceStatus {
                budget: budget.paper_trail_budget,
                used: budget.paper_trail_used,
                remaining: remaining.paper_trail,
                percentage: paper_trail_pct,
            },
            obsidian: SourceStatus {
                budget: budget.obsidian_budget,
                used: budget.obsidian_used,
                remaining: remaining.obsidian,
                percentage: obsidian_pct,
            },
            reference: SourceStatus {
                budget: budget.reference_budget,
                used: budget.reference_used,
                remaining: remaining.reference,
                percentage: reference_pct,
            },
            reasoning_budget: budget.reasoning_budget,
            last_audit: budget.last_audit,
        }
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn context_get_budget_constants() -> serde_json::Value {
    serde_json::json!({
        "totalBudget": TOTAL_BUDGET,
        "outputReserved": OUTPUT_RESERVED,
        "workingBudget": WORKING_BUDGET,
        "thresholdAutoCompress": THRESHOLD_AUTO_COMPRESS,
        "thresholdWarnUser": THRESHOLD_WARN_USER,
        "thresholdForceCompress": THRESHOLD_FORCE_COMPRESS,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_budget_constants() {
        assert_eq!(WORKING_BUDGET, TOTAL_BUDGET - OUTPUT_RESERVED);
        assert!(THRESHOLD_AUTO_COMPRESS < THRESHOLD_WARN_USER);
        assert!(THRESHOLD_WARN_USER < THRESHOLD_FORCE_COMPRESS);
    }

    #[test]
    fn test_new_budget_allocation() {
        let budget = ContextBudget::new(SessionClassification::Fit);
        // Fit: 40% paper trail
        assert_eq!(budget.paper_trail_budget, 28800); // 72000 * 0.4
        assert_eq!(budget.paper_trail_used, 0);
    }

    #[test]
    fn test_add_tokens() {
        let mut budget = ContextBudget::new(SessionClassification::NetNew);

        // Should succeed
        assert!(budget.add_tokens(ContextSource::Reference, 1000));
        assert_eq!(budget.reference_used, 1000);

        // Try to exceed budget
        let over_budget = budget.reference_budget + 1;
        assert!(!budget.add_tokens(ContextSource::Reference, over_budget));
    }

    #[test]
    fn test_threshold_status() {
        let mut budget = ContextBudget::new(SessionClassification::Fit);

        // Start normal
        assert_eq!(budget.threshold_status(), ThresholdStatus::Normal);

        // Add 75% usage
        let total = budget.paper_trail_budget + budget.obsidian_budget + budget.reference_budget;
        budget.paper_trail_used = (total as f64 * 0.75) as u32;
        assert_eq!(budget.threshold_status(), ThresholdStatus::AutoCompress);

        // Add to 90%
        budget.paper_trail_used = (total as f64 * 0.90) as u32;
        assert_eq!(budget.threshold_status(), ThresholdStatus::WarnUser);

        // Add to 96%
        budget.paper_trail_used = (total as f64 * 0.96) as u32;
        assert_eq!(budget.threshold_status(), ThresholdStatus::ForceCompress);
    }

    #[test]
    fn test_reclassify() {
        let mut budget = ContextBudget::new(SessionClassification::Quick);
        assert_eq!(budget.paper_trail_budget, 0); // Quick has 0% paper trail

        budget.reclassify(SessionClassification::Fit);
        assert_eq!(budget.paper_trail_budget, 28800); // Fit has 40%
    }
}
