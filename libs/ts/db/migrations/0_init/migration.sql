-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `email` VARCHAR(191) NOT NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_session` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `user_session_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_verification_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(191) NOT NULL,
    `email_daily_bulletin` BOOLEAN NOT NULL DEFAULT false,
    `empty_daily_bulletin` BOOLEAN NOT NULL DEFAULT false,
    `email_quorum_warning` BOOLEAN NOT NULL DEFAULT true,
    `discord_notifications` BOOLEAN NOT NULL DEFAULT false,
    `discord_reminders` BOOLEAN NOT NULL DEFAULT true,
    `discord_includevotes` BOOLEAN NOT NULL DEFAULT true,
    `discord_webhook` VARCHAR(191) NOT NULL DEFAULT '',
    `telegram_notifications` BOOLEAN NOT NULL DEFAULT false,
    `telegram_reminders` BOOLEAN NOT NULL DEFAULT true,
    `telegram_include_votes` BOOLEAN NOT NULL DEFAULT true,
    `telegram_chat_id` VARCHAR(191) NOT NULL DEFAULT '',
    `telegram_chat_title` VARCHAR(191) NOT NULL DEFAULT '',
    `slack_notifications` BOOLEAN NOT NULL DEFAULT false,
    `slack_reminders` BOOLEAN NOT NULL DEFAULT true,
    `slack_includevotes` BOOLEAN NOT NULL DEFAULT true,
    `slack_webhook` VARCHAR(191) NOT NULL DEFAULT '',
    `slack_channelname` VARCHAR(191) NOT NULL DEFAULT '',

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voter` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `address` VARCHAR(191) NOT NULL,
    `ens` VARCHAR(191) NULL,

    UNIQUE INDEX `voter_address_key`(`address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_to_voter` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(191) NOT NULL,
    `voter_id` VARCHAR(191) NOT NULL,

    INDEX `user_to_voter_voter_id_idx`(`voter_id`),
    UNIQUE INDEX `user_to_voter_user_id_voter_id_key`(`user_id`, `voter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dao` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `dao_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dao_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `dao_id` VARCHAR(191) NOT NULL,
    `picture` VARCHAR(191) NOT NULL,
    `background_color` VARCHAR(191) NOT NULL DEFAULT '#5A5A5A',
    `quorum_warning_email_support` BOOLEAN NOT NULL DEFAULT false,
    `twitter_account` JSON NULL,

    UNIQUE INDEX `dao_settings_dao_id_key`(`dao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dao_handler` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `handler_type` ENUM('AAVE_V2_MAINNET', 'COMPOUND_MAINNET', 'UNISWAP_MAINNET', 'ENS_MAINNET', 'GITCOIN_MAINNET', 'GITCOIN_V2_MAINNET', 'HOP_MAINNET', 'DYDX_MAINNET', 'INTEREST_PROTOCOL_MAINNET', 'ZEROX_PROTOCOL_MAINNET', 'FRAX_ALPHA_MAINNET', 'FRAX_OMEGA_MAINNET', 'NOUNS_PROPOSALS_MAINNET', 'OP_OPTIMISM', 'ARB_CORE_ARBITRUM', 'ARB_TREASURY_ARBITRUM', 'MAKER_EXECUTIVE_MAINNET', 'MAKER_POLL_MAINNET', 'MAKER_POLL_ARBITRUM', 'AAVE_V3_MAINNET', 'AAVE_V3_POLYGON_POS', 'AAVE_V3_AVALANCHE', 'SNAPSHOT') NOT NULL,
    `decoder` JSON NOT NULL,
    `governance_portal` VARCHAR(191) NOT NULL DEFAULT '',
    `proposals_refresh_speed` BIGINT NOT NULL DEFAULT 1000,
    `votes_refresh_speed` BIGINT NOT NULL DEFAULT 1000,
    `proposals_index` BIGINT NOT NULL DEFAULT 0,
    `votes_index` BIGINT NOT NULL DEFAULT 0,
    `dao_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `dao_handler_dao_id_handler_type_key`(`dao_id`, `handler_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `index_created` BIGINT NOT NULL DEFAULT 0,
    `votes_fetched` BOOLEAN NOT NULL DEFAULT false,
    `votes_refresh_speed` BIGINT NOT NULL DEFAULT 1000,
    `votes_index` BIGINT NOT NULL DEFAULT 0,
    `external_id` VARCHAR(191) NOT NULL,
    `name` LONGTEXT NOT NULL,
    `body` LONGTEXT NOT NULL,
    `url` LONGTEXT NOT NULL,
    `discussion_url` LONGTEXT NOT NULL,
    `choices` JSON NOT NULL,
    `scores` JSON NOT NULL,
    `scores_total` DOUBLE NOT NULL,
    `quorum` DOUBLE NOT NULL,
    `proposal_state` ENUM('PENDING', 'ACTIVE', 'CANCELED', 'DEFEATED', 'SUCCEEDED', 'QUEUED', 'EXPIRED', 'EXECUTED', 'HIDDEN', 'UNKNOWN') NOT NULL,
    `flagged` BOOLEAN NOT NULL DEFAULT false,
    `block_created` BIGINT NULL,
    `time_created` DATETIME(3) NULL,
    `time_start` DATETIME(3) NOT NULL,
    `time_end` DATETIME(3) NOT NULL,
    `dao_handler_id` VARCHAR(191) NOT NULL,
    `dao_id` VARCHAR(191) NOT NULL,

    INDEX `proposal_dao_handler_id_idx`(`dao_handler_id`),
    INDEX `proposal_dao_id_idx`(`dao_id`),
    INDEX `proposal_proposal_state_dao_id_idx`(`proposal_state`, `dao_id`),
    INDEX `proposal_time_end_name_idx`(`time_end`, `name`(10)),
    UNIQUE INDEX `proposal_external_id_dao_handler_id_key`(`external_id`, `dao_handler_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `index_created` BIGINT NOT NULL DEFAULT 0,
    `voter_address` VARCHAR(191) NOT NULL,
    `choice` JSON NOT NULL,
    `voting_power` DOUBLE NOT NULL,
    `reason` LONGTEXT NULL,
    `proposal_external_id` VARCHAR(191) NOT NULL,
    `block_created` BIGINT NULL,
    `time_created` DATETIME(3) NULL,
    `vp_state` VARCHAR(191) NULL,
    `proposal_id` VARCHAR(191) NOT NULL,
    `dao_id` VARCHAR(191) NOT NULL,
    `dao_handler_id` VARCHAR(191) NOT NULL,

    INDEX `vote_dao_handler_id_idx`(`dao_handler_id`),
    INDEX `vote_dao_id_idx`(`dao_id`),
    INDEX `vote_voter_address_idx`(`voter_address`),
    INDEX `vote_time_created_idx`(`time_created`),
    INDEX `vote_block_created_idx`(`block_created`),
    UNIQUE INDEX `vote_proposal_id_voter_address_key`(`proposal_id`, `voter_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(191) NOT NULL,
    `dao_id` VARCHAR(191) NOT NULL,

    INDEX `subscription_dao_id_idx`(`dao_id`),
    UNIQUE INDEX `subscription_user_id_dao_id_key`(`user_id`, `dao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(191) NOT NULL,
    `userid` VARCHAR(191) NULL,
    `proposalid` VARCHAR(191) NULL,
    `type` ENUM('QUORUM_NOT_REACHED_EMAIL', 'BULLETIN_EMAIL') NOT NULL,
    `dispatchstatus` ENUM('NOT_DISPATCHED', 'FIRST_RETRY', 'SECOND_RETRY', 'THIRD_RETRY', 'DISPATCHED', 'DELETED', 'FAILED') NOT NULL DEFAULT 'NOT_DISPATCHED',
    `decoder` JSON NOT NULL,

    INDEX `notification_type_idx`(`type`),
    INDEX `notification_proposalid_idx`(`proposalid`),
    INDEX `notification_dispatchstatus_idx`(`dispatchstatus`),
    INDEX `notification_userid_type_dispatchstatus_idx`(`userid`, `type`, `dispatchstatus`),
    UNIQUE INDEX `notification_userid_proposalid_type_key`(`userid`, `proposalid`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_session` ADD CONSTRAINT `user_session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification` ADD CONSTRAINT `email_verification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_to_voter` ADD CONSTRAINT `user_to_voter_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_to_voter` ADD CONSTRAINT `user_to_voter_voter_id_fkey` FOREIGN KEY (`voter_id`) REFERENCES `voter`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `dao_settings` ADD CONSTRAINT `dao_settings_dao_id_fkey` FOREIGN KEY (`dao_id`) REFERENCES `dao`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `dao_handler` ADD CONSTRAINT `dao_handler_dao_id_fkey` FOREIGN KEY (`dao_id`) REFERENCES `dao`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `proposal` ADD CONSTRAINT `proposal_dao_handler_id_fkey` FOREIGN KEY (`dao_handler_id`) REFERENCES `dao_handler`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `proposal` ADD CONSTRAINT `proposal_dao_id_fkey` FOREIGN KEY (`dao_id`) REFERENCES `dao`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `vote` ADD CONSTRAINT `vote_voter_address_fkey` FOREIGN KEY (`voter_address`) REFERENCES `voter`(`address`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `vote` ADD CONSTRAINT `vote_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `proposal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `vote` ADD CONSTRAINT `vote_dao_id_fkey` FOREIGN KEY (`dao_id`) REFERENCES `dao`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `vote` ADD CONSTRAINT `vote_dao_handler_id_fkey` FOREIGN KEY (`dao_handler_id`) REFERENCES `dao_handler`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_dao_id_fkey` FOREIGN KEY (`dao_id`) REFERENCES `dao`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userid_fkey` FOREIGN KEY (`userid`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_proposalid_fkey` FOREIGN KEY (`proposalid`) REFERENCES `proposal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

