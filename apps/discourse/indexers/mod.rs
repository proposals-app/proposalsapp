pub mod categories;
pub mod likes;
pub mod posts;
pub mod revisions;
pub mod topics;
pub mod users;

use tracing::{error, warn};

pub(crate) struct PageCursor {
    page: u32,
    max_pages: u32,
}

impl PageCursor {
    pub(crate) fn new(max_pages: u32) -> Self {
        Self { page: 0, max_pages }
    }

    pub(crate) fn page(&self) -> u32 {
        self.page
    }

    pub(crate) fn advance(&mut self, context: &str) -> bool {
        if self.page >= self.max_pages {
            error!(
                page = self.page,
                max_pages = self.max_pages,
                context,
                "Reached maximum page limit. Stopping pagination."
            );
            return false;
        }

        self.page += 1;
        true
    }
}

pub(crate) fn handle_join_result(
    result: std::result::Result<anyhow::Result<()>, tokio::task::JoinError>,
    task_name: &str,
) {
    match result {
        Ok(Ok(())) => { /* Task completed successfully */ }
        Ok(Err(e)) => {
            warn!(error = ?e, task = task_name, "Async task failed.");
        }
        Err(e) => {
            error!(error = ?e, task = task_name, "Async task panicked or was cancelled.");
        }
    }
}
