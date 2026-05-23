-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `role` ENUM('BUYER', 'HOST', 'ADMIN') NOT NULL DEFAULT 'BUYER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lots` (
    `id` VARCHAR(191) NOT NULL,
    `host_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lots_host_id_idx`(`host_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auctions` (
    `id` VARCHAR(191) NOT NULL,
    `lot_id` VARCHAR(191) NOT NULL,
    `host_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'SETTLED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `rule_snapshot` JSON NOT NULL,
    `scheduled_start_at` DATETIME(3) NULL,
    `start_at` DATETIME(3) NULL,
    `end_at` DATETIME(3) NULL,
    `cap_price` DECIMAL(12, 2) NULL,
    `current_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `winner_id` VARCHAR(191) NULL,
    `settle_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `auctions_status_idx`(`status`),
    INDEX `auctions_lot_id_idx`(`lot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bids` (
    `id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bids_idempotency_key_key`(`idempotency_key`),
    INDEX `bids_auction_id_amount_idx`(`auction_id`, `amount` DESC),
    INDEX `bids_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auction_events` (
    `id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `type` ENUM('STARTED', 'BID_ACCEPTED', 'SOFT_CLOSE_EXTENDED', 'SETTLED', 'CANCELLED', 'CAP_REACHED') NOT NULL,
    `payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auction_events_auction_id_idx`(`auction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_host_id_fkey` FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_host_id_fkey` FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_winner_id_fkey` FOREIGN KEY (`winner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auction_events` ADD CONSTRAINT `auction_events_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
