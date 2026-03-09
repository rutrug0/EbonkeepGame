-- AlterTable
ALTER TABLE "shop_instances"
ADD COLUMN "offerIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "itemCode" TEXT,
ADD COLUMN "itemData" JSONB,
ADD COLUMN "buyPriceDucats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "shop_instances_playerId_refreshAt_idx" ON "shop_instances"("playerId", "refreshAt");

-- CreateIndex
CREATE UNIQUE INDEX "shop_instances_playerId_offerIndex_key" ON "shop_instances"("playerId", "offerIndex");
