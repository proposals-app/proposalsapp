use futures::FutureExt;
use once_cell::sync::Lazy;
use opentelemetry::{global, metrics::MetricsError, trace::TraceError, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{HttpExporterBuilder, Protocol, WithExportConfig};
use opentelemetry_sdk::{
    logs as sdklogs,
    metrics::SdkMeterProvider,
    trace::{self as sdktrace, Config},
    Resource,
};
use std::{collections::HashMap, error::Error, time::Duration};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

static RESOURCE: Lazy<Resource> = Lazy::new(|| {
    let crate_name = std::env::var("CARGO_PKG_NAME")
        .or_else(|_| std::env::var("PROPOSALS_BIN"))
        .unwrap_or_else(|_| "unknown".to_string());

    Resource::new(vec![KeyValue::new(
        opentelemetry_semantic_conventions::resource::SERVICE_NAME,
        crate_name.to_lowercase(),
    )])
});

fn http_exporter() -> HttpExporterBuilder {
    let endpoint = std::env::var("HYPERDX_ENDPOINT").expect("HYPERDX_ENDPOINT not set!");
    let api_key = std::env::var("HYPERDX_KEY").expect("HYPERDX_KEY not set!");

    opentelemetry_otlp::new_exporter()
        .http()
        .with_endpoint(endpoint)
        .with_headers(HashMap::from([("authorization".to_string(), api_key)]))
}

fn init_logs() -> Result<sdklogs::LoggerProvider, opentelemetry::logs::LogError> {
    opentelemetry_otlp::new_pipeline()
        .logging()
        .with_resource(RESOURCE.clone())
        .with_exporter(http_exporter())
        .install_batch(opentelemetry_sdk::runtime::Tokio)
}

fn init_tracer_provider() -> Result<sdktrace::TracerProvider, TraceError> {
    opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(http_exporter())
        .with_trace_config(Config::default().with_resource(RESOURCE.clone()))
        .install_batch(opentelemetry_sdk::runtime::Tokio)
}

fn init_metrics() -> Result<SdkMeterProvider, MetricsError> {
    opentelemetry_otlp::new_pipeline()
        .metrics(opentelemetry_sdk::runtime::Tokio)
        .with_exporter(http_exporter())
        .with_resource(RESOURCE.clone())
        .with_period(Duration::from_millis(250))
        .with_timeout(Duration::from_secs(10))
        .build()
}

pub fn get_meter() -> opentelemetry::metrics::Meter {
    let crate_name = std::env::var("CARGO_PKG_NAME")
        .unwrap_or(std::env::var("PROPOSALS_BIN").unwrap_or("unknown".to_string()))
        .to_string();

    global::meter(crate_name)
}

pub fn setup_tracing() -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    let tracer_provider = init_tracer_provider()?;
    global::set_tracer_provider(tracer_provider);

    let meter_provider = init_metrics()?;
    global::set_meter_provider(meter_provider);

    let logger_provider = init_logs()?;
    let layer = OpenTelemetryTracingBridge::new(&logger_provider);

    let filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new("info"))
        .unwrap()
        .add_directive("hyper=error".parse().unwrap())
        .add_directive("tonic=error".parse().unwrap())
        .add_directive("reqwest=error".parse().unwrap());

    let fmt_layer = fmt::layer()
        .with_line_number(true)
        .compact()
        .with_writer(std::io::stdout);

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .with(layer)
        .init();

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
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    global::shutdown_tracer_provider();
    // Note: You should also shut down the meter provider and logger provider here
    // if you have access to them. In this structure, you might need to store them
    // in a global state or pass them around.
}
