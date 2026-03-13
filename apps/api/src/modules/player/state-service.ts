import type { InventoryItem, Prisma, PrismaClient } from "@prisma/client";
import {
  allCoreStatKeys,
  allEquipmentSlotIds,
  classToWeaponStat,
  equipmentSlotIdSchema,
  type CoreStatKey,
  type PlayerClass,
  type PlayerStatBlock,
  type PlayerStatBonuses,
  type PlayerStatSnapshot,
  type StatBlock
} from "@ebonkeep/shared/core";
import {
  playerStateSchema,
  publicPlayerProfileSchema,
  type PlayerState,
  type PublicPlayerProfile
} from "@ebonkeep/shared/player";
import {
  equipmentStateSchema,
  getAllowedClassesForArchetype,
  type EquipmentState as InventoryEquipmentState
} from "@ebonkeep/shared/inventory";
import { parseStoredInventoryItem } from "../inventory/item-service.js";
import { syncPlayerProgress } from "./progression-service.js";

const BASE_ACCURACY = 75;
const BASE_CRIT_CHANCE = 500;
const BASE_CRIT_MULTIPLIER = 15000;
const HP_PER_VITALITY = 10;
const mainStatToFlatDamageRatio = 0.1;
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

function resolveCurrentHealth(storedCurrent: number, maxHitpoints: number): number {
  const normalizedMax = Math.max(1, Math.floor(maxHitpoints));
  if (storedCurrent < 0) {
    return normalizedMax;
  }
  return Math.max(0, Math.min(normalizedMax, Math.floor(storedCurrent)));
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
    physicalDefense: 0,
    magicDefense: 0,
    maxHitpoints: 0,
    dodgeChance: 0,
    damage: 0,
    critChance: 0,
    critMultiplier: 0,
    accuracy: 0,
    extraAttackChance: 0
  };
}

export function createEmptyEquipmentState(): InventoryEquipmentState {
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
  const tree = classToWeaponStat(playerClass);
  if (tree === "intelligence") return "intelligence";
  if (tree === "dexterity") return "dexterity";
  return "strength";
}

function addCoreStatBonuses(baseStats: StatBlock, bonuses: PlayerStatBonuses): StatBlock {
  const total = { ...baseStats };
  for (const key of allCoreStatKeys) {
    total[key] += bonuses[key] ?? 0;
  }
  return total;
}

function sumEquipmentBonuses(equipment: InventoryEquipmentState): PlayerStatBonuses {
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

function resolveStatBlock(
  playerClass: PlayerClass,
  coreStats: StatBlock,
  bonuses: PlayerStatBonuses,
  equipment?: InventoryEquipmentState
): PlayerStatBlock {
  const mainOffenseStatKey = getMainOffenseStatKey(playerClass);
  const mainOffenseStat = coreStats[mainOffenseStatKey];
  const weaponAverageDamage = Math.round(equipment?.weapon?.damageRoll?.averageDamage ?? 0);

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
    physicalDefense: Math.max(0, bonuses.physicalDefense ?? 0),
    magicDefense: Math.max(0, bonuses.magicDefense ?? 0),
    maxHitpoints: Math.max(0, coreStats.vitality * HP_PER_VITALITY + (bonuses.maxHitpoints ?? 0)),
    dodgeChance: clampInt(coreStats.dexterity * CHANCE_PER_STAT + (bonuses.dodgeChance ?? 0), DODGE_CHANCE_CAP),
    damage: Math.max(
      0,
      weaponAverageDamage + Math.floor(mainOffenseStat * mainStatToFlatDamageRatio) + (bonuses.damage ?? 0)
    ),
    critChance: clampInt(BASE_CRIT_CHANCE + coreStats.luck * CHANCE_PER_STAT + (bonuses.critChance ?? 0), CRIT_CHANCE_CAP),
    critMultiplier: clampInt(
      BASE_CRIT_MULTIPLIER + coreStats.luck * CHANCE_PER_STAT + (bonuses.critMultiplier ?? 0),
      CRIT_MULTIPLIER_CAP
    ),
    accuracy: Math.max(0, BASE_ACCURACY + (bonuses.accuracy ?? 0)),
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
    physicalDefense: total.physicalDefense - base.physicalDefense,
    magicDefense: total.magicDefense - base.magicDefense,
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
  equipment: InventoryEquipmentState;
}): PlayerStatSnapshot {
  const equipmentBonuses = sumEquipmentBonuses(args.equipment);
  const totalCoreStats = addCoreStatBonuses(args.baseStats, equipmentBonuses);
  const base = resolveStatBlock(args.playerClass, args.baseStats, {});
  const total = resolveStatBlock(args.playerClass, totalCoreStats, equipmentBonuses, args.equipment);

  return {
    base,
    equipment: diffResolvedStats(total, base),
    total
  };
}

