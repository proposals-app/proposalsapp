use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct CategoryResponse {
    pub category_list: CategoryList,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CategoryList {
    pub categories: Vec<Category>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Category {
    pub id: i32,
    pub name: String,
    pub color: String,
    pub text_color: String,
    pub slug: String,
    pub topic_count: i32,
    pub post_count: i32,
    pub description: Option<String>,
    pub description_text: Option<String>,
    pub topics_day: Option<i32>,
    pub topics_week: Option<i32>,
    pub topics_month: Option<i32>,
    pub topics_year: Option<i32>,
    pub topics_all_time: Option<i32>,
}
