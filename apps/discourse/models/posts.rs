use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Post {
    pub id: i32,
    pub name: Option<String>,
    pub username: String,
    pub avatar_template: String,
    #[serde(with = "date_format")]
    pub created_at: DateTime<Utc>,
    pub cooked: String,
    pub post_number: i32,
    pub post_type: i32,
    #[serde(with = "date_format")]
    pub updated_at: DateTime<Utc>,
    pub reply_count: i32,
    pub reply_to_post_number: Option<i32>,
    pub quote_count: i32,
    pub incoming_link_count: i32,
    pub reads: i32,
    pub readers_count: i32,
    pub score: f64,
    pub topic_id: i32,
    pub topic_slug: String,
    pub display_username: Option<String>,
    pub primary_group_name: Option<String>,
    pub flair_name: Option<String>,
    pub flair_url: Option<String>,
    pub flair_bg_color: Option<String>,
    pub flair_color: Option<String>,
    pub version: i32,
    pub user_id: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PostResponse {
    pub post_stream: PostStream,
    pub posts_count: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PostStream {
    pub posts: Vec<Post>,
}

mod date_format {
    use chrono::{DateTime, Utc};
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(date: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&date.to_rfc3339())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        DateTime::parse_from_rfc3339(&s)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(serde::de::Error::custom)
    }
}
