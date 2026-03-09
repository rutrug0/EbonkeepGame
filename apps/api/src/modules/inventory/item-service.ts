import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  equipmentSlotIdSchema,
  inventoryItemSchema,
  itemModifierSchema,
  playerClassSchema,
  type EquipmentSlotId,
  type InventoryItem,
  type ItemModifier,
  type ItemRarity,
  type PlayerClass,
  type PlayerStatBonuses,
  type PlayerStatKey,
  type WeaponDamageRoll
} from "@ebonkeep/shared";

const legacyStoredItemSchema = z.object({
  id: z.string().optional(),
  itemCode: z.string().optional(),
  itemName: z.string(),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]),
  equipable: z.boolean(),
  levelRequirement: z.number().int().min(1).max(100),
  power: z.number().int().min(0),
  equipSlotId: equipmentSlotIdSchema,
  archetype: z.object({
    majorCategory: z.enum(["armor", "weapon", "jewelry", "vestige"]),
    armorArchetype: z.enum(["heavy", "light", "robe"]).optional(),
    weaponArchetype: z.enum(["melee", "arcane", "ranged"]).optional(),
    weaponFamily: z.enum(["sword", "axe", "wand", "staff", "sling", "bow"]).optional(),
    vestigeId: z.string().optional()
  }),
  statBonuses: z.record(z.number().int()).optional(),
  description: z.string().optional(),
  baseLevel: z.number().int().min(0).max(100).optional(),
  damageRoll: z.object({
    minRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    rolledMin: z.number().int().min(0),
    rolledMax: z.number().int().min(0),
    maxRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    averageDamage: z.number().min(0)
  }).optional(),
  prefix: itemModifierSchema.optional(),
  affix: itemModifierSchema.optional()
});

type ItemTemplate = {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  description: string;
  rarity: ItemRarity;
  levelRequirement: number;
  baseLevel: number;
  allowedSlotIds: readonly EquipmentSlotId[];
  archetype: InventoryItem["archetype"];
  baseStatBonuses: PlayerStatBonuses;
  basePower: number;
  weaponDamageProfile?: {
    minRollRange: readonly [number, number];
    maxRollRange: readonly [number, number];
  };
  eligibleAffixKeys: readonly PlayerStatKey[];
};

type ItemAffixDefinition = {
  statKey: PlayerStatKey;
  unit: "flat" | "basis_points";
  prefixNames: readonly [string, string, string];
  affixNames: readonly [string, string, string];
  valueByTier: (itemLevel: number) => readonly [number, number, number];
};

const TIER_ORDER = ["T1", "T2", "T3"] as const;
const RARITY_ORDER: readonly ItemRarity[] = ["common", "uncommon", "rare", "epic"];
const RARITY_BONUS: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 3,
  rare: 7,
  epic: 12
};
const TIER_POWER_BONUS = {
  T1: 2,
  T2: 4,
  T3: 7
} as const;
const WEAPON_RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.12,
  rare: 1.26,
  epic: 1.42
};

function flatTierValues(base: number, perLevel: number, itemLevel: number): readonly [number, number, number] {
  const scaledBase = base + Math.max(0, itemLevel - 1) * perLevel;
  return [scaledBase, scaledBase + 1, scaledBase + 3];
}

function basisPointsTierValues(base: number, perLevel: number, itemLevel: number): readonly [number, number, number] {
  const scaledBase = base + Math.max(0, itemLevel - 1) * perLevel;
  return [scaledBase, scaledBase + 20, scaledBase + 50];
}

