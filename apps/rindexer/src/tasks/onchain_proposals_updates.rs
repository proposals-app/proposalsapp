use crate::rindexer_lib::indexers::rindexer::{
    arbitrum_core_governor, arbitrum_sc_nominations, arbitrum_treasury_governor, uni_governor,
};
use anyhow::Result;
use std::future::Future;
use tokio::time;
use tracing::{error, info, instrument, warn};

#[instrument(name = "run_periodic_proposal_state_update", skip_all)]
pub async fn run_periodic_proposal_state_update() -> Result<()> {
    info!("Starting periodic task for proposal state updates.");
    let mut interval = time::interval(time::Duration::from_secs(60));

    loop {
        interval.tick().await;

        // Each step is independent: one failing (e.g. an Ethereum RPC outage breaking the
        // Uniswap backfill) must not stop the remaining Arbitrum updates.
        let results = [
            run_step(
                "uni_governor::backfill_missing_proposals_and_votes",
                uni_governor::backfill_missing_proposals_and_votes(),
            )
            .await,
            run_step(
                "arbitrum_core_governor::update_active_proposals_end_time",
                arbitrum_core_governor::update_active_proposals_end_time(),
            )
            .await,
            run_step(
                "arbitrum_treasury_governor::update_active_proposals_end_time",
                arbitrum_treasury_governor::update_active_proposals_end_time(),
            )
            .await,
            run_step(
                "uni_governor::update_active_proposals_end_time",
                uni_governor::update_active_proposals_end_time(),
            )
            .await,
            run_step(
                "arbitrum_core_governor::update_ended_proposals_state",
                arbitrum_core_governor::update_ended_proposals_state(),
            )
            .await,
            run_step(
                "arbitrum_treasury_governor::update_ended_proposals_state",
                arbitrum_treasury_governor::update_ended_proposals_state(),
            )
            .await,
            run_step(
                "uni_governor::update_ended_proposals_state",
                uni_governor::update_ended_proposals_state(),
            )
            .await,
            run_step(
                "arbitrum_sc_nominations::update_ended_proposals_state",
                arbitrum_sc_nominations::update_ended_proposals_state(),
            )
            .await,
            run_step(
                "arbitrum_core_governor::update_active_proposals_quorum",
                arbitrum_core_governor::update_active_proposals_quorum(),
            )
            .await,
            run_step(
                "arbitrum_treasury_governor::update_active_proposals_quorum",
                arbitrum_treasury_governor::update_active_proposals_quorum(),
            )
            .await,
        ];

        let failed_steps = results.iter().filter(|succeeded| !**succeeded).count();
        if failed_steps == 0 {
            info!("Successfully updated proposals states");
        } else {
            warn!(
                failed_steps,
                total_steps = results.len(),
                "Proposal state update cycle finished with failed steps"
            );
        }
    }
}

/// Run one update step, logging its error instead of propagating it.
/// Returns whether the step succeeded.
async fn run_step(step: &str, future: impl Future<Output = Result<()>>) -> bool {
    match future.await {
        Ok(()) => true,
        Err(err) => {
            error!(step, error = ?err, "Proposal state update step failed");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::run_step;
    use anyhow::anyhow;

    #[tokio::test]
    async fn failing_step_is_reported_without_propagating() {
        assert!(run_step("ok", async { Ok(()) }).await);
        assert!(!run_step("failing", async { Err(anyhow!("rpc unavailable")) }).await);
    }
}
