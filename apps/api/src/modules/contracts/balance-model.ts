import {
  allEquipmentSlotIds,
  classToEquipmentGroup,
  type EquipmentSlotId,
  type PlayerClass,
  type PlayerStatBonuses
} from "@ebonkeep/shared/core";
import { inventoryItemSchema, type EquipmentState, type InventoryItem, type ItemRarity } from "@ebonkeep/shared/inventory";
import { type PlayerState } from "@ebonkeep/shared/player";

import {
  allDefinedItemTemplates,
  buildExpectedInventoryItem
} from "../inventory/item-service.js";
import { getExperienceToNextLevel } from "../player/progression-service.js";
import {
  buildPlayerStatSnapshot,
  computeGearScore,
  createEmptyEquipmentState
} from "../player/state-service.js";

export const STANDARD_SIMULATION_SLOTS = allEquipmentSlotIds.filter(
  (slotId): slotId is EquipmentSlotId =>
    slotId !== "vestige1" && slotId !== "vestige2" && slotId !== "vestige3"
);

export const SIMULATION_BASE_STATS = {
  strength: 12,
  intelligence: 8,
  dexterity: 10,
  vitality: 12,
  initiative: 10,
  luck: 9
} as const;

type ItemTemplate = (typeof allDefinedItemTemplates)[number];

type WeightedExpectedItem = {
  weight: number;
  item: InventoryItem;
};

type AveragedDamageRoll = {
  minRollRange: [number, number];
  rolledMin: number;
  rolledMax: number;
  maxRollRange: [number, number];
  averageDamage: number;
};

type AveragedItemModel = {
  allowedSlotIds: readonly EquipmentSlotId[];
  archetype: InventoryItem["archetype"];
  category: string;
  description: string;
  itemName: string;
  power: number;
  statBonuses: PlayerStatBonuses;
  damageRoll?: AveragedDamageRoll;
};

export type ExpectedLoadoutCurve = {
  gearScore: number;
  level: number;
  playerClass: PlayerClass;
  equipment: EquipmentState;
};

export type ExpectedPlayerCombatMetrics = {
  playerState: PlayerState;
  gearScore: number;
  ehp: number;
  dps: number;
  tempo: number;
};

const RARITY_ORDER: readonly ItemRarity[] = ["common", "uncommon", "rare", "epic"] as const;
const expectedLoadoutCache = new Map<string, ExpectedLoadoutCurve>();
const expectedPlayerMetricsCache = new Map<string, ExpectedPlayerCombatMetrics>();

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getRewardItemRarityWeights(encounterLevel: number): Record<ItemRarity, number> {
  const epicChance = clampInt(100 + (encounterLevel * 10), 100, 1_400) / 10_000;
  const rareChance = clampInt(850 + (encounterLevel * 18), 850, 3_200) / 10_000;
  const uncommonChance = clampInt(2_400 + (encounterLevel * 10), 2_400, 4_000) / 10_000;
  const epicWeight = epicChance;
  const rareWeight = (1 - epicWeight) * rareChance;
  const uncommonWeight = (1 - epicWeight) * (1 - rareChance) * uncommonChance;
  const commonWeight = Math.max(0, 1 - epicWeight - rareWeight - uncommonWeight);

  return {
    common: commonWeight,
    uncommon: uncommonWeight,
    rare: rareWeight,
    epic: epicWeight
  };
}

function getEligibleTemplatesForSlot(playerClass: PlayerClass, slotId: EquipmentSlotId): ItemTemplate[] {
  const equipmentGroup = classToEquipmentGroup(playerClass);
  return allDefinedItemTemplates.filter(
    (template) =>
      template.allowedSlotIds.includes(slotId) &&
      (template.allowedClass === equipmentGroup || template.allowedClass === "all")
  );
}

function getAnchorLevels(templates: readonly ItemTemplate[]): number[] {
  return [...new Set(templates.map((template) => template.baseLevel))].sort((left, right) => left - right);
}

function getAdjacentAnchors(level: number, anchors: readonly number[]): { lower: number; upper: number } {
  const lower = [...anchors].reverse().find((anchor) => anchor <= level) ?? anchors[0] ?? level;
  const upper = anchors.find((anchor) => anchor >= level) ?? anchors[anchors.length - 1] ?? level;
  return { lower, upper };
}

function getTemplatesForAnchorLevel(templates: readonly ItemTemplate[], anchorLevel: number): ItemTemplate[] {
  const exact = templates.filter((template) => template.baseLevel === anchorLevel);
  if (exact.length > 0) {
    return exact;
  }

  const nearest = [...templates].sort((left, right) => {
    const leftDelta = Math.abs(left.baseLevel - anchorLevel);
    const rightDelta = Math.abs(right.baseLevel - anchorLevel);
    if (leftDelta !== rightDelta) {
      return leftDelta - rightDelta;
    }
    return left.baseLevel - right.baseLevel;
  })[0];

  return nearest ? [nearest] : [];
}

