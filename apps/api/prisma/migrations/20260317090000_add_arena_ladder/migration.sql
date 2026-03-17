-- CreateTable
CREATE TABLE "arena_entries" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "source" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "cooldownEndsAt" TIMESTAMP(3),
    "displayName" TEXT NOT NULL,
    "playerClass" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "gearScore" INTEGER NOT NULL DEFAULT 0,
    "weaponLabel" TEXT,
    "previewStats" JSONB NOT NULL,
    "combatSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_offers" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentEntryId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "combatSnapshot" JSONB NOT NULL,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldownEndsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_matches" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentEntryId" TEXT NOT NULL,
    "winnerSide" TEXT NOT NULL,
    "ratingDelta" INTEGER NOT NULL,
    "challengerRating" INTEGER NOT NULL,
    "opponentRating" INTEGER NOT NULL,
    "opponentSummary" JSONB NOT NULL,
    "encounter" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_entries_playerId_key" ON "arena_entries"("playerId");

-- CreateIndex
CREATE INDEX "arena_entries_source_rating_idx" ON "arena_entries"("source", "rating");

-- CreateIndex
CREATE INDEX "arena_entries_rating_idx" ON "arena_entries"("rating" DESC);

-- CreateIndex
CREATE INDEX "arena_offers_challengerId_offeredAt_idx" ON "arena_offers"("challengerId", "offeredAt" DESC);

-- CreateIndex
CREATE INDEX "arena_offers_challengerId_cooldownEndsAt_idx" ON "arena_offers"("challengerId", "cooldownEndsAt");

-- CreateIndex
CREATE INDEX "arena_matches_challengerId_createdAt_idx" ON "arena_matches"("challengerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "arena_matches_opponentEntryId_createdAt_idx" ON "arena_matches"("opponentEntryId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "arena_entries" ADD CONSTRAINT "arena_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_offers" ADD CONSTRAINT "arena_offers_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_offers" ADD CONSTRAINT "arena_offers_opponentEntryId_fkey" FOREIGN KEY ("opponentEntryId") REFERENCES "arena_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_opponentEntryId_fkey" FOREIGN KEY ("opponentEntryId") REFERENCES "arena_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
