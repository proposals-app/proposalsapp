use anyhow::Result;
use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, Protocol, WithExportConfig};
use opentelemetry_sdk::{
    logs::LoggerProvider,
    metrics::{MeterProviderBuilder, PeriodicReader, SdkMeterProvider},
    runtime,
    trace::{RandomIdGenerator, Sampler, TracerProvider},
    Resource,
};
use opentelemetry_semantic_conventions::{attribute::SERVICE_NAME, SCHEMA_URL};
use tracing::Level;
use tracing_opentelemetry::{MetricsLayer, OpenTelemetryLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Create a Resource that captures information about the entity for which telemetry is recorded.
fn resource() -> Resource {
    let crate_name = std::env::var("CARGO_PKG_NAME")
        .or_else(|_| std::env::var("PROPOSALS_BIN"))
        .unwrap_or_else(|_| "unknown".to_string());

    Resource::from_schema_url(
        [KeyValue::new(SERVICE_NAME, crate_name.to_lowercase())],
        SCHEMA_URL,
    )
}

pub fn get_meter() -> opentelemetry::metrics::Meter {
    global::meter(SERVICE_NAME)
}

// Construct MeterProvider for MetricsLayer
fn init_meter_provider() -> SdkMeterProvider {
    let endpoint =
        std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/metrics", endpoint))
        .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
        .build()
        .unwrap();

    let reader = PeriodicReader::builder(exporter, runtime::Tokio)
        .with_interval(std::time::Duration::from_secs(30))
        .build();

    let meter_provider = MeterProviderBuilder::default()
        .with_resource(resource())
        .with_reader(reader)
        .build();

    global::set_meter_provider(meter_provider.clone());

    meter_provider
}

// Construct TracerProvider for OpenTelemetryLayer
fn init_tracer_provider() -> TracerProvider {
    let endpoint =
        std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/traces", endpoint))
        .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
        .build()
        .unwrap();

    TracerProvider::builder()
        .with_sampler(Sampler::ParentBased(Box::new(Sampler::TraceIdRatioBased(
            1.0,
        ))))
        .with_id_generator(RandomIdGenerator::default())
        .with_resource(resource())
        .with_batch_exporter(exporter, runtime::Tokio)
        .build()
}

fn init_log_provider() -> LoggerProvider {
    let endpoint =
        std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!");

    let exporter = LogExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/logs", endpoint))
        .with_protocol(Protocol::HttpBinary)
        .build()
        .unwrap();

    LoggerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .with_resource(resource())
        .build()
}

// Initialize tracing-subscriber and return OtelGuard for opentelemetry-related termination processing
fn init_tracing_subscriber() -> OtelGuard {
    let tracer_provider = init_tracer_provider();
    let meter_provider = init_meter_provider();
    let logs_provider = init_log_provider();

    let tracer = tracer_provider.tracer("tracing-otel-subscriber");

    tracing_subscriber::registry()
        .with(tracing_subscriber::filter::LevelFilter::from_level(
            Level::INFO,
        ))
        .with(tracing_subscriber::fmt::layer())
        .with(MetricsLayer::new(meter_provider.clone()))
        .with(OpenTelemetryLayer::new(tracer))
        .with(OpenTelemetryTracingBridge::new(&logs_provider))
        .init();

    OtelGuard {
        tracer_provider,
        meter_provider,
    }
}

pub struct OtelGuard {
    tracer_provider: TracerProvider,
    meter_provider: SdkMeterProvider,
}

impl Drop for OtelGuard {
    fn drop(&mut self) {
        if let Err(err) = self.tracer_provider.shutdown() {
            eprintln!("{err:?}");
        }
        if let Err(err) = self.meter_provider.shutdown() {
            eprintln!("{err:?}");
        }
    }
}

pub async fn setup_tracing() -> Result<OtelGuard> {
    let guard = init_tracing_subscriber();
    Ok(guard)
}
