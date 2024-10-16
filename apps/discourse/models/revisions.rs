use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct RevisionResponse {
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
    pub can_edit: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BodyChanges {
    pub inline: String,
    pub side_by_side: String,
    pub side_by_side_markdown: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Revision {
    pub id: i32,
    pub post_id: i32,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub username: String,
    pub body_changes: String, // We'll store the inline changes as a string
    pub edit_reason: Option<String>,
}