function addWeightedStatBonuses(target: PlayerStatBonuses, bonuses: PlayerStatBonuses, weight: number): void {
  for (const [statKey, value] of Object.entries(bonuses)) {
    if (typeof value !== "number" || value === 0) {
      continue;
    }
    const key = statKey as keyof PlayerStatBonuses;
    target[key] = (target[key] ?? 0) + (value * weight);
  }
}

function buildAveragedItemModel(samples: readonly WeightedExpectedItem[], fallbackSlotId: EquipmentSlotId, level: number): InventoryItem | null {
  if (samples.length === 0) {
    return null;
  }

  const baseItem = samples[0]!.item;
  const statBonuses: PlayerStatBonuses = {};
  let powerTotal = 0;
  let damageAverageTotal = 0;
  let rolledMinTotal = 0;
  let rolledMaxTotal = 0;
  let minLowTotal = 0;
  let minHighTotal = 0;
  let maxLowTotal = 0;
  let maxHighTotal = 0;
  let damageWeightTotal = 0;

  for (const sample of samples) {
    powerTotal += sample.item.power * sample.weight;
    addWeightedStatBonuses(statBonuses, sample.item.statBonuses, sample.weight);

    if (sample.item.damageRoll) {
      damageWeightTotal += sample.weight;
      damageAverageTotal += sample.item.damageRoll.averageDamage * sample.weight;
      rolledMinTotal += sample.item.damageRoll.rolledMin * sample.weight;
      rolledMaxTotal += sample.item.damageRoll.rolledMax * sample.weight;
      minLowTotal += sample.item.damageRoll.minRollRange[0] * sample.weight;
      minHighTotal += sample.item.damageRoll.minRollRange[1] * sample.weight;
      maxLowTotal += sample.item.damageRoll.maxRollRange[0] * sample.weight;
      maxHighTotal += sample.item.damageRoll.maxRollRange[1] * sample.weight;
    }
  }

  const roundedStatBonuses = Object.fromEntries(
    Object.entries(statBonuses)
      .filter(([, value]) => typeof value === "number" && Math.round(value) !== 0)
      .map(([statKey, value]) => [statKey, Math.round(value)])
  ) as PlayerStatBonuses;

  const damageRoll = damageWeightTotal > 0
    ? {
        minRollRange: [
          Math.round(minLowTotal / damageWeightTotal),
          Math.round(minHighTotal / damageWeightTotal)
        ] as [number, number],
        rolledMin: Math.round(rolledMinTotal / damageWeightTotal),
        rolledMax: Math.round(rolledMaxTotal / damageWeightTotal),
        maxRollRange: [
          Math.round(maxLowTotal / damageWeightTotal),
          Math.round(maxHighTotal / damageWeightTotal)
        ] as [number, number],
        averageDamage: damageAverageTotal / damageWeightTotal
      }
    : undefined;

  return inventoryItemSchema.parse({
    id: `itm_expected_${fallbackSlotId}_${level}`,
    itemCode: `expected_${fallbackSlotId}_${level}`,
    itemName: `Expected ${fallbackSlotId}`,
    rarity: "common",
    category: baseItem.category,
    equipable: true,
    levelRequirement: level,
    allowedSlotIds: baseItem.allowedSlotIds.length > 0 ? baseItem.allowedSlotIds : [fallbackSlotId],
    baseLevel: level,
    power: Math.max(0, Math.round(powerTotal)),
    archetype: baseItem.archetype,
    statBonuses: roundedStatBonuses,
    damageRoll,
    description: "Deterministic expected loadout item for simulation."
  });
}

function buildAnchorExpectedItem(
  playerClass: PlayerClass,
  slotId: EquipmentSlotId,
  level: number,
  templates: readonly ItemTemplate[]
): InventoryItem | null {
  if (templates.length === 0) {
    return null;
  }

  const rarityWeights = getRewardItemRarityWeights(level);
  const templateWeight = 1 / templates.length;
  const samples: WeightedExpectedItem[] = [];

  for (const template of templates) {
    for (const rarity of RARITY_ORDER) {
      const rarityWeight = rarityWeights[rarity];
      if (rarityWeight <= 0) {
        continue;
      }

      samples.push({
        weight: templateWeight * rarityWeight,
        item: buildExpectedInventoryItem({
          playerId: `sim_${playerClass}`,
          templateId: template.id,
          rarity,
          itemLevel: level,
          explicitId: `itm_expected_${playerClass}_${slotId}_${template.id}_${rarity}_${level}`
        })
      });
    }
  }

  return buildAveragedItemModel(samples, slotId, level);
}

function buildInterpolatedExpectedItem(args: {
  playerClass: PlayerClass;
  slotId: EquipmentSlotId;
  level: number;
}): InventoryItem | null {
  const templates = getEligibleTemplatesForSlot(args.playerClass, args.slotId);
  if (templates.length === 0) {
    return null;
  }

  const anchors = getAnchorLevels(templates);
  const { lower, upper } = getAdjacentAnchors(args.level, anchors);
  const lowerItem = buildAnchorExpectedItem(
    args.playerClass,
    args.slotId,
    args.level,
    getTemplatesForAnchorLevel(templates, lower)
  );
  if (lower === upper) {
    return lowerItem;
  }

  const upperItem = buildAnchorExpectedItem(
    args.playerClass,
    args.slotId,
    args.level,
    getTemplatesForAnchorLevel(templates, upper)
  );
  if (!lowerItem) {
    return upperItem;
  }
  if (!upperItem) {
    return lowerItem;
  }

  const ratio = (args.level - lower) / Math.max(1, upper - lower);
  return buildAveragedItemModel(
    [
      { weight: 1 - ratio, item: lowerItem },
      { weight: ratio, item: upperItem }
    ],
    args.slotId,
    args.level
  );
}

