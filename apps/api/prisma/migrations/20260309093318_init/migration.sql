-- CreateTable
CREATE TABLE "auction_instances" (
    "id" TEXT NOT NULL,
    "levelBracketMin" INTEGER NOT NULL,
    "levelBracketMax" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_items" (
    "id" TEXT NOT NULL,
    "auctionInstanceId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemLevel" INTEGER NOT NULL,
    "itemRarity" TEXT NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "startingBid" INTEGER NOT NULL,
    "currentBid" INTEGER NOT NULL DEFAULT 0,
    "currentWinnerId" TEXT,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "extensionsUsed" INTEGER NOT NULL DEFAULT 0,
    "maxExtensions" INTEGER NOT NULL DEFAULT 5,
    "isPlayerSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "sellerId" TEXT,
    "feePercentage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_bids" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_pending_rewards" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "winningBid" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_pending_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_participation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "itemId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_player_listings" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemLevel" INTEGER NOT NULL,
    "itemRarity" TEXT NOT NULL,
    "minimumBid" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "auctionItemId" TEXT,
    "listedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_player_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_instances_status_endTime_idx" ON "auction_instances"("status", "endTime");

-- CreateIndex
CREATE INDEX "auction_instances_levelBracketMin_levelBracketMax_status_idx" ON "auction_instances"("levelBracketMin", "levelBracketMax", "status");

-- CreateIndex
CREATE INDEX "auction_items_auctionInstanceId_idx" ON "auction_items"("auctionInstanceId");

-- CreateIndex
CREATE INDEX "auction_items_currentWinnerId_idx" ON "auction_items"("currentWinnerId");

-- CreateIndex
CREATE INDEX "auction_items_sellerId_idx" ON "auction_items"("sellerId");

-- CreateIndex
CREATE INDEX "auction_bids_itemId_status_idx" ON "auction_bids"("itemId", "status");

-- CreateIndex
CREATE INDEX "auction_bids_playerId_status_idx" ON "auction_bids"("playerId", "status");

-- CreateIndex
CREATE INDEX "auction_bids_createdAt_idx" ON "auction_bids"("createdAt");

-- CreateIndex
CREATE INDEX "auction_pending_rewards_playerId_claimed_idx" ON "auction_pending_rewards"("playerId", "claimed");

-- CreateIndex
CREATE INDEX "auction_pending_rewards_expiresAt_idx" ON "auction_pending_rewards"("expiresAt");

-- CreateIndex
CREATE INDEX "auction_participation_auctionId_idx" ON "auction_participation"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "auction_participation_playerId_auctionId_key" ON "auction_participation"("playerId", "auctionId");

-- CreateIndex
CREATE INDEX "auction_player_listings_playerId_status_idx" ON "auction_player_listings"("playerId", "status");

-- CreateIndex
CREATE INDEX "auction_player_listings_status_idx" ON "auction_player_listings"("status");

-- CreateIndex
CREATE INDEX "auction_player_listings_auctionItemId_idx" ON "auction_player_listings"("auctionItemId");

-- AddForeignKey
ALTER TABLE "auction_items" ADD CONSTRAINT "auction_items_auctionInstanceId_fkey" FOREIGN KEY ("auctionInstanceId") REFERENCES "auction_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "auction_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
