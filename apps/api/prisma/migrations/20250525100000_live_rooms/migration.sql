-- AlterTable
ALTER TABLE `auctions` ADD COLUMN `room_id` VARCHAR(191) NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `live_rooms` (
    `id` VARCHAR(191) NOT NULL,
    `host_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('PREPARE', 'LIVE', 'ENDED') NOT NULL DEFAULT 'PREPARE',
    `active_auction_id` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_rooms_host_id_idx`(`host_id`),
    INDEX `live_rooms_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterEnum AuctionStatus add CLOSING
ALTER TABLE `auctions` MODIFY `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'CLOSING', 'SETTLED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX `auctions_room_id_sort_order_idx` ON `auctions`(`room_id`, `sort_order`);

-- AddForeignKey
ALTER TABLE `live_rooms` ADD CONSTRAINT `live_rooms_host_id_fkey` FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `live_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
