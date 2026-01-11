use anyhow::{Context, Result, anyhow};
use chrono::{TimeZone, Utc};
use discourse::db_handler::{
    get_or_create_unknown_user, get_post_like_count, initialize_db, upsert_category, upsert_post,
    upsert_post_likes_batch, upsert_revision, upsert_topic, upsert_user,
};
use discourse::models::{
    categories::Category,
    posts::{ActionSummary, Post},
    revisions::{BodyChanges, Revision, TitleChanges},
    topics::Topic,
    users::User,
};
use once_cell::sync::Lazy;
use proposalsapp_db::models::{
    dao, dao_discourse, discourse_category, discourse_post, discourse_post_revision,
    discourse_topic, discourse_user,
};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set, prelude::Uuid};
use serial_test::serial;
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use testcontainers::{Container, GenericImage, clients::Cli, core::WaitFor};
use tokio::runtime::{Builder, Runtime};
use tokio::sync::OnceCell;

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
    _container: Container<'static, GenericImage>,
}

static DOCKER: Lazy<Cli> = Lazy::new(Cli::default);
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

async fn test_context() -> Result<&'static TestContext> {
    let context = TEST_CONTEXT
        .get_or_init(|| async {
            init_context()
                .await
                .expect("failed to initialize test context")
        })
        .await;

    Ok(context)
}

async fn init_context() -> Result<TestContext> {
    let container = DOCKER.run(
        GenericImage::new(POSTGRES_IMAGE, POSTGRES_TAG)
            .with_exposed_port(POSTGRES_PORT)
            .with_env_var("POSTGRES_PASSWORD", POSTGRES_PASSWORD)
            .with_env_var("POSTGRES_USER", POSTGRES_USER)
            .with_env_var("POSTGRES_DB", POSTGRES_DB)
            .with_wait_for(WaitFor::message_on_stdout(
                "database system is ready to accept connections",
            )),
    );

    let host = "127.0.0.1";
    let port = container.get_host_port_ipv4(POSTGRES_PORT);
    let database_url =
        format!("postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{host}:{port}/{POSTGRES_DB}");

    run_migrations(&database_url).context("failed running migrations")?;

    unsafe {
        std::env::set_var("DATABASE_URL", &database_url);
    }
    initialize_db().await.context("failed to initialize DB")?;

    let db = discourse::db_handler::db().clone();
    let SeedData { dao_discourse_id } = seed_discourse(&db).await?;

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

async fn seed_discourse(db: &DatabaseConnection) -> Result<SeedData> {
    let dao_id = Uuid::from_u128(1);
    let dao_discourse_id = Uuid::from_u128(2);

    let dao_model = dao::ActiveModel {
        id: Set(dao_id),
        name: Set("Test DAO".to_string()),
        slug: Set("test-dao".to_string()),
        picture: Set("https://example.com/dao.png".to_string()),
    };

    dao::Entity::insert(dao_model)
        .exec(db)
        .await
        .context("failed to insert dao")?;

    let dao_discourse_model = dao_discourse::ActiveModel {
        id: Set(dao_discourse_id),
        dao_id: Set(dao_id),
        discourse_base_url: Set("https://forum.example.com".to_string()),
    };

    dao_discourse::Entity::insert(dao_discourse_model)
        .exec(db)
        .await
        .context("failed to insert dao_discourse")?;

    Ok(SeedData { dao_discourse_id })
}

#[test]
#[serial]
fn test_upsert_user_and_category() -> Result<()> {
    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping integration test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;

        let user = User {
            id: 101,
            username: "alice".to_string(),
            name: Some("Alice".to_string()),
            avatar_template: "https://example.com/avatar.png".to_string(),
            title: Some("Contributor".to_string()),
            likes_received: Some(12),
            likes_given: Some(4),
            topics_entered: Some(2),
            topic_count: Some(1),
            post_count: Some(3),
            posts_read: Some(10),
            days_visited: Some(5),
        };

        upsert_user(&user, context.dao_discourse_id).await?;

        let stored_user = discourse_user::Entity::find()
            .filter(discourse_user::Column::ExternalId.eq(user.id))
            .filter(discourse_user::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_user")?
            .context("missing discourse_user record")?;

        assert_eq!(stored_user.username, "alice");
        assert_eq!(stored_user.likes_received, Some(12));

        let category = Category {
            id: 501,
            name: "General".to_string(),
            color: "FFFFFF".to_string(),
            text_color: "000000".to_string(),
            slug: "general".to_string(),
            topic_count: 4,
            post_count: 7,
            description: Some("General discussion".to_string()),
            description_text: Some("General discussion".to_string()),
            topics_day: Some(1),
            topics_week: Some(2),
            topics_month: Some(3),
            topics_year: Some(4),
            topics_all_time: Some(5),
            subcategory_list: None,
        };

        upsert_category(&category, context.dao_discourse_id).await?;

        let stored_category = discourse_category::Entity::find()
            .filter(discourse_category::Column::ExternalId.eq(category.id))
            .filter(discourse_category::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_category")?
            .context("missing discourse_category record")?;

        assert_eq!(stored_category.slug, "general");
        assert_eq!(stored_category.topic_count, 4);

        Ok(())
    })
}

#[test]
#[serial]
fn test_get_or_create_unknown_user() -> Result<()> {
    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping integration test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;

        let user = get_or_create_unknown_user(context.dao_discourse_id).await?;

        assert_eq!(user.id, -1);
        assert_eq!(user.username, "unknown_user");

        let stored_user = discourse_user::Entity::find()
            .filter(discourse_user::Column::ExternalId.eq(user.id))
            .filter(discourse_user::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query unknown discourse_user")?
            .context("missing unknown discourse_user record")?;

        assert_eq!(stored_user.username, "unknown_user");
        assert_eq!(stored_user.name.as_deref(), Some("Unknown User"));

        Ok(())
    })
}

