//! Claim Dependency Graph (CDG) module
//!
//! Provides typed, weighted, directed edges between claims and computes
//! structural coherence metrics. See COHERENCE.md for the formal model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

use crate::session::Claim;

// ============ Types ============

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EdgeType {
    Support,
    Require,
    Tension,
    Derive,
    Qualify,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClaimStratum {
    Core,
    Structural,
    Evidential,
    Peripheral,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResolutionStatus {
    Unresolved,
    Resolved,
    Accepted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CdgEdge {
    pub source_claim_id: String,
    pub target_claim_id: String,
    pub edge_type: EdgeType,
    /// User-assigned confidence weight in `[0.0, 1.0]`.
    pub weight: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution: Option<ResolutionStatus>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CdgMetrics {
    pub sdd: f32,
    pub orphan_ratio: f32,
    pub core_reachability: f32,
    pub trr: f32,
    pub lbr: f32,
    pub coherence: f32,
    pub claim_count: usize,
    pub edge_count: usize,
    pub tension_count: usize,
    pub resolved_count: usize,
    pub accepted_count: usize,
    pub unresolved_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CdgSnapshot {
    pub pass_id: String,
    pub metrics: CdgMetrics,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassDiff {
    pub previous_pass_id: String,
    pub current: CdgMetrics,
    pub previous: CdgMetrics,
    pub delta_sdd: f32,
    pub delta_orphan_ratio: f32,
    pub delta_core_reachability: f32,
    pub delta_trr: f32,
    pub delta_lbr: f32,
    pub delta_coherence: f32,
}

// ============ Edge type weights (from COHERENCE.md) ============

fn type_weight(edge_type: &EdgeType) -> f32 {
    match edge_type {
        EdgeType::Require => 1.0,
        EdgeType::Derive => 0.9,
        EdgeType::Support => 0.7,
        EdgeType::Tension => 0.5, // base; modified by resolution_bonus
        EdgeType::Qualify => 0.3,
    }
}

fn resolution_bonus(edge: &CdgEdge) -> f32 {
    if edge.edge_type == EdgeType::Tension {
        match &edge.resolution {
            Some(ResolutionStatus::Resolved) => 1.5,
            Some(ResolutionStatus::Accepted) => 1.0,
            Some(ResolutionStatus::Unresolved) | None => 0.3,
        }
    } else {
        1.0
    }
}

fn edge_weight(edge: &CdgEdge) -> f32 {
    edge.weight * type_weight(&edge.edge_type) * resolution_bonus(edge)
}

// ============ Metric computation ============

/// Compute strata for all claims based on REQUIRE-path topology.
///
/// - CORE: unique sink of all REQUIRE paths (claim with no outgoing REQUIRE edges
///   but with incoming REQUIRE edges; if multiple, pick highest in-degree)
/// - STRUCTURAL: has a REQUIRE path to CORE
/// - EVIDENTIAL: has a SUPPORT edge to a STRUCTURAL node but no REQUIRE path to CORE
/// - PERIPHERAL: everything else
pub fn compute_strata(claims: &[Claim], edges: &[CdgEdge]) -> HashMap<String, ClaimStratum> {
    let claim_ids: HashSet<&str> = claims.iter().map(|c| c.id.as_str()).collect();
    let mut strata: HashMap<String, ClaimStratum> = HashMap::new();

    // Build REQUIRE adjacency: source -> targets (source REQUIRE target means source depends on target)
    let mut require_targets: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut has_incoming_require: HashSet<&str> = HashSet::new();
    let mut has_outgoing_require: HashSet<&str> = HashSet::new();

    for edge in edges {
        if edge.edge_type == EdgeType::Require
            && claim_ids.contains(edge.source_claim_id.as_str())
            && claim_ids.contains(edge.target_claim_id.as_str())
        {
            require_targets
                .entry(edge.source_claim_id.as_str())
                .or_default()
                .push(edge.target_claim_id.as_str());
            has_incoming_require.insert(edge.target_claim_id.as_str());
            has_outgoing_require.insert(edge.source_claim_id.as_str());
        }
    }

    // Find CORE: claim with incoming REQUIRE edges but no outgoing REQUIRE edges.
    // If multiple candidates, pick the one with the most incoming REQUIRE edges.
    let core_candidates: Vec<&str> = claim_ids
        .iter()
        .filter(|id| has_incoming_require.contains(*id) && !has_outgoing_require.contains(*id))
        .copied()
        .collect();

    let core_id = if core_candidates.len() == 1 {
        Some(core_candidates[0])
    } else if core_candidates.len() > 1 {
        // Pick candidate with most incoming REQUIRE edges
        let mut best = core_candidates[0];
        let mut best_count = 0usize;
        for &candidate in &core_candidates {
            let count = edges
                .iter()
                .filter(|e| e.edge_type == EdgeType::Require && e.target_claim_id == candidate)
                .count();
            if count > best_count {
                best = candidate;
                best_count = count;
            }
        }
        Some(best)
    } else {
        None
    };

    // Mark CORE
    if let Some(core) = core_id {
        strata.insert(core.to_string(), ClaimStratum::Core);
    }

    // Find STRUCTURAL: claims that have a REQUIRE path to CORE
    // BFS backwards from CORE through REQUIRE edges
    if let Some(core) = core_id {
        let mut reachable_to_core: HashSet<&str> = HashSet::new();
        reachable_to_core.insert(core);

        // Build reverse REQUIRE adjacency: target -> sources
        let mut require_sources: HashMap<&str, Vec<&str>> = HashMap::new();
        for edge in edges {
            if edge.edge_type == EdgeType::Require
                && claim_ids.contains(edge.source_claim_id.as_str())
                && claim_ids.contains(edge.target_claim_id.as_str())
            {
                require_sources
                    .entry(edge.target_claim_id.as_str())
                    .or_default()
                    .push(edge.source_claim_id.as_str());
            }
        }

        let mut queue: VecDeque<&str> = VecDeque::new();
        queue.push_back(core);

        while let Some(node) = queue.pop_front() {
            if let Some(sources) = require_sources.get(node) {
                for &src in sources {
                    if reachable_to_core.insert(src) {
                        queue.push_back(src);
                    }
                }
            }
        }

        for &id in &reachable_to_core {
            if id != core {
                strata.insert(id.to_string(), ClaimStratum::Structural);
            }
        }

        // Find EVIDENTIAL: SUPPORT edge to a STRUCTURAL node, no REQUIRE path to CORE
        let structural_ids: HashSet<&str> = reachable_to_core.iter().copied().collect();
        for edge in edges {
            if edge.edge_type == EdgeType::Support
                && claim_ids.contains(edge.source_claim_id.as_str())
                && structural_ids.contains(edge.target_claim_id.as_str())
                && !reachable_to_core.contains(edge.source_claim_id.as_str())
            {
                strata
                    .entry(edge.source_claim_id.clone())
                    .or_insert(ClaimStratum::Evidential);
            }
        }
    }

    // Everything else is PERIPHERAL
    for claim in claims {
        strata
            .entry(claim.id.clone())
            .or_insert(ClaimStratum::Peripheral);
    }

    strata
}

/// Find orphan claim IDs (degree 0 in the edge graph).
pub fn find_orphans(claims: &[Claim], edges: &[CdgEdge]) -> Vec<String> {
    let connected: HashSet<&str> = edges
        .iter()
        .flat_map(|e| {
            std::iter::once(e.source_claim_id.as_str())
                .chain(std::iter::once(e.target_claim_id.as_str()))
        })
        .collect();

    claims
        .iter()
        .filter(|c| !connected.contains(c.id.as_str()))
        .map(|c| c.id.clone())
        .collect()
}

/// Compute all 6 CDG metrics from COHERENCE.md.
pub fn compute_metrics(claims: &[Claim], edges: &[CdgEdge]) -> CdgMetrics {
    let n = claims.len();

    if n == 0 {
        return CdgMetrics {
            sdd: 0.0,
            orphan_ratio: 0.0,
            core_reachability: 0.0,
            trr: 0.0,
            lbr: 0.0,
            coherence: 0.0,
            claim_count: 0,
            edge_count: 0,
            tension_count: 0,
            resolved_count: 0,
            accepted_count: 0,
            unresolved_count: 0,
        };
    }

    let claim_ids: HashSet<&str> = claims.iter().map(|c| c.id.as_str()).collect();

    // Filter to valid edges (both endpoints exist)
    let valid_edges: Vec<&CdgEdge> = edges
        .iter()
        .filter(|e| {
            claim_ids.contains(e.source_claim_id.as_str())
                && claim_ids.contains(e.target_claim_id.as_str())
        })
        .collect();

    // SDD: Structural Dependence Density
    let max_edges = n * (n - 1);
    let sdd = if max_edges > 0 {
        let weighted_sum: f32 = valid_edges.iter().map(|e| edge_weight(e)).sum();
        weighted_sum / max_edges as f32
    } else {
        0.0
    };

    // OR: Orphan Ratio
    let orphans = find_orphans(claims, edges);
    let orphan_ratio = orphans.len() as f32 / n as f32;

    // Strata for LBR and CR
    let strata = compute_strata(claims, edges);

    // CR: Core Reachability — fraction of claims with a directed path to CORE
    let core_id = strata
        .iter()
        .find(|(_, s)| **s == ClaimStratum::Core)
        .map(|(id, _)| id.as_str());

    let core_reachability = if let Some(core) = core_id {
        // BFS backwards: find all nodes that can reach CORE via any edge type
        let mut can_reach_core: HashSet<&str> = HashSet::new();
        can_reach_core.insert(core);

        // BFS backwards: find all nodes that can reach CORE
        // Build reverse adjacency
        let mut rev_adj: HashMap<&str, Vec<&str>> = HashMap::new();
        for edge in &valid_edges {
            rev_adj
                .entry(edge.target_claim_id.as_str())
                .or_default()
                .push(edge.source_claim_id.as_str());
        }

        let mut queue: VecDeque<&str> = VecDeque::new();
        queue.push_back(core);
        while let Some(node) = queue.pop_front() {
            if let Some(sources) = rev_adj.get(node) {
                for &src in sources {
                    if can_reach_core.insert(src) {
                        queue.push_back(src);
                    }
                }
            }
        }

        can_reach_core.len() as f32 / n as f32
    } else {
        0.0
    };

    // TRR: Tension Resolution Rate
    let tension_edges: Vec<&&CdgEdge> = valid_edges
        .iter()
        .filter(|e| e.edge_type == EdgeType::Tension)
        .collect();
    let tension_count = tension_edges.len();
    let resolved_count = tension_edges
        .iter()
        .filter(|e| e.resolution == Some(ResolutionStatus::Resolved))
        .count();
    let accepted_count = tension_edges
        .iter()
        .filter(|e| e.resolution == Some(ResolutionStatus::Accepted))
        .count();
    let unresolved_count = tension_count - resolved_count - accepted_count;

    let trr = if tension_count > 0 {
        (resolved_count + accepted_count) as f32 / tension_count as f32
    } else {
        1.0 // No tensions = fully resolved (not a penalty)
    };

    // LBR: Load-Bearing Ratio
    let load_bearing = strata
        .values()
        .filter(|s| **s == ClaimStratum::Core || **s == ClaimStratum::Structural)
        .count();
    let lbr = load_bearing as f32 / n as f32;

    // Composite coherence: 0.35*SDD + 0.25*CR + 0.25*TRR + 0.15*(1-OR)
    let coherence = 0.35 * sdd + 0.25 * core_reachability + 0.25 * trr + 0.15 * (1.0 - orphan_ratio);

    CdgMetrics {
        sdd,
        orphan_ratio,
        core_reachability,
        trr,
        lbr,
        coherence,
        claim_count: n,
        edge_count: valid_edges.len(),
        tension_count,
        resolved_count,
        accepted_count,
        unresolved_count,
    }
}

/// Compare current metrics vs the most recent snapshot.
pub fn compute_pass_diff(current: &CdgMetrics, snapshot: &CdgSnapshot) -> PassDiff {
    let prev = &snapshot.metrics;
    PassDiff {
        previous_pass_id: snapshot.pass_id.clone(),
        current: current.clone(),
        previous: prev.clone(),
        delta_sdd: current.sdd - prev.sdd,
        delta_orphan_ratio: current.orphan_ratio - prev.orphan_ratio,
        delta_core_reachability: current.core_reachability - prev.core_reachability,
        delta_trr: current.trr - prev.trr,
        delta_lbr: current.lbr - prev.lbr,
        delta_coherence: current.coherence - prev.coherence,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn make_claim(id: &str) -> Claim {
        Claim {
            id: id.to_string(),
            content: format!("Claim {}", id),
            source_id: "src1".to_string(),
            marker: None,
            created_at: Utc::now(),
        }
    }

    fn make_edge(src: &str, tgt: &str, edge_type: EdgeType, weight: f32) -> CdgEdge {
        CdgEdge {
            source_claim_id: src.to_string(),
            target_claim_id: tgt.to_string(),
            edge_type,
            weight,
            resolution: None,
            created_at: Utc::now(),
        }
    }

    /// Build a small graph:
    ///   A --REQUIRE--> B --REQUIRE--> C (core)
    ///   D --SUPPORT--> B
    ///   E (orphan)
    fn fixture() -> (Vec<Claim>, Vec<CdgEdge>) {
        let claims = vec![
            make_claim("A"),
            make_claim("B"),
            make_claim("C"),
            make_claim("D"),
            make_claim("E"),
        ];
        let edges = vec![
            make_edge("A", "B", EdgeType::Require, 1.0),
            make_edge("B", "C", EdgeType::Require, 1.0),
            make_edge("D", "B", EdgeType::Support, 0.7),
        ];
        (claims, edges)
    }

    #[test]
    fn test_compute_strata() {
        let (claims, edges) = fixture();
        let strata = compute_strata(&claims, &edges);

        assert_eq!(strata["C"], ClaimStratum::Core);
        assert_eq!(strata["B"], ClaimStratum::Structural);
        assert_eq!(strata["A"], ClaimStratum::Structural);
        assert_eq!(strata["D"], ClaimStratum::Evidential);
        assert_eq!(strata["E"], ClaimStratum::Peripheral);
    }

    #[test]
    fn test_find_orphans() {
        let (claims, edges) = fixture();
        let orphans = find_orphans(&claims, &edges);

        assert_eq!(orphans, vec!["E".to_string()]);
    }

    #[test]
    fn test_compute_metrics() {
        let (claims, edges) = fixture();
        let metrics = compute_metrics(&claims, &edges);

        assert_eq!(metrics.claim_count, 5);
        assert_eq!(metrics.edge_count, 3);
        assert_eq!(metrics.tension_count, 0);
        // TRR = 1.0 when no tensions
        assert!((metrics.trr - 1.0).abs() < 0.001);
        // Orphan ratio = 1/5 = 0.2
        assert!((metrics.orphan_ratio - 0.2).abs() < 0.001);
        // Core reachability: A, B, C can reach core, D->B->C also reaches core = 4/5
        assert!((metrics.core_reachability - 0.8).abs() < 0.001);
    }

    #[test]
    fn test_compute_metrics_empty() {
        let metrics = compute_metrics(&[], &[]);
        assert_eq!(metrics.claim_count, 0);
        assert_eq!(metrics.coherence, 0.0);
    }
}
