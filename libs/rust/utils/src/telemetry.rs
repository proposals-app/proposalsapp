use std::env;
use tracing::Level;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{filter::Targets, layer::SubscriberExt};

pub fn setup_telemetry() {
    env::set_var("RUST_BACKTRACE", "full");

    let filter = Targets::new()
        .with_target("proposals_consumer", Level::INFO)
        .with_target("proposals_producer", Level::INFO)
        .with_target("votes_consumer", Level::INFO)
        .with_target("votes_producer", Level::INFO)
        .with_target("seed", Level::INFO);

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .compact()
                .with_level(false)
                .with_ansi(false)
                .with_file(false)
                .with_line_number(false)
                .without_time()
                .with_target(false),
        )
        .with(filter)
        .init();
}
