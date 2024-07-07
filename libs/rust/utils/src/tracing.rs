use futures::{Future, FutureExt};
use opentelemetry::{global, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    logs::Config, propagation::TraceContextPropagator, runtime::Tokio, trace, Resource,
};
use std::collections::HashMap;
use tracing::error;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

const OTLP_ADDRESS: &str = "http://localhost:4318";
const API_KEY: &str = "c7121264-3701-4875-8ff8-e555643715a9";

pub fn setup_tracing() {
    global::set_text_map_propagator(TraceContextPropagator::new());

    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new("info"))
        .unwrap();

    let fmt_layer = fmt::layer().with_line_number(true).compact();

    let otlp_address = std::env::var("OTLP_ADDRESS").unwrap_or(OTLP_ADDRESS.into());

    let crate_name = std::env::var("CARGO_PKG_NAME").unwrap().to_string();

    let resources = vec![KeyValue::new("service.name", crate_name.to_lowercase())];

    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .http()
                .with_endpoint(otlp_address.clone())
                .with_headers(HashMap::from([(
                    "authorization".to_string(),
                    API_KEY.to_string(),
                )])),
        )
        .with_trace_config(trace::config().with_resource(Resource::new(resources.clone())))
        .install_batch(Tokio)
        .unwrap();

    let otel_layer = tracing_opentelemetry::layer()
        .with_error_fields_to_exceptions(true)
        .with_error_events_to_exceptions(true)
        .with_error_records_to_exceptions(true)
        .with_location(true)
        .with_tracer(tracer);

    let logs = opentelemetry_otlp::new_pipeline()
        .logging()
        .with_log_config(Config::default().with_resource(Resource::new(resources.clone())))
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .http()
                .with_endpoint(otlp_address)
                .with_headers(HashMap::from([(
                    "authorization".to_string(),
                    API_KEY.to_string(),
                )])),
        )
        .install_batch(Tokio)
        .unwrap();

    let appender_tracing_layer = OpenTelemetryTracingBridge::new(&logs.provider().unwrap());

    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .with(appender_tracing_layer)
        .with(otel_layer)
        .init();
}
pub async fn run_with_tracing<F, Fut>(future: F)
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<(), anyhow::Error>> + Send + 'static,
{
    setup_tracing();

    // Wrap the async block in a catch_unwind
    let result = std::panic::AssertUnwindSafe(future()).catch_unwind().await;

    if let Err(e) = result {
        capture_panic_details(e);
    }

    shutdown_tracing().await;
}

fn capture_panic_details(e: Box<dyn std::any::Any + Send>) {
    let backtrace = backtrace::Backtrace::new();
    if let Some(s) = e.downcast_ref::<&str>() {
        error!(panic_message = *s, backtrace = ?backtrace, "Panic occurred with message");
    } else if let Some(s) = e.downcast_ref::<String>() {
        error!(panic_message = s, backtrace = ?backtrace, "Panic occurred with message");
    } else {
        error!(backtrace = ?backtrace, "Panic occurred but the payload is not a string");
    }
}

pub async fn shutdown_tracing() {
    // Delay to allow logs to be sent before shutting down
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    opentelemetry::global::shutdown_tracer_provider();
}
