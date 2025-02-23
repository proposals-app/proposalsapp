#![allow(
    non_camel_case_types,
    clippy::enum_variant_names,
    clippy::too_many_arguments,
    clippy::upper_case_acronyms,
    clippy::type_complexity,
    dead_code
)]
use super::super::super::super::typings::{database::get_or_init_postgres_client, networks::get_provider_cache_for_network};
/// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY.
///
/// This file was auto generated by rindexer - https://github.com/joshstevens19/rindexer.
/// Any manual changes to this file will be overwritten.
use super::arbitrum_treasury_governor_abi_gen::rindexer_arbitrum_treasury_governor_gen::{self, RindexerArbitrumTreasuryGovernorGen};
use ethers::{
    abi::Address,
    contract::EthLogDecode,
    providers::{Http, Provider, RetryClient},
    types::{Bytes, H256},
};
use rindexer::{
    async_trait,
    event::{
        callback_registry::{EventCallbackRegistry, EventCallbackRegistryInformation, EventCallbackResult, EventResult, TxInformation},
        contract_setup::{ContractInformation, NetworkContract},
    },
    generate_random_id,
    manifest::{
        contract::{Contract, ContractDetails},
        yaml::read_manifest,
    },
    provider::JsonRpcCachedProvider,
    FutureExt, PostgresClient,
};
use std::{
    any::Any,
    error::Error,
    future::Future,
    path::{Path, PathBuf},
    pin::Pin,
    sync::Arc,
};

pub type InitializedData = rindexer_arbitrum_treasury_governor_gen::InitializedFilter;

#[derive(Debug, Clone)]
pub struct InitializedResult {
    pub event_data: InitializedData,
    pub tx_information: TxInformation,
}

pub type LateQuorumVoteExtensionSetData = rindexer_arbitrum_treasury_governor_gen::LateQuorumVoteExtensionSetFilter;

#[derive(Debug, Clone)]
pub struct LateQuorumVoteExtensionSetResult {
    pub event_data: LateQuorumVoteExtensionSetData,
    pub tx_information: TxInformation,
}

pub type OwnershipTransferredData = rindexer_arbitrum_treasury_governor_gen::OwnershipTransferredFilter;

#[derive(Debug, Clone)]
pub struct OwnershipTransferredResult {
    pub event_data: OwnershipTransferredData,
    pub tx_information: TxInformation,
}

pub type ProposalCanceledData = rindexer_arbitrum_treasury_governor_gen::ProposalCanceledFilter;

#[derive(Debug, Clone)]
pub struct ProposalCanceledResult {
    pub event_data: ProposalCanceledData,
    pub tx_information: TxInformation,
}

pub type ProposalCreatedData = rindexer_arbitrum_treasury_governor_gen::ProposalCreatedFilter;

#[derive(Debug, Clone)]
pub struct ProposalCreatedResult {
    pub event_data: ProposalCreatedData,
    pub tx_information: TxInformation,
}

pub type ProposalExecutedData = rindexer_arbitrum_treasury_governor_gen::ProposalExecutedFilter;

#[derive(Debug, Clone)]
pub struct ProposalExecutedResult {
    pub event_data: ProposalExecutedData,
    pub tx_information: TxInformation,
}

pub type ProposalExtendedData = rindexer_arbitrum_treasury_governor_gen::ProposalExtendedFilter;

#[derive(Debug, Clone)]
pub struct ProposalExtendedResult {
    pub event_data: ProposalExtendedData,
    pub tx_information: TxInformation,
}

pub type ProposalQueuedData = rindexer_arbitrum_treasury_governor_gen::ProposalQueuedFilter;

#[derive(Debug, Clone)]
pub struct ProposalQueuedResult {
    pub event_data: ProposalQueuedData,
    pub tx_information: TxInformation,
}

pub type ProposalThresholdSetData = rindexer_arbitrum_treasury_governor_gen::ProposalThresholdSetFilter;

#[derive(Debug, Clone)]
pub struct ProposalThresholdSetResult {
    pub event_data: ProposalThresholdSetData,
    pub tx_information: TxInformation,
}

pub type QuorumNumeratorUpdatedData = rindexer_arbitrum_treasury_governor_gen::QuorumNumeratorUpdatedFilter;

#[derive(Debug, Clone)]
pub struct QuorumNumeratorUpdatedResult {
    pub event_data: QuorumNumeratorUpdatedData,
    pub tx_information: TxInformation,
}

pub type TimelockChangeData = rindexer_arbitrum_treasury_governor_gen::TimelockChangeFilter;

#[derive(Debug, Clone)]
pub struct TimelockChangeResult {
    pub event_data: TimelockChangeData,
    pub tx_information: TxInformation,
}

