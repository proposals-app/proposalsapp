use anyhow::Result;
use once_cell::sync::OnceCell;
use serde::Deserialize;
use std::{collections::HashMap, env, fs};
use tracing::{info, warn};

pub static CONFIG: OnceCell<MapperConfig> = OnceCell::new();

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct MapperConfig {
    pub grouping: GroupingConfig,
    pub karma: KarmaConfig,
    pub semantic: SemanticConfig,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct GroupingConfig {
    pub dao_discourse_category_filters: HashMap<String, Vec<i32>>,
}

impl Default for GroupingConfig {
    fn default() -> Self {
        let mut dao_discourse_category_filters = HashMap::new();
        dao_discourse_category_filters.insert("arbitrum".to_string(), vec![7, 8, 9]);
        dao_discourse_category_filters.insert("uniswap".to_string(), vec![5, 8, 9, 10]);
        Self {
            dao_discourse_category_filters,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct KarmaConfig {
    pub dao_slug_to_karma_name: HashMap<String, String>,
}

impl Default for KarmaConfig {
    fn default() -> Self {
        let mut dao_slug_to_karma_name = HashMap::new();
        dao_slug_to_karma_name.insert("arbitrum".to_string(), "arbitrum".to_string());
        Self {
            dao_slug_to_karma_name,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SemanticConfig {
    pub similarity_threshold: Option<f32>,
}

pub fn load() -> Result<()> {
    let config = load_config();
    CONFIG
        .set(config)
        .map_err(|_| anyhow::anyhow!("Mapper config already initialized"))?;
    Ok(())
}

pub fn get_config() -> &'static MapperConfig {
    CONFIG.get().expect("Mapper config not initialized")
}

fn load_config() -> MapperConfig {
    let path = env::var("MAPPER_CONFIG_PATH").unwrap_or_else(|_| "mapper.yaml".to_string());
    let mut config = match fs::read_to_string(&path) {
        Ok(contents) => match serde_yaml::from_str::<MapperConfig>(&contents) {
            Ok(config) => config,
            Err(err) => {
                warn!(error = %err, path = %path, "Failed to parse mapper config, using defaults");
                MapperConfig::default()
            }
        },
        Err(err) => {
            warn!(error = %err, path = %path, "Mapper config not found, using defaults");
            MapperConfig::default()
        }
    };

    apply_env_overrides(&mut config);

    info!(
        dao_filters = config.grouping.dao_discourse_category_filters.len(),
        karma_mappings = config.karma.dao_slug_to_karma_name.len(),
        semantic_threshold = config.semantic.similarity_threshold,
        "Mapper config loaded"
    );

    config
}

fn apply_env_overrides(config: &mut MapperConfig) {
    if let Ok(value) = env::var("MAPPER_DAO_CATEGORY_FILTERS") {
        match serde_json::from_str::<HashMap<String, Vec<i32>>>(&value) {
            Ok(map) => {
                config.grouping.dao_discourse_category_filters = map;
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "Failed to parse MAPPER_DAO_CATEGORY_FILTERS override"
                );
            }
        }
    }

    if let Ok(value) = env::var("MAPPER_KARMA_DAO_MAP") {
        match serde_json::from_str::<HashMap<String, String>>(&value) {
            Ok(map) => {
                config.karma.dao_slug_to_karma_name = map;
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "Failed to parse MAPPER_KARMA_DAO_MAP override"
                );
            }
        }
    }

    if let Ok(value) = env::var("SEMANTIC_SIMILARITY_THRESHOLD") {
        match value.parse::<f32>() {
            Ok(threshold) => {
                config.semantic.similarity_threshold = Some(threshold);
            }
            Err(err) => {
                warn!(
                    error = %err,
                    "Failed to parse SEMANTIC_SIMILARITY_THRESHOLD override"
                );
            }
        }
    }
}
