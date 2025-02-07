use once_cell::sync::OnceCell;
use opentelemetry::metrics::{Counter, Histogram, UpDownCounter};
use utils::tracing::get_meter;

pub static METRICS: OnceCell<Metrics> = OnceCell::new();

#[derive(Clone)]
pub struct Metrics {
    // API Metrics
    pub api_request_duration: Histogram<f64>,
    pub api_request_errors: Counter<u64>,
    pub api_total_requests: Counter<u64>,

    // Queue Metrics
    pub queue_size_normal: UpDownCounter<i64>,
    pub queue_size_priority: UpDownCounter<i64>,
    pub queue_processing_time: Histogram<f64>,
    pub queue_errors: Counter<u64>,
}

impl Metrics {
    pub fn new() -> Self {
        let meter = get_meter();

        Self {
            // Use cumulative histograms
            api_request_duration: meter
                .f64_histogram("discourse_api_request_duration_seconds")
                .with_description("Duration of API requests in seconds")
                .with_unit("seconds")
                .build(),

            api_request_errors: meter
                .u64_counter("discourse_api_request_errors_total")
                .with_description("Total number of API request errors")
                .with_unit("errors")
                .build(),

            api_total_requests: meter
                .u64_counter("discourse_api_requests_total")
                .with_description("Total number of API requests")
                .with_unit("requests")
                .build(),

            // Use gauge for current values
            queue_size_normal: meter
                .i64_up_down_counter("discourse_queue_size_normal_current")
                .with_description("Current size of the processing queue")
                .with_unit("items")
                .build(),

            queue_size_priority: meter
                .i64_up_down_counter("discourse_queue_size_priority_current")
                .with_description("Current size of the processing queue")
                .with_unit("items")
                .build(),

            queue_processing_time: meter
                .f64_histogram("discourse_queue_processing_time_seconds")
                .with_description("Time spent processing queue items in seconds")
                .with_unit("seconds")
                .build(),

            queue_errors: meter
                .u64_counter("discourse_queue_errors_total")
                .with_description("Total number of queue processing errors")
                .with_unit("errors")
                .build(),
        }
    }

    pub fn init() -> &'static Self {
        METRICS.get_or_init(|| Metrics::new())
    }
}