export function buildEquipmentState(equipmentSlots: readonly EquipmentSlotWithItem[]): InventoryEquipmentState {
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

export function computeGearScore(equipment: InventoryEquipmentState): number {
  return allEquipmentSlotIds.reduce((sum, slotId) => sum + (equipment[slotId]?.power ?? 0), 0);
}

export async function ensurePlayerEquipmentSlots(prisma: PrismaClient | Prisma.TransactionClient, playerId: string): Promise<void> {
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

type PlayerStateDbClient = PrismaClient | Prisma.TransactionClient;

export function canEquipItemForPlayerClass(
  playerClass: PlayerClass,
  item: NonNullable<InventoryEquipmentState[keyof InventoryEquipmentState]>
): boolean {
  const archetypeKey = item.archetype.majorCategory === "armor"
    ? item.archetype.armorArchetype
    : item.archetype.majorCategory === "weapon"
      ? item.archetype.weaponArchetype
      : undefined;

  return getAllowedClassesForArchetype(item.archetype.majorCategory, archetypeKey).includes(playerClass);
}

export async function loadPlayerState(prisma: PlayerStateDbClient, playerId: string): Promise<PlayerState | null> {
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

  if (!profile) {
    return null;
  }

  const progress = await syncPlayerProgress(prisma, playerId);

  // Ensure stats exist
  let stats = profile.stats;
  if (!stats) {
    stats = await prisma.playerStat.create({
      data: {
        playerId,
        strength: 10,
        intelligence: 10,
        dexterity: 10,
        vitality: 10,
        initiative: 10,
        luck: 10
      }
    });
  }

  // Ensure currency exists
  let currency = profile.currency;
  if (!currency) {
    currency = await prisma.currencyBalance.create({
      data: {
        playerId,
        ducats: 1000,
        imperials: 0
      }
    });
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
      strength: stats.strength,
      intelligence: stats.intelligence,
      dexterity: stats.dexterity,
      vitality: stats.vitality,
      initiative: stats.initiative,
      luck: stats.luck
    },
    equipment
  });
  const resolvedCurrentHealth = resolveCurrentHealth(profile.hitpointsCurrent, statSnapshot.total.maxHitpoints);

  if (profile.hitpointsCurrent !== resolvedCurrentHealth) {
    await prisma.playerProfile.update({
      where: { id: playerId },
      data: {
        hitpointsCurrent: resolvedCurrentHealth
      }
    });
  }

  return playerStateSchema.parse({
    playerId: profile.id,
    accountId: profile.accountId,
    class: profile.class,
    portraitId: profile.portraitId ?? "str_01",
    backgroundId: profile.backgroundId ?? "bg_01",
    preferredLocale: profile.preferredLocale ?? "en",
    level: progress.experience.level,
    experience: progress.experience.experience,
    experienceIntoLevel: progress.experience.experienceIntoLevel,
    experienceToNextLevel: progress.experience.experienceToNextLevel,
    gearScore: computeGearScore(equipment),
    health: {
      current: resolvedCurrentHealth,
      max: statSnapshot.total.maxHitpoints
    },
    stamina: {
      current: progress.stamina.current,
      max: progress.stamina.max,
      nextPointAt: progress.stamina.nextPointAt
    },
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
      ducats: currency.ducats,
      imperials: currency.imperials
    }
  });
}

export async function getPublicPlayerProfile(
  prisma: PlayerStateDbClient,
  playerId: string
): Promise<PublicPlayerProfile | null> {
  await ensurePlayerEquipmentSlots(prisma, playerId);

  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    include: {
      stats: true,
      equipmentSlots: {
        include: {
          item: {
            select: { id: true, itemCode: true, itemData: true }
          }
        }
      },
      account: { select: { username: true } },
      guildMembership: { select: { guildId: true } }
    }
  });

  if (!profile) return null;

  const stats = profile.stats ?? {
    strength: 10, intelligence: 10, dexterity: 10,
    vitality: 10, initiative: 10, luck: 10
  };
  const equipment = buildEquipmentState(profile.equipmentSlots);
  const statSnapshot = buildPlayerStatSnapshot({
    playerClass: profile.class as PlayerClass,
    baseStats: {
      strength: stats.strength,
      intelligence: stats.intelligence,
      dexterity: stats.dexterity,
      vitality: stats.vitality,
      initiative: stats.initiative,
      luck: stats.luck
    },
    equipment
  });

  return publicPlayerProfileSchema.parse({
    playerId: profile.id,
    username: profile.account.username ?? "Unknown Warden",
    class: profile.class,
    level: profile.level,
    gearScore: profile.gearScore,
    guildId: profile.guildMembership?.guildId ?? null,
    equipment,
    statSnapshot
  });
}
