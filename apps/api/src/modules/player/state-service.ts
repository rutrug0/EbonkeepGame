import type { InventoryItem, PrismaClient } from "@prisma/client";
import {
  allCoreStatKeys,
  allEquipmentSlotIds,
  equipmentSlotIdSchema,
  equipmentStateSchema,
  getAllowedClassesForArchetype,
  mainStatToFlatDamageRatio,
  playerStateSchema,
  type CoreStatKey,
  type EquipmentState,
  type PlayerClass,
  type PlayerState,
  type PlayerStatBlock,
  type PlayerStatBonuses,
  type PlayerStatSnapshot,
  type StatBlock
} from "@ebonkeep/shared";
import { parseStoredInventoryItem } from "../inventory/item-service.js";

const BASE_CRIT_MULTIPLIER = 15000;
const HP_PER_VITALITY = 10;
const CHANCE_PER_STAT = 10;
const CRIT_CHANCE_CAP = 6000;
const CRIT_MULTIPLIER_CAP = 45000;
const DODGE_CHANCE_CAP = 3500;
const EXTRA_ATTACK_CHANCE_CAP = 3500;

type EquipmentSlotWithItem = {
  slotType: string;
  item: {
    id: string;
    itemCode: string;
    itemData: unknown;
  } | null;
};

