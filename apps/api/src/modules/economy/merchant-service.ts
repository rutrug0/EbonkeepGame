import { randomUUID } from "node:crypto";

import type { InventoryItem as PrismaInventoryItem, PrismaClient, ShopInstance } from "@prisma/client";
import {
  inventoryItemSchema,
  merchantStateSchema,
  type InventoryItem,
  type MerchantOffer,
  type MerchantState,
  type PlayerState
} from "@ebonkeep/shared";
import { TEMPERING_DRAUGHT_ITEM_CODE } from "@ebonkeep/shared/forge";

import {
  MERCHANT_TEMPLATE_IDS,
  cloneInventoryItemForPlayer,
  parseStoredInventoryItem,
  rollInventoryItem
} from "../inventory/item-service.js";
import { loadPlayerState } from "../player/state-service.js";

const MERCHANT_STOCK_SIZE = 8;
const MERCHANT_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MAX_MERCHANT_ITEM_LEVEL_DELTA = 3;
const BUYBACK_PRICE_MARKUP_FACTOR = 1.1;
/** Fixed buy price for the Tempering Draught sold in the merchant's last slot. */
const TEMPERING_DRAUGHT_BUY_PRICE_DUCATS = 650;

const BUY_PRICE_RARITY_MULTIPLIER = {
  common: 1,
  uncommon: 1.35,
  rare: 1.85,
  epic: 2.6
} as const;

const SELL_PRICE_FACTOR = 0.35;

type MerchantOfferRow = Pick<
  ShopInstance,
  "id" | "offerCode" | "offerIndex" | "itemCode" | "itemData" | "buyPriceDucats" | "soldAt" | "refreshAt"
>;

type MerchantPlayerSnapshot = {
  level: number;
  currency: {
    ducats: number;
    imperials: number;
  };
};

export class MerchantActionError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function randomInt(min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rollMerchantRarity(): InventoryItem["rarity"] {
  const roll = Math.random();
  if (roll < 0.45) {
    return "common";
  }
  if (roll < 0.75) {
    return "uncommon";
  }
  if (roll < 0.93) {
    return "rare";
  }
  return "epic";
}

function computeBuyPriceDucats(item: InventoryItem): number {
  const level = item.baseLevel ?? item.levelRequirement;
  const base = item.power * 20 + level * 14;
  return Math.max(45, Math.round(base * BUY_PRICE_RARITY_MULTIPLIER[item.rarity]));
}

export function computeSellPriceDucats(item: InventoryItem): number {
  const basePrice = Math.max(12, Math.floor(computeBuyPriceDucats(item) * SELL_PRICE_FACTOR));
  if (item.temperingFailed) {
    // Failed tempering reduces sell value by 50%
    return Math.max(5, Math.floor(basePrice * 0.5));
  }
  return basePrice;
}

function isBuybackOffer(row: Pick<ShopInstance, "offerCode">): boolean {
  return row.offerCode.startsWith("buyback:");
}

function parseMerchantItem(row: MerchantOfferRow): InventoryItem | null {
  const parsed = row.itemData ? row.itemData : null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const result = inventoryItemSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  return result.data;
}

function toMerchantOffer(row: MerchantOfferRow): MerchantOffer | null {
  const item = parseMerchantItem(row);
  if (!item) {
    return null;
  }

  return {
    offerId: row.id,
    offerIndex: row.offerIndex,
    item,
    buyPriceDucats: row.buyPriceDucats,
    sold: row.soldAt !== null,
    refreshAt: row.refreshAt.toISOString()
  };
}

function buildSellPrices(playerState: PlayerState): Record<string, number> {
  const prices: Record<string, number> = {};

  for (const item of playerState.inventory) {
    prices[item.id] = computeSellPriceDucats(item);
  }

  for (const item of Object.values(playerState.equipment)) {
    if (!item) {
      continue;
    }
    prices[item.id] = computeSellPriceDucats(item);
  }

  return prices;
}

async function loadMerchantPlayerSnapshot(prisma: PrismaClient, playerId: string): Promise<MerchantPlayerSnapshot> {
  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      level: true,
      currency: {
        select: {
          ducats: true,
          imperials: true
        }
      }
    }
  });

  if (!profile || !profile.currency) {
    throw new MerchantActionError(404, "Merchant state not found.");
  }

  return {
    level: profile.level,
    currency: {
      ducats: profile.currency.ducats,
      imperials: profile.currency.imperials
    }
  };
}

