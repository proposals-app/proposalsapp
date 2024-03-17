-- AlterTable
ALTER TABLE `notification` MODIFY `id` VARCHAR(191) NOT NULL DEFAULT (uuid());
