/*
  Warnings:

  - You are about to drop the column `hot` on the `dao_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `dao` ADD COLUMN `hot` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `dao_settings` DROP COLUMN `hot`;