#[test]
#[serial]
fn test_upsert_topic_and_post() -> Result<()> {
    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping integration test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;

        let topic = Topic {
            id: 701,
            title: "Test Topic".to_string(),
            fancy_title: "Test Topic".to_string(),
            slug: "test-topic".to_string(),
            posts_count: 1,
            reply_count: 0,
            created_at: Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap(),
            last_posted_at: Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap(),
            bumped: true,
            bumped_at: Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap(),
            pinned: false,
            visible: true,
            closed: false,
            archived: false,
            liked: None,
            views: 10,
            like_count: 1,
            category_id: 501,
            pinned_globally: false,
        };

        upsert_topic(&topic, context.dao_discourse_id).await?;

        let post = Post {
            id: 9001,
            name: Some("Alice".to_string()),
            username: "alice".to_string(),
            avatar_template: "https://example.com/avatar.png".to_string(),
            created_at: Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap(),
            raw: Some("Hello world".to_string()),
            post_number: 1,
            post_type: 1,
            updated_at: Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap(),
            reply_count: 0,
            reply_to_post_number: None,
            quote_count: 0,
            incoming_link_count: 0,
            reads: 5,
            readers_count: 5,
            score: 1.0,
            topic_id: topic.id,
            topic_slug: topic.slug.clone(),
            display_username: Some("Alice".to_string()),
            primary_group_name: None,
            flair_name: None,
            flair_url: None,
            flair_bg_color: None,
            flair_color: None,
            version: 1,
            can_view_edit_history: true,
            user_id: 101,
            actions_summary: vec![ActionSummary { id: 2, count: 1 }],
        };

        upsert_post(&post, context.dao_discourse_id).await?;

        let stored_topic = discourse_topic::Entity::find()
            .filter(discourse_topic::Column::ExternalId.eq(topic.id))
            .filter(discourse_topic::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_topic")?
            .context("missing discourse_topic record")?;

        assert_eq!(stored_topic.slug, "test-topic");

        let stored_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::ExternalId.eq(post.id))
            .filter(discourse_post::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_post")?
            .context("missing discourse_post record")?;

        assert_eq!(stored_post.topic_id, topic.id);
        assert!(!stored_post.deleted);

        Ok(())
    })
}

