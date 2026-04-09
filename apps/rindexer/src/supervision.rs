use anyhow::Result;
use std::{future::Future, time::Duration};
use tracing::{error, warn};

pub async fn run_task_forever<Task, Fut>(
    task_name: &str,
    retry_delay: Duration,
    mut task: Task,
) -> !
where
    Task: FnMut() -> Fut,
    Fut: Future<Output = Result<()>>,
{
    loop {
        match task().await {
            Ok(()) => warn!(task = task_name, "Task completed unexpectedly, restarting"),
            Err(err) => error!(task = task_name, error = ?err, "Task failed, restarting"),
        }

        tokio::time::sleep(retry_delay).await;
    }
}
