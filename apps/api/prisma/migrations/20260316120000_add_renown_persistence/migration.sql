-- AlterTable: add renown column to currencies
ALTER TABLE "currencies" ADD COLUMN "renown" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: player_renown_nodes
CREATE TABLE "player_renown_nodes" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_renown_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_renown_nodes_playerId_idx" ON "player_renown_nodes"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_renown_nodes_playerId_nodeId_key" ON "player_renown_nodes"("playerId", "nodeId");

-- AddForeignKey
ALTER TABLE "player_renown_nodes" ADD CONSTRAINT "player_renown_nodes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
