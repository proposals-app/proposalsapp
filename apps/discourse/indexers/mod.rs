pub mod categories;
pub mod likes;
pub mod posts;
pub mod revisions;
pub mod topics;
pub mod users;

use anyhow::{Context, Result, bail};

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

    pub(crate) fn advance(&mut self, context: &str) -> Result<()> {
        if self.page + 1 >= self.max_pages {
            bail!(
                "Reached the maximum of {} pages while indexing {context}",
                self.max_pages
            );
        }

        self.page += 1;
        Ok(())
    }
}

pub(crate) fn handle_join_result(
    result: std::result::Result<anyhow::Result<()>, tokio::task::JoinError>,
    task_name: &str,
) -> Result<()> {
    match result {
        Ok(result) => result.with_context(|| format!("{task_name} failed")),
        Err(error) => Err(error).with_context(|| format!("{task_name} panicked or was cancelled")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_cursor_enforces_total_page_limit() {
        let mut cursor = PageCursor::new(2);
        assert_eq!(cursor.page(), 0);
        cursor.advance("test pages").unwrap();
        assert_eq!(cursor.page(), 1);
        assert!(cursor.advance("test pages").is_err());
    }
}