function buildTemperingDraughtOfferRow(playerId: string, offerIndex: number, refreshAt: Date): {
  id: string;
  playerId: string;
  offerCode: string;
  offerIndex: number;
  itemCode: string;
  itemData: InventoryItem;
  buyPriceDucats: number;
  refreshAt: Date;
} {
  const item = inventoryItemSchema.parse({
    id: `merchant_draught_${randomUUID().replaceAll("-", "")}`,
    itemCode: TEMPERING_DRAUGHT_ITEM_CODE,
    itemName: "Tempering Draught",
    rarity: "uncommon",
    category: "Consumable",
    equipable: false,
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: [],
    power: 0,
    archetype: { majorCategory: "consumable" },
    statBonuses: {},
    description: "A compound of quench stone, bone ash and pitch resin. Applied to a fractured tempering, it resets the metal grain and restores the weapon's full damage.",
    iconAssetPath: "/assets/materials/mat_tempering_draught.png"
  }) as InventoryItem;

  return {
    id: `merchant_offer_${randomUUID().replaceAll("-", "")}`,
    playerId,
    offerCode: `${TEMPERING_DRAUGHT_ITEM_CODE}_${offerIndex}`,
    offerIndex,
    itemCode: TEMPERING_DRAUGHT_ITEM_CODE,
    itemData: item,
    buyPriceDucats: TEMPERING_DRAUGHT_BUY_PRICE_DUCATS,
    refreshAt
  };
}

function buildMerchantOfferRows(playerId: string, playerLevel: number): Array<{
  id: string;
  playerId: string;
  offerCode: string;
  offerIndex: number;
  itemCode: string;
  itemData: InventoryItem;
  buyPriceDucats: number;
  refreshAt: Date;
}> {
  const itemLevelMax = Math.max(1, playerLevel + MAX_MERCHANT_ITEM_LEVEL_DELTA);
  const refreshAt = new Date(Date.now() + MERCHANT_REFRESH_INTERVAL_MS);
  const randomSlotCount = MERCHANT_STOCK_SIZE - 1;

  const randomRows = Array.from({ length: randomSlotCount }, (_, offerIndex) => {
    const templateId = MERCHANT_TEMPLATE_IDS[randomInt(0, MERCHANT_TEMPLATE_IDS.length - 1)];
    const itemLevel = randomInt(1, itemLevelMax);
    const item = rollInventoryItem({
      playerId: `merchant_${playerId}`,
      templateId,
      rarity: rollMerchantRarity(),
      itemLevel,
      explicitId: `merchant_item_${randomUUID().replaceAll("-", "")}`
    });
    const offerId = `merchant_offer_${randomUUID().replaceAll("-", "")}`;

    return {
      id: offerId,
      playerId,
      offerCode: `${templateId}_${offerIndex}`,
      offerIndex,
      itemCode: item.itemCode,
      itemData: item,
      buyPriceDucats: computeBuyPriceDucats(item),
      refreshAt
    };
  });

  return [...randomRows, buildTemperingDraughtOfferRow(playerId, randomSlotCount, refreshAt)];
}

async function getNextMerchantRefreshAt(prisma: Pick<PrismaClient, "shopInstance">, playerId: string): Promise<Date> {
  const latestOffer = await prisma.shopInstance.findFirst({
    where: {
      playerId,
      NOT: {
        offerCode: {
          startsWith: "buyback:"
        }
      }
    },
    orderBy: {
      refreshAt: "desc"
    },
    select: {
      refreshAt: true
    }
  });

  return latestOffer?.refreshAt ?? new Date(Date.now() + MERCHANT_REFRESH_INTERVAL_MS);
}

