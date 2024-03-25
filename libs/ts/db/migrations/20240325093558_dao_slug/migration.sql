/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `dao` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `dao` ADD COLUMN `slug` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `dao_slug_key` ON `dao`(`slug`);
