use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct PostActionUser {
    pub id: i32,
    pub username: String,
    pub name: Option<String>,
    pub avatar_template: String,
    pub post_url: Option<String>,
    pub username_lower: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PostLikeResponse {
    pub post_action_users: Vec<PostActionUser>,
    pub total_rows_post_action_users: Option<i32>,
}