async function replaceMerchantStock(prisma: PrismaClient, playerId: string, playerLevel: number): Promise<void> {
  const nextRows = buildMerchantOfferRows(playerId, playerLevel);

  await prisma.$transaction(async (tx) => {
    await tx.shopInstance.deleteMany({
      where: { playerId }
    });

    await tx.shopInstance.createMany({
      data: nextRows
    });
  });
}

async function ensureMerchantStock(prisma: PrismaClient, playerId: string): Promise<MerchantOfferRow[]> {
  const rows = await prisma.shopInstance.findMany({
    where: { playerId },
    orderBy: {
      offerIndex: "asc"
    },
    select: {
      id: true,
      offerCode: true,
      offerIndex: true,
      itemCode: true,
      itemData: true,
      buyPriceDucats: true,
      soldAt: true,
      refreshAt: true
    }
  });

  const regularRows = rows.filter((row) => !isBuybackOffer(row));

  const needsRestock =
    regularRows.length === 0 ||
    regularRows.length !== MERCHANT_STOCK_SIZE ||
    regularRows.some((row) => row.refreshAt.getTime() <= Date.now() || row.itemData === null);

  if (!needsRestock) {
    return rows;
  }

  const player = await loadMerchantPlayerSnapshot(prisma, playerId);
  await replaceMerchantStock(prisma, playerId, player.level);

  return prisma.shopInstance.findMany({
    where: { playerId },
    orderBy: {
      offerIndex: "asc"
    },
    select: {
      id: true,
      offerCode: true,
      offerIndex: true,
      itemCode: true,
      itemData: true,
      buyPriceDucats: true,
      soldAt: true,
      refreshAt: true
    }
  });
}

async function getActualItemSourceSlot(
  prisma: PrismaClient,
  playerId: string,
  itemId: string
): Promise<{ itemRecord: Pick<PrismaInventoryItem, "id" | "itemCode" | "itemData" | "playerId" | "slotKey">; actualSourceSlot: string }> {
  const [itemRecord, equipmentSlots] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        itemCode: true,
        itemData: true,
        playerId: true,
        slotKey: true
      }
    }),
    prisma.equipmentSlot.findMany({
      where: { playerId },
      select: {
        slotType: true,
        itemId: true
      }
    })
  ]);

  if (!itemRecord || itemRecord.playerId !== playerId) {
    throw new MerchantActionError(404, "Inventory item not found.");
  }

  const equippedSlot = equipmentSlots.find((slot) => slot.itemId === itemId);
  return {
    itemRecord,
    actualSourceSlot: equippedSlot?.slotType ?? itemRecord.slotKey
  };
}

export async function loadMerchantState(
  prisma: PrismaClient,
  playerId: string,
  playerState?: PlayerState | null
): Promise<MerchantState> {
  const resolvedPlayerState = playerState ?? (await loadPlayerState(prisma, playerId));
  if (!resolvedPlayerState) {
    throw new MerchantActionError(404, "Player state not found.");
  }

  const [rows, playerSnapshot] = await Promise.all([
    ensureMerchantStock(prisma, playerId),
    loadMerchantPlayerSnapshot(prisma, playerId)
  ]);

  const offers = rows
    .map((row) => toMerchantOffer(row))
    .filter((offer, index): offer is MerchantOffer => offer !== null && rows[index]?.soldAt === null)
    .sort((left, right) => left.offerIndex - right.offerIndex);
  const nextRefreshAt =
    rows.find((row) => !isBuybackOffer(row))?.refreshAt.toISOString() ??
    new Date(Date.now() + MERCHANT_REFRESH_INTERVAL_MS).toISOString();

  return merchantStateSchema.parse({
    offers,
    sellPrices: buildSellPrices(resolvedPlayerState),
    nextRefreshAt,
    currency: playerSnapshot.currency
  });
}

