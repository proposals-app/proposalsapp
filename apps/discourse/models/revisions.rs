use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
    pub fn get_cooked_before(&self) -> String {
        // Start with the current text
        let mut content = self.body_changes.inline.clone();

        // Remove all insertions (content that was added in this revision)
        while let Some(start) = content.find("<ins>") {
            if let Some(end) = content[start..].find("</ins>") {
                content.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        // Keep deletions but remove the tags
        content = content
            .replace("<del>", "")
            .replace("</del>", "")
            .replace("diff-del", "")
            .trim()
            .to_string();

        // Clean up any residual HTML comments or extra whitespace
        content = content
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "")
            .trim()
            .to_string();

        content
    }

    pub fn get_cooked_after(&self) -> String {
        // Start with the current text
        let mut content = self.body_changes.inline.clone();

        // Remove all deletions (content that was removed in this revision)
        while let Some(start) = content.find("<del>") {
            if let Some(end) = content[start..].find("</del>") {
                content.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        // Keep insertions but remove the tags
        content = content
            .replace("<ins>", "")
            .replace("</ins>", "")
            .replace("diff-ins", "")
            .trim()
            .to_string();

        // Clean up any residual HTML comments or extra whitespace
        content = content
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "")
            .trim()
            .to_string();

        content
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BodyChanges {
    pub inline: String,
    pub side_by_side: String,
    pub side_by_side_markdown: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TitleChanges {
    pub inline: String,
}

impl TitleChanges {
    pub fn get_cooked_before(&self) -> String {
        // Similar logic for title changes
        let mut content = self.inline.clone();

        while let Some(start) = content.find("<ins>") {
            if let Some(end) = content[start..].find("</ins>") {
                content.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        content = content
            .replace("<del>", "")
            .replace("</del>", "")
            .replace("diff-del", "")
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "")
            .trim()
            .to_string();

        content
    }

    pub fn get_cooked_after(&self) -> String {
        // Similar logic for title changes
        let mut content = self.inline.clone();

        while let Some(start) = content.find("<del>") {
            if let Some(end) = content[start..].find("</del>") {
                content.replace_range(start..start + end + 6, "");
            } else {
                break;
            }
        }

        content = content
            .replace("<ins>", "")
            .replace("</ins>", "")
            .replace("diff-ins", "")
            .replace(r#"<div class="inline-diff">"#, "")
            .replace("</div>", "")
            .trim()
            .to_string();

        content
    }
}
