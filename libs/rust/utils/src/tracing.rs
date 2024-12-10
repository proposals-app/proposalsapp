use futures::FutureExt;
use once_cell::sync::Lazy;
use opentelemetry::{global, trace::TraceError, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, MetricExporter, Protocol, SpanExporter, WithExportConfig};
use opentelemetry_sdk::{
    logs::{self as sdklogs, LoggerProvider},
    metrics::{MetricError, PeriodicReader, SdkMeterProvider},
    runtime,
    trace::{self as sdktrace, TracerProvider},
    Resource,
};
use std::{error::Error, time::Duration};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[derive(Debug)]
pub struct MetricsError(String);

impl std::error::Error for MetricsError {}

impl std::fmt::Display for MetricsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Metrics error: {}", self.0)
    }
}

static RESOURCE: Lazy<Resource> = Lazy::new(|| {
    let crate_name = std::env::var("CARGO_PKG_NAME")
        .or_else(|_| std::env::var("PROPOSALS_BIN"))
        .unwrap_or_else(|_| "unknown".to_string());

    Resource::new(vec![KeyValue::new(
        opentelemetry_semantic_conventions::resource::SERVICE_NAME,
        crate_name.to_lowercase(),
    )])
});

static SERVICE_NAME: Lazy<&'static str> = Lazy::new(|| {
    let crate_name = std::env::var("CARGO_PKG_NAME")
        .or_else(|_| std::env::var("PROPOSALS_BIN"))
        .unwrap_or_else(|_| "unknown".to_string());

    Box::leak(crate_name.to_lowercase().into_boxed_str())
});

fn get_endpoint() -> String {
    std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").expect("OTEL_EXPORTER_OTLP_ENDPOINT not set!")
}

fn init_logs() -> Result<sdklogs::LoggerProvider, opentelemetry_sdk::logs::LogError> {
    let endpoint = get_endpoint();

    let exporter = LogExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/logs", endpoint))
        .with_protocol(Protocol::HttpBinary)
        .build()?;

    Ok(LoggerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .with_resource(RESOURCE.clone())
        .build())
}

fn init_tracer_provider() -> Result<sdktrace::TracerProvider, TraceError> {
    let endpoint = get_endpoint();

    let exporter = SpanExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/traces", endpoint))
        .with_protocol(Protocol::HttpBinary)
        .build()?;

    Ok(TracerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .with_resource(RESOURCE.clone())
        .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
        .build())
}

fn init_metrics() -> Result<SdkMeterProvider, MetricError> {
    let endpoint = get_endpoint();

    let exporter = MetricExporter::builder()
        .with_http()
        .with_endpoint(format!("{}/v1/metrics", endpoint))
        .with_protocol(Protocol::HttpBinary)
        .build()
        .map_err(|e| MetricError::Other(e.to_string()))?;

    Ok(SdkMeterProvider::builder()
        .with_reader(PeriodicReader::builder(exporter, runtime::Tokio).build())
        .with_resource(RESOURCE.clone())
        .build())
}

pub fn get_meter() -> opentelemetry::metrics::Meter {
    global::meter(&*SERVICE_NAME)
}

pub fn setup_tracing() -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    let tracer_provider = init_tracer_provider().map_err(|e| {
        tracing::error!("Failed to initialize tracer provider: {:?}", e);
        e
    })?;
    global::set_tracer_provider(tracer_provider.clone());

    let meter_provider = init_metrics().map_err(|e| {
        tracing::error!("Failed to initialize metrics: {:?}", e);
        e
    })?;
    global::set_meter_provider(meter_provider.clone());

    let logger_provider = init_logs().map_err(|e| {
        tracing::error!("Failed to initialize logger provider: {:?}", e);
        e
    })?;

    // Create a new OpenTelemetryTracingBridge using the LoggerProvider
    let otel_layer = OpenTelemetryTracingBridge::new(&logger_provider);

    // Filter for OpenTelemetry layer to prevent infinite telemetry generation
    let filter_otel = EnvFilter::new("info")
        .add_directive("hyper=off".parse().unwrap())
        .add_directive("opentelemetry=off".parse().unwrap())
        .add_directive("tonic=off".parse().unwrap())
        .add_directive("h2=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap());
    let otel_layer = otel_layer.with_filter(filter_otel);

    // Create fmt layer with custom filter
    let filter_fmt = EnvFilter::new("info").add_directive("opentelemetry=debug".parse().unwrap());
    let fmt_layer = fmt::layer()
        .with_line_number(true)
        .compact()
        .with_thread_names(true)
        .with_filter(filter_fmt);

    // Initialize the tracing subscriber
    tracing_subscriber::registry()
        .with(otel_layer)
        .with(fmt_layer)
        .try_init()
        .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

    Ok(())
}

pub async fn run_with_tracing<F, Fut>(
    future: F,
) -> Result<(), Box<dyn Error + Send + Sync + 'static>>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<(), anyhow::Error>> + Send + 'static,
{
    setup_tracing()?;

    let result = std::panic::AssertUnwindSafe(future()).catch_unwind().await;

    if let Err(e) = result {
        capture_panic_details(e);
    }

    shutdown_tracing().await;
    Ok(())
}

fn capture_panic_details(e: Box<dyn std::any::Any + Send>) {
    let backtrace = backtrace::Backtrace::new();
    if let Some(s) = e.downcast_ref::<&str>() {
        tracing::error!(panic_message = *s, backtrace = ?backtrace, "Panic occurred with message");
    } else if let Some(s) = e.downcast_ref::<String>() {
        tracing::error!(panic_message = s, backtrace = ?backtrace, "Panic occurred with message");
    } else {
        tracing::error!(backtrace = ?backtrace, "Panic occurred but the payload is not a string");
    }
}

pub async fn shutdown_tracing() {
    // Allow time for final exports
    tokio::time::sleep(Duration::from_secs(5)).await;

    // Shut down tracer provider
    global::shutdown_tracer_provider();
}
