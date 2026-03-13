-- CreateTable
CREATE TABLE "guild_academy_nodes" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "ducatsInvested" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "guild_academy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_academy_donations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "donatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_academy_donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_academy_nodes_guildId_idx" ON "guild_academy_nodes"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_academy_nodes_guildId_nodeId_key" ON "guild_academy_nodes"("guildId", "nodeId");

-- CreateIndex
CREATE INDEX "guild_academy_donations_guildId_nodeId_idx" ON "guild_academy_donations"("guildId", "nodeId");

-- CreateIndex
CREATE INDEX "guild_academy_donations_guildId_playerId_idx" ON "guild_academy_donations"("guildId", "playerId");

-- CreateIndex
CREATE INDEX "guild_academy_donations_guildId_donatedAt_idx" ON "guild_academy_donations"("guildId", "donatedAt" DESC);

-- AddForeignKey
ALTER TABLE "guild_academy_nodes" ADD CONSTRAINT "guild_academy_nodes_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_academy_donations" ADD CONSTRAINT "guild_academy_donations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_academy_donations" ADD CONSTRAINT "guild_academy_donations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