const ITEM_AFFIX_DEFINITIONS: Record<PlayerStatKey, ItemAffixDefinition> = {
  strength: {
    statKey: "strength",
    unit: "flat",
    prefixNames: ["Forceful", "Brutal", "Worldrend"],
    affixNames: ["of Striking", "of Cleaving", "of the Warbringer"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  intelligence: {
    statKey: "intelligence",
    unit: "flat",
    prefixNames: ["Imbued", "Arcane", "Void-touched"],
    affixNames: ["of Sparks", "of Sorcery", "of Cataclysm"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  dexterity: {
    statKey: "dexterity",
    unit: "flat",
    prefixNames: ["Keen", "Deadeye", "Windpiercer"],
    affixNames: ["of Aim", "of Piercing", "of the Ballista"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  vitality: {
    statKey: "vitality",
    unit: "flat",
    prefixNames: ["Stout", "Vigorous", "Colossal"],
    affixNames: ["of Endurance", "of Deep Reserves", "of the Undying"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  initiative: {
    statKey: "initiative",
    unit: "flat",
    prefixNames: ["Swift", "Quickened", "Lightning-borne"],
    affixNames: ["of Haste", "of the Tempest", "of Relentless Motion"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  luck: {
    statKey: "luck",
    unit: "flat",
    prefixNames: ["Fortunate", "Lucky", "Fatebound"],
    affixNames: ["of Fortune", "of the Gambler", "of Twisted Fate"],
    valueByTier: (itemLevel) => flatTierValues(1, 0, itemLevel)
  },
  armor: {
    statKey: "armor",
    unit: "flat",
    prefixNames: ["Reinforced", "Ironbound", "Bastionforged"],
    affixNames: ["of Guarding", "of the Bulwark", "of Unyielding Stone"],
    valueByTier: (itemLevel) => flatTierValues(2, 1, itemLevel)
  },
  spellShield: {
    statKey: "spellShield",
    unit: "flat",
    prefixNames: ["Warded", "Runed", "Nullbound"],
    affixNames: ["of Warding", "of the Barrier", "of Arcane Silence"],
    valueByTier: (itemLevel) => flatTierValues(2, 1, itemLevel)
  },
  missileResistance: {
    statKey: "missileResistance",
    unit: "flat",
    prefixNames: ["Deflecting", "Arrowproof", "Stormguard"],
    affixNames: ["of Deflection", "of the Iron Screen", "of the Unerring Wall"],
    valueByTier: (itemLevel) => flatTierValues(2, 1, itemLevel)
  },
  maxHitpoints: {
    statKey: "maxHitpoints",
    unit: "flat",
    prefixNames: ["Stout", "Vigorous", "Colossal"],
    affixNames: ["of Endurance", "of Deep Reserves", "of the Undying"],
    valueByTier: (itemLevel) => flatTierValues(6, 2, itemLevel)
  },
  dodgeChance: {
    statKey: "dodgeChance",
    unit: "basis_points",
    prefixNames: ["Evasive", "Elusive", "Ghoststride"],
    affixNames: ["of Evasion", "of Sidestepping", "of Vanishing"],
    valueByTier: (itemLevel) => basisPointsTierValues(20, 2, itemLevel)
  },
  damage: {
    statKey: "damage",
    unit: "flat",
    prefixNames: ["Sharpened", "Deadly", "Kingslayer's"],
    affixNames: ["of Force", "of Slaying", "of Ruin"],
    valueByTier: (itemLevel) => flatTierValues(1, 1, itemLevel)
  },
  critChance: {
    statKey: "critChance",
    unit: "basis_points",
    prefixNames: ["Fortunate", "Lucky", "Fatebound"],
    affixNames: ["of Fortune", "of the Gambler", "of Twisted Fate"],
    valueByTier: (itemLevel) => basisPointsTierValues(25, 3, itemLevel)
  },
  critMultiplier: {
    statKey: "critMultiplier",
    unit: "basis_points",
    prefixNames: ["Punishing", "Devastating", "Doom-marked"],
    affixNames: ["of Impact", "of Ruin", "of Final Judgment"],
    valueByTier: (itemLevel) => basisPointsTierValues(40, 4, itemLevel)
  },
  accuracy: {
    statKey: "accuracy",
    unit: "flat",
    prefixNames: ["True", "Sure", "Unerring"],
    affixNames: ["of Focus", "of Precision", "of Perfect Aim"],
    valueByTier: (itemLevel) => flatTierValues(1, 1, itemLevel)
  },
  extraAttackChance: {
    statKey: "extraAttackChance",
    unit: "basis_points",
    prefixNames: ["Opportunistic", "Relentless", "Frenzied"],
    affixNames: ["of Momentum", "of the Second Strike", "of Endless Assault"],
    valueByTier: (itemLevel) => basisPointsTierValues(20, 2, itemLevel)
  }
};

const ITEM_TEMPLATES: readonly ItemTemplate[] = [
  {
    id: "warrior_iron_shortsword",
    itemCode: "warrior_iron_shortsword",
    itemName: "Iron Shortsword",
    category: "Weapon",
    description: "A plain militia blade sharpened for close work and drilled hands.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["weapon"],
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: "melee",
      weaponFamily: "sword"
    },
    baseStatBonuses: {
      strength: 2,
      damage: 1,
      accuracy: 1
    },
    basePower: 11,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 6]
    },
    eligibleAffixKeys: ["strength", "vitality", "damage", "accuracy", "critChance", "critMultiplier", "luck"]
  },
  {
    id: "warrior_worn_jerkin",
    itemCode: "warrior_worn_jerkin",
    itemName: "Worn Jerkin",
    category: "Armor",
    description: "A repaired heavy jerkin with enough plate to matter in a first real fight.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["upperArmor"],
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    baseStatBonuses: {
      strength: 1,
      vitality: 2,
      armor: 2,
      maxHitpoints: 8
    },
    basePower: 9,
    eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "initiative", "luck"]
  },
  {
    id: "mage_dormant_hazel_wand",
    itemCode: "mage_dormant_hazel_wand",
    itemName: "Dormant Hazel Wand",
    category: "Weapon",
    description: "A novice wand that holds a steady channel even when its bearer does not.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["weapon"],
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: "arcane",
      weaponFamily: "wand"
    },
    baseStatBonuses: {
      intelligence: 2,
      damage: 1,
      accuracy: 1
    },
    basePower: 11,
    weaponDamageProfile: {
      minRollRange: [2, 4],
      maxRollRange: [4, 6]
    },
    eligibleAffixKeys: ["intelligence", "initiative", "luck", "damage", "accuracy", "critChance", "critMultiplier"]
  },
  {
    id: "mage_rough_cloth",
    itemCode: "mage_rough_cloth",
    itemName: "Rough Cloth",
    category: "Armor",
    description: "Simple robe layers stitched with enough ward-thread to keep sparks off the skin.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["upperArmor"],
    archetype: {
      majorCategory: "armor",
      armorArchetype: "robe"
    },
    baseStatBonuses: {
      intelligence: 1,
      vitality: 1,
      spellShield: 2,
      maxHitpoints: 6
    },
    basePower: 9,
    eligibleAffixKeys: ["intelligence", "vitality", "spellShield", "maxHitpoints", "initiative", "luck"]
  },
  {
    id: "ranger_longreach_recurve",
    itemCode: "ranger_longreach_recurve",
    itemName: "Longreach Recurve",
    category: "Weapon",
    description: "A hunting bow tuned for quick draws, light tension, and steady sightlines.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["weapon"],
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: "ranged",
      weaponFamily: "bow"
    },
    baseStatBonuses: {
      dexterity: 2,
      damage: 1,
      accuracy: 1
    },
    basePower: 11,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 7]
    },
    eligibleAffixKeys: ["dexterity", "initiative", "luck", "damage", "accuracy", "critChance", "extraAttackChance"]
  },
  {
    id: "ranger_plain_jerkin",
    itemCode: "ranger_plain_jerkin",
    itemName: "Plain Jerkin",
    category: "Armor",
    description: "A simple leather jerkin cut to move without catching brush or bowstring.",
    rarity: "common",
    levelRequirement: 1,
    baseLevel: 1,
    allowedSlotIds: ["upperArmor"],
    archetype: {
      majorCategory: "armor",
      armorArchetype: "light"
    },
    baseStatBonuses: {
      dexterity: 1,
      vitality: 1,
      missileResistance: 2,
      dodgeChance: 20
    },
    basePower: 9,
    eligibleAffixKeys: ["dexterity", "vitality", "missileResistance", "dodgeChance", "initiative", "luck"]
  }
];

const ITEM_TEMPLATE_BY_ID = new Map(ITEM_TEMPLATES.map((template) => [template.id, template] as const));

const STARTER_TEMPLATE_IDS: Record<PlayerClass, readonly [string, string]> = {
  warrior: ["warrior_worn_jerkin", "warrior_iron_shortsword"],
  mage: ["mage_rough_cloth", "mage_dormant_hazel_wand"],
  ranger: ["ranger_plain_jerkin", "ranger_longreach_recurve"]
};

function randomInt(min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

function maybeRound(value: number): number {
  return Math.max(0, Math.round(value));
}

function capitalizeCategory(category: InventoryItem["archetype"]["majorCategory"]): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function addStatBonus(totals: PlayerStatBonuses, statKey: PlayerStatKey, value: number): void {
  totals[statKey] = (totals[statKey] ?? 0) + value;
}

function rollModifierTier(): typeof TIER_ORDER[number] {
  const roll = Math.random();
  if (roll < 0.6) {
    return "T1";
  }
  if (roll < 0.9) {
    return "T2";
  }
  return "T3";
}

function rollWeaponDamage(template: ItemTemplate, rarity: ItemRarity, deterministic: boolean): WeaponDamageRoll | undefined {
  if (!template.weaponDamageProfile) {
    return undefined;
  }

  const rarityMultiplier = WEAPON_RARITY_MULTIPLIER[rarity];
  const [baseMinLow, baseMinHigh] = template.weaponDamageProfile.minRollRange;
  const [baseMaxLow, baseMaxHigh] = template.weaponDamageProfile.maxRollRange;
  const minLow = maybeRound(baseMinLow * rarityMultiplier);
  const minHigh = Math.max(minLow, maybeRound(baseMinHigh * rarityMultiplier));
  const maxLow = Math.max(minHigh, maybeRound(baseMaxLow * rarityMultiplier));
  const maxHigh = Math.max(maxLow, maybeRound(baseMaxHigh * rarityMultiplier));
  const rolledMin = deterministic ? minLow : randomInt(minLow, minHigh);
  const rolledMax = deterministic ? maxLow : randomInt(Math.max(maxLow, rolledMin), maxHigh);

  return {
    minRollRange: [minLow, minHigh],
    rolledMin,
    rolledMax,
    maxRollRange: [maxLow, maxHigh],
    averageDamage: (rolledMin + rolledMax) / 2
  };
}

function pickEligibleAffixDefinitions(template: ItemTemplate): ItemAffixDefinition[] {
  return template.eligibleAffixKeys
    .map((statKey) => ITEM_AFFIX_DEFINITIONS[statKey])
    .filter((definition): definition is ItemAffixDefinition => definition !== undefined);
}

function buildModifier(
  definition: ItemAffixDefinition,
  kind: ItemModifier["kind"],
  itemLevel: number,
  tier: typeof TIER_ORDER[number]
): ItemModifier {
  const tierIndex = TIER_ORDER.indexOf(tier);
  const tierValues = definition.valueByTier(itemLevel);
  return {
    kind,
    tier,
    name: kind === "prefix" ? definition.prefixNames[tierIndex] : definition.affixNames[tierIndex],
    statKey: definition.statKey,
    value: tierValues[tierIndex],
    unit: definition.unit
  };
}

function rollModifiers(template: ItemTemplate, itemLevel: number, rarity: ItemRarity): {
  prefix?: ItemModifier;
  affix?: ItemModifier;
} {
  if (rarity === "common") {
    return {};
  }

  const eligibleDefinitions = pickEligibleAffixDefinitions(template);
  if (eligibleDefinitions.length === 0) {
    return {};
  }

  const pickDefinition = (excludeStatKey?: PlayerStatKey): ItemAffixDefinition => {
    const pool = excludeStatKey
      ? eligibleDefinitions.filter((definition) => definition.statKey !== excludeStatKey)
      : eligibleDefinitions;
    return pool[randomInt(0, Math.max(0, pool.length - 1))] ?? eligibleDefinitions[0];
  };

  if (rarity === "uncommon") {
    const definition = pickDefinition();
    const tier = rollModifierTier();
    const kind: ItemModifier["kind"] = Math.random() < 0.5 ? "prefix" : "affix";
    const modifier = buildModifier(definition, kind, itemLevel, tier);
    return kind === "prefix" ? { prefix: modifier } : { affix: modifier };
  }

  const prefixDefinition = pickDefinition();
  const affixDefinition = pickDefinition(prefixDefinition.statKey);
  return {
    prefix: buildModifier(prefixDefinition, "prefix", itemLevel, rollModifierTier()),
    affix: buildModifier(affixDefinition, "affix", itemLevel, rollModifierTier())
  };
}

function buildPower(template: ItemTemplate, rarity: ItemRarity, prefix?: ItemModifier, affix?: ItemModifier): number {
  return (
    template.basePower +
    RARITY_BONUS[rarity] +
    (prefix ? TIER_POWER_BONUS[prefix.tier] : 0) +
    (affix ? TIER_POWER_BONUS[affix.tier] : 0)
  );
}

function buildStatBonuses(template: ItemTemplate, prefix?: ItemModifier, affix?: ItemModifier): PlayerStatBonuses {
  const totals: PlayerStatBonuses = { ...template.baseStatBonuses };
  if (prefix) {
    addStatBonus(totals, prefix.statKey, prefix.value);
  }
  if (affix) {
    addStatBonus(totals, affix.statKey, affix.value);
  }
  return totals;
}

function buildItemCode(template: ItemTemplate, rarity: ItemRarity, deterministicCode?: string): string {
  if (deterministicCode) {
    return deterministicCode;
  }
  return `${template.itemCode}_${rarity}_${randomUUID().slice(0, 8)}`;
}

function buildItemId(playerId: string, itemCode: string, deterministic: boolean): string {
  if (deterministic) {
    return `itm_${playerId}_${itemCode}`;
  }
  return `itm_${randomUUID().replaceAll("-", "")}`;
}

export function getItemTemplate(templateId: string): ItemTemplate {
  const template = ITEM_TEMPLATE_BY_ID.get(templateId);
  if (!template) {
    throw new Error(`Unknown item template: ${templateId}`);
  }
  return template;
}

export function getStarterTemplateIdsForClass(playerClass: PlayerClass): readonly [string, string] {
  return STARTER_TEMPLATE_IDS[playerClass];
}

export function rollInventoryItem(args: {
  playerId: string;
  templateId: string;
  rarity?: ItemRarity;
  deterministic?: boolean;
  deterministicCode?: string;
}): InventoryItem {
  const template = getItemTemplate(args.templateId);
  const rarity = args.rarity ?? template.rarity;
  const deterministic = args.deterministic === true;
  const modifiers = deterministic ? {} : rollModifiers(template, template.levelRequirement, rarity);
  const itemCode = buildItemCode(template, rarity, args.deterministicCode);

  return inventoryItemSchema.parse({
    id: buildItemId(args.playerId, itemCode, deterministic),
    itemCode,
    itemName: template.itemName,
    rarity,
    category: template.category || capitalizeCategory(template.archetype.majorCategory),
    equipable: true,
    levelRequirement: template.levelRequirement,
    allowedSlotIds: [...template.allowedSlotIds],
    baseLevel: template.baseLevel,
    power: buildPower(template, rarity, modifiers.prefix, modifiers.affix),
    archetype: template.archetype,
    statBonuses: buildStatBonuses(template, modifiers.prefix, modifiers.affix),
    damageRoll: rollWeaponDamage(template, rarity, deterministic),
    prefix: modifiers.prefix,
    affix: modifiers.affix,
    description: template.description
  });
}

export function createStarterInventoryItems(playerId: string, playerClass: PlayerClass): InventoryItem[] {
  return getStarterTemplateIdsForClass(playerClass).map((templateId) =>
    rollInventoryItem({
      playerId,
      templateId,
      rarity: "common",
      deterministic: true,
      deterministicCode: `starter_${templateId}`
    })
  );
}

export function parseStoredInventoryItem(item: { id: string; itemCode: string; itemData: unknown } | null): InventoryItem | null {
  if (!item || !item.itemData || typeof item.itemData !== "object" || Array.isArray(item.itemData)) {
    return null;
  }

  const parsedCurrent = inventoryItemSchema.safeParse({
    ...item.itemData,
    id: item.id,
    itemCode: item.itemCode
  });
  if (parsedCurrent.success) {
    return parsedCurrent.data;
  }

  const parsedLegacy = legacyStoredItemSchema.safeParse({
    ...item.itemData,
    id: item.id,
    itemCode: item.itemCode
  });
  if (!parsedLegacy.success) {
    return null;
  }

  return inventoryItemSchema.parse({
    id: item.id,
    itemCode: item.itemCode,
    itemName: parsedLegacy.data.itemName,
    rarity: parsedLegacy.data.rarity,
    category: capitalizeCategory(parsedLegacy.data.archetype.majorCategory),
    equipable: parsedLegacy.data.equipable,
    levelRequirement: parsedLegacy.data.levelRequirement,
    allowedSlotIds: [parsedLegacy.data.equipSlotId],
    baseLevel: parsedLegacy.data.baseLevel,
    power: parsedLegacy.data.power,
    archetype: parsedLegacy.data.archetype,
    statBonuses: parsedLegacy.data.statBonuses ?? {},
    damageRoll: parsedLegacy.data.damageRoll,
    prefix: parsedLegacy.data.prefix,
    affix: parsedLegacy.data.affix,
    description: parsedLegacy.data.description ?? ""
  });
}

export function canItemEquipInSlot(item: Pick<InventoryItem, "allowedSlotIds">, slotId: EquipmentSlotId): boolean {
  return item.allowedSlotIds.includes(slotId);
}

export const allDefinedItemTemplates = ITEM_TEMPLATES;
export const allDefinedPlayerClasses: readonly PlayerClass[] = playerClassSchema.options;