export function buildExpectedLoadoutCurve(args: {
  playerClass: PlayerClass;
  level: number;
}): ExpectedLoadoutCurve {
  const key = `${args.playerClass}:${args.level}`;
  const cached = expectedLoadoutCache.get(key);
  if (cached) {
    return cached;
  }

  const equipment = createEmptyEquipmentState();
  for (const slotId of STANDARD_SIMULATION_SLOTS) {
    equipment[slotId] = buildInterpolatedExpectedItem({
      playerClass: args.playerClass,
      slotId,
      level: args.level
    });
  }

  const curve = {
    playerClass: args.playerClass,
    level: args.level,
    equipment,
    gearScore: computeGearScore(equipment)
  } satisfies ExpectedLoadoutCurve;

  expectedLoadoutCache.set(key, curve);
  return curve;
}

export function createExpectedPlayerState(args: {
  playerClass: PlayerClass;
  level: number;
}): PlayerState {
  const loadout = buildExpectedLoadoutCurve(args);
  const statSnapshot = buildPlayerStatSnapshot({
    playerClass: args.playerClass,
    level: args.level,
    baseStats: { ...SIMULATION_BASE_STATS },
    equipment: loadout.equipment
  });
  const maxHealth = Math.max(1, statSnapshot.total.maxHitpoints);

  return {
    playerId: `sim_player_${args.playerClass}_${args.level}`,
    accountId: `sim_account_${args.playerClass}`,
    class: args.playerClass,
    portraitId: "str_01",
    backgroundId: "bg_01",
    preferredLocale: "en",
    level: args.level,
    experience: 0,
    experienceIntoLevel: 0,
    experienceToNextLevel: getExperienceToNextLevel(args.level),
    gearScore: loadout.gearScore,
    health: {
      current: maxHealth,
      max: maxHealth
    },
    stamina: {
      current: 120,
      max: 120,
      nextPointAt: null
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
    inventory: [],
    equipment: loadout.equipment,
    currency: {
      ducats: 0,
      imperials: 0,
      renown: 0
    },
    cheatSettings: {
      invincibilityEnabled: false,
      fastTravelEnabled: false,
      fastContractReplenishEnabled: false,
      fastArenaReplenishEnabled: false,
      fastTrainTimeEnabled: false
    }
  };
}

function computeExpectedEffectiveHp(playerState: PlayerState): number {
  const typedDefenseAverage = (
    playerState.statSnapshot.total.armor +
    playerState.statSnapshot.total.spellShield +
    playerState.statSnapshot.total.missileResistance
  ) / 3;
  const bonusDefenseAverage = (
    playerState.statSnapshot.total.physicalDefense +
    playerState.statSnapshot.total.magicDefense
  ) / 2;

  return playerState.health.max * (1 + (typedDefenseAverage / 180) + (bonusDefenseAverage / 140));
}

function computeExpectedDamagePerAction(playerState: PlayerState): number {
  const weaponAverageDamage = playerState.equipment.weapon?.damageRoll?.averageDamage ?? playerState.statSnapshot.total.damage;
  const critFactor = 1 + ((playerState.statSnapshot.total.critChance / 10_000) * ((playerState.statSnapshot.total.critMultiplier / 10_000) - 1));
  const assumedHitFactor = 0.82 + Math.min(0.1, Math.max(-0.08, (playerState.statSnapshot.total.accuracy - 75) / 250));
  return weaponAverageDamage * critFactor * assumedHitFactor;
}

function computeExpectedTempo(playerState: PlayerState): number {
  const extraAttackFactor = 1 + (playerState.statSnapshot.total.extraAttackChance / 10_000);
  return playerState.statSnapshot.total.initiative * extraAttackFactor;
}

export function getExpectedPlayerCombatMetrics(args: {
  playerClass: PlayerClass;
  level: number;
}): ExpectedPlayerCombatMetrics {
  const key = `${args.playerClass}:${args.level}`;
  const cached = expectedPlayerMetricsCache.get(key);
  if (cached) {
    return cached;
  }

  const playerState = createExpectedPlayerState(args);
  const metrics = {
    playerState,
    gearScore: playerState.gearScore,
    ehp: computeExpectedEffectiveHp(playerState),
    dps: computeExpectedDamagePerAction(playerState),
    tempo: computeExpectedTempo(playerState)
  } satisfies ExpectedPlayerCombatMetrics;

  expectedPlayerMetricsCache.set(key, metrics);
  return metrics;
}

export function resetExpectedBalanceCachesForTests(): void {
  expectedLoadoutCache.clear();
  expectedPlayerMetricsCache.clear();
}