function clampInt(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function createEmptyCoreStatBlock(): StatBlock {
  return {
    strength: 0,
    intelligence: 0,
    dexterity: 0,
    vitality: 0,
    initiative: 0,
    luck: 0
  };
}

export function createEmptyResolvedStatBlock(): PlayerStatBlock {
  return {
    strength: 0,
    intelligence: 0,
    dexterity: 0,
    vitality: 0,
    initiative: 0,
    luck: 0,
    armor: 0,
    spellShield: 0,
    missileResistance: 0,
    maxHitpoints: 0,
    dodgeChance: 0,
    damage: 0,
    critChance: 0,
    critMultiplier: 0,
    accuracy: 0,
    extraAttackChance: 0
  };
}

export function createEmptyEquipmentState(): EquipmentState {
  return equipmentStateSchema.parse({
    helmet: null,
    necklace: null,
    upperArmor: null,
    belt: null,
    ringLeft: null,
    weapon: null,
    pauldrons: null,
    gloves: null,
    lowerArmor: null,
    boots: null,
    ringRight: null,
    vestige1: null,
    vestige2: null,
    vestige3: null
  });
}

function getMainOffenseStatKey(playerClass: PlayerClass): CoreStatKey {
  if (playerClass === "mage") {
    return "intelligence";
  }
  if (playerClass === "ranger") {
    return "dexterity";
  }
  return "strength";
}

function addCoreStatBonuses(baseStats: StatBlock, bonuses: PlayerStatBonuses): StatBlock {
  const total = { ...baseStats };
  for (const key of allCoreStatKeys) {
    total[key] += bonuses[key] ?? 0;
  }
  return total;
}

function sumEquipmentBonuses(equipment: EquipmentState): PlayerStatBonuses {
  const totals: PlayerStatBonuses = {};

  for (const slotId of allEquipmentSlotIds) {
    const item = equipment[slotId];
    if (!item) {
      continue;
    }

    for (const [statKey, value] of Object.entries(item.statBonuses)) {
      if (typeof value !== "number") {
        continue;
      }
      const key = statKey as keyof PlayerStatBonuses;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }

  return totals;
}

function resolveStatBlock(playerClass: PlayerClass, coreStats: StatBlock, bonuses: PlayerStatBonuses): PlayerStatBlock {
  const mainOffenseStatKey = getMainOffenseStatKey(playerClass);
  const mainOffenseStat = coreStats[mainOffenseStatKey];

  return {
    strength: coreStats.strength,
    intelligence: coreStats.intelligence,
    dexterity: coreStats.dexterity,
    vitality: coreStats.vitality,
    initiative: coreStats.initiative,
    luck: coreStats.luck,
    armor: coreStats.strength + (bonuses.armor ?? 0),
    spellShield: coreStats.intelligence + (bonuses.spellShield ?? 0),
    missileResistance: coreStats.dexterity + (bonuses.missileResistance ?? 0),
    maxHitpoints: Math.max(0, coreStats.vitality * HP_PER_VITALITY + (bonuses.maxHitpoints ?? 0)),
    dodgeChance: clampInt(coreStats.dexterity * CHANCE_PER_STAT + (bonuses.dodgeChance ?? 0), DODGE_CHANCE_CAP),
    damage: Math.max(0, Math.floor(mainOffenseStat * mainStatToFlatDamageRatio) + (bonuses.damage ?? 0)),
    critChance: clampInt(coreStats.luck * CHANCE_PER_STAT + (bonuses.critChance ?? 0), CRIT_CHANCE_CAP),
    critMultiplier: clampInt(
      BASE_CRIT_MULTIPLIER + coreStats.luck * CHANCE_PER_STAT + (bonuses.critMultiplier ?? 0),
      CRIT_MULTIPLIER_CAP
    ),
    accuracy: Math.max(0, mainOffenseStat + (bonuses.accuracy ?? 0)),
    extraAttackChance: clampInt(
      coreStats.initiative * CHANCE_PER_STAT + (bonuses.extraAttackChance ?? 0),
      EXTRA_ATTACK_CHANCE_CAP
    )
  };
}

function diffResolvedStats(total: PlayerStatBlock, base: PlayerStatBlock): PlayerStatBlock {
  return {
    strength: total.strength - base.strength,
    intelligence: total.intelligence - base.intelligence,
    dexterity: total.dexterity - base.dexterity,
    vitality: total.vitality - base.vitality,
    initiative: total.initiative - base.initiative,
    luck: total.luck - base.luck,
    armor: total.armor - base.armor,
    spellShield: total.spellShield - base.spellShield,
    missileResistance: total.missileResistance - base.missileResistance,
    maxHitpoints: total.maxHitpoints - base.maxHitpoints,
    dodgeChance: total.dodgeChance - base.dodgeChance,
    damage: total.damage - base.damage,
    critChance: total.critChance - base.critChance,
    critMultiplier: total.critMultiplier - base.critMultiplier,
    accuracy: total.accuracy - base.accuracy,
    extraAttackChance: total.extraAttackChance - base.extraAttackChance
  };
}

export function buildPlayerStatSnapshot(args: {
  playerClass: PlayerClass;
  baseStats: StatBlock;
  equipment: EquipmentState;
}): PlayerStatSnapshot {
  const equipmentBonuses = sumEquipmentBonuses(args.equipment);
  const totalCoreStats = addCoreStatBonuses(args.baseStats, equipmentBonuses);
  const base = resolveStatBlock(args.playerClass, args.baseStats, {});
  const total = resolveStatBlock(args.playerClass, totalCoreStats, equipmentBonuses);

  return {
    base,
    equipment: diffResolvedStats(total, base),
    total
  };
}

export function buildEquipmentState(equipmentSlots: readonly EquipmentSlotWithItem[]): EquipmentState {
  const equipment = createEmptyEquipmentState();

  for (const slot of equipmentSlots) {
    const parsedSlot = equipmentSlotIdSchema.safeParse(slot.slotType);
    if (!parsedSlot.success) {
      continue;
    }

    equipment[parsedSlot.data] = slot.item ? parseStoredInventoryItem({
      id: slot.item.id,
      itemCode: slot.item.itemCode,
      itemData: slot.item.itemData
    }) : null;
  }

  return equipmentStateSchema.parse(equipment);
}

export function computeGearScore(equipment: EquipmentState): number {
  return allEquipmentSlotIds.reduce((sum, slotId) => sum + (equipment[slotId]?.power ?? 0), 0);
}

export async function ensurePlayerEquipmentSlots(prisma: PrismaClient, playerId: string): Promise<void> {
  const existingSlots = await prisma.equipmentSlot.findMany({
    where: { playerId },
    select: { slotType: true }
  });
  const existingSlotTypes = new Set(existingSlots.map((slot) => slot.slotType));
  const missingSlots = allEquipmentSlotIds.filter((slotId) => !existingSlotTypes.has(slotId));

  if (missingSlots.length === 0) {
    return;
  }

  await prisma.equipmentSlot.createMany({
    data: missingSlots.map((slotId) => ({
      id: `equip_${playerId}_${slotId}`,
      playerId,
      slotType: slotId
    }))
  });
}

export function canEquipItemForPlayerClass(playerClass: PlayerClass, item: NonNullable<EquipmentState[keyof EquipmentState]>): boolean {
  const archetypeKey = item.archetype.majorCategory === "armor"
    ? item.archetype.armorArchetype
    : item.archetype.majorCategory === "weapon"
      ? item.archetype.weaponArchetype
      : undefined;

  return getAllowedClassesForArchetype(item.archetype.majorCategory, archetypeKey).includes(playerClass);
}

export async function loadPlayerState(prisma: PrismaClient, playerId: string): Promise<PlayerState | null> {
  await ensurePlayerEquipmentSlots(prisma, playerId);

  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    include: {
      stats: true,
      currency: true,
      inventoryItems: {
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          itemCode: true,
          itemData: true,
          slotKey: true
        }
      },
      equipmentSlots: {
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              itemData: true
            }
          }
        }
      }
    }
  });

  if (!profile || !profile.stats || !profile.currency) {
    return null;
  }

  const equipment = buildEquipmentState(profile.equipmentSlots);
  const inventory = profile.inventoryItems
    .filter((item) => item.slotKey === "inventory")
    .map((item) => parseStoredInventoryItem({
      id: item.id,
      itemCode: item.itemCode,
      itemData: item.itemData
    }))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const statSnapshot = buildPlayerStatSnapshot({
    playerClass: profile.class as PlayerClass,
    baseStats: {
      strength: profile.stats.strength,
      intelligence: profile.stats.intelligence,
      dexterity: profile.stats.dexterity,
      vitality: profile.stats.vitality,
      initiative: profile.stats.initiative,
      luck: profile.stats.luck
    },
    equipment
  });

  return playerStateSchema.parse({
    playerId: profile.id,
    accountId: profile.accountId,
    class: profile.class,
    preferredLocale: profile.preferredLocale ?? "en",
    level: profile.level,
    gearScore: computeGearScore(equipment),
    stats: {
      strength: statSnapshot.total.strength,
      intelligence: statSnapshot.total.intelligence,
      dexterity: statSnapshot.total.dexterity,
      vitality: statSnapshot.total.vitality,
      initiative: statSnapshot.total.initiative,
      luck: statSnapshot.total.luck
    },
    statSnapshot,
    inventory,
    equipment,
    currency: {
      ducats: profile.currency.ducats,
      imperials: profile.currency.imperials
    }
  });
}
