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
        // Helper function to extract text content before revision
        let body_before = self
            .body_changes
            .inline
            .split("<ins>")
            .map(|part| part.split("</ins>").last().unwrap_or(""))
            .collect::<Vec<&str>>()
            .join("");

        // Remove deletion markers
        body_before
            .replace("<del>", "")
            .replace("</del>", "")
            .replace("diff-del", "")
            .trim()
            .to_string()
    }

    pub fn get_cooked_after(&self) -> String {
        // Helper function to extract text content after revision
        let body_after = self
            .body_changes
            .inline
            .split("<del>")
            .map(|part| part.split("</del>").last().unwrap_or(""))
            .collect::<Vec<&str>>()
            .join("");

        // Remove insertion markers
        body_after
            .replace("<ins>", "")
            .replace("</ins>", "")
            .replace("diff-ins", "")
            .trim()
            .to_string()
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
        // Helper function to extract text content before revision
        let title_before = self
            .inline
            .split("<ins>")
            .map(|part| part.split("</ins>").last().unwrap_or(""))
            .collect::<Vec<&str>>()
            .join("");

        // Remove deletion markers
        title_before
            .replace("<del>", "")
            .replace("</del>", "")
            .replace("diff-del", "")
            .trim()
            .to_string()
    }

    pub fn get_cooked_after(&self) -> String {
        // Helper function to extract text content after revision
        let title_after = self
            .inline
            .split("<del>")
            .map(|part| part.split("</del>").last().unwrap_or(""))
            .collect::<Vec<&str>>()
            .join("");

        // Remove insertion markers
        title_after
            .replace("<ins>", "")
            .replace("</ins>", "")
            .replace("diff-ins", "")
            .trim()
            .to_string()
    }
}
