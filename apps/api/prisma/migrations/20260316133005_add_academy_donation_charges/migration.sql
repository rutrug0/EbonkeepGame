-- CreateTable
CREATE TABLE "player_academy_donation_charges" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "charges" INTEGER NOT NULL DEFAULT 20,
    "lastRechargeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_academy_donation_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_academy_donation_charges_playerId_key" ON "player_academy_donation_charges"("playerId");

-- AddForeignKey
ALTER TABLE "player_academy_donation_charges" ADD CONSTRAINT "player_academy_donation_charges_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
