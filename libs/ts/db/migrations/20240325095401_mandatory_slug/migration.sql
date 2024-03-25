/*
  Warnings:

  - Made the column `slug` on table `dao` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `dao` MODIFY `slug` VARCHAR(191) NOT NULL;
