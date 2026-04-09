-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceRefId" TEXT,
    "senderPlayerId" TEXT,
    "senderName" TEXT,
    "guildId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_deliveries" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientPlayerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reward_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reward_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combat_replay_records" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "combat_replay_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_sourceType_sourceRefId_idx" ON "messages"("sourceType", "sourceRefId");

-- CreateIndex
CREATE INDEX "messages_senderPlayerId_idx" ON "messages"("senderPlayerId");

-- CreateIndex
CREATE INDEX "messages_guildId_idx" ON "messages"("guildId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "message_deliveries_recipientPlayerId_createdAt_idx" ON "message_deliveries"("recipientPlayerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "message_deliveries_recipientPlayerId_readAt_idx" ON "message_deliveries"("recipientPlayerId", "readAt");

-- CreateIndex
CREATE INDEX "message_deliveries_recipientPlayerId_claimedAt_idx" ON "message_deliveries"("recipientPlayerId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_deliveries_messageId_recipientPlayerId_key" ON "message_deliveries"("messageId", "recipientPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reward_attachments_messageId_key" ON "message_reward_attachments"("messageId");

-- CreateIndex
CREATE INDEX "combat_replay_records_createdAt_idx" ON "combat_replay_records"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "combat_replay_records_sourceType_sourceRefId_kind_key" ON "combat_replay_records"("sourceType", "sourceRefId", "kind");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderPlayerId_fkey" FOREIGN KEY ("senderPlayerId") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replayId_fkey" FOREIGN KEY ("replayId") REFERENCES "combat_replay_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_recipientPlayerId_fkey" FOREIGN KEY ("recipientPlayerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reward_attachments" ADD CONSTRAINT "message_reward_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
