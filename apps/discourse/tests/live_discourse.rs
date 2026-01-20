use anyhow::{Context, Result, anyhow, ensure};
use discourse::db_handler::{
    initialize_db, upsert_category, upsert_post, upsert_post_likes_batch, upsert_revision,
    upsert_topic, upsert_user,
};
use discourse::discourse_api::DiscourseApi;
use discourse::models::{
    categories::CategoryResponse,
    likes::PostLikeResponse,
    posts::{Post, PostResponse},
    revisions::Revision,
    topics::TopicResponse,
    users::{User, UserDetailResponse, UserResponse},
};
use once_cell::sync::Lazy;
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_category, discourse_post, discourse_post_like,
    discourse_post_revision, discourse_topic, discourse_user,
};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set, prelude::Uuid};
use serde_json::Value;
use serial_test::serial;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use testcontainers::{
    ContainerAsync, GenericImage, ImageExt,
    core::{IntoContainerPort, WaitFor},
    runners::AsyncRunner,
};
use tokio::runtime::{Builder, Runtime};
use tokio::sync::OnceCell;

const DEFAULT_BASE_URL: &str = "https://meta.discourse.org";
const ABOUT_ENDPOINT: &str = "/about.json";
const DIRECTORY_ENDPOINT: &str = "/directory_items.json?page=0&order=username&period=all&asc=true";
const LATEST_ENDPOINT: &str = "/latest.json?order=activity";
const LATEST_POSTS_ENDPOINT: &str = "/posts.json";
const LIKE_ACTION_ID: u64 = 2;
const MAX_TOPIC_SCAN: usize = 5;
const MAX_POSTS_PER_TOPIC: usize = 5;
const MAX_CATEGORIES: usize = 10;
const MAX_USERS: usize = 10;

const POSTGRES_IMAGE: &str = "pgvector/pgvector";
const POSTGRES_TAG: &str = "pg16";
const POSTGRES_PORT: u16 = 5432;
const POSTGRES_USER: &str = "postgres";
const POSTGRES_PASSWORD: &str = "postgres";
const POSTGRES_DB: &str = "proposalsapp_test";

struct SeedData {
    dao_discourse_id: Uuid,
}

struct TestContext {
    db: DatabaseConnection,
    dao_discourse_id: Uuid,
    _container: ContainerAsync<GenericImage>,
}
static DOCKER_AVAILABLE: Lazy<bool> = Lazy::new(|| {
    Command::new("docker")
        .arg("info")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
});
static TEST_RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime")
});
static TEST_CONTEXT: OnceCell<TestContext> = OnceCell::const_new();

fn live_tests_enabled() -> bool {
    env::var("DISCOURSE_LIVE_TESTS").is_ok()
}

fn live_base_url() -> String {
    env::var("DISCOURSE_LIVE_BASE_URL")
        .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn like_count(post: &Post) -> u64 {
    post.actions_summary
        .iter()
        .find(|summary| summary.id == LIKE_ACTION_ID)
        .map(|summary| summary.count)
        .unwrap_or(0)
}

async fn test_context() -> Result<&'static TestContext> {
    let context = TEST_CONTEXT
        .get_or_init(|| async {
            init_context()
                .await
                .expect("failed to initialize live test context")
        })
        .await;

    Ok(context)
}

async fn init_context() -> Result<TestContext> {
    let container = GenericImage::new(POSTGRES_IMAGE, POSTGRES_TAG)
        .with_exposed_port(POSTGRES_PORT.tcp())
        .with_wait_for(WaitFor::message_on_stdout(
            "database system is ready to accept connections",
        ))
        .with_env_var("POSTGRES_PASSWORD", POSTGRES_PASSWORD)
        .with_env_var("POSTGRES_USER", POSTGRES_USER)
        .with_env_var("POSTGRES_DB", POSTGRES_DB)
        .start()
        .await
        .context("failed to start postgres container")?;

    let host = "127.0.0.1";
    let port = container.get_host_port_ipv4(POSTGRES_PORT).await?;
    let database_url =
        format!("postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{host}:{port}/{POSTGRES_DB}");

    run_migrations(&database_url).context("failed running migrations")?;

    unsafe {
        std::env::set_var("DATABASE_URL", &database_url);
    }
    initialize_db().await.context("failed to initialize DB")?;

    let db = discourse::db_handler::db().clone();
    let SeedData { dao_discourse_id } = seed_discourse(&db, &live_base_url()).await?;

    Ok(TestContext {
        db,
        dao_discourse_id,
        _container: container,
    })
}