pub type VoteCastData = rindexer_arbitrum_treasury_governor_gen::VoteCastFilter;

#[derive(Debug, Clone)]
pub struct VoteCastResult {
    pub event_data: VoteCastData,
    pub tx_information: TxInformation,
}

pub type VoteCastWithParamsData = rindexer_arbitrum_treasury_governor_gen::VoteCastWithParamsFilter;

#[derive(Debug, Clone)]
pub struct VoteCastWithParamsResult {
    pub event_data: VoteCastWithParamsData,
    pub tx_information: TxInformation,
}

pub type VotingDelaySetData = rindexer_arbitrum_treasury_governor_gen::VotingDelaySetFilter;

#[derive(Debug, Clone)]
pub struct VotingDelaySetResult {
    pub event_data: VotingDelaySetData,
    pub tx_information: TxInformation,
}

pub type VotingPeriodSetData = rindexer_arbitrum_treasury_governor_gen::VotingPeriodSetFilter;

#[derive(Debug, Clone)]
pub struct VotingPeriodSetResult {
    pub event_data: VotingPeriodSetData,
    pub tx_information: TxInformation,
}

type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[async_trait]
trait EventCallback {
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()>;
}

pub struct EventContext<TExtensions>
where
    TExtensions: Send + Sync,
{
    pub database: Arc<PostgresClient>,

    pub extensions: Arc<TExtensions>,
}

// didn't want to use option or none made harder DX
// so a blank struct makes interface nice
pub struct NoExtensions {}
pub fn no_extensions() -> NoExtensions {
    NoExtensions {}
}

pub fn proposalcreated_handler<TExtensions, F, Fut>(custom_logic: F) -> ProposalCreatedEventCallbackType<TExtensions>
where
    ProposalCreatedResult: Clone + 'static,
    F: for<'a> Fn(Vec<ProposalCreatedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type ProposalCreatedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<ProposalCreatedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct ProposalCreatedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: ProposalCreatedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> ProposalCreatedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        ProposalCreatedResult: Clone + 'static,
        F: for<'a> Fn(Vec<ProposalCreatedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: proposalcreated_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for ProposalCreatedEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<ProposalCreatedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<ProposalCreatedData>()
                    .ok()
                    .map(|arc| ProposalCreatedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("ProposalCreatedEvent: Unexpected data type - expected: ProposalCreatedData")
        }
    }
}

pub fn proposalexecuted_handler<TExtensions, F, Fut>(custom_logic: F) -> ProposalExecutedEventCallbackType<TExtensions>
where
    ProposalExecutedResult: Clone + 'static,
    F: for<'a> Fn(Vec<ProposalExecutedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type ProposalExecutedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<ProposalExecutedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct ProposalExecutedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: ProposalExecutedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> ProposalExecutedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        ProposalExecutedResult: Clone + 'static,
        F: for<'a> Fn(Vec<ProposalExecutedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: proposalexecuted_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for ProposalExecutedEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<ProposalExecutedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<ProposalExecutedData>()
                    .ok()
                    .map(|arc| ProposalExecutedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("ProposalExecutedEvent: Unexpected data type - expected: ProposalExecutedData")
        }
    }
}

pub fn proposalextended_handler<TExtensions, F, Fut>(custom_logic: F) -> ProposalExtendedEventCallbackType<TExtensions>
where
    ProposalExtendedResult: Clone + 'static,
    F: for<'a> Fn(Vec<ProposalExtendedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type ProposalExtendedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<ProposalExtendedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct ProposalExtendedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: ProposalExtendedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> ProposalExtendedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        ProposalExtendedResult: Clone + 'static,
        F: for<'a> Fn(Vec<ProposalExtendedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: proposalextended_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for ProposalExtendedEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<ProposalExtendedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<ProposalExtendedData>()
                    .ok()
                    .map(|arc| ProposalExtendedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("ProposalExtendedEvent: Unexpected data type - expected: ProposalExtendedData")
        }
    }
}

pub fn proposalqueued_handler<TExtensions, F, Fut>(custom_logic: F) -> ProposalQueuedEventCallbackType<TExtensions>
where
    ProposalQueuedResult: Clone + 'static,
    F: for<'a> Fn(Vec<ProposalQueuedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type ProposalQueuedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<ProposalQueuedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct ProposalQueuedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: ProposalQueuedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> ProposalQueuedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        ProposalQueuedResult: Clone + 'static,
        F: for<'a> Fn(Vec<ProposalQueuedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: proposalqueued_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for ProposalQueuedEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<ProposalQueuedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<ProposalQueuedData>()
                    .ok()
                    .map(|arc| ProposalQueuedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("ProposalQueuedEvent: Unexpected data type - expected: ProposalQueuedData")
        }
    }
}

