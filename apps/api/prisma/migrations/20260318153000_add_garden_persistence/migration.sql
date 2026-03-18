-- CreateTable
CREATE TABLE "garden_plots" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "plantId" TEXT,
    "plantedAt" TIMESTAMP(3),
    "growthEndsAt" TIMESTAMP(3),
    "bloomStartsAt" TIMESTAMP(3),
    "bloomEndsAt" TIMESTAMP(3),
    "wiltAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garden_plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garden_inventory_entries" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garden_inventory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garden_plots_playerId_slotIndex_key" ON "garden_plots"("playerId", "slotIndex");

-- CreateIndex
CREATE INDEX "garden_plots_playerId_slotIndex_idx" ON "garden_plots"("playerId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "garden_inventory_entries_playerId_plantId_kind_key" ON "garden_inventory_entries"("playerId", "plantId", "kind");

-- CreateIndex
CREATE INDEX "garden_inventory_entries_playerId_kind_idx" ON "garden_inventory_entries"("playerId", "kind");

-- AddForeignKey
ALTER TABLE "garden_plots" ADD CONSTRAINT "garden_plots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garden_inventory_entries" ADD CONSTRAINT "garden_inventory_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
