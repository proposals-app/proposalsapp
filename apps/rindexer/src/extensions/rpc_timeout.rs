use anyhow::{Result, anyhow};
use std::{future::IntoFuture, sync::OnceLock, time::Duration};

const DEFAULT_RPC_CALL_TIMEOUT_SECS: u64 = 30;

/// Upper bound for a single RPC call made from custom handlers and tasks.
///
/// rindexer's providers retry rate-limited calls with `RetryBackoffLayer` for up
/// to 5000 attempts, so a single call against a throttled endpoint can block for
/// hours. Bounding each call keeps one stuck request from hanging a task.
pub fn rpc_call_timeout() -> Duration {
    static TIMEOUT: OnceLock<Duration> = OnceLock::new();
    *TIMEOUT.get_or_init(|| {
        Duration::from_secs(parse_timeout_secs(
            std::env::var("RPC_CALL_TIMEOUT_SECS").ok().as_deref(),
        ))
    })
}

fn parse_timeout_secs(value: Option<&str>) -> u64 {
    value
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|secs| *secs > 0)
        .unwrap_or(DEFAULT_RPC_CALL_TIMEOUT_SECS)
}

/// Await an RPC call, failing with an error if it exceeds [`rpc_call_timeout`].
pub async fn with_rpc_timeout<F, T, E>(operation: &str, call: F) -> Result<T>
where
    F: IntoFuture<Output = std::result::Result<T, E>>,
    E: Into<anyhow::Error>,
{
    with_timeout(operation, rpc_call_timeout(), call).await
}

async fn with_timeout<F, T, E>(operation: &str, timeout: Duration, call: F) -> Result<T>
where
    F: IntoFuture<Output = std::result::Result<T, E>>,
    E: Into<anyhow::Error>,
{
    match tokio::time::timeout(timeout, call).await {
        Ok(result) => result.map_err(Into::into),
        Err(_) => Err(anyhow!(
            "{operation} timed out after {}s",
            timeout.as_secs_f64()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_env_parsing_falls_back_to_default() {
        assert_eq!(parse_timeout_secs(None), DEFAULT_RPC_CALL_TIMEOUT_SECS);
        assert_eq!(parse_timeout_secs(Some("")), DEFAULT_RPC_CALL_TIMEOUT_SECS);
        assert_eq!(parse_timeout_secs(Some("0")), DEFAULT_RPC_CALL_TIMEOUT_SECS);
        assert_eq!(
            parse_timeout_secs(Some("abc")),
            DEFAULT_RPC_CALL_TIMEOUT_SECS
        );
        assert_eq!(parse_timeout_secs(Some(" 12 ")), 12);
    }

    #[tokio::test]
    async fn stuck_call_times_out() {
        let result: Result<()> = with_timeout(
            "eth_blockNumber",
            Duration::from_millis(10),
            std::future::pending::<std::result::Result<(), anyhow::Error>>(),
        )
        .await;
        let error = result.expect_err("pending call must time out").to_string();
        assert!(error.contains("eth_blockNumber timed out"), "{error}");
    }

    #[tokio::test]
    async fn completed_call_passes_through_result_and_error() {
        let ok: Result<u64> = with_timeout("ok", Duration::from_secs(1), async {
            Ok::<_, std::io::Error>(7)
        })
        .await;
        assert_eq!(ok.unwrap(), 7);

        let err: Result<u64> = with_timeout("err", Duration::from_secs(1), async {
            Err::<u64, _>(std::io::Error::other("boom"))
        })
        .await;
        assert_eq!(err.unwrap_err().to_string(), "boom");
    }
}
