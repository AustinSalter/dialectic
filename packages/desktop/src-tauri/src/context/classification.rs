//! Session Classification
//!
//! Determines how a session relates to existing theses and allocates
//! context budgets accordingly.

use serde::{Deserialize, Serialize};

/// Session classification that determines context budget allocation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionClassification {
    /// Matches existing thesis - heavy paper trail, moderate obsidian
    Fit,
    /// Related to existing work - balanced allocation
    Adjacent,
    /// Fresh territory - minimal history, heavy reasoning
    NetNew,
    /// Ephemeral query - no paper trail, maximal reference/reasoning
    Quick,
}

impl Default for SessionClassification {
    fn default() -> Self {
        SessionClassification::NetNew
    }
}

impl SessionClassification {
    /// Get budget allocation percentages for each context source
    /// Returns (paper_trail_pct, obsidian_pct, reference_pct, reasoning_pct)
    pub fn get_allocation(&self) -> BudgetAllocation {
        match self {
            SessionClassification::Fit => BudgetAllocation {
                paper_trail_pct: 40,
                obsidian_pct: 20,
                reference_pct: 10,
                reasoning_pct: 30,
            },
            SessionClassification::Adjacent => BudgetAllocation {
                paper_trail_pct: 20,
                obsidian_pct: 30,
                reference_pct: 20,
                reasoning_pct: 30,
            },
            SessionClassification::NetNew => BudgetAllocation {
                paper_trail_pct: 5,
                obsidian_pct: 15,
                reference_pct: 20,
                reasoning_pct: 60,
            },
            SessionClassification::Quick => BudgetAllocation {
                paper_trail_pct: 0,
                obsidian_pct: 5,
                reference_pct: 35,
                reasoning_pct: 60,
            },
        }
    }

    /// Convert to display string
    pub fn display_name(&self) -> &'static str {
        match self {
            SessionClassification::Fit => "Fit (matches thesis)",
            SessionClassification::Adjacent => "Adjacent (related)",
            SessionClassification::NetNew => "Net New (fresh)",
            SessionClassification::Quick => "Quick (ephemeral)",
        }
    }
}

/// Budget allocation percentages
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAllocation {
    pub paper_trail_pct: u8,
    pub obsidian_pct: u8,
    pub reference_pct: u8,
    pub reasoning_pct: u8,
}

impl BudgetAllocation {
    /// Calculate actual token budgets given a total working budget
    pub fn to_token_budgets(&self, working_budget: u32) -> TokenBudgets {
        TokenBudgets {
            paper_trail: (working_budget as u64 * self.paper_trail_pct as u64 / 100) as u32,
            obsidian: (working_budget as u64 * self.obsidian_pct as u64 / 100) as u32,
            reference: (working_budget as u64 * self.reference_pct as u64 / 100) as u32,
            reasoning: (working_budget as u64 * self.reasoning_pct as u64 / 100) as u32,
        }
    }
}

/// Actual token budgets in absolute numbers
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenBudgets {
    pub paper_trail: u32,
    pub obsidian: u32,
    pub reference: u32,
    pub reasoning: u32,
}

impl TokenBudgets {
    pub fn total(&self) -> u32 {
        self.paper_trail + self.obsidian + self.reference + self.reasoning
    }
}

/// Classification signals used to determine session classification
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationSignals {
    /// Keywords from session title/description
    pub keywords: Vec<String>,
    /// Thesis IDs that might be related
    pub related_thesis_ids: Vec<String>,
    /// Similarity scores to existing theses (0.0 - 1.0)
    pub thesis_similarities: Vec<f32>,
    /// Whether user explicitly marked as quick
    pub user_marked_quick: bool,
    /// Whether session has existing paper trail
    pub has_paper_trail: bool,
}

/// Classify a session based on its signals
pub fn classify_session(signals: &ClassificationSignals) -> SessionClassification {
    // User explicit quick takes precedence
    if signals.user_marked_quick {
        return SessionClassification::Quick;
    }

    // Check thesis similarity
    let max_similarity = signals.thesis_similarities.iter().copied().fold(0.0_f32, f32::max);

    if max_similarity >= 0.8 {
        SessionClassification::Fit
    } else if max_similarity >= 0.4 || signals.has_paper_trail {
        SessionClassification::Adjacent
    } else if signals.related_thesis_ids.is_empty() && signals.keywords.is_empty() {
        SessionClassification::Quick
    } else {
        SessionClassification::NetNew
    }
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn context_get_allocation(classification: SessionClassification) -> BudgetAllocation {
    classification.get_allocation()
}

#[tauri::command]
pub fn context_classify_session(signals: ClassificationSignals) -> SessionClassification {
    classify_session(&signals)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classification_allocations_sum_to_100() {
        for classification in [
            SessionClassification::Fit,
            SessionClassification::Adjacent,
            SessionClassification::NetNew,
            SessionClassification::Quick,
        ] {
            let alloc = classification.get_allocation();
            let total = alloc.paper_trail_pct + alloc.obsidian_pct + alloc.reference_pct + alloc.reasoning_pct;
            assert_eq!(total, 100, "Classification {:?} doesn't sum to 100", classification);
        }
    }

    #[test]
    fn test_quick_has_no_paper_trail() {
        let alloc = SessionClassification::Quick.get_allocation();
        assert_eq!(alloc.paper_trail_pct, 0);
    }

    #[test]
    fn test_fit_has_high_paper_trail() {
        let alloc = SessionClassification::Fit.get_allocation();
        assert!(alloc.paper_trail_pct >= 30);
    }

    #[test]
    fn test_classify_high_similarity() {
        let signals = ClassificationSignals {
            thesis_similarities: vec![0.85],
            ..Default::default()
        };
        assert_eq!(classify_session(&signals), SessionClassification::Fit);
    }

    #[test]
    fn test_classify_user_quick() {
        let signals = ClassificationSignals {
            user_marked_quick: true,
            thesis_similarities: vec![0.9], // Even high similarity
            ..Default::default()
        };
        assert_eq!(classify_session(&signals), SessionClassification::Quick);
    }

    #[test]
    fn test_token_budgets() {
        let alloc = SessionClassification::Fit.get_allocation();
        let budgets = alloc.to_token_budgets(72000); // 72K working budget

        // FIT: 40% paper trail = 28,800
        assert_eq!(budgets.paper_trail, 28800);
        // 20% obsidian = 14,400
        assert_eq!(budgets.obsidian, 14400);
    }
}
