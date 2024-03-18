-- CreateTable
CREATE TABLE `countdown_cache` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `time` DATETIME(3) NOT NULL,
    `large_url` VARCHAR(191) NOT NULL,
    `small_url` VARCHAR(191) NOT NULL,

    INDEX `countdown_cache_time_idx`(`time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
