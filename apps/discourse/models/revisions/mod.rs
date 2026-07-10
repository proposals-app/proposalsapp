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
    /// Visibility-only revisions have no content diff but still advance the
    /// provider's revision chain.
    pub body_changes: Option<BodyChanges>,
    pub title_changes: Option<TitleChanges>,
    pub can_edit: bool,
}

impl Revision {
    pub fn get_cooked_markdown_before(&self) -> String {
        self.body_changes
            .as_ref()
            .and_then(|changes| {
                markdown_changes::extract_before_content_markdown(&changes.side_by_side_markdown)
                    .ok()
            })
            .unwrap_or_default()
    }

    pub fn get_cooked_markdown_after(&self) -> String {
        self.body_changes
            .as_ref()
            .and_then(|changes| {
                markdown_changes::extract_after_content_markdown(&changes.side_by_side_markdown)
                    .ok()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::Revision;

    #[test]
    fn deserializes_visibility_only_revision() {
        let revision: Revision = serde_json::from_str(
            r#"{
                "created_at":"2026-06-24T20:06:26.747Z",
                "post_id":77077,
                "previous_hidden":true,
                "current_hidden":false,
                "first_revision":3,
                "previous_revision":null,
                "current_revision":3,
                "next_revision":4,
                "last_revision":5,
                "current_version":2,
                "version_count":4,
                "username":"opco",
                "display_username":"OpCo",
                "avatar_template":"/user_avatar/opco/{size}/15563_2.png",
                "edit_reason":null,
                "body_changes":null,
                "title_changes":null,
                "can_edit":false
            }"#,
        )
        .expect("visibility-only revision should deserialize");

        assert!(revision.body_changes.is_none());
        assert_eq!(revision.current_revision, 3);
        assert_eq!(revision.current_version, 2);
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
