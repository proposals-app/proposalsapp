pub mod db_handler;
pub mod discourse_api;
pub mod indexers;
pub mod models;

pub const MAX_PAGES_PER_RUN: u32 = 1000; // Safety break for pagination loops
pub const RECENT_LOOKBACK_HOURS: i64 = 2; // How far back to look for "recent" items
