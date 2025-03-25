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
use super::arb_token_abi_gen::rindexer_arb_token_gen::{self, RindexerARBTokenGen};
use ethers::{
    abi::Address,
    contract::EthLogDecode,
    providers::{Http, Provider, RetryClient},
    types::{Bytes, H256},
};
use rindexer::{
    FutureExt, PostgresClient, async_trait,
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
};
use std::{
    any::Any,
    error::Error,
    future::Future,
    path::{Path, PathBuf},
    pin::Pin,
    sync::Arc,
};

pub type ApprovalData = rindexer_arb_token_gen::ApprovalFilter;

#[derive(Debug, Clone)]
pub struct ApprovalResult {
    pub event_data: ApprovalData,
    pub tx_information: TxInformation,
}

pub type DelegateChangedData = rindexer_arb_token_gen::DelegateChangedFilter;

#[derive(Debug, Clone)]
pub struct DelegateChangedResult {
    pub event_data: DelegateChangedData,
    pub tx_information: TxInformation,
}

pub type DelegateVotesChangedData = rindexer_arb_token_gen::DelegateVotesChangedFilter;

#[derive(Debug, Clone)]
pub struct DelegateVotesChangedResult {
    pub event_data: DelegateVotesChangedData,
    pub tx_information: TxInformation,
}

pub type InitializedData = rindexer_arb_token_gen::InitializedFilter;

#[derive(Debug, Clone)]
pub struct InitializedResult {
    pub event_data: InitializedData,
    pub tx_information: TxInformation,
}

pub type OwnershipTransferredData = rindexer_arb_token_gen::OwnershipTransferredFilter;

#[derive(Debug, Clone)]
pub struct OwnershipTransferredResult {
    pub event_data: OwnershipTransferredData,
    pub tx_information: TxInformation,
}

pub type TransferData = rindexer_arb_token_gen::TransferFilter;

#[derive(Debug, Clone)]
pub struct TransferResult {
    pub event_data: TransferData,
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

pub fn delegatechanged_handler<TExtensions, F, Fut>(custom_logic: F) -> DelegateChangedEventCallbackType<TExtensions>
where
    DelegateChangedResult: Clone + 'static,
    F: for<'a> Fn(Vec<DelegateChangedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
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

type DelegateChangedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<DelegateChangedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct DelegateChangedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: DelegateChangedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> DelegateChangedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        DelegateChangedResult: Clone + 'static,
        F: for<'a> Fn(Vec<DelegateChangedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: delegatechanged_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for DelegateChangedEvent<TExtensions>
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
        let result: Vec<DelegateChangedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<DelegateChangedData>()
                    .ok()
                    .map(|arc| DelegateChangedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("DelegateChangedEvent: Unexpected data type - expected: DelegateChangedData")
        }
    }
}

pub fn delegatevoteschanged_handler<TExtensions, F, Fut>(custom_logic: F) -> DelegateVotesChangedEventCallbackType<TExtensions>
where
    DelegateVotesChangedResult: Clone + 'static,
    F: for<'a> Fn(Vec<DelegateVotesChangedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
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

type DelegateVotesChangedEventCallbackType<TExtensions> = Arc<dyn for<'a> Fn(&'a Vec<DelegateVotesChangedResult>, Arc<EventContext<TExtensions>>) -> BoxFuture<'a, EventCallbackResult<()>> + Send + Sync>;

pub struct DelegateVotesChangedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    callback: DelegateVotesChangedEventCallbackType<TExtensions>,
    context: Arc<EventContext<TExtensions>>,
}

impl<TExtensions> DelegateVotesChangedEvent<TExtensions>
where
    TExtensions: Send + Sync + 'static,
{
    pub async fn handler<F, Fut>(closure: F, extensions: TExtensions) -> Self
    where
        DelegateVotesChangedResult: Clone + 'static,
        F: for<'a> Fn(Vec<DelegateVotesChangedResult>, Arc<EventContext<TExtensions>>) -> Fut + Send + Sync + 'static + Clone,
        Fut: Future<Output = EventCallbackResult<()>> + Send + 'static,
    {
        Self {
            callback: delegatevoteschanged_handler(closure),
            context: Arc::new(EventContext {
                database: get_or_init_postgres_client().await,

                extensions: Arc::new(extensions),
            }),
        }
    }
}

