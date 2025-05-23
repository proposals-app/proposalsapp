use std::time::Duration;

use anyhow::Result;
use dotenv::dotenv;
use opentelemetry::{global, trace::TracerProvider as _};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, Protocol, WithExportConfig};
use opentelemetry_sdk::{
    logs::LoggerProvider,
    metrics::{MeterProviderBuilder, PeriodicReader, SdkMeterProvider},
    runtime,
    trace::{RandomIdGenerator, Sampler, TracerProvider},
};
use pyroscope::{PyroscopeAgent, pyroscope::PyroscopeAgentRunning};
use pyroscope_pprofrs::{PprofConfig, pprof_backend};
use tracing::{info, level_filters::LevelFilter};
use tracing_opentelemetry::{MetricsLayer, OpenTelemetryLayer};
use tracing_subscriber::{filter::Targets, layer::SubscriberExt, util::SubscriberInitExt};

pub fn get_meter() -> opentelemetry::metrics::Meter {
    global::meter("proposals.app")
}

// Construct MeterProvider for MetricsLayer
fn init_meter_provider() -> SdkMeterProvider {
    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/metrics", endpoint))
        .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
        .build()
        .unwrap();

    let reader = PeriodicReader::builder(exporter, runtime::Tokio).build();

    let meter_provider = MeterProviderBuilder::default().with_reader(reader).build();

    global::set_meter_provider(meter_provider.clone());

    meter_provider
}

// Construct TracerProvider for OpenTelemetryLayer
fn init_tracer_provider() -> TracerProvider {
    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/traces", endpoint))
        .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
        .build()
        .unwrap();

    TracerProvider::builder()
        .with_sampler(Sampler::AlwaysOn)
        .with_id_generator(RandomIdGenerator::default())
        .with_batch_exporter(exporter, runtime::Tokio)
        .build()
}

fn init_log_provider() -> LoggerProvider {
    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = LogExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/logs", endpoint))
        .with_protocol(Protocol::HttpBinary)
        .build()
        .unwrap();

    LoggerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .build()
}

// Initialize tracing-subscriber and return OtelGuard for opentelemetry-related
// termination processing
fn init_otel() -> OtelGuard {
    let tracer_provider = init_tracer_provider();
    let meter_provider = init_meter_provider();
    let logs_provider = init_log_provider();

    let tracer = tracer_provider.tracer("tracing-otel-subscriber");

    tracing_subscriber::registry()
        .with(
            Targets::new()
                .with_target("hyper_util", LevelFilter::OFF)
                .with_target("alloy_rpc_client", LevelFilter::OFF)
                .with_default(LevelFilter::DEBUG),
        )
        .with(tracing_subscriber::fmt::layer())
        .with(MetricsLayer::new(meter_provider.clone()))
        .with(OpenTelemetryLayer::new(tracer))
        .with(OpenTelemetryTracingBridge::new(&logs_provider))
        .init();

    OtelGuard {
        tracer_provider,
        meter_provider,
        agent_running: None, // Initialize to None
    }
}

pub struct OtelGuard {
    tracer_provider: TracerProvider,
    meter_provider: SdkMeterProvider,
    agent_running: Option<PyroscopeAgent<PyroscopeAgentRunning>>,
}

impl Drop for OtelGuard {
    fn drop(&mut self) {
        if let Some(agent) = self.agent_running.take() {
            let agent_ready = agent.stop().unwrap();
            agent_ready.shutdown();
        }

        if let Err(err) = self.tracer_provider.shutdown() {
            eprintln!("{err:?}");
        }
        if let Err(err) = self.meter_provider.shutdown() {
            eprintln!("{err:?}");
        }
    }
}

pub async fn setup_otel() -> Result<OtelGuard> {
    tokio::time::sleep(Duration::from_secs(5)).await;

    dotenv().ok();
    let mut guard = init_otel();

    tokio::time::sleep(Duration::from_secs(5)).await;

    info!("Setting up profiling!");

    // Get the OTEL_EXPORTER_OTLP_ENDPOINT and replace the port with 4040
    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");
    let base_url = endpoint
        .rsplit_once(':')
        .map_or(endpoint.clone(), |(base, _)| format!("{}:4040", base));

    // Get the OTEL_SERVICE_NAME
    let service_name = std::env::var("OTEL_SERVICE_NAME").unwrap_or("local_app".to_string());

    // Configure Pyroscope Agent
    let agent = PyroscopeAgent::builder(&base_url, &service_name)
        .backend(pprof_backend(PprofConfig::new().sample_rate(100)))
        .tags([("app", service_name.as_str())].to_vec())
        .build()?;

    let agent_running = agent.start()?;
    guard.agent_running = Some(agent_running);

    info!("OTEL and profiling set up!");

    Ok(guard)
}
