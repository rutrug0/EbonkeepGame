/*
  Warnings:

  - You are about to drop the `player_academy_donation_charges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `player_renown_nodes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "player_academy_donation_charges" DROP CONSTRAINT "player_academy_donation_charges_playerId_fkey";

-- DropForeignKey
ALTER TABLE "player_renown_nodes" DROP CONSTRAINT "player_renown_nodes_playerId_fkey";

-- DropTable
DROP TABLE "player_academy_donation_charges";

-- DropTable
DROP TABLE "player_renown_nodes";
