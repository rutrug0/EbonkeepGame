/**
 * Script to clean up all auction test data
 * Usage: npx tsx cleanup-auction-test.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
  console.log("\n🧹 Cleaning up auction test data...\n");

  // Delete all auction-related data
  const bidCount = await prisma.auctionBid.deleteMany({});
  console.log(`  ✓ Deleted ${bidCount.count} auction bids`);

  const itemCount = await prisma.auctionItem.deleteMany({});
  console.log(`  ✓ Deleted ${itemCount.count} auction items`);

  const instanceCount = await prisma.auctionInstance.deleteMany({});
  console.log(`  ✓ Deleted ${instanceCount.count} auction instances`);

  const rewardCount = await prisma.auctionPendingReward.deleteMany({});
  console.log(`  ✓ Deleted ${rewardCount.count} pending rewards`);

  const participationCount = await prisma.auctionParticipation.deleteMany({});
  console.log(`  ✓ Deleted ${participationCount.count} participations`);

  const listingCount = await prisma.auctionPlayerListing.deleteMany({});
  console.log(`  ✓ Deleted ${listingCount.count} player listings`);

  // Clean up test players
  const testPlayerCount = await prisma.currencyBalance.deleteMany({
    where: { playerId: { startsWith: "test_player_" } }
  });
  console.log(`  ✓ Deleted ${testPlayerCount.count} test player currencies`);

  const testProfileCount = await prisma.playerProfile.deleteMany({
    where: { id: { startsWith: "test_player_" } }
  });
  console.log(`  ✓ Deleted ${testProfileCount.count} test player profiles`);

  console.log("\n✅ Cleanup complete!\n");
}

cleanup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
