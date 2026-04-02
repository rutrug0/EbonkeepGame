import { PrismaClient } from "@prisma/client";
import { getConsumableDefinition } from "@ebonkeep/shared/consumables";
import { inventoryItemSchema } from "@ebonkeep/shared/inventory";

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
  const now = new Date();
  const auction =
    (await prisma.auctionInstance.findFirst({
      where: {
        levelBracketMin: 1,
        levelBracketMax: 10,
        status: "active",
        endTime: {
          gt: now
        }
      },
      orderBy: [{ startTime: "desc" }, { createdAt: "desc" }]
    })) ??
    (await prisma.auctionInstance.create({
      data: {
        levelBracketMin: 1,
        levelBracketMax: 10,
        startTime: new Date(now.getTime() - 60_000),
        endTime: new Date(now.getTime() + 60 * 60 * 1000),
        status: "active"
      }
    }));

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

  await prisma.currencyBalance.upsert({
    where: { playerId },
    update: {
      ducats: 10_000
    },
    create: {
      playerId,
      ducats: 10_000,
      imperials: 0
    }
  });

  return { auction, item, itemPayload };
}

export async function seedConsumableInventoryItem(
  playerId: string,
  itemCode: string,
  quantity = 1
) {
  const definition = getConsumableDefinition(itemCode);
  if (!definition) {
    throw new Error(`Missing consumable definition: ${itemCode}`);
  }

  const id = `e2e_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const itemData = inventoryItemSchema.parse({
    id,
    itemCode: definition.itemCode,
    itemName: definition.displayName,
    rarity: definition.rarity,
    category: "Consumable",
    equipable: false,
    levelRequirement: 1,
    allowedSlotIds: [],
    baseLevel: 1,
    power: 0,
    archetype: { majorCategory: "consumable" },
    statBonuses: {},
    description: definition.description
  });

  await prisma.inventoryItem.create({
    data: {
      id,
      playerId,
      itemCode: definition.itemCode,
      slotKey: "inventory",
      quantity: Math.max(1, Math.floor(quantity)),
      itemData
    }
  });

  return {
    id,
    itemCode: definition.itemCode,
    displayName: definition.displayName
  };
}
