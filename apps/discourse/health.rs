use chrono::{DateTime, Utc};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    sync::{Arc, RwLock},
};

#[derive(Clone, Default)]
pub struct HealthRegistry {
    tasks: Arc<RwLock<BTreeMap<String, TaskHealth>>>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskHealth {
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Starting,
    Healthy,
    Degraded,
}

#[derive(Debug, Serialize)]
pub struct HealthSnapshot {
    pub status: HealthStatus,
    pub tasks: BTreeMap<String, TaskHealth>,
}

impl HealthRegistry {
    pub fn register(&self, task_name: impl Into<String>) {
        self.tasks
            .write()
            .expect("health registry lock poisoned")
            .entry(task_name.into())
            .or_default();
    }

    pub fn record_success(&self, task_name: &str, completed_at: DateTime<Utc>) {
        let mut tasks = self.tasks.write().expect("health registry lock poisoned");
        let task = tasks.entry(task_name.to_owned()).or_default();
        task.last_attempt_at = Some(completed_at);
        task.last_success_at = Some(completed_at);
        task.last_error = None;
    }

    pub fn record_failure(
        &self,
        task_name: &str,
        completed_at: DateTime<Utc>,
        error: impl Into<String>,
    ) {
        let mut tasks = self.tasks.write().expect("health registry lock poisoned");
        let task = tasks.entry(task_name.to_owned()).or_default();
        task.last_attempt_at = Some(completed_at);
        task.last_error = Some(error.into());
    }

    pub fn snapshot(&self) -> HealthSnapshot {
        let tasks = self
            .tasks
            .read()
            .expect("health registry lock poisoned")
            .clone();
        let status = if tasks.is_empty() {
            HealthStatus::Degraded
        } else if tasks.values().any(|task| task.last_attempt_at.is_none()) {
            HealthStatus::Starting
        } else if tasks.values().any(|task| task.last_error.is_some()) {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        };

        HealthSnapshot { status, tasks }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_starting_failure_and_recovery() {
        let registry = HealthRegistry::default();
        let now = Utc::now();
        registry.register("recent_arbitrum");
        assert_eq!(registry.snapshot().status, HealthStatus::Starting);

        registry.record_failure("recent_arbitrum", now, "database unavailable");
        assert_eq!(registry.snapshot().status, HealthStatus::Degraded);

        registry.record_success("recent_arbitrum", now);
        assert_eq!(registry.snapshot().status, HealthStatus::Healthy);
    }

    #[test]
    fn reports_degraded_when_no_indexers_are_configured() {
        assert_eq!(
            HealthRegistry::default().snapshot().status,
            HealthStatus::Degraded
        );
    }
}
