use anyhow::Result;
use async_trait::async_trait;
use seaorm::{dao, dao_indexer, proposal, vote};

#[async_trait]
pub trait Indexer: Send + Sync {
    async fn process(
        &self,
        indexer: &dao_indexer::Model,
        dao: &dao::Model,
    ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)>;

    fn min_refresh_speed(&self) -> i32;
    fn max_refresh_speed(&self) -> i32;

    fn adjust_speed(&self, current_speed: i32, success: bool) -> i32 {
        if success {
            std::cmp::min(current_speed * 5 / 4, self.max_refresh_speed())
        } else {
            std::cmp::max(current_speed * 3 / 4, self.min_refresh_speed())
        }
    }
}