#[async_trait]
impl<TExtensions> EventCallback for DelegateVotesChangedEvent<TExtensions>
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
        let result: Vec<DelegateVotesChangedResult> = events
            .into_iter()
            .filter_map(|item| {
                item.decoded_data
                    .downcast::<DelegateVotesChangedData>()
                    .ok()
                    .map(|arc| DelegateVotesChangedResult {
                        event_data: (*arc).clone(),
                        tx_information: item.tx_information,
                    })
            })
            .collect();

        if result.len() == events_len {
            (self.callback)(&result, Arc::clone(&self.context)).await
        } else {
            panic!("DelegateVotesChangedEvent: Unexpected data type - expected: DelegateVotesChangedData")
        }
    }
}

pub enum ARBTokenEventType<TExtensions>
where
    TExtensions: 'static + Send + Sync,
{
    DelegateChanged(DelegateChangedEvent<TExtensions>),
    DelegateVotesChanged(DelegateVotesChangedEvent<TExtensions>),
}

pub fn arb_token_contract(network: &str) -> RindexerARBTokenGen<Arc<Provider<RetryClient<Http>>>> {
    let address: Address = "0x912ce59144191c1204e64559fe8253a0e49e6548"
        .parse()
        .expect("Invalid address");
    RindexerARBTokenGen::new(
        address,
        Arc::new(get_provider_cache_for_network(network).get_inner_provider()),
    )
}

pub fn decoder_contract(network: &str) -> RindexerARBTokenGen<Arc<Provider<RetryClient<Http>>>> {
    if network == "arbitrum" {
        RindexerARBTokenGen::new(
            // do not care about address here its decoding makes it easier to handle ValueOrArray
            Address::zero(),
            Arc::new(get_provider_cache_for_network(network).get_inner_provider()),
        )
    } else {
        panic!("Network not supported");
    }
}

impl<TExtensions> ARBTokenEventType<TExtensions>
where
    TExtensions: 'static + Send + Sync,
{
    pub fn topic_id(&self) -> &'static str {
        match self {
            ARBTokenEventType::DelegateChanged(_) => "0x3134e8a2e6d97e929a7e54011ea5485d7d196dd5f0ba4d4ef95803e8e3fc257f",
            ARBTokenEventType::DelegateVotesChanged(_) => "0xdec2bacdd2f05b59de34da9b523dff8be42e5e38e818c82fdb0bae774387a724",
        }
    }

    pub fn event_name(&self) -> &'static str {
        match self {
            ARBTokenEventType::DelegateChanged(_) => "DelegateChanged",
            ARBTokenEventType::DelegateVotesChanged(_) => "DelegateVotesChanged",
        }
    }

    pub fn contract_name(&self) -> String {
        "ARBToken".to_string()
    }

    fn get_provider(&self, network: &str) -> Arc<JsonRpcCachedProvider> {
        get_provider_cache_for_network(network)
    }

    fn decoder(&self, network: &str) -> Arc<dyn Fn(Vec<H256>, Bytes) -> Arc<dyn Any + Send + Sync> + Send + Sync> {
        let decoder_contract = decoder_contract(network);

        match self {
            ARBTokenEventType::DelegateChanged(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match DelegateChangedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: DelegateChangedData = event;
                        Arc::new(result) as Arc<dyn Any + Send + Sync>
                    }
                    Err(error) => Arc::new(error) as Arc<dyn Any + Send + Sync>,
                }
            }),

            ARBTokenEventType::DelegateVotesChanged(_) => Arc::new(move |topics: Vec<H256>, data: Bytes| {
                match DelegateVotesChangedData::decode_log(&ethers::core::abi::RawLog {
                    topics,
                    data: data.to_vec(),
                }) {
                    Ok(event) => {
                        let result: DelegateVotesChangedData = event;
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
            ARBTokenEventType::DelegateChanged(event) => {
                let event = Arc::new(event);
                Arc::new(move |result| {
                    let event = Arc::clone(&event);
                    async move { event.call(result).await }.boxed()
                })
            }

            ARBTokenEventType::DelegateVotesChanged(event) => {
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
