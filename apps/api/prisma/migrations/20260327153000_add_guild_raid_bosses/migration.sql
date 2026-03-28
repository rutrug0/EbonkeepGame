CREATE TABLE "guild_raid_progress" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "highestBossIndexDefeated" INTEGER NOT NULL DEFAULT -1,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalVictories" INTEGER NOT NULL DEFAULT 0,
    "activeRaidInstanceId" TEXT,
    "nextAvailableAt" TIMESTAMP(3),
    "lastBossId" TEXT,
    "lastOutcome" TEXT,
    "lastResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_raid_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_raid_instances" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "bossOrderIndex" INTEGER NOT NULL,
    "zoneKey" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "bossName" TEXT NOT NULL,
    "bossTitle" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'lobby',
    "summonedById" TEXT NOT NULL,
    "summonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lobbyEndsAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "lockEndsAt" TIMESTAMP(3),
    "recommendedPower" INTEGER NOT NULL DEFAULT 0,
    "bossMaxHp" INTEGER NOT NULL,
    "joinedPower" INTEGER NOT NULL DEFAULT 0,
    "joinCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "outcome" TEXT,
    "firstClear" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_raid_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guild_raid_participants" (
    "id" TEXT NOT NULL,
    "raidInstanceId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerClass" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "power" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "damageDone" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_raid_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guild_raid_progress_guildId_key" ON "guild_raid_progress"("guildId");
CREATE INDEX "guild_raid_progress_nextAvailableAt_idx" ON "guild_raid_progress"("nextAvailableAt");

CREATE INDEX "guild_raid_instances_guildId_state_idx" ON "guild_raid_instances"("guildId", "state");
CREATE INDEX "guild_raid_instances_guildId_bossOrderIndex_idx" ON "guild_raid_instances"("guildId", "bossOrderIndex");
CREATE INDEX "guild_raid_instances_lobbyEndsAt_idx" ON "guild_raid_instances"("lobbyEndsAt");
CREATE INDEX "guild_raid_instances_lockEndsAt_idx" ON "guild_raid_instances"("lockEndsAt");

CREATE UNIQUE INDEX "guild_raid_participants_raidInstanceId_playerId_key" ON "guild_raid_participants"("raidInstanceId", "playerId");
CREATE INDEX "guild_raid_participants_playerId_joinedAt_idx" ON "guild_raid_participants"("playerId", "joinedAt" DESC);
CREATE INDEX "guild_raid_participants_raidInstanceId_damageDone_idx" ON "guild_raid_participants"("raidInstanceId", "damageDone" DESC);

ALTER TABLE "guild_raid_progress"
ADD CONSTRAINT "guild_raid_progress_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "guilds"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "guild_raid_instances"
ADD CONSTRAINT "guild_raid_instances_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "guilds"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "guild_raid_instances"
ADD CONSTRAINT "guild_raid_instances_summonedById_fkey"
FOREIGN KEY ("summonedById") REFERENCES "player_profiles"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "guild_raid_participants"
ADD CONSTRAINT "guild_raid_participants_raidInstanceId_fkey"
FOREIGN KEY ("raidInstanceId") REFERENCES "guild_raid_instances"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "guild_raid_participants"
ADD CONSTRAINT "guild_raid_participants_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
