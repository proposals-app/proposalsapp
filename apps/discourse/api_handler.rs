use anyhow::{anyhow, Result};
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use rand::{Rng, SeedableRng};
use reqwest::header::USER_AGENT;
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Semaphore};
use tokio::time::sleep;
use tracing::{info, warn};

#[derive(Clone)]
pub struct ApiHandler {
    client: Client,
    max_retries: usize,
    semaphore: Arc<Semaphore>,
    sender: mpsc::Sender<Job>,
    jobs_in_queue: Arc<AtomicUsize>,
}

struct Job {
    url: String,
    response_sender: oneshot::Sender<Result<String>>,
}

impl ApiHandler {
    pub fn new(max_retries: usize) -> Self {
        let client = Client::new();
        let semaphore = Arc::new(Semaphore::new(5));
        let (sender, receiver) = mpsc::channel(100);
        let jobs_in_queue = Arc::new(AtomicUsize::new(0));

        let api_handler = Self {
            client,
            max_retries,
            semaphore: semaphore.clone(),
            sender,
            jobs_in_queue,
        };

        tokio::spawn(api_handler.clone().run_queue(receiver));

        api_handler
    }

    pub async fn fetch<T>(&self, url: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let (response_sender, response_receiver) = oneshot::channel();
        let job = Job {
            url: url.to_string(),
            response_sender,
        };

        self.sender
            .send(job)
            .await
            .map_err(|e| anyhow!("Failed to send job: {}", e))?;

        self.jobs_in_queue.fetch_add(1, Ordering::SeqCst);

        let jobs_in_queue = self.jobs_in_queue.load(Ordering::SeqCst);
        let available_permits = self.semaphore.available_permits();

        info!(
            "Job queue status: {} jobs in queue, {} available permits",
            jobs_in_queue, available_permits
        );

        let response = response_receiver
            .await
            .map_err(|e| anyhow!("Failed to receive response: {}", e))??;
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))
    }

    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            let permit = self.semaphore.clone().acquire_owned().await.unwrap();
            let client = self.client.clone();
            let max_retries = self.max_retries;
            let jobs_in_queue = self.jobs_in_queue.clone();

            tokio::spawn(async move {
                let mut rng = StdRng::from_entropy();
                let result = Self::execute_request(&client, &job.url, max_retries, &mut rng).await;
                let _ = job.response_sender.send(result);
                jobs_in_queue.fetch_sub(1, Ordering::SeqCst);
                drop(permit);
            });
        }
    }

    async fn execute_request(
        client: &Client,
        url: &str,
        max_retries: usize,
        rng: &mut StdRng,
    ) -> Result<String> {
        let mut attempt = 0;
        let mut delay = Duration::from_secs(2);

        loop {
            sleep(Duration::from_millis(rng.gen_range(500..1500))).await;

            match client
                .get(url)
                .header(USER_AGENT, get_random_user_agent(rng))
                .header("Referer", "https://proposals.app")
                .send()
                .await
            {
                Ok(response) => {
                    if response.status().is_success() {
                        return response
                            .text()
                            .await
                            .map_err(|e| anyhow!("Failed to get response text: {}", e));
                    } else if response.status().is_server_error()
                        || response.status().as_u16() == 429
                    {
                        attempt += 1;
                        if attempt > max_retries {
                            return Err(anyhow!(
                                "Max retries reached. Last error: HTTP {}",
                                response.status()
                            ));
                        }

                        let retry_after = response
                            .headers()
                            .get("Retry-After")
                            .and_then(|h| h.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs)
                            .unwrap_or(delay);

                        warn!(
                            "Rate limited or server error {}. Waiting for {:?} before retrying...",
                            response.status(),
                            retry_after
                        );
                        sleep(retry_after).await;
                        delay = delay.max(retry_after) * 2;
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();
                        return Err(anyhow!("Request failed with status {}: {}", status, body));
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > max_retries {
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!("Request error: {}. Retrying in {:?}...", e, delay);
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }
}

fn get_random_user_agent(rng: &mut StdRng) -> &'static str {
    const USER_AGENTS: &[&str] = &[
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.277",
    ];

    USER_AGENTS.choose(rng).unwrap_or(&"")
}
