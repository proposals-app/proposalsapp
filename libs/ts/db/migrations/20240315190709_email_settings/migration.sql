/*
  Warnings:

  - You are about to drop the column `discord_includevotes` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `discord_notifications` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `discord_reminders` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `discord_webhook` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `empty_daily_bulletin` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `slack_channelname` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `slack_includevotes` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `slack_notifications` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `slack_reminders` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `slack_webhook` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_chat_id` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_chat_title` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_include_votes` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_notifications` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_reminders` on the `user_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('BULLETIN_EMAIL', 'QUORUM_NOT_REACHED_EMAIL', 'TIMEEND_EMAIL') NOT NULL;

-- AlterTable
ALTER TABLE `user_settings` DROP COLUMN `discord_includevotes`,
    DROP COLUMN `discord_notifications`,
    DROP COLUMN `discord_reminders`,
    DROP COLUMN `discord_webhook`,
    DROP COLUMN `empty_daily_bulletin`,
    DROP COLUMN `slack_channelname`,
    DROP COLUMN `slack_includevotes`,
    DROP COLUMN `slack_notifications`,
    DROP COLUMN `slack_reminders`,
    DROP COLUMN `slack_webhook`,
    DROP COLUMN `telegram_chat_id`,
    DROP COLUMN `telegram_chat_title`,
    DROP COLUMN `telegram_include_votes`,
    DROP COLUMN `telegram_notifications`,
    DROP COLUMN `telegram_reminders`,
    ADD COLUMN `email_timeend_warning` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `email_daily_bulletin` BOOLEAN NOT NULL DEFAULT true;
