/*
  Warnings:

  - Added the required column `submitted_at` to the `notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `notification` ADD COLUMN `submitted_at` DATETIME(3) NOT NULL;
