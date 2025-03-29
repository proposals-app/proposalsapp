pub mod categories;
pub mod likes;
pub mod posts;
pub mod revisions;
pub mod topics;
pub mod users;

// Shared constants for indexers
pub(crate) const MAX_PAGES_PER_RUN: u32 = 1000; // Safety break for pagination loops
pub(crate) const RECENT_LOOKBACK_HOURS: i64 = 2; // How far back to look for "recent" items