#[test]
#[serial]
fn test_upsert_deleted_post_marks_deleted() -> Result<()> {
    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping integration test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;

        let post = Post {
            id: 9003,
            name: Some("Deleted".to_string()),
            username: "deleted-user".to_string(),
            avatar_template: "https://example.com/avatar-deleted.png".to_string(),
            created_at: Utc.with_ymd_and_hms(2024, 3, 1, 0, 0, 0).unwrap(),
            raw: Some("(post deleted by author)".to_string()),
            post_number: 1,
            post_type: 1,
            updated_at: Utc.with_ymd_and_hms(2024, 3, 1, 0, 0, 0).unwrap(),
            reply_count: 0,
            reply_to_post_number: None,
            quote_count: 0,
            incoming_link_count: 0,
            reads: 0,
            readers_count: 0,
            score: 0.0,
            topic_id: 9999,
            topic_slug: "deleted-topic".to_string(),
            display_username: Some("Deleted".to_string()),
            primary_group_name: None,
            flair_name: None,
            flair_url: None,
            flair_bg_color: None,
            flair_color: None,
            version: 1,
            can_view_edit_history: false,
            user_id: 303,
            actions_summary: vec![],
        };

        upsert_post(&post, context.dao_discourse_id).await?;

        let stored_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::ExternalId.eq(post.id))
            .filter(discourse_post::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query deleted discourse_post")?
            .context("missing deleted discourse_post record")?;

        assert!(stored_post.deleted);
        assert_eq!(stored_post.cooked, None);

        Ok(())
    })
}

#[test]
#[serial]
fn test_upsert_revision_and_likes() -> Result<()> {
    if !*DOCKER_AVAILABLE {
        eprintln!("Docker unavailable; skipping integration test.");
        return Ok(());
    }

    TEST_RUNTIME.block_on(async {
        let context = test_context().await?;

        let post = Post {
            id: 9002,
            name: Some("Bob".to_string()),
            username: "bob".to_string(),
            avatar_template: "https://example.com/avatar-bob.png".to_string(),
            created_at: Utc.with_ymd_and_hms(2024, 2, 1, 0, 0, 0).unwrap(),
            raw: Some("Original".to_string()),
            post_number: 1,
            post_type: 1,
            updated_at: Utc.with_ymd_and_hms(2024, 2, 1, 0, 0, 0).unwrap(),
            reply_count: 0,
            reply_to_post_number: None,
            quote_count: 0,
            incoming_link_count: 0,
            reads: 3,
            readers_count: 3,
            score: 1.5,
            topic_id: 701,
            topic_slug: "test-topic".to_string(),
            display_username: Some("Bob".to_string()),
            primary_group_name: None,
            flair_name: None,
            flair_url: None,
            flair_bg_color: None,
            flair_color: None,
            version: 2,
            can_view_edit_history: true,
            user_id: 202,
            actions_summary: vec![ActionSummary { id: 2, count: 2 }],
        };

        upsert_post(&post, context.dao_discourse_id).await?;

        let stored_post = discourse_post::Entity::find()
            .filter(discourse_post::Column::ExternalId.eq(post.id))
            .filter(discourse_post::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_post")?
            .context("missing discourse_post record")?;

        let revision = Revision {
            created_at: Utc.with_ymd_and_hms(2024, 2, 2, 0, 0, 0).unwrap(),
            post_id: post.id,
            previous_hidden: false,
            current_hidden: false,
            first_revision: 1,
            previous_revision: Some(1),
            current_revision: 2,
            next_revision: None,
            last_revision: 2,
            current_version: 2,
            version_count: 2,
            username: "bob".to_string(),
            display_username: "Bob".to_string(),
            avatar_template: "https://example.com/avatar-bob.png".to_string(),
            edit_reason: Some("Fix typo".to_string()),
            body_changes: BodyChanges {
                inline: "-old +new".to_string(),
                side_by_side: "old | new".to_string(),
                side_by_side_markdown: "<del>old</del><ins>new</ins>".to_string(),
            },
            title_changes: Some(TitleChanges {
                inline: "-Old +New".to_string(),
            }),
            can_edit: true,
        };

        upsert_revision(&revision, context.dao_discourse_id, stored_post.id).await?;

        let stored_revision = discourse_post_revision::Entity::find()
            .filter(discourse_post_revision::Column::ExternalPostId.eq(post.id))
            .filter(discourse_post_revision::Column::Version.eq(2))
            .filter(discourse_post_revision::Column::DaoDiscourseId.eq(context.dao_discourse_id))
            .one(&context.db)
            .await
            .context("failed to query discourse_post_revision")?
            .context("missing discourse_post_revision record")?;

        assert_eq!(stored_revision.username, "bob");
        assert_eq!(stored_revision.edit_reason.as_deref(), Some("Fix typo"));

        upsert_post_likes_batch(post.id, vec![101, 202], context.dao_discourse_id).await?;
        upsert_post_likes_batch(post.id, vec![202, 303], context.dao_discourse_id).await?;
        let like_count = get_post_like_count(post.id, context.dao_discourse_id).await?;

        assert_eq!(like_count, 3);

        Ok(())
    })
}
