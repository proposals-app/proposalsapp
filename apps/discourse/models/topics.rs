use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct TopicResponse {
    pub topic_list: TopicList,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TopicList {
    pub topics: Vec<Topic>,
    pub per_page: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Topic {
    pub id: i32,
    pub title: String,
    pub fancy_title: String,
    pub slug: String,
    pub posts_count: i32,
    pub reply_count: i32,
    #[serde(with = "date_format")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "date_format")]
    pub last_posted_at: DateTime<Utc>,
    pub bumped: bool,
    #[serde(with = "date_format")]
    pub bumped_at: DateTime<Utc>,
    pub pinned: bool,
    pub visible: bool,
    pub closed: bool,
    pub archived: bool,
    pub liked: Option<bool>,
    pub views: i32,
    pub like_count: i32,
    pub category_id: i32,
    pub pinned_globally: bool,
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
