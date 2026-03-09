/**
 * Script to delete all inventory items for a specific player
 * Usage: npx tsx delete-test-inventory.ts <email>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteInventory(email: string) {
  console.log(`\n🗑️  Looking for account: ${email}`);

  const account = await prisma.account.findUnique({
    where: { email },
    include: { profiles: true }
  });

  if (!account || account.profiles.length === 0) {
    console.error(`❌ Account or profile not found: ${email}`);
    return;
  }

  const player = account.profiles[0];
  console.log(`✅ Found player: ${player.id}`);

  const deleted = await prisma.inventoryItem.deleteMany({
    where: { playerId: player.id }
  });

  console.log(`🗑️  Deleted ${deleted.count} inventory items\n`);
}

const email = process.argv[2] || "pat.kredatus@gmail.com";

deleteInventory(email)
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
