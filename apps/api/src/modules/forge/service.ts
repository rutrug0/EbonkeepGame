import { randomInt } from "node:crypto";

import type { CurrencyBalance, Prisma, PrismaClient } from "@prisma/client";

import {
  FORGE_MAX_ENCHANT_LEVEL,
  FORGE_SAFE_ENCHANT_LEVEL,
  forgeMendResponseSchema,
  forgeEnchantResponseSchema,
  forgeOutcomeSchema,
  getForgeAttemptCostDucats,
  getEffectiveCatalystRarity,
  getForgeDamageBonusBps,
  getForgeDamagePenaltyBps,
  getForgeSuccessChancePct,
  TEMPERING_DRAUGHT_ITEM_CODE,
  type ForgeMendResponse,
  type ForgeEnchantResponse
} from "@ebonkeep/shared/forge";
import { inventoryItemSchema, type InventoryItem, type WeaponDamageRoll } from "@ebonkeep/shared/inventory";

import { loadPlayerState } from "../player/state-service.js";
import {
  getStoredWeaponForgeData,
  parseStoredInventoryItem,
  withStoredWeaponForgeData
} from "../inventory/item-service.js";
import {
  loadForgeState,
  loadPersistedForgeState,
  savePersistedForgeState,
  type ForgeDbClient
} from "./state.js";

async function isUnlimitedForgeConsumables(prisma: PrismaClient | Prisma.TransactionClient, playerId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ unlimitedForgeConsumablesEnabled: boolean }>>`
    SELECT "unlimitedForgeConsumablesEnabled" FROM "player_profiles" WHERE "id" = ${playerId} LIMIT 1
  `;
  return rows[0]?.unlimitedForgeConsumablesEnabled ?? false;
}

export class ForgeError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ForgeError";
  }
}

function assertWeaponItem(item: InventoryItem | null): InventoryItem & { damageRoll: WeaponDamageRoll } {
  if (!item || item.archetype.majorCategory !== "weapon" || !item.damageRoll) {
    throw new ForgeError("INVALID_FORGE_WEAPON", 400, "Only weapons can be enchanted right now.");
  }
  return item as InventoryItem & { damageRoll: WeaponDamageRoll };
}

async function ensureCurrency(prisma: ForgeDbClient, playerId: string): Promise<CurrencyBalance> {
  const existing = await prisma.currencyBalance.findUnique({
    where: { playerId }
  });

  if (existing) {
    return existing;
  }

  return prisma.currencyBalance.create({
    data: {
      playerId,
      ducats: 1_000,
      imperials: 0
    }
  });
}

function getCurrentEnchantLevel(item: InventoryItem): number {
  return item.enchanting?.track === "weapon" ? item.enchanting.level : 0;
}

function getCurrentBonusScaleBps(item: InventoryItem): number {
  return item.enchanting?.track === "weapon" ? item.enchanting.bonusScaleBps : 0;
}

export async function getForgeState(
  prisma: PrismaClient,
  playerId: string
) {
  return loadForgeState(prisma, playerId);
}