export async function restockMerchant(prisma: PrismaClient, playerId: string): Promise<void> {
  const player = await loadMerchantPlayerSnapshot(prisma, playerId);
  await replaceMerchantStock(prisma, playerId, player.level);
}

export async function buyMerchantOffer(prisma: PrismaClient, playerId: string, offerId: string): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const [offer, currency] = await Promise.all([
      tx.shopInstance.findFirst({
        where: {
          id: offerId,
          playerId
        },
        select: {
          id: true,
          offerCode: true,
          offerIndex: true,
          itemCode: true,
          itemData: true,
          buyPriceDucats: true,
          soldAt: true,
          refreshAt: true
        }
      }),
      tx.currencyBalance.findUnique({
        where: { playerId },
        select: {
          ducats: true
        }
      })
    ]);

    if (!offer) {
      throw new MerchantActionError(404, "Merchant offer not found.");
    }
    if (!currency) {
      throw new MerchantActionError(404, "Currency balance not found.");
    }
    if (offer.soldAt !== null) {
      throw new MerchantActionError(400, "Merchant offer is already sold.");
    }
    if (offer.refreshAt <= now) {
      throw new MerchantActionError(400, "Merchant offer has expired.");
    }

    const parsedItem = parseMerchantItem(offer);
    if (!parsedItem) {
      throw new MerchantActionError(400, "Merchant offer is invalid.");
    }
    if (currency.ducats < offer.buyPriceDucats) {
      throw new MerchantActionError(400, "Not enough ducats.");
    }

    const ownedItem = cloneInventoryItemForPlayer({
      item: parsedItem,
      playerId
    });

    await tx.inventoryItem.create({
      data: {
        id: ownedItem.id,
        playerId,
        itemCode: ownedItem.itemCode,
        slotKey: "inventory",
        quantity: 1,
        itemData: ownedItem
      }
    });

    await tx.currencyBalance.update({
      where: { playerId },
      data: {
        ducats: {
          decrement: offer.buyPriceDucats
        }
      }
    });

    await tx.shopInstance.update({
      where: { id: offer.id },
      data: {
        soldAt: now
      }
    });
  });
}

export async function sellMerchantItem(
  prisma: PrismaClient,
  playerId: string,
  itemId: string,
  fromSlot: string
): Promise<void> {
  const { itemRecord, actualSourceSlot } = await getActualItemSourceSlot(prisma, playerId, itemId);

  if (actualSourceSlot !== fromSlot) {
    throw new MerchantActionError(400, "Source slot does not match item location.");
  }

  const item = parseStoredInventoryItem(itemRecord);
  if (!item) {
    throw new MerchantActionError(400, "Item data is invalid.");
  }

  const sellPrice = computeSellPriceDucats(item);
  const buybackPrice = Math.max(sellPrice + 1, Math.ceil(sellPrice * BUYBACK_PRICE_MARKUP_FACTOR));

  await prisma.$transaction(async (tx) => {
    if (actualSourceSlot !== "inventory") {
      await tx.equipmentSlot.updateMany({
        where: {
          playerId,
          itemId
        },
        data: {
          itemId: null
        }
      });
    }

    await tx.inventoryItem.delete({
      where: { id: itemId }
    });

    await tx.currencyBalance.update({
      where: { playerId },
      data: {
        ducats: {
          increment: sellPrice
        }
      }
    });

    const latestOffer = await tx.shopInstance.findFirst({
      where: {
        playerId
      },
      orderBy: {
        offerIndex: "desc"
      },
      select: {
        offerIndex: true
      }
    });

    await tx.shopInstance.create({
      data: {
        id: `merchant_offer_${randomUUID().replaceAll("-", "")}`,
        playerId,
        offerCode: `buyback:${itemId}`,
        offerIndex: (latestOffer?.offerIndex ?? MERCHANT_STOCK_SIZE - 1) + 1,
        itemCode: item.itemCode,
        itemData: item,
        buyPriceDucats: buybackPrice,
        refreshAt: await getNextMerchantRefreshAt(tx, playerId)
      }
    });
  });
}
