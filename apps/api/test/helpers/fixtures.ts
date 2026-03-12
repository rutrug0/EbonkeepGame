import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { ensureStarterInventoryItems } from "../../src/modules/inventory/starter-items.js";
import { inventoryItemSchema, type InventoryItem, type PlayerClass } from "@ebonkeep/shared";

const DEFAULT_TEST_CLASS: PlayerClass = "juggernaut";

export async function loginAsGuest(
  app: FastifyInstance,
  options?: { guestId?: string; playerClass?: PlayerClass }
) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/dev/guest-login",
    payload: {
      guestId: options?.guestId ?? `guest-${randomUUID()}`,
      class: options?.playerClass ?? DEFAULT_TEST_CLASS
    }
  });

  return {
    response,
    body: response.json() as { accessToken: string; playerId: string; accountId: string }
  };
}

export async function registerUser(
  app: FastifyInstance,
  overrides?: Partial<{
    username: string;
    email: string;
    password: string;
    class: PlayerClass;
  }>
) {
  const id = randomUUID().slice(0, 8);
  const payload = {
    username: overrides?.username ?? `warden_${id}`,
    email: overrides?.email ?? `warden_${id}@example.com`,
    password: overrides?.password ?? "password123",
    class: overrides?.class ?? DEFAULT_TEST_CLASS,
    portraitId: "str_01",
    backgroundId: "bg_01"
  };

  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload
  });

  return {
    payload,
    response,
    body: response.json() as { accessToken: string; playerId: string; accountId: string }
  };
}

export function authHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

export async function setPlayerDucats(prisma: PrismaClient, playerId: string, ducats: number) {
  await prisma.currencyBalance.upsert({
    where: { playerId },
    update: { ducats },
    create: {
      playerId,
      ducats,
      imperials: 0
    }
  });
}

export async function createInventoryItemForPlayer(
  prisma: PrismaClient,
  playerId: string,
  overrides?: Partial<InventoryItem>
) {
  const item = inventoryItemSchema.parse({
    id: overrides?.id ?? `item_${randomUUID().replaceAll("-", "")}`,
    itemCode: overrides?.itemCode ?? `test_item_${randomUUID().replaceAll("-", "")}`,
    itemName: overrides?.itemName ?? "Test Item",
    rarity: overrides?.rarity ?? "rare",
    category: overrides?.category ?? "weapon",
    equipable: overrides?.equipable ?? true,
    levelRequirement: overrides?.levelRequirement ?? 1,
    allowedSlotIds: overrides?.allowedSlotIds ?? ["weapon"],
    baseLevel: overrides?.baseLevel ?? 1,
    power: overrides?.power ?? 25,
    archetype: overrides?.archetype ?? {
      majorCategory: "weapon",
      weaponArchetype: "melee",
      weaponFamily: "sword"
    },
    statBonuses: overrides?.statBonuses ?? {
      damage: 5
    },
    damageRoll: overrides?.damageRoll,
    prefix: overrides?.prefix,
    affix: overrides?.affix,
    description: overrides?.description ?? "Created by automated tests."
  });

  await prisma.inventoryItem.create({
    data: {
      id: item.id,
      playerId,
      itemCode: item.itemCode,
      slotKey: "inventory",
      quantity: 1,
      itemData: item
    }
  });

  return item;
}

export async function createActiveAuction(prisma: PrismaClient, options: {
  itemCode?: string;
  currentBid?: number;
  currentWinnerId?: string | null;
  startingBid?: number;
  sellerId?: string | null;
  isPlayerSubmitted?: boolean;
  feePercentage?: number;
}) {
  const auction = await prisma.auctionInstance.create({
    data: {
      levelBracketMin: 1,
      levelBracketMax: 10,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      status: "active"
    }
  });

  const item = await prisma.auctionItem.create({
    data: {
      auctionInstanceId: auction.id,
      itemCode: options.itemCode ?? JSON.stringify({ name: "Test Relic" }),
      itemLevel: 5,
      itemRarity: "rare",
      itemCategory: "weapon",
      startingBid: options.startingBid ?? 100,
      currentBid: options.currentBid ?? 0,
      currentWinnerId: options.currentWinnerId ?? null,
      isPlayerSubmitted: options.isPlayerSubmitted ?? false,
      sellerId: options.sellerId ?? null,
      feePercentage: options.feePercentage ?? 0
    }
  });

  return { auction, item };
}

export async function expireAuction(prisma: PrismaClient, auctionId: string) {
  await prisma.auctionInstance.update({
    where: { id: auctionId },
    data: {
      endTime: new Date(Date.now() - 1_000)
    }
  });
}

export async function seedLeaderboardPlayers(
  prisma: PrismaClient,
  players: Array<{ name: string; class: PlayerClass; level: number; gearScore: number; updatedAt?: Date }>
) {
  for (const player of players) {
    const account = await prisma.account.create({
      data: {
        provider: "test",
        providerUserId: `${player.name}-${randomUUID()}`,
        username: player.name
      }
    });

    const profile = await prisma.playerProfile.create({
      data: {
        accountId: account.id,
        class: player.class,
        level: player.level,
        gearScore: player.gearScore,
        updatedAt: player.updatedAt ?? new Date()
      }
    });

    await prisma.playerStat.create({
      data: {
        playerId: profile.id
      }
    });

    await prisma.currencyBalance.create({
      data: {
        playerId: profile.id,
        ducats: 5_000,
        imperials: 0
      }
    });

    await ensureStarterInventoryItems(prisma, profile.id, player.class);
  }
}
