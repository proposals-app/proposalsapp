use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

mod inline_changes;
mod markdown_changes;

#[derive(Debug, Deserialize, Serialize)]
pub struct BodyChanges {
    pub inline: String,
    pub side_by_side: String,
    pub side_by_side_markdown: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Revision {
    pub created_at: DateTime<Utc>,
    pub post_id: i32,
    pub previous_hidden: bool,
    pub current_hidden: bool,
    pub first_revision: i32,
    pub previous_revision: Option<i32>,
    pub current_revision: i32,
    pub next_revision: Option<i32>,
    pub last_revision: i32,
    pub current_version: i32,
    pub version_count: i32,
    pub username: String,
    pub display_username: String,
    pub avatar_template: String,
    pub edit_reason: Option<String>,
    pub body_changes: BodyChanges,
    pub title_changes: Option<TitleChanges>,
    pub can_edit: bool,
}

impl Revision {
    pub fn get_cooked_markdown_before(&self) -> String {
        let content = self.body_changes.side_by_side_markdown.clone();
        markdown_changes::extract_before_content_markdown(&content).unwrap_or_default()
    }

    pub fn get_cooked_markdown_after(&self) -> String {
        let content = self.body_changes.side_by_side_markdown.clone();
        markdown_changes::extract_after_content_markdown(&content).unwrap_or_default()
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TitleChanges {
    pub inline: String,
}

impl TitleChanges {
    pub fn get_cooked_before_html(&self) -> String {
        inline_changes::extract_before_content_inline(&self.inline).unwrap_or_default()
    }

    pub fn get_cooked_after_html(&self) -> String {
        inline_changes::extract_after_content_inline(&self.inline).unwrap_or_default()
    }
}
