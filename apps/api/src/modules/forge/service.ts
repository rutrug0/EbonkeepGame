import { randomInt } from "node:crypto";

import type { CurrencyBalance, Prisma, PrismaClient } from "@prisma/client";

import {
  FORGE_MAX_ENCHANT_LEVEL,
  FORGE_SAFE_ENCHANT_LEVEL,
  forgeCleanseResponseSchema,
  forgeEnchantResponseSchema,
  forgeOutcomeSchema,
  getForgeAttemptCostDucats,
  getForgeCatalystRarity,
  getForgeCleanseCostDucats,
  getForgeDamageBonusBps,
  getForgeDamagePenaltyBps,
  getForgeSuccessChancePct,
  type ForgeCleanseResponse,
  type ForgeEnchantResponse
} from "@ebonkeep/shared/forge";
import type { InventoryItem, WeaponDamageRoll } from "@ebonkeep/shared/inventory";

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
    const catalystRarity = getForgeCatalystRarity(targetEnchantLevel);
    const attemptCostDucats = getForgeAttemptCostDucats(targetEnchantLevel);

    const currency = await ensureCurrency(tx, playerId);
    if (currency.ducats < attemptCostDucats) {
      throw new ForgeError("FORGE_NOT_ENOUGH_DUCATS", 400, "Not enough ducats for that enchant attempt.");
    }

    const storedForgeData = getStoredWeaponForgeData(itemRecord.itemData, weapon);
    if (!storedForgeData) {
      throw new ForgeError("FORGE_WEAPON_DATA_INVALID", 400, "Weapon data is incomplete.");
    }

    const didSucceed = targetEnchantLevel <= FORGE_SAFE_ENCHANT_LEVEL || randomInt(0, 100) < successChancePct;
    const nextForgeData = didSucceed
      ? {
          ...storedForgeData,
          level: targetEnchantLevel,
          bonusScaleBps: getForgeDamageBonusBps(targetEnchantLevel)
        }
      : {
          ...storedForgeData,
          level: 0,
          bonusScaleBps: 0
        };

    const resultingInstability = didSucceed
      ? null
      : {
          weaponItemId,
          weaponName: weapon.itemName,
          sourceEnchantLevel: targetEnchantLevel,
          damagePenaltyBps: getForgeDamagePenaltyBps(targetEnchantLevel),
          cleanseCostDucats: getForgeCleanseCostDucats(targetEnchantLevel),
          triggeredAt: new Date().toISOString()
        };

    await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: attemptCostDucats } }
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

export async function cleanseForgeInstability(
  prisma: PrismaClient,
  playerId: string
): Promise<ForgeCleanseResponse> {
  const cleanseCostDucats = await prisma.$transaction(async (tx) => {
    const persistedState = await loadPersistedForgeState(tx, playerId);
    if (!persistedState.instability) {
      throw new ForgeError("FORGE_INSTABILITY_NOT_ACTIVE", 400, "There is no active forge instability to cleanse.");
    }

    const { cleanseCostDucats: cost } = persistedState.instability;
    const currency = await ensureCurrency(tx, playerId);
    if (currency.ducats < cost) {
      throw new ForgeError("FORGE_NOT_ENOUGH_DUCATS", 400, "Not enough ducats to stabilize the forge.");
    }

    await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: cost } }
    });

    await savePersistedForgeState(tx, playerId, { instability: null });
    return cost;
  });

  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new ForgeError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }

  return forgeCleanseResponseSchema.parse({
    forge: await loadForgeState(prisma, playerId),
    playerState,
    cleanseCostDucats
  });
}