export async function attemptWeaponEnchant(
  prisma: PrismaClient,
  playerId: string,
  weaponItemId: string
): Promise<ForgeEnchantResponse> {
  const txResult = await prisma.$transaction(async (tx) => {
    const persistedState = await loadPersistedForgeState(tx, playerId);
    if (persistedState.instability) {
      throw new ForgeError("FORGE_INSTABILITY_ACTIVE", 409, "Stabilize your forge fracture before attempting another enchant.");
    }

    const itemRecord = await tx.inventoryItem.findUnique({
      where: { id: weaponItemId },
      select: {
        id: true,
        playerId: true,
        itemCode: true,
        itemData: true
      }
    });

    if (!itemRecord || itemRecord.playerId !== playerId) {
      throw new ForgeError("FORGE_WEAPON_NOT_FOUND", 404, "Weapon not found.");
    }

    const weapon = assertWeaponItem(parseStoredInventoryItem(itemRecord));
    const previousEnchantLevel = getCurrentEnchantLevel(weapon);
    if (previousEnchantLevel >= FORGE_MAX_ENCHANT_LEVEL) {
      throw new ForgeError("FORGE_MAX_LEVEL_REACHED", 400, "This weapon has already reached the maximum enchant level.");
    }

    const targetEnchantLevel = previousEnchantLevel + 1;
    const successChancePct = getForgeSuccessChancePct(targetEnchantLevel);
    const catalystRarity = getEffectiveCatalystRarity(targetEnchantLevel, weapon.rarity);
    const attemptCostDucats = getForgeAttemptCostDucats(targetEnchantLevel);

    const currency = await ensureCurrency(tx, playerId);
    const unlimitedConsumables = await isUnlimitedForgeConsumables(tx, playerId);
    if (!unlimitedConsumables && currency.ducats < attemptCostDucats) {
      throw new ForgeError("FORGE_NOT_ENOUGH_DUCATS", 400, "Not enough ducats for that enchant attempt.");
    }

    const storedForgeData = getStoredWeaponForgeData(itemRecord.itemData, weapon);
    if (!storedForgeData) {
      throw new ForgeError("FORGE_WEAPON_DATA_INVALID", 400, "Weapon data is incomplete.");
    }

    const didSucceed = targetEnchantLevel <= FORGE_SAFE_ENCHANT_LEVEL || randomInt(0, 100) < successChancePct;
    const damagePenaltyBps = didSucceed ? 0 : getForgeDamagePenaltyBps(targetEnchantLevel);
    const nextForgeData = didSucceed
      ? {
          ...storedForgeData,
          level: targetEnchantLevel,
          bonusScaleBps: getForgeDamageBonusBps(targetEnchantLevel),
          temperingFailed: false
        }
      : {
          ...storedForgeData,
          level: 0,
          bonusScaleBps: 0,
          temperingFailed: true,
          damagePenaltyBps
        };

    const resultingInstability = didSucceed
      ? null
      : {
          weaponItemId,
          weaponName: weapon.itemName,
          sourceEnchantLevel: targetEnchantLevel,
          damagePenaltyBps,
          triggeredAt: new Date().toISOString()
        };

    await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: unlimitedConsumables ? 0 : attemptCostDucats } }
    });

    await tx.inventoryItem.update({
      where: { id: weaponItemId },
      data: {
        itemData: withStoredWeaponForgeData(itemRecord.itemData, nextForgeData) as Prisma.InputJsonValue
      }
    });

    await savePersistedForgeState(tx, playerId, { instability: resultingInstability });

    return { weapon, previousEnchantLevel, targetEnchantLevel, didSucceed, successChancePct, catalystRarity, attemptCostDucats };
  });

  const { weapon, previousEnchantLevel, targetEnchantLevel, didSucceed, successChancePct, catalystRarity, attemptCostDucats } = txResult;

  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new ForgeError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }

  const updatedWeapon =
    playerState.equipment.weapon?.id === weaponItemId
      ? playerState.equipment.weapon
      : playerState.inventory.find((item) => item.id === weaponItemId) ?? null;
  const updatedDamage = updatedWeapon?.damageRoll?.averageDamage ?? weapon.damageRoll.averageDamage;

  return forgeEnchantResponseSchema.parse({
    forge: await loadForgeState(prisma, playerId),
    playerState,
    result: {
      outcome: forgeOutcomeSchema.parse(didSucceed ? "success" : "reset"),
      previousEnchantLevel,
      currentEnchantLevel: didSucceed ? targetEnchantLevel : 0,
      successChancePct,
      damageBonusBpsBefore: getCurrentBonusScaleBps(weapon),
      damageBonusBpsAfter: didSucceed ? getForgeDamageBonusBps(targetEnchantLevel) : 0,
      catalystRarity,
      attemptCostDucats,
      damageBefore: weapon.damageRoll.averageDamage,
      damageAfter: updatedDamage,
      spinTurns: randomInt(2, 11),
      landedAt: didSucceed ? "weapon" : "enchant"
    }
  });
}

