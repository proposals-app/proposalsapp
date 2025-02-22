use self::rindexer_lib::indexers::all_handlers::register_all_handlers;
use dotenv::dotenv;
use extensions::db_extension::initialize_db;
use rindexer::{start_rindexer, GraphqlOverrideSettings, IndexingDetails, StartDetails};
use std::env;
use utils::tracing::setup_otel;
mod extensions;
mod rindexer_lib;
use anyhow::{Context, Result};

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let _otel = setup_otel()
        .await
        .context("Failed to setup OpenTelemetry")?;

    initialize_db()
        .await
        .context("Failed to initialize database")?;

    let args: Vec<String> = env::args().collect();

    let mut enable_graphql = false;
    let mut enable_indexer = false;

    let mut port: Option<u16> = None;

    let args_iter = args.iter();
    if args.len() == 1 {
        enable_graphql = true;
        enable_indexer = true;
    }

    for arg in args_iter {
        match arg.as_str() {
            "--graphql" => enable_graphql = true,
            "--indexer" => enable_indexer = true,
            _ if arg.starts_with("--port=") || arg.starts_with("--p") => {
                if let Some(value) = arg.split('=').nth(1) {
                    let overridden_port = value
                        .parse::<u16>()
                        .context("Invalid port number provided")?;
                    port = Some(overridden_port);
                }
            }
            _ => {}
        }
    }

    let path = env::current_dir().context("Failed to get current directory")?;
    let manifest_path = path.join("rindexer.yaml");

    start_rindexer(StartDetails {
        manifest_path: &manifest_path,
        indexing_details: if enable_indexer {
            Some(IndexingDetails {
                registry: register_all_handlers(&manifest_path).await,
            })
        } else {
            None
        },
        graphql_details: GraphqlOverrideSettings {
            enabled: enable_graphql,
            override_port: port,
        },
    })
    .await
    .context("Failed to start rindexer")?;

    Ok(())
}
