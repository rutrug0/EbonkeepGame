-- AlterTable
ALTER TABLE "player_profiles"
ADD COLUMN "experience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "staminaCurrent" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "staminaMax" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "staminaUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "contract_board_slots" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "contractName" TEXT,
  "difficulty" TEXT,
  "familyId" TEXT,
  "familyName" TEXT,
  "locationName" TEXT,
  "encounterLevel" INTEGER,
  "enemyCount" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "replenishAt" TIMESTAMP(3),
  "activeRunId" TEXT,
  "rewardsPreview" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_board_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_runs" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "contractName" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "familyName" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "encounterLevel" INTEGER NOT NULL,
  "travelEndsAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "winnerSide" TEXT NOT NULL,
  "combatBackgroundPath" TEXT,
  "travelImagePath" TEXT,
  "playerSnapshot" JSONB NOT NULL,
  "enemySnapshots" JSONB NOT NULL,
  "events" JSONB NOT NULL,
  "rewards" JSONB NOT NULL,
  "rewardsGranted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_board_slots_playerId_slotIndex_key" ON "contract_board_slots"("playerId", "slotIndex");

-- CreateIndex
CREATE INDEX "contract_board_slots_playerId_state_idx" ON "contract_board_slots"("playerId", "state");

-- CreateIndex
CREATE INDEX "contract_board_slots_playerId_expiresAt_idx" ON "contract_board_slots"("playerId", "expiresAt");

-- CreateIndex
CREATE INDEX "contract_board_slots_playerId_replenishAt_idx" ON "contract_board_slots"("playerId", "replenishAt");

-- CreateIndex
CREATE INDEX "contract_runs_playerId_state_idx" ON "contract_runs"("playerId", "state");

-- CreateIndex
CREATE INDEX "contract_runs_playerId_createdAt_idx" ON "contract_runs"("playerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "contract_board_slots"
ADD CONSTRAINT "contract_board_slots_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_runs"
ADD CONSTRAINT "contract_runs_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