export async function mendForgeWeapon(
  prisma: PrismaClient,
  playerId: string,
  weaponItemId: string
): Promise<ForgeMendResponse> {
  await prisma.$transaction(async (tx) => {
    const persistedState = await loadPersistedForgeState(tx, playerId);
    if (!persistedState.instability || persistedState.instability.weaponItemId !== weaponItemId) {
      throw new ForgeError("FORGE_INSTABILITY_NOT_ACTIVE", 400, "No active tempering failure for this weapon.");
    }

    // Find a Tempering Draught in player's inventory
    const unlimitedConsumables = await isUnlimitedForgeConsumables(tx, playerId);
    const draughtRecord = unlimitedConsumables ? null : await tx.inventoryItem.findFirst({
      where: {
        playerId,
        itemCode: TEMPERING_DRAUGHT_ITEM_CODE,
        slotKey: "inventory"
      },
      select: { id: true, itemCode: true, itemData: true }
    });

    if (!unlimitedConsumables && !draughtRecord) {
      throw new ForgeError("FORGE_MISSING_TEMPERING_DRAUGHT", 400, "You need a Tempering Draught to mend this weapon.");
    }

    // Find the weapon in inventory or equipment to clear its failure flag.
    // First try the exact ID stored at the time of failure. If that row is gone
    // (e.g. the player sold the weapon and bought it back, giving it a new id),
    // fall back to any weapon owned by this player that still carries the flag.
    let weaponRecord = await tx.inventoryItem.findUnique({
      where: { id: weaponItemId },
      select: { id: true, playerId: true, itemCode: true, itemData: true }
    });

    if (!weaponRecord || weaponRecord.playerId !== playerId) {
      const candidates = await tx.inventoryItem.findMany({
        where: { playerId },
        select: { id: true, playerId: true, itemCode: true, itemData: true }
      });
      weaponRecord = candidates.find((r) => {
        const parsed = parseStoredInventoryItem(r);
        return parsed?.archetype?.majorCategory === "weapon" && parsed?.temperingFailed === true;
      }) ?? null;
    }

    if (!weaponRecord || weaponRecord.playerId !== playerId) {
      throw new ForgeError("FORGE_WEAPON_NOT_FOUND", 404, "Weapon not found.");
    }

    const weapon = parseStoredInventoryItem(weaponRecord);
    if (!weapon || weapon.archetype.majorCategory !== "weapon") {
      throw new ForgeError("INVALID_FORGE_WEAPON", 400, "Item is not a weapon.");
    }

    const storedForgeData = getStoredWeaponForgeData(weaponRecord.itemData, weapon);
    if (!storedForgeData) {
      throw new ForgeError("FORGE_WEAPON_DATA_INVALID", 400, "Weapon data is incomplete.");
    }

    // Clear failure on weapon
    const mendedForgeData = {
      ...storedForgeData,
      temperingFailed: false,
      damagePenaltyBps: 0
    };

    await tx.inventoryItem.update({
      where: { id: weaponRecord.id },
      data: {
        itemData: withStoredWeaponForgeData(weaponRecord.itemData, mendedForgeData) as Prisma.InputJsonValue
      }
    });

    // Consume the Tempering Draught (skip if cheat enabled)
    if (draughtRecord) {
      await tx.inventoryItem.delete({ where: { id: draughtRecord.id } });
    }

    // Clear global instability
    await savePersistedForgeState(tx, playerId, { instability: null });
  });

  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new ForgeError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }

  return forgeMendResponseSchema.parse({
    forge: await loadForgeState(prisma, playerId),
    playerState
  });
}

// Builds itemData to persist when creating a Tempering Draught in a player's inventory
export function buildTemperingDraughtItemData(): Record<string, unknown> {
  return inventoryItemSchema.parse({
    id: "placeholder",
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
  }) as Record<string, unknown>;
}
