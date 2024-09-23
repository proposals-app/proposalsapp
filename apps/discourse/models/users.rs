use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct UserDetailResponse {
    pub user: UserDetail,
}

#[derive(Debug, Deserialize)]
pub struct UserDetail {
    pub id: i32,
    pub username: String,
    pub name: Option<String>,
    pub avatar_template: String,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub name: Option<String>,
    pub avatar_template: String,
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub likes_received: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub likes_given: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topics_entered: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posts_read: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_visited: Option<u64>,
}

/// Represents an item in the directory, including user statistics.
#[derive(Debug, Deserialize, Serialize)]
pub struct DirectoryItem {
    pub id: u64,
    pub likes_received: Option<u64>,
    pub likes_given: Option<u64>,
    pub topics_entered: Option<u64>,
    pub topic_count: Option<u64>,
    pub post_count: Option<u64>,
    pub posts_read: Option<u64>,
    pub days_visited: Option<u64>,
    pub user: User,
}

/// Contains metadata about the directory response.
#[derive(Debug, Deserialize, Serialize)]
pub struct Meta {
    pub last_updated_at: String,
    pub total_rows_directory_items: u64,
    pub load_more_directory_items: Option<String>,
}

/// Represents the response from the directory_items endpoint.
#[derive(Debug, Deserialize, Serialize)]
pub struct UserResponse {
    pub directory_items: Vec<DirectoryItem>,
    pub meta: Meta,
}
