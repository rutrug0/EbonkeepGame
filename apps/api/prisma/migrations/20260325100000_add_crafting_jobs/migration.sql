CREATE TABLE "crafting_jobs" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishesAt" TIMESTAMP(3) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "crafting_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crafting_jobs_playerId_slotIndex_key" ON "crafting_jobs"("playerId", "slotIndex");
CREATE INDEX "crafting_jobs_playerId_idx" ON "crafting_jobs"("playerId");

ALTER TABLE "crafting_jobs"
ADD CONSTRAINT "crafting_jobs_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
