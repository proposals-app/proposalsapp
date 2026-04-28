use anyhow::{Result, anyhow};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::sync::oneshot;

use proposalsapp_rindexer::supervision::run_task_forever;

#[tokio::test]
async fn restarts_a_task_after_an_error() -> Result<()> {
    let attempts = Arc::new(AtomicUsize::new(0));
    let (tx, rx) = oneshot::channel::<()>();
    let signal = Arc::new(Mutex::new(Some(tx)));

    let task = {
        let attempts = Arc::clone(&attempts);
        let signal = Arc::clone(&signal);

        tokio::spawn(async move {
            run_task_forever("test", Duration::from_millis(1), move || {
                let attempts = Arc::clone(&attempts);
                let signal = Arc::clone(&signal);

                async move {
                    let attempt = attempts.fetch_add(1, Ordering::SeqCst) + 1;
                    if attempt >= 2
                        && let Some(sender) = signal.lock().expect("signal mutex poisoned").take()
                    {
                        let _ = sender.send(());
                    }

                    if attempt == 1 {
                        Err(anyhow!("boom"))
                    } else {
                        Ok(())
                    }
                }
            })
            .await;
        })
    };

    tokio::time::timeout(Duration::from_secs(1), rx).await??;
    task.abort();

    assert!(attempts.load(Ordering::SeqCst) >= 2);
    Ok(())
}

#[tokio::test]
async fn restarts_a_task_after_unexpected_completion() -> Result<()> {
    let attempts = Arc::new(AtomicUsize::new(0));
    let (tx, rx) = oneshot::channel::<()>();
    let signal = Arc::new(Mutex::new(Some(tx)));

    let task = {
        let attempts = Arc::clone(&attempts);
        let signal = Arc::clone(&signal);

        tokio::spawn(async move {
            run_task_forever("test", Duration::from_millis(1), move || {
                let attempts = Arc::clone(&attempts);
                let signal = Arc::clone(&signal);

                async move {
                    let attempt = attempts.fetch_add(1, Ordering::SeqCst) + 1;
                    if attempt >= 2
                        && let Some(sender) = signal.lock().expect("signal mutex poisoned").take()
                    {
                        let _ = sender.send(());
                    }

                    Ok(())
                }
            })
            .await;
        })
    };

    tokio::time::timeout(Duration::from_secs(1), rx).await??;
    task.abort();

    assert!(attempts.load(Ordering::SeqCst) >= 2);
    Ok(())
}