pub fn votecast_handler<TExtensions, F, Fut>(custom_logic: F) -> VoteCastEventCallbackType<TExtensions>
where
    VoteCastResult: Clone + 'static,
    F: for<'a> Fn(Vec<VoteCastResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type VoteCastEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<VoteCastResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct VoteCastEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: VoteCastEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> VoteCastEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        VoteCastResult: Clone + 'static,
        F: for<'a> Fn(Vec<VoteCastResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: votecast_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for VoteCastEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<VoteCastResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<VoteCastData>()
                    .ok()
                    .map(|arc| VoteCastResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("VoteCastEvent: Unexpected data type - expected: VoteCastData")
        }
    }
}

pub fn votecastwithparams_handler<TExtensions, F, Fut>(custom_logic: F) -> VoteCastWithParamsEventCallbackType<TExtensions>
where
    VoteCastWithParamsResult: Clone + 'static,
    F: for<'a> Fn(Vec<VoteCastWithParamsResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
    Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    TExtensions: Send + Sync + 'static,
{
    Arc::new(move |results, context| {
        let custom_logic = custom_logic.clone();
        let results = results.clone();
        let context = Arc::clone(&context);
        async move { (custom_logic)(results, context).await }.boxed()
    })
}

type VoteCastWithParamsEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<VoteCastWithParamsResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct VoteCastWithParamsEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: VoteCastWithParamsEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> VoteCastWithParamsEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        VoteCastWithParamsResult: Clone + 'static,
        F: for<'a> Fn(Vec<VoteCastWithParamsResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: votecastwithparams_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for VoteCastWithParamsEvent<TExtensions>
where
    TExtensions: Send + Sync,
{
    async fn call(&self, events: Vec<EventResult>) -> EventCallbackResult<()> {
        let events_len = events.len();

        // note some can not downcast because it cant decode
        // this happens on events which failed decoding due to
        // not having the right abi for example
        // transfer events with 2 indexed topics cant decode
        // transfer events with 3 indexed topics
        let result: Vec<VoteCastWithParamsResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<VoteCastWithParamsData>()
                    .ok()
                    .map(|arc| VoteCastWithParamsResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("VoteCastWithParamsEvent: Unexpected data type - expected: VoteCastWithParamsData")
        }
    }
}

pub enum ArbitrumTreasuryGovernorEventType<TExtensions>
where
    TExtensions: 'static + Send + Sync,
{
    ProposalCreated(ProposalCreatedEvent<TExtensions>),
    ProposalExecuted(ProposalExecutedEvent<TExtensions>),
    ProposalExtended(ProposalExtendedEvent<TExtensions>),
    ProposalQueued(ProposalQueuedEvent<TExtensions>),
    VoteCast(VoteCastEvent<TExtensions>),
    VoteCastWithParams(VoteCastWithParamsEvent<TExtensions>),
}

pub fn arbitrum_treasury_governor_contract(network: &str) -> RindexerArbitrumTreasuryGovernorGen<Arc<Provider<RetryClient<Http>>>> {
    let address: Address = "0x789fc99093b09ad01c34dc7251d0c89ce743e5a4"
        .parse()
        .expect("Invalid address");
    RindexerArbitrumTreasuryGovernorGen::new(
        address,
        Arc::new(get_provider_cache_for_network(network).get_inner_provider()),
    )
}

pub fn decoder_contract(network: &str) -> RindexerArbitrumTreasuryGovernorGen<Arc<Provider<RetryClient<Http>>>> {
    if network == "arbitrum" {
        RindexerArbitrumTreasuryGovernorGen::new(
            // do not care about address here its decoding makes it easier to handle ValueOrArray
            Address::zero(),
            Arc::new(get_provider_cache_for_network(network).get_inner_provider()),
        )
    } else {
        panic!("Network not supported");
    }
}

