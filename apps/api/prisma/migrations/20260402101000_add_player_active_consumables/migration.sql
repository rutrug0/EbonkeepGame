CREATE TABLE "player_active_consumables" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "consumableType" TEXT NOT NULL,
    "consumableFamily" TEXT NOT NULL,
    "effects" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "remainingEncounters" INTEGER,
    "originalDurationKind" TEXT NOT NULL,
    "originalDurationValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_active_consumables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "player_active_consumables_playerId_consumableType_idx"
ON "player_active_consumables"("playerId", "consumableType");

CREATE INDEX "player_active_consumables_playerId_consumableType_consumableFamily_idx"
ON "player_active_consumables"("playerId", "consumableType", "consumableFamily");

CREATE INDEX "player_active_consumables_playerId_expiresAt_idx"
ON "player_active_consumables"("playerId", "expiresAt");

CREATE INDEX "player_active_consumables_playerId_remainingEncounters_idx"
ON "player_active_consumables"("playerId", "remainingEncounters");

ALTER TABLE "player_active_consumables"
ADD CONSTRAINT "player_active_consumables_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