fn repo_root() -> Result<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir
        .parent()
        .and_then(|parent| parent.parent())
        .context("failed to resolve repo root")?;
    Ok(root.to_path_buf())
}

fn run_db_command(root: &Path, database_url: &str, args: &[&str]) -> Result<()> {
    let status = Command::new("pnpm")
        .args(args)
        .current_dir(root)
        .env("DATABASE_URL", database_url)
        .status()
        .context("failed to run pnpm command")?;

    if !status.success() {
        return Err(anyhow!(
            "pnpm {:?} failed with status {:?}",
            args,
            status.code()
        ));
    }

    Ok(())
}

fn has_seed_files(root: &Path) -> bool {
    let seeds_dir = root.join("libs/ts/db/seeds");
    let entries = match fs::read_dir(seeds_dir) {
        Ok(entries) => entries,
        Err(_) => return false,
    };

    entries
        .flatten()
        .any(|entry| entry.path().extension().is_some_and(|ext| ext == "ts"))
}

fn run_migrations(database_url: &str) -> Result<()> {
    let root = repo_root()?;

    run_db_command(
        &root,
        database_url,
        &["--filter", "@proposalsapp/db", "db:migrate"],
    )?;

    if has_seed_files(&root) {
        run_db_command(
            &root,
            database_url,
            &["--filter", "@proposalsapp/db", "db:seed"],
        )?;
    }

    Ok(())
}

async fn seed_discourse(db: &DatabaseConnection, base_url: &str) -> Result<SeedData> {
    let dao_id = Uuid::from_u128(1);
    let dao_discourse_id = Uuid::from_u128(2);

    let dao_model = dao::ActiveModel {
        id: Set(dao_id),
        name: Set("Live Test DAO".to_string()),
        slug: Set("live-test-dao".to_string()),
        picture: Set("https://example.com/dao.png".to_string()),
    };

    dao::Entity::insert(dao_model)
        .exec(db)
        .await
        .context("failed to insert dao")?;

    let dao_discourse_model = dao_discourse::ActiveModel {
        id: Set(dao_discourse_id),
        dao_id: Set(dao_id),
        discourse_base_url: Set(base_url.to_string()),
    };

    dao_discourse::Entity::insert(dao_discourse_model)
        .exec(db)
        .await
        .context("failed to insert dao_discourse")?;

    Ok(SeedData { dao_discourse_id })
}

