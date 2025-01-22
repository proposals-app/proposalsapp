use opentelemetry::metrics::{Counter, Histogram, UpDownCounter};
use utils::tracing::get_meter;

#[derive(Clone)]
pub struct Metrics {
    // Database Metrics
    pub db_query_duration: Histogram<f64>,
    pub db_query_errors: Counter<u64>,

    pub db_inserts: Counter<u64>,
    pub db_updates: Counter<u64>,

    // API Metrics
    pub api_request_duration: Histogram<f64>,
    pub api_request_errors: Counter<u64>,
    pub api_total_requests: Counter<u64>,

    // Queue Metrics
    pub queue_size: UpDownCounter<i64>,
    pub queue_processing_time: Histogram<f64>,
    pub queue_errors: Counter<u64>,
}

impl Metrics {
    pub fn new() -> Self {
        let meter = get_meter();

        Self {
            db_query_duration: meter
                .f64_histogram("discourse_db_query_duration_seconds")
                .with_description("Duration of database queries in seconds")
                .build(),
            db_query_errors: meter
                .u64_counter("discourse_db_query_errors_total")
                .with_description("Total number of database query errors")
                .build(),

            db_inserts: meter
                .u64_counter("discourse_db_inserts_total")
                .with_description("Total number of database inserts")
                .build(),
            db_updates: meter
                .u64_counter("discourse_db_updates_total")
                .with_description("Total number of database updates")
                .build(),

            api_request_duration: meter
                .f64_histogram("discourse_api_request_duration_seconds")
                .with_description("Duration of API requests in seconds")
                .build(),
            api_request_errors: meter
                .u64_counter("discourse_api_request_errors_total")
                .with_description("Total number of API request errors")
                .build(),
            api_total_requests: meter
                .u64_counter("discourse_api_requests_total")
                .with_description("Total number of API requests")
                .build(),

            queue_size: meter
                .i64_up_down_counter("discourse_queue_size")
                .with_description("Current size of the processing queue")
                .build(),
            queue_processing_time: meter
                .f64_histogram("discourse_queue_processing_time_seconds")
                .with_description("Time spent processing queue items in seconds")
                .build(),
            queue_errors: meter
                .u64_counter("discourse_queue_errors_total")
                .with_description("Total number of queue processing errors")
                .build(),
        }
    }
}
