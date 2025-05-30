use crate::rindexer_lib::indexers::rindexer::{arbitrum_core_governor, arbitrum_treasury_governor};
use anyhow::{Context, Result};
use tokio::time;
use tracing::{info, instrument};

#[instrument(name = "run_periodic_proposal_state_update", skip_all)]
pub async fn run_periodic_proposal_state_update() -> Result<()> {
    info!("Starting periodic task for proposal state updates.");
    let mut interval = time::interval(time::Duration::from_secs(60));

    loop {
        interval.tick().await;

        arbitrum_core_governor::update_active_proposals_end_time()
            .await
            .context("Failed to update active proposals end time for arbitrum_core_governor")?;
        arbitrum_treasury_governor::update_active_proposals_end_time()
            .await
            .context("Failed to update active proposals end time for arbitrum_treasury_governor")?;

        arbitrum_core_governor::update_ended_proposals_state()
            .await
            .context("Failed to update ended proposals state for arbitrum_core_governor")?;
        arbitrum_treasury_governor::update_ended_proposals_state()
            .await
            .context("Failed to update ended proposals state for arbitrum_treasury_governor")?;

        info!("Successfully updated proposals states");
    }
}
