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
            // Increase by 10%, but at least by 1
            let increase = std::cmp::max((current_speed as f32 * 0.1).round() as i32, 1);
            let new_speed = current_speed + increase;
            std::cmp::min(new_speed, self.max_refresh_speed())
        } else {
            // Decrease by 50%
            let new_speed = current_speed / 2;
            std::cmp::max(new_speed, self.min_refresh_speed())
        }
    }
}

#[cfg(test)]
mod indexer_tests {
    use super::*;
    use std::sync::Arc;

    struct MockIndexer;

    #[async_trait]
    impl Indexer for MockIndexer {
        async fn process(
            &self,
            _indexer: &dao_indexer::Model,
            _dao: &dao::Model,
        ) -> Result<(Vec<proposal::ActiveModel>, Vec<vote::ActiveModel>, i32)> {
            unimplemented!()
        }

        fn min_refresh_speed(&self) -> i32 {
            10
        }

        fn max_refresh_speed(&self) -> i32 {
            100
        }
    }

    #[test]
    fn test_adjust_speed_success() {
        let indexer = Arc::new(MockIndexer);

        assert_eq!(indexer.adjust_speed(50, true), 55);
        assert_eq!(indexer.adjust_speed(90, true), 99);
        assert_eq!(indexer.adjust_speed(95, true), 100);
        assert_eq!(indexer.adjust_speed(100, true), 100);
    }

    #[test]
    fn test_adjust_speed_failure() {
        let indexer = Arc::new(MockIndexer);

        assert_eq!(indexer.adjust_speed(50, false), 25);
        assert_eq!(indexer.adjust_speed(30, false), 15);
        assert_eq!(indexer.adjust_speed(15, false), 10);
        assert_eq!(indexer.adjust_speed(10, false), 10);
    }

    #[test]
    fn test_adjust_speed_min_increase() {
        let indexer = Arc::new(MockIndexer);

        assert_eq!(indexer.adjust_speed(11, true), 12);
        assert_eq!(indexer.adjust_speed(10, true), 11);
    }

    #[test]
    fn test_adjust_speed_bounds() {
        let indexer = Arc::new(MockIndexer);

        // Test lower bound
        assert_eq!(indexer.adjust_speed(5, false), 10);

        // Test upper bound
        assert_eq!(indexer.adjust_speed(110, true), 100);
    }
}
