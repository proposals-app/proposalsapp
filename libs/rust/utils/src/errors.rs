//env
pub const DATABASE_URL_NOT_SET: &str = "DATABASE_URL not set!";
pub const ETHEREUM_NODE_URL_NOT_SET: &str = "ETHEREUM_NODE_URL not set!";
pub const ETHERSCAN_API_KEY_NOT_SET: &str = "ETHERSCAN_API_KEY not set!";
pub const ARBITRUM_NODE_URL_NOT_SET: &str = "ARBITRUM_NODE_URL not set!";
pub const ARBISCAN_API_KEY_NOT_SET: &str = "ARBISCAN_API_KEY not set!";
pub const OPTIMISM_NODE_URL_NOT_SET: &str = "OPTIMISM_NODE_URL not set!";
pub const OPTIMISTIC_SCAN_API_KEY_NOT_SET: &str = "OPTIMISTIC_SCAN_API_KEY not set!";
pub const AVALANCHE_NODE_URL_NOT_SET: &str = "AVALANCHE_NODE_URL not set!";
pub const POLYGON_NODE_URL_NOT_SET: &str = "POLYGON_NODE_URL not set!";

//db
pub const DATABASE_CONNECTION_FAILED: &str = "Failed to connect to database";
pub const DATABASE_ERROR: &str = "Database error";
pub const DB_TRANSACTION_BEGIN_FAILED: &str = "Failed to begin database transaction";
pub const DB_TRANSACTION_COMMIT_FAILED: &str = "Failed to commit database transaction";

pub const PRODUCE_JOBS_FAILED: &str = "Failed to produce jobs";
pub const PUBLISH_JOB_FAILED: &str = "Failed to publish job";
pub const PARSE_JOB_FAILED: &str = "Failed to parse job";
pub const DESERIALIZE_JOB_FAILED: &str = "Failed to deserialize job";

pub const JOB_ACK_FAILED: &str = "Failed to ack job";
pub const JOB_NACK_FAILED: &str = "Failed to nack job";

//detective
pub const INCREASE_REFRESH_SPEED_FAILED: &str = "Failed to increase refresh speed";
pub const DECREASE_REFRESH_SPEED_FAILED: &str = "Failed to decrease refresh speed";

pub const DAOHANDLER_NOT_FOUND_ERROR: &str = "DAOHandler not found";
pub const PROPOSAL_NOT_FOUND_ERROR: &str = "Proposal not found";
pub const VOTER_NOT_FOUND_ERROR: &str = "Voter not found";

pub const DATABASE_FETCH_DAO_HANDLERS_FAILED: &str = "Failed to fetch DAO handlers from database";
pub const DATABASE_FETCH_PROPOSALS_FAILED: &str = "Failed to fetch proposals from database";

pub const SANITIZE_FAILED: &str = "Failed to sanitize";
