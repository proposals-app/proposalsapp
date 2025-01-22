use opentelemetry::metrics::{Counter, Histogram, UpDownCounter};
use utils::tracing::get_meter;

#[derive(Clone)]
pub struct Metrics {
    // Database Metrics
    pub db_query_duration: Histogram<f64>,
    pub db_inserts: Counter<u64>,
    pub db_updates: Counter<u64>,

    // Job Processing Metrics
    pub job_processing_duration: Histogram<f64>,
    pub job_processing_errors: Counter<u64>,
    pub job_queue_size: UpDownCounter<i64>,
    pub job_processed_total: Counter<u64>,

    // Karma Metrics
    pub karma_fetch_duration: Histogram<f64>,
    pub karma_fetch_errors: Counter<u64>,
    pub karma_delegates_processed: Counter<u64>,
}

impl Metrics {
    pub fn new() -> Self {
        let meter = get_meter();

        Self {
            db_query_duration: meter
                .f64_histogram("mapper_db_query_duration_seconds")
                .with_description("Duration of database queries in seconds")
                .with_unit("seconds")
                .build(),

            db_inserts: meter
                .u64_counter("mapper_db_inserts_total")
                .with_description("Total number of database inserts")
                .with_unit("operations")
                .build(),

            db_updates: meter
                .u64_counter("mapper_db_updates_total")
                .with_description("Total number of database updates")
                .with_unit("operations")
                .build(),

            job_processing_duration: meter
                .f64_histogram("mapper_job_processing_duration_seconds")
                .with_description("Duration of job processing in seconds")
                .with_unit("seconds")
                .build(),

            job_processing_errors: meter
                .u64_counter("mapper_job_processing_errors_total")
                .with_description("Total number of job processing errors")
                .with_unit("errors")
                .build(),

            job_queue_size: meter
                .i64_up_down_counter("mapper_job_queue_size_current")
                .with_description("Current size of the job queue")
                .with_unit("items")
                .build(),

            job_processed_total: meter
                .u64_counter("mapper_jobs_processed_total")
                .with_description("Total number of jobs processed")
                .with_unit("jobs")
                .build(),

            karma_fetch_duration: meter
                .f64_histogram("mapper_karma_fetch_duration_seconds")
                .with_description("Duration of Karma data fetching in seconds")
                .with_unit("seconds")
                .build(),

            karma_fetch_errors: meter
                .u64_counter("mapper_karma_fetch_errors_total")
                .with_description("Total number of Karma fetch errors")
                .with_unit("errors")
                .build(),

            karma_delegates_processed: meter
                .u64_counter("mapper_karma_delegates_processed_total")
                .with_description("Total number of Karma delegates processed")
                .with_unit("delegates")
                .build(),
        }
    }
}
