use crate::metrics::METRICS;
use anyhow::{anyhow, Result};
use opentelemetry::KeyValue;
use rand::{seq::SliceRandom, thread_rng};
use regex::Regex;
use reqwest::{
    cookie::Jar,
    header::{HeaderMap, HeaderValue, RETRY_AFTER, USER_AGENT},
    Client, StatusCode,
};
use serde::de::DeserializeOwned;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::{
    sync::{mpsc, oneshot},
    time::sleep,
};
use tracing::{error, info, instrument, warn};

const DEFAULT_QUEUE_SIZE: usize = 100_000;
const DEFAULT_MAX_RETRIES: usize = 5;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(2);
const NORMAL_JOBS_BATCH_SIZE: usize = 10;

const USER_AGENTS: [&str; 5] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) \
     Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/91.0.4472.120 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like \
     Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
];

#[derive(Clone)]
pub struct DiscourseApi {
    client: Client,
    max_retries: usize,
    sender: mpsc::Sender<Job>,
    pub base_url: String,
    forbidden_urls: Arc<Mutex<HashSet<(String, u64)>>>,
    pending_requests: Arc<Mutex<HashMap<String, PendingRequest>>>,
    priority_queue: Arc<Mutex<VecDeque<Job>>>,
    normal_queue: Arc<Mutex<VecDeque<Job>>>,
}

struct PendingRequest {
    response_senders: Vec<oneshot::Sender<Result<Arc<String>>>>,
    priority: bool,
}

struct Job {
    url: String,
    priority: bool,
    response_sender: String,
}

impl DiscourseApi {
    #[instrument]
    pub fn new(base_url: String, with_user_agent: bool) -> Self {
        let (headers, cookie_jar) = Self::default_headers_with_cookies(with_user_agent);

        let client = Client::builder()
            .default_headers(headers)
            .cookie_provider(cookie_jar)
            .build()
            .expect("Failed to build HTTP client");

        let (sender, receiver) = mpsc::channel(DEFAULT_QUEUE_SIZE);
        let priority_queue = Arc::new(Mutex::new(VecDeque::with_capacity(DEFAULT_QUEUE_SIZE)));
        let normal_queue = Arc::new(Mutex::new(VecDeque::with_capacity(DEFAULT_QUEUE_SIZE)));

        let api_handler = Self {
            client,
            max_retries: DEFAULT_MAX_RETRIES,
            sender,
            base_url: base_url.clone(),
            forbidden_urls: Arc::new(Mutex::new(HashSet::new())),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            priority_queue: priority_queue.clone(),
            normal_queue: normal_queue.clone(),
        };

        // Spawn the queue runner
        tokio::spawn(api_handler.clone().run_queue(receiver));

        // Spawn the cache-clearing task
        tokio::spawn(clear_forbidden_urls_cache(
            api_handler.forbidden_urls.clone(),
        ));

        api_handler
    }

