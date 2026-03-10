-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "leaderId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 50,
    "isRecruiting" BOOLEAN NOT NULL DEFAULT true,
    "totalPower" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "crestBgShape" TEXT NOT NULL DEFAULT 'shield_01',
    "crestBgColor" TEXT NOT NULL DEFAULT 'crimson',
    "crestBgPattern" TEXT,
    "crestFgSymbol" TEXT NOT NULL DEFAULT 'sword_01',
    "crestFgColor" TEXT NOT NULL DEFAULT 'gold',
    "crestFrame" TEXT,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_members" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributedPower" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "guild_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_invites" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "guild_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_activity" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT,
    "actionType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guilds_name_key" ON "guilds"("name");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_tag_key" ON "guilds"("tag");

-- CreateIndex
CREATE INDEX "guilds_name_idx" ON "guilds"("name");

-- CreateIndex
CREATE INDEX "guilds_tag_idx" ON "guilds"("tag");

-- CreateIndex
CREATE INDEX "guilds_leaderId_idx" ON "guilds"("leaderId");

-- CreateIndex
CREATE INDEX "guilds_totalPower_idx" ON "guilds"("totalPower");

-- CreateIndex
CREATE INDEX "guilds_createdAt_idx" ON "guilds"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guild_members_playerId_key" ON "guild_members"("playerId");

-- CreateIndex
CREATE INDEX "guild_members_guildId_idx" ON "guild_members"("guildId");

-- CreateIndex
CREATE INDEX "guild_members_playerId_idx" ON "guild_members"("playerId");

-- CreateIndex
CREATE INDEX "guild_members_role_idx" ON "guild_members"("role");

-- CreateIndex
CREATE INDEX "guild_invites_guildId_idx" ON "guild_invites"("guildId");

-- CreateIndex
CREATE INDEX "guild_invites_inviteeId_status_idx" ON "guild_invites"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "guild_invites_expiresAt_idx" ON "guild_invites"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "guild_invites_guildId_inviteeId_status_key" ON "guild_invites"("guildId", "inviteeId", "status");

-- CreateIndex
CREATE INDEX "guild_activity_guildId_timestamp_idx" ON "guild_activity"("guildId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "guild_activity_actorId_idx" ON "guild_activity"("actorId");

-- AddForeignKey
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_activity" ADD CONSTRAINT "guild_activity_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_activity" ADD CONSTRAINT "guild_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_activity" ADD CONSTRAINT "guild_activity_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
