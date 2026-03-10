import { PrismaClient } from "@prisma/client";

const postgresPort = process.env.EBONKEEP_POSTGRES_HOST_PORT ?? "55432";
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://ebonkeep:ebonkeep@localhost:${postgresPort}/ebonkeep?schema=test`;

export const prisma = new PrismaClient({
  datasourceUrl: databaseUrl
});

export async function seedPendingAuctionReward(playerId: string, itemCode: string) {
  return prisma.auctionPendingReward.create({
    data: {
      playerId,
      itemId: `reward_item_${Date.now()}`,
      itemCode,
      auctionId: `auction_${Date.now()}`,
      winningBid: 275,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      claimed: false
    }
  });
}

export async function seedPlayableAuction(playerId: string) {
  const auction = await prisma.auctionInstance.create({
    data: {
      levelBracketMin: 1,
      levelBracketMax: 10,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: "active"
    }
  });

  const itemPayload = {
    id: `auction_item_${Date.now()}`,
    itemCode: `auction_code_${Date.now()}`,
    itemName: "Playwright Blade",
    rarity: "rare",
    category: "weapon",
    equipable: true,
    levelRequirement: 1,
    allowedSlotIds: ["weapon"],
    baseLevel: 1,
    power: 50,
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: "melee",
      weaponFamily: "sword"
    },
    statBonuses: {
      damage: 10
    },
    description: "Seeded for Playwright."
  };

  const item = await prisma.auctionItem.create({
    data: {
      auctionInstanceId: auction.id,
      itemCode: JSON.stringify(itemPayload),
      itemLevel: 5,
      itemRarity: "rare",
      itemCategory: "weapon",
      startingBid: 100,
      currentBid: 0,
      currentWinnerId: null,
      bidCount: 0,
      extensionsUsed: 0,
      isPlayerSubmitted: false
    }
  });

  await prisma.currencyBalance.update({
    where: { playerId },
    data: {
      ducats: 10_000
    }
  });

  return { auction, item, itemPayload };
}
