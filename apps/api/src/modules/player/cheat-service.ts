import type { Prisma, PrismaClient } from "@prisma/client";
import { classToEquipmentGroup, type EquipmentSlotId } from "@ebonkeep/shared/core";
import type { InventoryItem, ItemRarity } from "@ebonkeep/shared/inventory";
import type { PlayerCheatSettings, PlayerState } from "@ebonkeep/shared/player";

import { allDefinedItemTemplates, rollInventoryItem } from "../inventory/item-service.js";
import { getCumulativeExperienceToReachLevel, playerProgressionConfig } from "./progression-service.js";
import { loadPlayerState } from "./state-service.js";

type PlayerDbClient = PrismaClient | Prisma.TransactionClient;

const STANDARD_CHEAT_SLOT_IDS: readonly EquipmentSlotId[] = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft",
  "weapon",
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight"
];

export const CHEAT_FAST_TRAVEL_DURATION_MS = 2_000;
export const CHEAT_FAST_CONTRACT_REPLENISH_DURATION_MS = 3_000;
export const CHEAT_FAST_ARENA_REPLENISH_DURATION_MS = 2_000;
export const CHEAT_DUCATS_GRANT = 1_000_000;
export const CHEAT_IMPERIALS_GRANT = 10_000;
export const CHEAT_RENOWN_GRANT = 20;

async function loadRequiredPlayerState(prisma: PlayerDbClient, playerId: string): Promise<PlayerState> {
  const playerState = await loadPlayerState(prisma, playerId);
  if (!playerState) {
    throw new Error("Player state not found.");
  }
  return playerState;
}

function pickRandomTemplateIdForSlot(args: {
  playerClass: PlayerState["class"];
  playerLevel: number;
  slotId: EquipmentSlotId;
}): string {
  const equipmentGroup = classToEquipmentGroup(args.playerClass);
  const matchesOwner = (template: (typeof allDefinedItemTemplates)[number]) =>
    template.allowedClass === equipmentGroup || template.allowedClass === "all";
  const matchesSlot = (template: (typeof allDefinedItemTemplates)[number]) => template.allowedSlotIds.includes(args.slotId);

  const exactTemplates = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwner(template) &&
      matchesSlot(template) &&
      template.dropMinLevel <= args.playerLevel &&
      template.dropMaxLevel >= args.playerLevel
  );
  const nearbyTemplates = allDefinedItemTemplates.filter(
    (template) =>
      matchesOwner(template) &&
      matchesSlot(template) &&
      template.baseLevel <= args.playerLevel + 5 &&
      template.baseLevel >= Math.max(1, args.playerLevel - 8)
  );
  const fallbackTemplates = allDefinedItemTemplates.filter(
    (template) => matchesOwner(template) && matchesSlot(template)
  );
  const candidates = exactTemplates.length > 0 ? exactTemplates : nearbyTemplates.length > 0 ? nearbyTemplates : fallbackTemplates;
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  if (!template) {
    throw new Error(`No item template available for slot ${args.slotId}.`);
  }

  return template.id;
}

export async function updatePlayerCheatSettings(
  prisma: PlayerDbClient,
  playerId: string,
  settings: PlayerCheatSettings
): Promise<PlayerState> {
  await prisma.$executeRaw`
    UPDATE "player_profiles"
    SET
      "fastTravelEnabled" = ${settings.fastTravelEnabled},
      "fastContractReplenishEnabled" = ${settings.fastContractReplenishEnabled},
      "fastArenaReplenishEnabled" = ${settings.fastArenaReplenishEnabled},
      "invincibilityEnabled" = ${settings.invincibilityEnabled},
      "fastTrainTimeEnabled" = ${settings.fastTrainTimeEnabled},
      "unlimitedAcademyDonationsEnabled" = ${settings.unlimitedAcademyDonationsEnabled},
      "unlimitedForgeConsumablesEnabled" = ${settings.unlimitedForgeConsumablesEnabled},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${playerId}
  `;

  return loadRequiredPlayerState(prisma, playerId);
}

export async function replenishPlayerForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  now = new Date()
): Promise<PlayerState> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);

  await prisma.playerProfile.update({
    where: { id: playerId },
    data: {
      hitpointsCurrent: playerState.health.max,
      staminaCurrent: playerState.stamina.max,
      staminaUpdatedAt: now
    }
  });

  return loadRequiredPlayerState(prisma, playerId);
}

export async function levelPlayerForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  targetLevel: number
): Promise<PlayerState> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);
  const normalizedTargetLevel = Math.min(playerProgressionConfig.maxLevel, Math.max(1, Math.floor(targetLevel)));

  if (normalizedTargetLevel === playerState.level) {
    throw new Error("Target level must be different from the current level.");
  }

  await prisma.playerProfile.update({
    where: { id: playerId },
    data: {
      level: normalizedTargetLevel,
      experience: getCumulativeExperienceToReachLevel(normalizedTargetLevel)
    }
  });

  return loadRequiredPlayerState(prisma, playerId);
}

export async function generateEquipmentForCheats(
  prisma: PlayerDbClient,
  playerId: string,
  rarity: ItemRarity
): Promise<{ playerState: PlayerState; generatedItems: InventoryItem[] }> {
  const playerState = await loadRequiredPlayerState(prisma, playerId);
  const generatedItems: InventoryItem[] = [];

  for (const slotId of STANDARD_CHEAT_SLOT_IDS) {
    const templateId = pickRandomTemplateIdForSlot({
      playerClass: playerState.class,
      playerLevel: playerState.level,
      slotId
    });
    const item = rollInventoryItem({
      playerId,
      templateId,
      rarity,
      itemLevel: playerState.level
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

    generatedItems.push(item);
  }

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    generatedItems
  };
}

export async function grantCurrencyForCheats(
  prisma: PlayerDbClient,
  playerId: string
): Promise<{ playerState: PlayerState; ducatsGranted: number; imperialsGranted: number }> {
  await prisma.currencyBalance.upsert({
    where: { playerId },
    update: {
      ducats: { increment: CHEAT_DUCATS_GRANT },
      imperials: { increment: CHEAT_IMPERIALS_GRANT },
      renown: { increment: CHEAT_RENOWN_GRANT }
    },
    create: {
      playerId,
      ducats: CHEAT_DUCATS_GRANT,
      imperials: CHEAT_IMPERIALS_GRANT,
      renown: CHEAT_RENOWN_GRANT
    }
  });

  return {
    playerState: await loadRequiredPlayerState(prisma, playerId),
    ducatsGranted: CHEAT_DUCATS_GRANT,
    imperialsGranted: CHEAT_IMPERIALS_GRANT
  };
}