    #[instrument]
    fn get_random_user_agent() -> &'static str {
        let mut rng = thread_rng();
        USER_AGENTS.choose(&mut rng).unwrap_or(&USER_AGENTS[0])
    }

    #[instrument]
    fn default_headers_with_cookies(with_user_agent: bool) -> (HeaderMap, Arc<Jar>) {
        let mut headers = HeaderMap::new();
        let cookie_jar = Arc::new(Jar::default());

        if with_user_agent {
            headers.insert(
                USER_AGENT,
                HeaderValue::from_static(Self::get_random_user_agent()),
            );
        } else {
            headers.insert(
                USER_AGENT,
                HeaderValue::from_static(
                    "proposals.app Discourse Indexer/1.0 (https://proposals.app; \
                     contact@proposals.app) reqwest/0.12",
                ),
            );
        }

        headers.insert("Referer", HeaderValue::from_static("https://proposals.app"));
        headers.insert(
            "Accept",
            HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"),
        );
        headers.insert(
            "Accept-Language",
            HeaderValue::from_static("en-US,en;q=0.5"),
        );
        headers.insert("Connection", HeaderValue::from_static("keep-alive"));
        headers.insert("Upgrade-Insecure-Requests", HeaderValue::from_static("1"));

        (headers, cookie_jar)
    }

    #[instrument(skip(self))]
    pub fn is_priority_queue_empty(&self) -> bool {
        self.priority_queue.lock().unwrap().is_empty()
    }

    #[instrument(skip(self), fields(endpoint = %endpoint, priority = priority))]
    pub async fn queue<T>(&self, endpoint: &str, priority: bool) -> Result<T>
    where
        T: DeserializeOwned,
    {
        info!("Fetching data from endpoint");

        let (response_sender, response_receiver) = oneshot::channel();
        let url = format!("{}{}", self.base_url, endpoint);

        // Check if there's already a pending request for this endpoint
        let should_send_new_request = {
            let mut pending_requests = self.pending_requests.lock().unwrap();

            if let Some(pending_request) = pending_requests.get_mut(endpoint) {
                // If the new request is priority and the existing one isn't, upgrade it
                if priority && !pending_request.priority {
                    pending_request.priority = true;
                }
                // Add this sender to the list of receivers
                pending_request.response_senders.push(response_sender);
                false
            } else {
                // No pending request, create a new one
                pending_requests.insert(
                    endpoint.to_string(),
                    PendingRequest {
                        response_senders: vec![response_sender],
                        priority,
                    },
                );

                true
            }
        };

        if should_send_new_request {
            if priority {
                METRICS
                    .get()
                    .unwrap()
                    .queue_size_priority
                    .add(1, &[KeyValue::new("url", url.clone())]);
            } else {
                METRICS
                    .get()
                    .unwrap()
                    .queue_size_normal
                    .add(1, &[KeyValue::new("url", url.clone())]);
            }

            let job = Job {
                url,
                priority,
                response_sender: endpoint.to_string(),
            };

            self.sender
                .send(job)
                .await
                .map_err(|e| anyhow!("Failed to send job: {}", e))?;
        }

        let response = response_receiver
            .await
            .map_err(|e| anyhow!("Failed to receive response: {}", e))??;
        serde_json::from_str(&response).map_err(|e| anyhow!("Failed to parse response: {}", e))
    }

    #[instrument(skip(self, receiver))]
    async fn run_queue(self, mut receiver: mpsc::Receiver<Job>) {
        while let Some(job) = receiver.recv().await {
            if job.priority {
                let mut pq = self.priority_queue.lock().unwrap();
                pq.push_back(job);
            } else {
                let mut nq = self.normal_queue.lock().unwrap();
                nq.push_back(job);
            }

            // Process all priority jobs first
            while let Some(priority_job) = {
                let mut pq = self.priority_queue.lock().unwrap();
                pq.pop_front()
            } {
                self.process_job(&priority_job, true).await;
                METRICS
                    .get()
                    .unwrap()
                    .queue_size_priority
                    .add(-1, &[KeyValue::new("url", priority_job.url)]);
            }

            // Process a batch of normal jobs
            for _ in 0..NORMAL_JOBS_BATCH_SIZE {
                if let Some(normal_job) = {
                    let mut nq = self.normal_queue.lock().unwrap();
                    nq.pop_front()
                } {
                    self.process_job(&normal_job, false).await;
                    METRICS
                        .get()
                        .unwrap()
                        .queue_size_normal
                        .add(-1, &[KeyValue::new("url", normal_job.url)]);
                } else {
                    break;
                }
            }

            // Sleep for a short duration to avoid busy-waiting
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    #[instrument(skip(self, job), fields(url = %job.url, priority = is_priority))]
    async fn process_job(&self, job: &Job, is_priority: bool) {
        let start_time = std::time::Instant::now();

        // Record total requests metric
        METRICS.get().unwrap().api_total_requests.add(
            1,
            &[
                KeyValue::new("url", job.url.clone()),
                KeyValue::new("priority", is_priority.to_string()),
            ],
        );

        let result = self.execute_request(&job.url).await;

        // Record the duration of the request
        let duration = start_time.elapsed().as_secs_f64();
        METRICS.get().unwrap().api_request_duration.record(
            duration,
            &[
                KeyValue::new("url", job.url.clone()),
                KeyValue::new("priority", is_priority.to_string()),
            ],
        );

        // Get all the senders for this endpoint and remove the pending request
        let senders = {
            let mut pending_requests = self.pending_requests.lock().unwrap();
            pending_requests
                .remove(&job.response_sender)
                .expect("Pending request should exist")
                .response_senders
        };

        // Send the result to all waiting receivers
        match result {
            Ok(response_text) => {
                let shared_response = Arc::new(response_text);
                for sender in senders {
                    let _ = sender.send(Ok(shared_response.clone()));
                }
            }
            Err(e) => {
                let error_msg = e.to_string();
                for sender in senders {
                    let _ = sender.send(Err(anyhow!(error_msg.clone())));
                }

                // Record the error
                METRICS.get().unwrap().api_request_errors.add(
                    1,
                    &[
                        KeyValue::new("url", job.url.clone()),
                        KeyValue::new("priority", is_priority.to_string()),
                        KeyValue::new("error", error_msg),
                    ],
                );

                // // Record queue errors
                METRICS
                    .get()
                    .unwrap()
                    .queue_errors
                    .add(1, &[KeyValue::new("url", job.url.clone())]);
            }
        }

        // Record queue processing time
        METRICS.get().unwrap().queue_processing_time.record(
            start_time.elapsed().as_secs_f64(),
            &[KeyValue::new("url", job.url.clone())],
        );
    }

    #[instrument(skip(self), fields(url = %url))]
    async fn execute_request(&self, url: &str) -> Result<String> {
        // Check if the URL is in the forbidden cache
        {
            let mut forbidden_urls = self.forbidden_urls.lock().unwrap();
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            // Clean up expired entries
            forbidden_urls.retain(|(_, timestamp)| now - *timestamp < 3600);

            if forbidden_urls.iter().any(|(u, _)| u == url) {
                return Err(anyhow!("URL is cached forbidden: {}", url));
            }
        }

        let mut attempt = 0;
        let mut delay = DEFAULT_INITIAL_BACKOFF;

        loop {
            match self.client.get(url).send().await {
                Ok(response) => {
                    let status = response.status();
                    match status {
                        StatusCode::OK => {
                            info!(url, "Request successful");
                            return response
                                .text()
                                .await
                                .map_err(|e| anyhow!("Failed to get response text: {}", e));
                        }
                        StatusCode::TOO_MANY_REQUESTS => {
                            attempt += 1;
                            if attempt > self.max_retries {
                                error!(
                                    url,
                                    attempt,
                                    max_retries = self.max_retries,
                                    "Max retries reached. Last error: HTTP 429"
                                );
                                return Err(anyhow!("Max retries reached. Last error: HTTP 429"));
                            }

                            let retry_after = Self::get_retry_after(&response, delay);
                            warn!(url, attempt, retry_after = ?retry_after, "Rate limited, retrying");
                            sleep(retry_after).await;
                            delay = delay.max(retry_after) * 2;

                            // Record retry metrics
                            METRICS.get().unwrap().api_request_errors.add(
                                1,
                                &[
                                    KeyValue::new("url", url.to_string()),
                                    KeyValue::new("status", "429"),
                                    KeyValue::new("attempt", attempt.to_string()),
                                ],
                            );
                        }
                        status if status.is_server_error() => {
                            attempt += 1;
                            if attempt > self.max_retries {
                                error!(url, status = %status, attempt, max_retries = self.max_retries, "Max retries reached. Server error");
                                return Err(anyhow!("Max retries reached. Last error: HTTP {}", status));
                            }

                            warn!(url, status = %status, attempt, delay = ?delay, "Server error, retrying");
                            sleep(delay).await;
                            delay *= 2;

                            // Record retry metrics
                            METRICS.get().unwrap().api_request_errors.add(
                                1,
                                &[
                                    KeyValue::new("url", url.to_string()),
                                    KeyValue::new("status", status.to_string()),
                                    KeyValue::new("attempt", attempt.to_string()),
                                ],
                            );
                        }
                        StatusCode::FORBIDDEN => {
                            let body = response.text().await.unwrap_or_default();

                            // Add the URL to the forbidden cache
                            let now = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_secs();
                            let mut forbidden_urls = self.forbidden_urls.lock().unwrap();
                            forbidden_urls.insert((url.to_string(), now));

                            error!(url, status = %status, body, "Request failed");
                            return Err(anyhow!("Request failed with status {}: {}", status, body));
                        }
                        status if status.is_client_error() => {
                            let body = response.text().await.unwrap_or_default();
                            error!(url, status = %status, body, "Client error, skipping retries");
                            return Err(anyhow!("Client error: HTTP {}: {}", status, body));
                        }
                        status => {
                            let body = response.text().await.unwrap_or_default();
                            error!(url, status = %status, body, "Request failed");
                            return Err(anyhow!("Request failed with status {}: {}", status, body));
                        }
                    }
                }
                Err(e) => {
                    attempt += 1;
                    if attempt > self.max_retries {
                        error!(url, error = ?e, attempt, max_retries = self.max_retries, "Max retries reached");
                        return Err(anyhow!("Max retries reached. Last error: {}", e));
                    }
                    warn!(url, error = ?e, attempt, delay = ?delay, "Request error, retrying");
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff

                    // Record retry metrics
                    METRICS.get().unwrap().api_request_errors.add(
                        1,
                        &[
                            KeyValue::new("url", url.to_string()),
                            KeyValue::new("error", e.to_string()),
                            KeyValue::new("attempt", attempt.to_string()),
                        ],
                    );
                }
            }
        }
    }

    #[instrument]
    fn get_retry_after(response: &reqwest::Response, default: Duration) -> Duration {
        response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or(default)
    }
}

/// Background task to periodically clear the forbidden URLs cache.
async fn clear_forbidden_urls_cache(forbidden_urls: Arc<Mutex<HashSet<(String, u64)>>>) {
    loop {
        tokio::time::sleep(Duration::from_secs(3600)).await; // Clear cache every hour
        let mut forbidden_urls = forbidden_urls.lock().unwrap();
        forbidden_urls.clear();
    }
}

#[instrument(skip(discourse_api))]
pub async fn process_upload_urls(raw_content: &str, discourse_api: Arc<DiscourseApi>) -> Result<String> {
    let re_upload = Regex::new(r"upload:\/\/([a-zA-Z0-9\-_]+)(?:\.([a-zA-Z0-9]+))?").unwrap();
    let replaced_content = re_upload.replace_all(raw_content, |caps: &regex::Captures| {
        let base_url = &discourse_api.base_url;
        let file_name = &caps[1]; // Capture group 1: filename without extension
                                  // If there's a file extension (capture group 2), use it; otherwise, don't add a period.
        if let Some(ext) = caps.get(2) {
            format!(
                "{}/uploads/short-url/{}.{}",
                base_url,
                file_name,
                ext.as_str()
            )
        } else {
            format!("{}/uploads/short-url/{}", base_url, file_name)
        }
    });
    Ok(replaced_content.to_string())
}

#[tokio::test]
async fn test_process_post_raw_content() {
    // Create real API client instances
    let discourse_api = Arc::new(DiscourseApi::new(
        "https://forum.arbitrum.foundation".to_string(),
        true,
    ));

    let raw_content = r#"Yes, both Arbitrum DAO governors count the **Abstain** vote choice towards quorum.

And for example, in the OpCo onchain vote, if **Abstain** wouldn't count towards quorum the proposal would have just very very barely passed, with **122.4M ARB** voting **For** and the 3% Quorum threshold being **121.8M ARB**.

![soon on arbitrum.proposals.app|690x234](upload://dL6cgekakAbqqmWl7b2EWSlhidB.png)
"#;

    // Process the raw content
    // Use a placeholder for http_client since it is no longer used in process_post_raw_content.
    let processed_content = process_upload_urls(raw_content, discourse_api)
        .await
        .unwrap();

    assert_eq!(
        processed_content,
        r#"Yes, both Arbitrum DAO governors count the **Abstain** vote choice towards quorum.

And for example, in the OpCo onchain vote, if **Abstain** wouldn't count towards quorum the proposal would have just very very barely passed, with **122.4M ARB** voting **For** and the 3% Quorum threshold being **121.8M ARB**.

![soon on arbitrum.proposals.app|690x234](https://forum.arbitrum.foundation/uploads/short-url/dL6cgekakAbqqmWl7b2EWSlhidB.png)
"#
    );
}

#[tokio::test]
async fn test_process_post_raw_content_revision() {
    // Create a DiscourseApi instance with a test base URL
    let discourse_api = Arc::new(DiscourseApi::new(
        "https://forum.arbitrum.foundation".to_string(),
        true,
    ));

    let raw_content = r#"## Constitutional / Non-Constitutional

Constitutional

## Abstract

We propose to unlock ARB utility and improve the governance and security of the Arbitrum protocol by implementing ARB staking, without yet turning on fee distribution to token holders. Through ARB staking, token holders who delegate to active governance participants will be able to capture value. The proposal will also implement a liquid staked ARB token (stARB) via the Tally Protocol that enables any future rewards to auto-compound, is (re)stakeable, and is compatible with DeFi. Separately, we will work with the Arbitrum DAO to decide whether and how to fund rewards and split rewards between token holders and delegates.

## Motivation

The ARB token is struggling to accrue value.

* Governance power is the only source of fundamental demand for ARB, while there are multiple sources of new supply (unlocks, treasury spending).
* The ability to restake ARB or use it on DeFi is not compatible with governance. Voting power breaks when ARB is deposited into smart contracts. [Less than 1%](https://dune.com/queries/3732998/6278607) of ARB tokens are used actively in the onchain ecosystem.

![|446x317](upload://tamq2f2DwVq4Vns9mZ2HPtEvQO4.png)

The ARB token is struggling as a governance mechanism

* Only about 10% of the circulating supply of ARB is [actively used](https://www.tally.xyz/gov/arbitrum/delegates) in governance
* Voter participation in the DAO has been [steadily declining](https://dune.com/queries/3829223/6440489) since DAO launch

![|441x350](upload://1PNLGkw1QuYw4Qh3IZwZ8mjyGgK.png)

Meanwhile, the Arbitrum DAO treasury has accumulated over [16 Million $ETH](https://www.tally.xyz/gov/arbitrum/treasury) in surplus fees from Arbitrum One and Nova. As a result, it is becoming economically attractive for a malicious actor to launch a governance attack on the DAO treasury. The potential profit of attacking the DAO treasury is increasing as more ETH accumulates in the treasury, while the cost of attacking the DAO through purchasing ARB for its voting power is not increasing proportionally to defend against attacks. A more developed version of this dynamic exists in the ENS and Compound DAOs, both of which are actively fighting off governance attacks (ENS documented [here](https://discuss.ens.domains/t/temp-check-enable-cancel-role-on-the-dao/19090/10)).

ARB Staking unlocks utility and aligns governance by creating a mechanism to stream future rewards from DAO-generated sources like sequencer fees, MEV fees, validator fees, token inflation, and treasury diversification to token holders who are delegated to an active governance participant. ARB Staking makes ARB usable in restaking and DeFi by returning voting power locked in contracts to the DAO.

## Rationale

This proposal contributes to Arbitrum [Community Values](https://docs.arbitrum.foundation/dao-constitution#section-6-community-values) by making the Arbitrum DAO more sustainable and secure.

## Specifications and Steps to Implement

### System architecture

ARB Staking enables ARB utility while allowing the DAO to retain governance power. It includes a few modular components that come together to power the system.

Governance Staking

* Requires that tokens are delegated to an active delegate in order to be eligible to receive rewards (see Karma Integration)
* Accepts arbitrary fee sources as rewards
* Is based on Uniswaps audited [UniStaker](https://github.com/uniswapfoundation/UniStaker). Each pool of staked tokens are held in their own special purpose smart contract which can only delegate its own voting power. The governance contract is simple, permissionless, audited and has no special authorities. The contract is upgradable only via Constitutional Proposal by the Arbitrum DAO.
* Each user owns their own staking vault, and is free to use Governance Staking regardless of whether or not they use stARB (see Tally Protocol LST section below). This allows for maximum flexibility for the DAO and lets others also build yield generating infrastructure for the ARB token.

![image|401x500](upload://xtLYBucs08yayq7BgfqSGTvtUjM.png)

The DAO
* Has the power to turn on fee distribution and send fees to ARB Staking
* Controls how voting power is distributed to delegates, including delegation strategies for unused voting power

stARB (Tally Protocol LST)

* Creates a *receipt token* for the ARB which is staked through it, called stARB, and it returns it to the user. The underlying tokens that are staked on the users behalf are always available to redeem, 1:1 plus rewards if applicable, at any time.
* Auto-compounds potential rewards if they are turned on in the future
* Provides token holders a liquid position
* Administers its own Governance Staking vault, not any other vault. stARB has no special powers over the staking contract, and has no access to user&#39;s tokens other than the tokens it manages itself.
* Will be deployed as an immutable, non-upgradeable contract. The delegation strategies part of the system will upgradeable via Arbitrum DAO Constitutional Proposal. The only part of the system Tally manages is the rebalancing of underlying assets.
* Can have a withdrawal period, which is configurable by the DAO. The expectation is that any withdrawal period will be very short and is there only to prevent people from abusing the reward mechanism (i.e. staking right before a reward, claiming a chunk of it, and immediately unstaking). If there is a price difference, arbitrageurs can instantly unstake stARB and sell it as ARB to close the price difference. This easy arbitrage opportunity minimizes price discrepancies and makes it difficult for any potential governance attacker to acquire ARB at a discount.
* Allows stARB holders to continue delegating directly to their preferred delegate.
* Has the ability to return voting power to the DAO if stARB is deposited into restaking, DeFi, or centralized exchange smart contracts that do not maintain a 1:1 delegation relationship by implementing a [Flexible Voting](https://github.com/ScopeLift/flexible-voting) client. The Arbitrum DAO exclusively has the ability to determine how this voting power is distributed/redelegated via a governance proposal. The DAO will decide how to set up the initial redelegation logic for stARB.

![image|527x500](upload://agIc8rArg7v5BAPz3iVfM397fS2.png)

### Karma integration

Governance Staking requires that tokens are delegated to an active delegate in order to be eligible to receive rewards. We will define an &quot;active delegate&quot; using Karma Score. The implementation of Karma for ARB Staking is designed to be modular. If, in the future, the DAO wishes to add additional or alternative providers to define &quot;active delegate&quot;, it can do so. The DAO will define the Karma Score requirement for being considered an active delegate. Karma Score is a combination of delegate’s Snapshot voting stats, onchain voting stats and their forum activity. To accurately calculate forum activity score, delegates are required to prove ownership of their forum handle by [signing a message](https://www.karmahq.xyz/dao/link/forum?dao=arbitrum) with their delegate address and posting on the forum. The current Karma score formula is below, which can be adjusted by the DAO going forward:

((100) * ((Forum Activity Score * 1) + (Off-chain Votes % * 3) + (On-chain Votes % * 5))) / (Sum of Weights times Max Score Setting * 1)

Karma Score will be included in ARB staking via a smart contract that writes data onchain from the Karma API. We will include several guardrails to ensure that this aspect of the implementation is robust and decentralized:

* Users can verify Karma score calculations independently.
* The DAO will have the ability to block Karma Scores if it believes they are being calculated incorrectly.
* If Karma scores fail to arrive or the scores are blocked by the DAO, ARB Staking will distribute rewards to all stakers regardless of whether they are delegated to an active governance participant until the situation is resolved.

In the future, we believe it would make sense to integrate delegate incentives with ARB staking so that, instead of getting delegate incentive funds from the ARB treasury, they come directly from onchain revenue. We will lead a working group to develop a recommendation on this topic.

Tally will build ARB staking into our existing [Arbitrum DAO platform](https://www.tally.xyz/gov/arbitrum), so that users can easily stake and delegate in one place.

### Parallel workstreams: Staking Rewards and Delegation working groups

In parallel with the development of ARB Staking, we will lead two separate DAO working groups that are focused on aspects of the system that will be implemented after development is complete.

* The Staking Rewards working group will focus on how to fund staking rewards. It will develop a recommendation about whether staking rewards should be funded by sequencer fees, MEV fees, validator fees, token inflation, treasury diversification, and/or DAO venture investments and how to implement such rewards.
* The ARB Staking &amp; Delegation working group will focus on how to define an active contributor to the Arbitrum DAO, delegate incentives, and voting power distribution. It will collaborate with Tally and Karma to develop recommendations on Karma Score formula, the minimum Karma Score required to be eligible for staking.

The working groups will be formed via an open call for contributors that will be posted after this proposal passes the temp check stage. Each working group will deliver their recommendations in October, so that the recommendations can be turned into DAO proposals and created following the implementation of ARB Staking.

### Integration with future Arbitrum staking systems

We anticipate that multiple Arbitrum staking systems will be developed over time, perhaps to incentivize decentralized block production in BoLD or to create an efficient MEV market in Time Boost. We view multiple staking systems as complementary. Each system would ask the staker to do different work for Arbitrum, take different risks, and pay out different rewards. Having multiple systems lets ARB holders pick between different risk/reward payoffs and specialize in different types of work to secure the system.

## Estimated Timeline

Post proposal on forum for feedback: June

Post temp check proposal on Snapshot: August

Post onchain proposal on Tally for funding: August

Begin development: August

Submit smart contracts for audit: September

Submit onchain proposal on Tally including full ARB Staking implementation: October

Publish working group recommendations and turn them into DAO proposals: November

## Overall Cost

If this proposal passes temperature check, we will submit an onchain proposal that includes $200,000 USD in ARB of funding to cover the costs of development, including the following funding categories:

* $50,000 USD in ARB: Develop ARB Staking smart contracts
  * Implement staking contracts
  * Integrate Arbitrum’s current and potential fee mechanisms
  * Integrate Karma Score requirement
  * Enable the DAO to block Karma Scores if it believes they are being calculated incorrectly
* $20,000 USD in ARB: Integrate ARB Staking into Tally.xyz
* $50,000 USD in ARB: Integrate Karma into ARB Staking
  * Develop and deploy a smart contract to store key stats and Karma scores onchain
  * Create a system to record stats onchain and store detailed delegate data off-chain (using Arweave or IPFS) for easy verification
  * Continuously improve scoring algorithms to adapt to evolving Arbitrum community needs
  * Provide technical support to delegates experiencing issues with their statistics
* $60,000 USD in ARB: Audit ARB Staking smart contracts
  * The final cost of the audit including documentation will be published on this thread. Any leftover funds from the $100,000 budget will be returned to the DAO.
* $20,000 USD in ARB: Fund Staking Rewards and ARB Staking &amp; Delegation working groups

Separately, we will submit an onchain proposal with the full ARB Staking implementation at the conclusion of the development process.

### Disclaimer

This proposal should not be relied on as legal, tax, or investment advice. Any projections included here are based on our best estimates and presented for informational purposes only."#;

    // Process the raw content
    let processed_content = process_upload_urls(raw_content, discourse_api)
        .await
        .unwrap();

    let expected_content = r#"## Constitutional / Non-Constitutional

Constitutional

## Abstract

We propose to unlock ARB utility and improve the governance and security of the Arbitrum protocol by implementing ARB staking, without yet turning on fee distribution to token holders. Through ARB staking, token holders who delegate to active governance participants will be able to capture value. The proposal will also implement a liquid staked ARB token (stARB) via the Tally Protocol that enables any future rewards to auto-compound, is (re)stakeable, and is compatible with DeFi. Separately, we will work with the Arbitrum DAO to decide whether and how to fund rewards and split rewards between token holders and delegates.

## Motivation

The ARB token is struggling to accrue value.

* Governance power is the only source of fundamental demand for ARB, while there are multiple sources of new supply (unlocks, treasury spending).
* The ability to restake ARB or use it on DeFi is not compatible with governance. Voting power breaks when ARB is deposited into smart contracts. [Less than 1%](https://dune.com/queries/3732998/6278607) of ARB tokens are used actively in the onchain ecosystem.

![|446x317](https://forum.arbitrum.foundation/uploads/short-url/tamq2f2DwVq4Vns9mZ2HPtEvQO4.png)

The ARB token is struggling as a governance mechanism

* Only about 10% of the circulating supply of ARB is [actively used](https://www.tally.xyz/gov/arbitrum/delegates) in governance
* Voter participation in the DAO has been [steadily declining](https://dune.com/queries/3829223/6440489) since DAO launch

![|441x350](https://forum.arbitrum.foundation/uploads/short-url/1PNLGkw1QuYw4Qh3IZwZ8mjyGgK.png)

Meanwhile, the Arbitrum DAO treasury has accumulated over [16 Million $ETH](https://www.tally.xyz/gov/arbitrum/treasury) in surplus fees from Arbitrum One and Nova. As a result, it is becoming economically attractive for a malicious actor to launch a governance attack on the DAO treasury. The potential profit of attacking the DAO treasury is increasing as more ETH accumulates in the treasury, while the cost of attacking the DAO through purchasing ARB for its voting power is not increasing proportionally to defend against attacks. A more developed version of this dynamic exists in the ENS and Compound DAOs, both of which are actively fighting off governance attacks (ENS documented [here](https://discuss.ens.domains/t/temp-check-enable-cancel-role-on-the-dao/19090/10)).

ARB Staking unlocks utility and aligns governance by creating a mechanism to stream future rewards from DAO-generated sources like sequencer fees, MEV fees, validator fees, token inflation, and treasury diversification to token holders who are delegated to an active governance participant. ARB Staking makes ARB usable in restaking and DeFi by returning voting power locked in contracts to the DAO.

## Rationale

This proposal contributes to Arbitrum [Community Values](https://docs.arbitrum.foundation/dao-constitution#section-6-community-values) by making the Arbitrum DAO more sustainable and secure.

## Specifications and Steps to Implement

### System architecture

ARB Staking enables ARB utility while allowing the DAO to retain governance power. It includes a few modular components that come together to power the system.

Governance Staking

* Requires that tokens are delegated to an active delegate in order to be eligible to receive rewards (see Karma Integration)
* Accepts arbitrary fee sources as rewards
* Is based on Uniswaps audited [UniStaker](https://github.com/uniswapfoundation/UniStaker). Each pool of staked tokens are held in their own special purpose smart contract which can only delegate its own voting power. The governance contract is simple, permissionless, audited and has no special authorities. The contract is upgradable only via Constitutional Proposal by the Arbitrum DAO.
* Each user owns their own staking vault, and is free to use Governance Staking regardless of whether or not they use stARB (see Tally Protocol LST section below). This allows for maximum flexibility for the DAO and lets others also build yield generating infrastructure for the ARB token.

![image|401x500](https://forum.arbitrum.foundation/uploads/short-url/xtLYBucs08yayq7BgfqSGTvtUjM.png)

The DAO
* Has the power to turn on fee distribution and send fees to ARB Staking
* Controls how voting power is distributed to delegates, including delegation strategies for unused voting power

stARB (Tally Protocol LST)

* Creates a *receipt token* for the ARB which is staked through it, called stARB, and it returns it to the user. The underlying tokens that are staked on the users behalf are always available to redeem, 1:1 plus rewards if applicable, at any time.
* Auto-compounds potential rewards if they are turned on in the future
* Provides token holders a liquid position
* Administers its own Governance Staking vault, not any other vault. stARB has no special powers over the staking contract, and has no access to user&#39;s tokens other than the tokens it manages itself.
* Will be deployed as an immutable, non-upgradeable contract. The delegation strategies part of the system will upgradeable via Arbitrum DAO Constitutional Proposal. The only part of the system Tally manages is the rebalancing of underlying assets.
* Can have a withdrawal period, which is configurable by the DAO. The expectation is that any withdrawal period will be very short and is there only to prevent people from abusing the reward mechanism (i.e. staking right before a reward, claiming a chunk of it, and immediately unstaking). If there is a price difference, arbitrageurs can instantly unstake stARB and sell it as ARB to close the price difference. This easy arbitrage opportunity minimizes price discrepancies and makes it difficult for any potential governance attacker to acquire ARB at a discount.
* Allows stARB holders to continue delegating directly to their preferred delegate.
* Has the ability to return voting power to the DAO if stARB is deposited into restaking, DeFi, or centralized exchange smart contracts that do not maintain a 1:1 delegation relationship by implementing a [Flexible Voting](https://github.com/ScopeLift/flexible-voting) client. The Arbitrum DAO exclusively has the ability to determine how this voting power is distributed/redelegated via a governance proposal. The DAO will decide how to set up the initial redelegation logic for stARB.

![image|527x500](https://forum.arbitrum.foundation/uploads/short-url/agIc8rArg7v5BAPz3iVfM397fS2.png)

### Karma integration

Governance Staking requires that tokens are delegated to an active delegate in order to be eligible to receive rewards. We will define an &quot;active delegate&quot; using Karma Score. The implementation of Karma for ARB Staking is designed to be modular. If, in the future, the DAO wishes to add additional or alternative providers to define &quot;active delegate&quot;, it can do so. The DAO will define the Karma Score requirement for being considered an active delegate. Karma Score is a combination of delegate’s Snapshot voting stats, onchain voting stats and their forum activity. To accurately calculate forum activity score, delegates are required to prove ownership of their forum handle by [signing a message](https://www.karmahq.xyz/dao/link/forum?dao=arbitrum) with their delegate address and posting on the forum. The current Karma score formula is below, which can be adjusted by the DAO going forward:

((100) * ((Forum Activity Score * 1) + (Off-chain Votes % * 3) + (On-chain Votes % * 5))) / (Sum of Weights times Max Score Setting * 1)

Karma Score will be included in ARB staking via a smart contract that writes data onchain from the Karma API. We will include several guardrails to ensure that this aspect of the implementation is robust and decentralized:

* Users can verify Karma score calculations independently.
* The DAO will have the ability to block Karma Scores if it believes they are being calculated incorrectly.
* If Karma scores fail to arrive or the scores are blocked by the DAO, ARB Staking will distribute rewards to all stakers regardless of whether they are delegated to an active governance participant until the situation is resolved.

In the future, we believe it would make sense to integrate delegate incentives with ARB staking so that, instead of getting delegate incentive funds from the ARB treasury, they come directly from onchain revenue. We will lead a working group to develop a recommendation on this topic.

Tally will build ARB staking into our existing [Arbitrum DAO platform](https://www.tally.xyz/gov/arbitrum), so that users can easily stake and delegate in one place.

### Parallel workstreams: Staking Rewards and Delegation working groups

In parallel with the development of ARB Staking, we will lead two separate DAO working groups that are focused on aspects of the system that will be implemented after development is complete.

* The Staking Rewards working group will focus on how to fund staking rewards. It will develop a recommendation about whether staking rewards should be funded by sequencer fees, MEV fees, validator fees, token inflation, treasury diversification, and/or DAO venture investments and how to implement such rewards.
* The ARB Staking &amp; Delegation working group will focus on how to define an active contributor to the Arbitrum DAO, delegate incentives, and voting power distribution. It will collaborate with Tally and Karma to develop recommendations on Karma Score formula, the minimum Karma Score required to be eligible for staking.

The working groups will be formed via an open call for contributors that will be posted after this proposal passes the temp check stage. Each working group will deliver their recommendations in October, so that the recommendations can be turned into DAO proposals and created following the implementation of ARB Staking.

### Integration with future Arbitrum staking systems

We anticipate that multiple Arbitrum staking systems will be developed over time, perhaps to incentivize decentralized block production in BoLD or to create an efficient MEV market in Time Boost. We view multiple staking systems as complementary. Each system would ask the staker to do different work for Arbitrum, take different risks, and pay out different rewards. Having multiple systems lets ARB holders pick between different risk/reward payoffs and specialize in different types of work to secure the system.

## Estimated Timeline

Post proposal on forum for feedback: June

Post temp check proposal on Snapshot: August

Post onchain proposal on Tally for funding: August

Begin development: August

Submit smart contracts for audit: September

Submit onchain proposal on Tally including full ARB Staking implementation: October

Publish working group recommendations and turn them into DAO proposals: November

## Overall Cost

If this proposal passes temperature check, we will submit an onchain proposal that includes $200,000 USD in ARB of funding to cover the costs of development, including the following funding categories:

* $50,000 USD in ARB: Develop ARB Staking smart contracts
  * Implement staking contracts
  * Integrate Arbitrum’s current and potential fee mechanisms
  * Integrate Karma Score requirement
  * Enable the DAO to block Karma Scores if it believes they are being calculated incorrectly
* $20,000 USD in ARB: Integrate ARB Staking into Tally.xyz
* $50,000 USD in ARB: Integrate Karma into ARB Staking
  * Develop and deploy a smart contract to store key stats and Karma scores onchain
  * Create a system to record stats onchain and store detailed delegate data off-chain (using Arweave or IPFS) for easy verification
  * Continuously improve scoring algorithms to adapt to evolving Arbitrum community needs
  * Provide technical support to delegates experiencing issues with their statistics
* $60,000 USD in ARB: Audit ARB Staking smart contracts
  * The final cost of the audit including documentation will be published on this thread. Any leftover funds from the $100,000 budget will be returned to the DAO.
* $20,000 USD in ARB: Fund Staking Rewards and ARB Staking &amp; Delegation working groups

Separately, we will submit an onchain proposal with the full ARB Staking implementation at the conclusion of the development process.

### Disclaimer

This proposal should not be relied on as legal, tax, or investment advice. Any projections included here are based on our best estimates and presented for informational purposes only."#;

    assert_eq!(processed_content, expected_content);
}
