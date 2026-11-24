/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `paymentType` VARCHAR(191) NULL,
    ADD COLUMN `snapToken` TEXT NULL,
    ADD COLUMN `transactionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `transactions_transactionId_key` ON `transactions`(`transactionId`);
