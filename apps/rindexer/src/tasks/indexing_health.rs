//! Progress-aware health for on-chain indexing.
//!
//! rindexer's built-in `/health` only checks that the database answers and that
//! event tables exist, so it stays healthy while indexing is stalled. This module
//! polls the checkpoints rindexer writes (`rindexer_internal.<table>.last_synced_block`)
//! and reports a (contract, network) group as stalled when none of its event
//! checkpoints advanced within the stall threshold.
//!
//! Progress is tracked per group rather than per event because dependency-ordered
//! contracts index one event level at a time during catch-up: the other events of
//! the contract legitimately wait, but some event of the group is always advancing
//! while indexing works. Live indexing advances every checkpoint on each poll even
//! when no logs match, so a caught-up indexer keeps advancing too.

use crate::extensions::db_extension::DB;
use alloy::primitives::keccak256;
use anyhow::{Context, Result};
use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use rindexer::manifest::yaml::read_manifest_raw;
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tracing::{debug, info, warn};

const DEFAULT_STALL_THRESHOLD_SECS: u64 = 30 * 60;
const DEFAULT_PROGRESS_POLL_SECS: u64 = 60;
const DEFAULT_HEALTH_PORT: u16 = 3000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IndexingHealthConfig {
    /// A group with no checkpoint advance for longer than this is stalled.
    pub stall_threshold: Duration,
    /// How often checkpoints are read from the database.
    pub poll_interval: Duration,
    /// Port serving the progress-aware `/health` endpoint.
    pub port: u16,
}

impl IndexingHealthConfig {
    pub fn from_env() -> Self {
        Self::from_values(
            std::env::var("INDEXER_STALL_THRESHOLD_SECS")
                .ok()
                .as_deref(),
            std::env::var("INDEXER_PROGRESS_POLL_SECS").ok().as_deref(),
            std::env::var("HEALTH_PORT").ok().as_deref(),
        )
    }

    fn from_values(
        stall_threshold_secs: Option<&str>,
        poll_secs: Option<&str>,
        port: Option<&str>,
    ) -> Self {
        Self {
            stall_threshold: Duration::from_secs(parse_positive(
                stall_threshold_secs,
                DEFAULT_STALL_THRESHOLD_SECS,
            )),
            poll_interval: Duration::from_secs(parse_positive(
                poll_secs,
                DEFAULT_PROGRESS_POLL_SECS,
            )),
            port: parse_positive(port, DEFAULT_HEALTH_PORT),
        }
    }
}

fn parse_positive<T>(value: Option<&str>, default: T) -> T
where
    T: std::str::FromStr + PartialOrd + Default,
{
    value
        .and_then(|value| value.trim().parse::<T>().ok())
        .filter(|value| *value > T::default())
        .unwrap_or(default)
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct StreamGroup {
    pub contract: String,
    pub network: String,
}

/// One rindexer event checkpoint: `rindexer_internal.<table>` row for `group.network`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProgressStream {
    pub group: StreamGroup,
    pub event: String,
    pub table: String,
}

/// Port of rindexer's private `helpers::camel_to_snake`, used to derive the
/// internal checkpoint table names exactly as rindexer does.
fn camel_to_snake(s: &str) -> String {
    let mut snake_case = String::new();
    let mut previous_was_uppercase = false;
    let mut previous_was_digit = false;
    let mut uppercase_sequence_length = 0;

    for (i, c) in s.chars().enumerate() {
        if c.is_alphanumeric() || c == '_' {
            if c.is_uppercase() {
                if i > 0
                    && (!previous_was_uppercase
                        || (i + 1 < s.len()
                            && s.chars().nth(i + 1).is_some_and(|next| next.is_lowercase())))
                {
                    snake_case.push('_');
                }
                snake_case.push(c.to_ascii_lowercase());
                previous_was_uppercase = true;
                previous_was_digit = false;
                uppercase_sequence_length += 1;
            } else if c.is_ascii_digit() {
                if i > 0
                    && !previous_was_digit
                    && !snake_case.ends_with('_')
                    && uppercase_sequence_length != 1
                {
                    snake_case.push('_');
                }
                snake_case.push(c);
                previous_was_uppercase = false;
                previous_was_digit = true;
                uppercase_sequence_length = 0;
            } else {
                snake_case.push(c);
                previous_was_uppercase = false;
                previous_was_digit = false;
                uppercase_sequence_length = 0;
            }
        }
    }

    snake_case
}