#[test]
#[serial]
#[ignore]
fn live_discourse_endpoints() -> Result<()> {
    if !live_tests_enabled() {
        eprintln!("Set DISCOURSE_LIVE_TESTS=1 to run live Discourse tests.");
        return Ok(());
    }

    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping live Discourse test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;
        let dao_discourse_id = context.dao_discourse_id;
        let db = &context.db;

        let base_url = live_base_url();
        let api = DiscourseApi::new(base_url);

        let about: Value = api
            .queue(ABOUT_ENDPOINT, true)
            .await
            .context("fetch about")?;
        ensure!(
            about.get("about").is_some(),
            "about response missing about data"
        );

        let categories = api
            .queue::<CategoryResponse>("/categories.json", true)
            .await
            .context("fetch categories")?;
        ensure!(
            !categories.category_list.categories.is_empty(),
            "categories response was empty"
        );
        let featured_category = categories
            .category_list
            .categories
            .iter()
            .find(|category| category.topic_count > 0)
            .cloned()
            .unwrap_or_else(|| categories.category_list.categories[0].clone());

        let mut category_ids = Vec::new();
        for category in categories
            .category_list
            .categories
            .iter()
            .take(MAX_CATEGORIES)
        {
            upsert_category(category, dao_discourse_id).await?;
            category_ids.push(category.id);
        }

        let category_id = category_ids
            .first()
            .copied()
            .context("no categories upserted")?;

        let category_topics_endpoint = format!(
            "/c/{}/{}.json",
            featured_category.slug, featured_category.id
        );
        let category_topics: Value = api
            .queue(&category_topics_endpoint, true)
            .await
            .context("fetch category topics")?;
        ensure!(
            category_topics
                .get("topic_list")
                .and_then(|topic_list| topic_list.get("topics"))
                .and_then(Value::as_array)
                .is_some(),
            "category topics response missing topic_list"
        );

        let latest_posts: Value = api
            .queue(LATEST_POSTS_ENDPOINT, true)
            .await
            .context("fetch latest posts")?;
        ensure!(
            latest_posts
                .get("latest_posts")
                .and_then(Value::as_array)
                .is_some(),
            "latest posts response missing latest_posts"
        );

        let topics = api
            .queue::<TopicResponse>(LATEST_ENDPOINT, true)
            .await
            .context("fetch latest topics")?;
        ensure!(
            !topics.topic_list.topics.is_empty(),
            "latest topics response was empty"
        );
        ensure!(topics.topic_list.per_page > 0, "topics per_page missing");

        let mut topic_ids = Vec::new();
        let mut post_ids = Vec::new();
        let mut sample_post: Option<Post> = None;
        let mut like_post: Option<Post> = None;
        let mut revision_post: Option<Post> = None;

        for topic in topics.topic_list.topics.iter().take(MAX_TOPIC_SCAN) {
            upsert_topic(topic, dao_discourse_id).await?;
            topic_ids.push(topic.id);

            let endpoint = format!("/t/{}.json?include_raw=true&page=1", topic.id);
            let posts = api
                .queue::<PostResponse>(&endpoint, true)
                .await
                .with_context(|| format!("fetch posts for topic {}", topic.id))?;
            ensure!(posts.posts_count > 0, "topic {} has no posts", topic.id);

            for post in posts.post_stream.posts.iter().take(MAX_POSTS_PER_TOPIC) {
                upsert_post(post, dao_discourse_id).await?;
                post_ids.push(post.id);

                if sample_post.is_none() {
                    sample_post = Some(post.clone());
                }

                if like_post.is_none() && like_count(post) > 0 {
                    like_post = Some(post.clone());
                }
                if revision_post.is_none() && post.can_view_edit_history && post.version > 1 {
                    revision_post = Some(post.clone());
                }
            }
        }

        let topic_id = topic_ids.first().copied().context("no topics upserted")?;
        let sample_post = sample_post.context("no posts found in latest topics")?;
        let post_id = post_ids.first().copied().context("no posts upserted")?;

        let directory = api
            .queue::<UserResponse>(DIRECTORY_ENDPOINT, true)
            .await
            .context("fetch directory users")?;
        ensure!(
            !directory.directory_items.is_empty(),
            "directory items response was empty"
        );
        ensure!(
            directory.meta.total_rows_directory_items > 0,
            "directory meta total_rows_directory_items missing"
        );

        let mut user_ids = Vec::new();
        for item in directory.directory_items.iter().take(MAX_USERS) {
            let mut user = item.user.clone();
            user.likes_received = item.likes_received;
            user.likes_given = item.likes_given;
            user.topics_entered = item.topics_entered;
            user.topic_count = item.topic_count;
            user.post_count = item.post_count;
            user.posts_read = item.posts_read;
            user.days_visited = item.days_visited;

            upsert_user(&user, dao_discourse_id).await?;
            user_ids.push(user.id);
        }

        let directory_user_id = user_ids
            .first()
            .copied()
            .context("no directory users upserted")?;

        let user_detail_endpoint = format!("/u/{}.json", sample_post.username);
        let user_detail = api
            .queue::<UserDetailResponse>(&user_detail_endpoint, true)
            .await
            .context("fetch user detail from post author")?;
        ensure!(
            user_detail.user.username == sample_post.username,
            "user detail username mismatch"
        );
        ensure!(
            user_detail.user.id == sample_post.user_id,
            "user detail id mismatch"
        );

        let detail_user = User {
            id: user_detail.user.id,
            username: user_detail.user.username,
            name: user_detail.user.name,
            avatar_template: user_detail.user.avatar_template,
            title: user_detail.user.title,
            likes_received: None,
            likes_given: None,
            topics_entered: None,
            topic_count: None,
            post_count: None,
            posts_read: None,
            days_visited: None,
        };

        upsert_user(&detail_user, dao_discourse_id).await?;

        let mut likes_inserted = false;
        let mut like_post_id = None;
        if let Some(like_post) = like_post {
            let like_endpoint = format!(
                "/post_action_users.json?id={}&post_action_type_id=2&page=0&limit=50",
                like_post.id
            );
            match api.queue::<PostLikeResponse>(&like_endpoint, true).await {
                Ok(likes) => {
                    let user_ids: Vec<i32> =
                        likes.post_action_users.iter().map(|user| user.id).collect();
                    if !user_ids.is_empty() {
                        upsert_post_likes_batch(like_post.id, user_ids, dao_discourse_id).await?;
                        likes_inserted = true;
                        like_post_id = Some(like_post.id);
                    } else {
                        eprintln!("Likes response empty; skipping likes insert.");
                    }
                }
                Err(err) => {
                    eprintln!("Failed to fetch likes; skipping. Error: {err}");
                }
            }
        } else {
            eprintln!("No liked post found in latest topics; skipping likes check.");
        }

        let mut revision_inserted = false;
        let mut revision_key = None;
        if let Some(revision_post) = revision_post {
            let mut revision_numbers = vec![2, revision_post.version];
            revision_numbers.sort_unstable();
            revision_numbers.dedup();

            for revision_number in revision_numbers {
                let revision_endpoint = format!(
                    "/posts/{}/revisions/{}.json",
                    revision_post.id, revision_number
                );
                match api.queue::<Revision>(&revision_endpoint, true).await {
                    Ok(revision) => {
                        ensure!(
                            revision.post_id == revision_post.id,
                            "revision post id mismatch"
                        );
                        ensure!(
                            !revision.body_changes.side_by_side_markdown.is_empty(),
                            "revision body changes missing"
                        );

                        let stored_post = discourse_post::Entity::find()
                            .filter(discourse_post::Column::ExternalId.eq(revision_post.id))
                            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
                            .one(db)
                            .await
                            .context("failed to query revision post")?
                            .context("missing revision post in DB")?;

                        upsert_revision(&revision, dao_discourse_id, stored_post.id).await?;
                        revision_inserted = true;
                        revision_key = Some((revision_post.id, revision.current_version));
                        break;
                    }
                    Err(err) => {
                        eprintln!(
                            "Failed to fetch revision {} for post {}; skipping. Error: {err}",
                            revision_number, revision_post.id
                        );
                    }
                }
            }

            if !revision_inserted {
                eprintln!("No revision data available; skipping revisions check.");
            }
        } else {
            eprintln!("No editable post found in latest topics; skipping revisions check.");
        }

        let stored_category = discourse_category::Entity::find()
            .filter(discourse_category::Column::ExternalId.eq(category_id))
            .filter(discourse_category::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(db)
            .await
            .context("failed to query discourse_category")?
            .context("missing category record")?;
        ensure!(
            !stored_category.slug.is_empty(),
            "stored category slug empty"
        );

        let stored_topic = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::ExternalId.eq(topic_id))
            .filter(discourse_topic::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(db)
            .await
            .context("failed to query discourse_topic")?
            .context("missing topic record")?;
        ensure!(!stored_topic.slug.is_empty(), "stored topic slug empty");

        let stored_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::ExternalId.eq(post_id))
            .filter(discourse_post::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(db)
            .await
            .context("failed to query discourse_post")?
            .context("missing post record")?;
        ensure!(
            stored_post.topic_id == topic_id,
            "stored post topic mismatch"
        );

        let stored_user = discourse_user::Entity::find()
            .filter(discourse_user::Column::ExternalId.eq(directory_user_id))
            .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(db)
            .await
            .context("failed to query discourse_user")?
            .context("missing user record")?;
        ensure!(
            !stored_user.username.is_empty(),
            "stored user username empty"
        );

        let detailed_user = discourse_user::Entity::find()
            .filter(discourse_user::Column::ExternalId.eq(detail_user.id))
            .filter(discourse_user::Column::DaoDiscourseId.eq(dao_discourse_id))
            .one(db)
            .await
            .context("failed to query detailed discourse_user")?
            .context("missing detailed user record")?;
        ensure!(
            detailed_user.username == detail_user.username,
            "detailed user username mismatch"
        );

        if likes_inserted {
            let like_post_id = like_post_id.context("missing like post id")?;
            let stored_like = discourse_post_like::Entity::find()
                .filter(discourse_post_like::Column::ExternalDiscoursePostId.eq(like_post_id))
                .filter(discourse_post_like::Column::DaoDiscourseId.eq(dao_discourse_id))
                .one(db)
                .await
                .context("failed to query discourse_post_like")?;
            ensure!(stored_like.is_some(), "expected post like inserted");
        }

        if revision_inserted {
            let (post_id, version) = revision_key.context("missing revision key")?;
            let stored_revision = discourse_post_revision::Entity::find()
                .filter(discourse_post_revision::Column::ExternalPostId.eq(post_id))
                .filter(discourse_post_revision::Column::Version.eq(version))
                .filter(discourse_post_revision::Column::DaoDiscourseId.eq(dao_discourse_id))
                .one(db)
                .await
                .context("failed to query discourse_post_revision")?;
            ensure!(stored_revision.is_some(), "expected revision inserted");
        }

        Ok(())
    })
}
