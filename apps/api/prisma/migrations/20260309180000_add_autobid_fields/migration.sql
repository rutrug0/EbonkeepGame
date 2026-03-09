-- Add auto-bid fields to auction_bids table
ALTER TABLE "auction_bids" ADD COLUMN "isAutoBid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "auction_bids" ADD COLUMN "maxAutoBid" INTEGER;

-- Add index for efficient auto-bid lookups
CREATE INDEX "auction_bids_playerId_itemId_status_idx" ON "auction_bids"("playerId", "itemId", "status");