/// Port of rindexer's `generate_internal_event_table_name` (including the
/// 63-character Postgres identifier compaction).
fn internal_event_table_name(indexer: &str, contract: &str, event: &str) -> String {
    let table_name = format!(
        "{}_{}_{}",
        camel_to_snake(indexer),
        camel_to_snake(contract),
        camel_to_snake(event)
    );
    if table_name.len() > 63 {
        let hash = keccak256(table_name.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        return format!("{}_{}", &table_name[0..52], &hash[0..10]);
    }
    table_name
}

pub fn progress_streams_from_manifest(manifest_path: &Path) -> Result<Vec<ProgressStream>> {
    // The raw reader skips `${ENV}` substitution, which panics on missing variables;
    // only contract, event and network names are needed here.
    let manifest = read_manifest_raw(&manifest_path.to_path_buf())
        .with_context(|| format!("Failed to read manifest {}", manifest_path.display()))?;

    let mut streams = Vec::new();
    for contract in &manifest.contracts {
        let Some(events) = &contract.include_events else {
            warn!(
                contract = %contract.name,
                "Contract has no include_events; its progress is not monitored"
            );
            continue;
        };
        for detail in &contract.details {
            for event in events {
                streams.push(ProgressStream {
                    group: StreamGroup {
                        contract: contract.name.clone(),
                        network: detail.network.clone(),
                    },
                    event: event.name.clone(),
                    table: internal_event_table_name(&manifest.name, &contract.name, &event.name),
                });
            }
        }
    }
    Ok(streams)
}

#[derive(Debug)]
struct GroupProgress {
    blocks: BTreeMap<String, u64>,
    last_advanced_at: Instant,
}

/// Tracks when each group's checkpoints last advanced.
#[derive(Debug)]
pub struct ProgressTracker {
    groups: BTreeMap<StreamGroup, GroupProgress>,
    last_poll_error: Option<String>,
}

impl ProgressTracker {
    /// Groups start with `last_advanced_at = now`, so the stall threshold doubles as
    /// the startup grace period.
    pub fn new(groups: impl IntoIterator<Item = StreamGroup>, now: Instant) -> Self {
        Self {
            groups: groups
                .into_iter()
                .map(|group| {
                    (
                        group,
                        GroupProgress {
                            blocks: BTreeMap::new(),
                            last_advanced_at: now,
                        },
                    )
                })
                .collect(),
            last_poll_error: None,
        }
    }

    /// Record an observed checkpoint. Only a strictly higher block than the previous
    /// observation counts as progress; the first observation only sets a baseline.
    pub fn record(&mut self, group: &StreamGroup, event: &str, block: u64, now: Instant) {
        let Some(progress) = self.groups.get_mut(group) else {
            return;
        };
        match progress.blocks.insert(event.to_string(), block) {
            Some(previous) if block > previous => progress.last_advanced_at = now,
            _ => {}
        }
    }

    pub fn set_poll_error(&mut self, error: Option<String>) {
        self.last_poll_error = error;
    }

    pub fn report(&self, now: Instant, stall_threshold: Duration) -> HealthReport {
        let groups: Vec<GroupReport> = self
            .groups
            .iter()
            .map(|(group, progress)| {
                let since_progress = now.saturating_duration_since(progress.last_advanced_at);
                GroupReport {
                    contract: group.contract.clone(),
                    network: group.network.clone(),
                    last_synced_block: progress.blocks.values().copied().max(),
                    events: progress.blocks.clone(),
                    seconds_since_progress: since_progress.as_secs(),
                    stalled: since_progress > stall_threshold,
                }
            })
            .collect();

        // With nothing to monitor we cannot vouch for progress.
        let healthy = !groups.is_empty() && groups.iter().all(|group| !group.stalled);
        HealthReport {
            status: if healthy {
                ReportStatus::Healthy
            } else {
                ReportStatus::Stalled
            },
            stall_threshold_secs: stall_threshold.as_secs(),
            last_poll_error: self.last_poll_error.clone(),
            groups,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ReportStatus {
    Healthy,
    Stalled,
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupReport {
    pub contract: String,
    pub network: String,
    pub last_synced_block: Option<u64>,
    pub events: BTreeMap<String, u64>,
    pub seconds_since_progress: u64,
    pub stalled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthReport {
    pub status: ReportStatus,
    pub stall_threshold_secs: u64,
    pub last_poll_error: Option<String>,
    pub groups: Vec<GroupReport>,
}

impl HealthReport {
    pub fn is_healthy(&self) -> bool {
        self.status == ReportStatus::Healthy
    }

    pub fn stalled_groups(&self) -> Vec<String> {
        self.groups
            .iter()
            .filter(|group| group.stalled)
            .map(|group| format!("{}@{}", group.contract, group.network))
            .collect()
    }
}

/// Shared handle used by the poller, the `/health` endpoint and the uptime heartbeat.
#[derive(Clone)]
pub struct IndexingHealth {
    tracker: Arc<Mutex<ProgressTracker>>,
    streams: Arc<Vec<ProgressStream>>,
    config: IndexingHealthConfig,
}

impl IndexingHealth {
    pub fn new(streams: Vec<ProgressStream>, config: IndexingHealthConfig) -> Self {
        let tracker = ProgressTracker::new(
            streams.iter().map(|stream| stream.group.clone()),
            Instant::now(),
        );
        Self {
            tracker: Arc::new(Mutex::new(tracker)),
            streams: Arc::new(streams),
            config,
        }
    }

    pub fn report(&self) -> HealthReport {
        self.tracker
            .lock()
            .expect("progress tracker lock poisoned")
            .report(Instant::now(), self.config.stall_threshold)
    }

    /// Poll checkpoints forever. Evaluation happens at read time, so a hung or
    /// failing poll turns into a stall instead of freezing the last healthy state.
    pub async fn run_progress_monitor(&self) -> Result<()> {
        info!(
            streams = self.streams.len(),
            stall_threshold_secs = self.config.stall_threshold.as_secs(),
            poll_interval_secs = self.config.poll_interval.as_secs(),
            "Starting indexing progress monitor"
        );
        let mut interval = tokio::time::interval(self.config.poll_interval);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            interval.tick().await;
            self.poll_once().await;
        }
    }

    async fn poll_once(&self) {
        let mut errors = Vec::new();
        for stream in self.streams.iter() {
            let result =
                tokio::time::timeout(self.config.poll_interval, fetch_last_synced_block(stream))
                    .await
                    .unwrap_or_else(|_| Err(anyhow::anyhow!("checkpoint query timed out")));
            match result {
                Ok(Some(block)) => {
                    self.tracker
                        .lock()
                        .expect("progress tracker lock poisoned")
                        .record(&stream.group, &stream.event, block, Instant::now());
                }
                Ok(None) => errors.push(format!(
                    "{}: no row for network {}",
                    stream.table, stream.group.network
                )),
                Err(error) => errors.push(format!("{}: {error:#}", stream.table)),
            }
        }

        if !errors.is_empty() {
            warn!(errors = ?errors, "Failed to read some indexing checkpoints");
        }
        let report = {
            let mut tracker = self.tracker.lock().expect("progress tracker lock poisoned");
            tracker.set_poll_error((!errors.is_empty()).then(|| errors.join("; ")));
            tracker.report(Instant::now(), self.config.stall_threshold)
        };
        if report.is_healthy() {
            debug!("Indexing progress healthy");
        } else {
            warn!(
                stalled = ?report.stalled_groups(),
                stall_threshold_secs = report.stall_threshold_secs,
                "Indexing is stalled"
            );
        }
    }

    pub async fn serve(self) -> Result<()> {
        let port = self.config.port;
        let app = Router::new()
            .route("/health", get(health_handler))
            .with_state(self);
        let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
            .await
            .with_context(|| format!("Failed to bind health server on port {port}"))?;
        info!(port, "Starting indexing health server");
        axum::serve(listener, app)
            .await
            .context("Health server failed")
    }
}

async fn health_handler(State(health): State<IndexingHealth>) -> (StatusCode, Json<HealthReport>) {
    let report = health.report();
    let status = if report.is_healthy() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(report))
}

async fn fetch_last_synced_block(stream: &ProgressStream) -> Result<Option<u64>> {
    let db = DB.get().context("DB not initialized")?;
    // Table names are derived from the manifest (snake_case identifiers), never from input.
    let sql = format!(
        "SELECT last_synced_block::BIGINT AS block FROM rindexer_internal.{} WHERE network = $1",
        stream.table
    );
    let row = db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            sql,
            [stream.group.network.clone().into()],
        ))
        .await?;
    row.map(|row| {
        row.try_get::<i64>("", "block")
            .map(|block| block.max(0) as u64)
            .context("Failed to read last_synced_block")
    })
    .transpose()
}

/// Tracks heartbeat state so stall transitions are logged once, not every ping.
#[derive(Debug, Default)]
pub struct HeartbeatGate {
    withheld: bool,
}

impl HeartbeatGate {
    /// Returns whether the uptime ping should be sent for this report.
    pub fn should_ping(&mut self, report: &HealthReport) -> bool {
        let healthy = report.is_healthy();
        if healthy && self.withheld {
            info!("Indexing progressing again; resuming uptime pings");
        } else if !healthy && !self.withheld {
            warn!(
                stalled = ?report.stalled_groups(),
                last_poll_error = ?report.last_poll_error,
                "Indexing stalled; withholding uptime pings"
            );
        }
        self.withheld = !healthy;
        healthy
    }
}

/// Group streams by group for logging at startup.
pub fn describe_streams(streams: &[ProgressStream]) -> HashMap<String, Vec<String>> {
    let mut by_group: HashMap<String, Vec<String>> = HashMap::new();
    for stream in streams {
        by_group
            .entry(format!(
                "{}@{}",
                stream.group.contract, stream.group.network
            ))
            .or_default()
            .push(stream.table.clone());
    }
    by_group
}

#[cfg(test)]
mod tests {
    use super::*;

    const THRESHOLD: Duration = Duration::from_secs(1800);

    fn group(contract: &str, network: &str) -> StreamGroup {
        StreamGroup {
            contract: contract.to_string(),
            network: network.to_string(),
        }
    }

    #[test]
    fn config_uses_defaults_and_rejects_invalid_values() {
        let defaults = IndexingHealthConfig::from_values(None, None, None);
        assert_eq!(defaults.stall_threshold, Duration::from_secs(1800));
        assert_eq!(defaults.poll_interval, Duration::from_secs(60));
        assert_eq!(defaults.port, 3000);

        let invalid = IndexingHealthConfig::from_values(Some("0"), Some("x"), Some("-1"));
        assert_eq!(invalid, defaults);

        let custom = IndexingHealthConfig::from_values(Some("600"), Some("30"), Some("3100"));
        assert_eq!(custom.stall_threshold, Duration::from_secs(600));
        assert_eq!(custom.poll_interval, Duration::from_secs(30));
        assert_eq!(custom.port, 3100);
    }

    #[test]
    fn camel_to_snake_matches_rindexer() {
        // Vectors from rindexer's own helpers tests.
        assert_eq!(camel_to_snake("CamelCase"), "camel_case");
        assert_eq!(camel_to_snake("Camel-Case"), "camel_case");
        assert_eq!(camel_to_snake("camelCase"), "camel_case");
        assert_eq!(camel_to_snake("collectNFTId"), "collect_nft_id");
        assert_eq!(camel_to_snake("ERC20"), "erc_20");
        assert_eq!(camel_to_snake("arg1"), "arg_1");
        assert_eq!(camel_to_snake("sqrtPriceX96"), "sqrt_price_x96");
    }

    #[test]
    fn internal_table_names_for_configured_contracts() {
        assert_eq!(
            internal_event_table_name("rindexer", "ARBToken", "DelegateVotesChanged"),
            "rindexer_arb_token_delegate_votes_changed"
        );
        assert_eq!(
            internal_event_table_name("rindexer", "ArbitrumSCNominations", "ProposalCreated"),
            "rindexer_arbitrum_sc_nominations_proposal_created"
        );
        assert_eq!(
            internal_event_table_name("rindexer", "UNIToken", "DelegateChanged"),
            "rindexer_uni_token_delegate_changed"
        );
        let long = internal_event_table_name(
            "rindexer",
            "SomeVeryLongContractNameForTesting",
            "AnotherVeryLongEventName",
        );
        assert_eq!(long.len(), 63);
    }

    #[test]
    fn streams_cover_every_configured_contract_event() {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR")).join("rindexer.yaml");
        let streams = progress_streams_from_manifest(&manifest).expect("manifest parses");
        // Arbitrum: ARBToken 2 + core 4 + treasury 4 + SC nominations 2; Ethereum: UNIToken 2 + UniGovernor 3.
        assert_eq!(streams.len(), 17);
        assert!(streams.iter().any(|stream| {
            stream.group == group("ArbitrumCoreGovernor", "arbitrum")
                && stream.event == "VoteCast"
                && stream.table == "rindexer_arbitrum_core_governor_vote_cast"
        }));
        assert!(streams.iter().any(|stream| {
            stream.group == group("UniGovernor", "ethereum")
                && stream.table == "rindexer_uni_governor_proposal_created"
        }));
        assert!(streams.iter().all(|stream| stream.table.len() <= 63));
    }

    #[test]
    fn startup_grace_then_stall_without_progress() {
        let start = Instant::now();
        let eth = group("UniGovernor", "ethereum");
        let mut tracker = ProgressTracker::new([eth.clone()], start);

        // First observation is only a baseline.
        tracker.record(&eth, "VoteCast", 100, start + Duration::from_secs(60));
        assert!(tracker.report(start + THRESHOLD, THRESHOLD).is_healthy());

        tracker.record(&eth, "VoteCast", 100, start + THRESHOLD);
        let report = tracker.report(start + THRESHOLD + Duration::from_secs(1), THRESHOLD);
        assert!(!report.is_healthy());
        assert_eq!(report.stalled_groups(), vec!["UniGovernor@ethereum"]);

        // Progress resumes: healthy again.
        let later = start + THRESHOLD + Duration::from_secs(120);
        tracker.record(&eth, "VoteCast", 150, later);
        assert!(tracker.report(later, THRESHOLD).is_healthy());
    }

    #[test]
    fn catch_up_with_waiting_dependency_levels_is_progress() {
        let start = Instant::now();
        let core = group("ArbitrumCoreGovernor", "arbitrum");
        let mut tracker = ProgressTracker::new([core.clone()], start);
        tracker.record(&core, "ProposalCreated", 400_000_000, start);
        tracker.record(&core, "VoteCast", 300_000_000, start);

        // Only the running level advances; the waiting level sits still for hours.
        for step in 1..=20u64 {
            let now = start + Duration::from_secs(step * 15 * 60);
            tracker.record(&core, "ProposalCreated", 400_000_000 + step * 50_000, now);
            tracker.record(&core, "VoteCast", 300_000_000, now);
            assert!(tracker.report(now, THRESHOLD).is_healthy(), "step {step}");
        }
    }

    #[test]
    fn one_stalled_network_makes_the_whole_report_unhealthy() {
        let start = Instant::now();
        let eth = group("UniGovernor", "ethereum");
        let arb = group("ARBToken", "arbitrum");
        let mut tracker = ProgressTracker::new([eth.clone(), arb.clone()], start);
        tracker.record(&eth, "VoteCast", 20_000_000, start);
        tracker.record(&arb, "DelegateChanged", 1, start);

        let now = start + THRESHOLD + Duration::from_secs(60);
        tracker.record(&eth, "VoteCast", 20_000_000, now);
        tracker.record(&arb, "DelegateChanged", 2, now);
        let report = tracker.report(now, THRESHOLD);
        assert!(!report.is_healthy());
        assert_eq!(report.stalled_groups(), vec!["UniGovernor@ethereum"]);
    }

    #[test]
    fn lower_block_is_not_progress_and_unknown_groups_are_ignored() {
        let start = Instant::now();
        let eth = group("UNIToken", "ethereum");
        let mut tracker = ProgressTracker::new([eth.clone()], start);
        tracker.record(&eth, "DelegateChanged", 100, start);
        tracker.record(&eth, "DelegateChanged", 90, start + THRESHOLD);
        tracker.record(&group("Unknown", "ethereum"), "X", 1_000, start + THRESHOLD);
        assert!(
            !tracker
                .report(start + THRESHOLD + Duration::from_secs(1), THRESHOLD)
                .is_healthy()
        );
    }

    #[test]
    fn no_monitored_groups_is_unhealthy() {
        let tracker = ProgressTracker::new(Vec::new(), Instant::now());
        assert!(!tracker.report(Instant::now(), THRESHOLD).is_healthy());
    }

    #[test]
    fn heartbeat_gate_withholds_pings_while_stalled() {
        let start = Instant::now();
        let eth = group("UniGovernor", "ethereum");
        let mut tracker = ProgressTracker::new([eth.clone()], start);
        let mut gate = HeartbeatGate::default();

        assert!(gate.should_ping(&tracker.report(start, THRESHOLD)));
        let stalled_at = start + THRESHOLD + Duration::from_secs(1);
        assert!(!gate.should_ping(&tracker.report(stalled_at, THRESHOLD)));
        assert!(!gate.should_ping(&tracker.report(stalled_at, THRESHOLD)));

        tracker.record(&eth, "VoteCast", 1, stalled_at);
        tracker.record(&eth, "VoteCast", 2, stalled_at);
        assert!(gate.should_ping(&tracker.report(stalled_at, THRESHOLD)));
    }
}
