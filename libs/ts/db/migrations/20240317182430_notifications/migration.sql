/*
  Warnings:

  - You are about to drop the column `proposalid` on the `notification` table. All the data in the column will be lost.
  - You are about to drop the column `userid` on the `notification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,proposal_id,type]` on the table `notification` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_proposalid_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_userid_fkey`;

-- DropIndex
DROP INDEX `notification_userid_proposalid_type_key` ON `notification`;

-- DropIndex
DROP INDEX `notification_userid_type_dispatchstatus_idx` ON `notification`;

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `proposalid`,
    DROP COLUMN `userid`,
    ADD COLUMN `proposal_id` VARCHAR(191) NULL,
    ADD COLUMN `user_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `notification_proposal_id_idx` ON `notification`(`proposal_id`);

-- CreateIndex
CREATE INDEX `notification_user_id_type_dispatchstatus_idx` ON `notification`(`user_id`, `type`, `dispatchstatus`);

-- CreateIndex
CREATE UNIQUE INDEX `notification_user_id_proposal_id_type_key` ON `notification`(`user_id`, `proposal_id`, `type`);

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `proposal`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