impl<TExtensions> ArbitrumTreasuryGovernorEventType<TExtensions>
where
    TExtensions: 'static + Send + Sync,
{
    pub fn topic_id(&self) -> &'static str {
        match self {
            ArbitrumTreasuryGovernorEventType::ProposalCreated(_) => "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0",
            ArbitrumTreasuryGovernorEventType::ProposalExecuted(_) => "0x712ae1383f79ac853f8d882153778e0260ef8f03b504e2866e0593e04d2b291f",
            ArbitrumTreasuryGovernorEventType::ProposalExtended(_) => "0x541f725fb9f7c98a30cc9c0ff32fbb14358cd7159c847a3aa20a2bdc442ba511",
            ArbitrumTreasuryGovernorEventType::ProposalQueued(_) => "0x9a2e42fd6722813d69113e7d0079d3d940171428df7373df9c7f7617cfda2892",
            ArbitrumTreasuryGovernorEventType::VoteCast(_) => "0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4",
            ArbitrumTreasuryGovernorEventType::VoteCastWithParams(_) => "0xe2babfbac5889a709b63bb7f598b324e08bc5a4fb9ec647fb3cbc9ec07eb8712",
        }
    }

    pub fn event_name(&self) -> &'static str {
        match self {
            ArbitrumTreasuryGovernorEventType::ProposalCreated(_) => "ProposalCreated",
            ArbitrumTreasuryGovernorEventType::ProposalExecuted(_) => "ProposalExecuted",
            ArbitrumTreasuryGovernorEventType::ProposalExtended(_) => "ProposalExtended",
            ArbitrumTreasuryGovernorEventType::ProposalQueued(_) => "ProposalQueued",
            ArbitrumTreasuryGovernorEventType::VoteCast(_) => "VoteCast",
            ArbitrumTreasuryGovernorEventType::VoteCastWithParams(_) => "VoteCastWithParams",
        }
    }

    pub fn contract_name(&self) -> String {
        "ArbitrumTreasuryGovernor".to_string()
    }

    fn get_provider(&self, network: &str) -> Arc<JsonRpcCachedProvider> {
        get_provider_cache_for_network(network)
    }

    fn decoder(&self, network: &str) -> Arc<dyn Fn(Vec<H256>, Bytes) -> Arc<dyn Any + Send + Sync> + Send + Sync> {
        let decoder_contract = decoder_contract(network);

        match self {
            ArbitrumTreasuryGovernorEventType::ProposalCreated(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match ProposalCreatedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: ProposalCreatedData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ArbitrumTreasuryGovernorEventType::ProposalExecuted(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match ProposalExecutedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: ProposalExecutedData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ArbitrumTreasuryGovernorEventType::ProposalExtended(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match ProposalExtendedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: ProposalExtendedData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ArbitrumTreasuryGovernorEventType::ProposalQueued(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match ProposalQueuedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: ProposalQueuedData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ArbitrumTreasuryGovernorEventType::VoteCast(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match VoteCastData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: VoteCastData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ArbitrumTreasuryGovernorEventType::VoteCastWithParams(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match VoteCastWithParamsData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: VoteCastWithParamsData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),
        }
    }

    pub fn register(self, manifest_path: &PathBuf, registry: &mut EventCallbackRegistry) {
        let rindexer_yaml = read_manifest(manifest_path).expect("Failed to read rindexer.yaml");
        let topic_id = self.topic_id();
        let contract_name = self.contract_name();
        let event_name = self.event_name();

        let contract_details = rindexer_yaml
            .contracts
            .iter()
            .find(|c| c.name == contract_name)
            .unwrap_or_else(|| {
                panic!(
                    "Contract {} not found please make sure its defined in the rindexer.yaml",
                    contract_name
                )
            })
            .clone();

        let index_event_in_order = contract_details
            .index_event_in_order
            .as_ref()
            .map_or(false, |vec| vec.contains(&event_name.to_string()));

        let contract = ContractInformation {
            name: contract_details
                .before_modify_name_if_filter_readonly()
                .into_owned(),
            details: contract_details
                .details
                .iter()
                .map(|c| NetworkContract {
                    id: generate_random_id(10),
                    network: c.network.clone(),
                    cached_provider: self.get_provider(&c.network),
                    decoder: self.decoder(&c.network),
                    indexing_contract_setup: c.indexing_contract_setup(),
                    start_block: c.start_block,
                    end_block: c.end_block,
                    disable_logs_bloom_checks: rindexer_yaml
                        .networks
                        .iter()
                        .find(|n| n.name == c.network)
                        .map_or(false, |n| n.disable_logs_bloom_checks.unwrap_or_default()),
                })
                .collect(),
            abi: contract_details.abi,
            reorg_safe_distance: contract_details.reorg_safe_distance.unwrap_or_default(),
        };

        let callback: Arc<dyn Fn(Vec<EventResult>) -> BoxFuture<'static, EventCallbackResult<()>> + Send + Sync> = match self {
            ArbitrumTreasuryGovernorEventType::ProposalCreated(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ArbitrumTreasuryGovernorEventType::ProposalExecuted(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ArbitrumTreasuryGovernorEventType::ProposalExtended(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ArbitrumTreasuryGovernorEventType::ProposalQueued(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ArbitrumTreasuryGovernorEventType::VoteCast(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ArbitrumTreasuryGovernorEventType::VoteCastWithParams(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }
        };

        registry.register_event(EventCallbackRegistryInformation {
            id: generate_random_id(10),
            indexer_name: "rindexer".to_string(),
            event_name: event_name.to_string(),
            index_event_in_order,
            topic_id: topic_id.parse::<H256>().unwrap(),
            contract,
            callback,
        });
    }
}
