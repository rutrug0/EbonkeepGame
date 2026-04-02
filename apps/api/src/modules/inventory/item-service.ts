import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import {
  armorArchetypeSchema,
  classToEquipmentGroup,
  equipmentGroupSchema,
  equipmentSlotIdSchema,
  playerClassSchema,
  weaponFamilySchema,
  type ArmorArchetype,
  type EquipmentGroup,
  type EquipmentSlotId,
  type PlayerClass,
  type PlayerStatBonuses,
  type PlayerStatKey,
  type WeaponFamily
} from "@ebonkeep/shared/core";
import {
  itemEnchantingSchema,
  inventoryItemSchema,
  itemModifierSchema,
  weaponDamageRollSchema,
  type InventoryItem,
  type ItemEnchanting,
  type ItemModifier,
  type ItemRarity,
  type WeaponDamageRoll
} from "@ebonkeep/shared/inventory";

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
  damageRoll: z
    .object({
      minRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
      rolledMin: z.number().int().min(0),
      rolledMax: z.number().int().min(0),
      maxRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
      averageDamage: z.number().min(0)
    })
    .optional(),
  prefix: itemModifierSchema.optional(),
  affix: itemModifierSchema.optional()
});

const storedWeaponForgeDataSchema = z.object({
  track: z.literal("weapon"),
  level: z.number().int().min(0).max(10),
  bonusScaleBps: z.number().int().min(0),
  basePower: z.number().int().min(0),
  baseDamageRoll: weaponDamageRollSchema,
  temperingFailed: z.boolean().optional(),
  damagePenaltyBps: z.number().int().min(0).optional()
});

type StoredWeaponForgeData = z.infer<typeof storedWeaponForgeDataSchema>;

type ItemTemplate = {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  description: string;
  rarity: ItemRarity;
  levelRequirement: number;
  baseLevel: number;
  dropMinLevel: number;
  dropMaxLevel: number;
  allowedClass: EquipmentGroup | "all";
  sequence: number;
  allowedSlotIds: readonly EquipmentSlotId[];
  archetype: InventoryItem["archetype"];
  baseStatBonuses: PlayerStatBonuses;
  statGrowthPerLevel?: Partial<Record<PlayerStatKey, number>>;
  basePower: number;
  powerPerLevel?: number;
  weaponDamageTableId?: "meleeWeapon" | "rangedWeapon" | "arcaneWeapon";
  weaponDamageProfile?: {
    minRollRange: readonly [number, number];
    maxRollRange: readonly [number, number];
    minGrowthPerLevel?: number;
    maxGrowthPerLevel?: number;
  };
  fixedDefenseProfile?: {
    tableId: "heavyArmor" | "lightArmor" | "robeArmor" | "jewelry";
    rowSlot: "helmet" | "upperArmor" | "belt" | "pauldrons" | "gloves" | "lowerArmor" | "boots" | "necklace" | "ring";
    statKey: "physicalDefense" | "magicDefense";
  };
  eligibleAffixKeys: readonly PlayerStatKey[];
};

type ItemAffixDefinition = {
  scaleKey:
    | "attr_primary"
    | "vitality_primary"
    | "damage_primary"
    | "resistance_primary"
    | "max_hitpoints_primary"
    | "crit_chance"
    | "crit_damage"
    | "double_attack_chance"
    | "threat_bps";
  statKey: PlayerStatKey;
  unit: "flat" | "basis_points";
  prefixNames: readonly [string, string, string];
  affixNames: readonly [string, string, string];
};

type AffixScalingRow = {
  scaleKey: ItemAffixDefinition["scaleKey"];
  tier: typeof TIER_ORDER[number];
  rollMin: number;
  rollMax: number;
  unit: ItemModifier["unit"];
};

type ArmorProfile = Pick<
  ItemTemplate,
  "baseStatBonuses" | "statGrowthPerLevel" | "basePower" | "powerPerLevel" | "eligibleAffixKeys"
>;

type WeaponProfile = ArmorProfile & {
  weaponDamageProfile: NonNullable<ItemTemplate["weaponDamageProfile"]>;
};

type JewelryProfile = Pick<
  ItemTemplate,
  "baseStatBonuses" | "statGrowthPerLevel" | "basePower" | "powerPerLevel" | "eligibleAffixKeys"
> & {
  allowedSlotIds: readonly EquipmentSlotId[];
  category: string;
};

type ArmorCsvRow = {
  sequence: number;
  itemName: string;
  itemType: string;
  archetype: ArmorArchetype;
  slotFamily: string;
  allowedClass: EquipmentGroup;
  flavorText: string;
  baseLevel: number;
  dropMinLevel: number;
  dropMaxLevel: number;
};

type WeaponCsvRow = {
  sequence: number;
  weaponName: string;
  weaponType: string;
  weaponFamily: WeaponFamily;
  allowedClass: EquipmentGroup;
  flavorText: string;
  baseLevel: number;
  dropMinLevel: number;
  dropMaxLevel: number;
};

type JewelryCsvRow = {
  sequence: number;
  itemName: string;
  itemType: string;
  slotFamily: "ring" | "necklace";
  flavorText: string;
  baseLevel: number;
  dropMinLevel: number;
  dropMaxLevel: number;
};

const SLOT_ID_BY_FAMILY = {
  helmet: "helmet",
  upper_armor: "upperArmor",
  belt: "belt",
  pauldrons: "pauldrons",
  gloves: "gloves",
  lower_armor: "lowerArmor",
  boots: "boots"
} satisfies Record<string, EquipmentSlotId>;

const WEAPON_ARCHETYPE_BY_FAMILY: Record<WeaponFamily, NonNullable<InventoryItem["archetype"]["weaponArchetype"]>> = {
  sword: "melee",
  axe: "melee",
  wand: "arcane",
  staff: "arcane",
  sling: "ranged",
  bow: "ranged"
};

const DATA_FILES = {
  heavyArmor: "heavy_armor_name_ranges_v1.csv",
  lightArmor: "light_armor_name_ranges_v1.csv",
  robeArmor: "robe_armor_name_ranges_v1.csv",
  ringJewelry: "jewelry_ring_name_ranges_v1.csv",
  necklaceJewelry: "jewelry_necklace_name_ranges_v1.csv",
  meleeWeapons: "warrior_melee_weapon_name_ranges_v4.csv",
  rangedWeapons: "ranger_ranged_weapon_name_ranges_v3.csv",
  arcaneWeapons: "mage_arcane_weapon_name_ranges_v3.csv",
  meleeWeaponScaling: "warrior_melee_weapon_ilvl_scaling_v2.csv",
  rangedWeaponScaling: "ranger_ranged_weapon_ilvl_scaling_v1.csv",
  arcaneWeaponScaling: "mage_arcane_weapon_ilvl_scaling_v1.csv",
  heavyArmorDefense: "heavy_armor_physical_defense_ilvl_scaling_v1.csv",
  lightArmorDefense: "light_armor_physical_defense_ilvl_scaling_v1.csv",
  robeArmorDefense: "robe_armor_physical_defense_ilvl_scaling_v1.csv",
  jewelryDefense: "jewelry_magic_defense_ilvl_scaling_v1.csv",
  affixScaling: "affix_scaling_level_1_100.csv"
} as const;

const TIER_ORDER = ["T1", "T2", "T3"] as const;
const WEAPON_DAMAGE_POWER_SCALE = 0.35;
const DEFENSE_POWER_SCALE = 2.2;
const STAT_POWER_WEIGHT: Partial<Record<PlayerStatKey, number>> = {
  strength: 1,
  intelligence: 1,
  dexterity: 1,
  vitality: 1,
  initiative: 1,
  luck: 1,
  armor: DEFENSE_POWER_SCALE,
  spellShield: DEFENSE_POWER_SCALE,
  missileResistance: DEFENSE_POWER_SCALE,
  physicalDefense: DEFENSE_POWER_SCALE,
  magicDefense: DEFENSE_POWER_SCALE,
  maxHitpoints: 0.1,
  damage: WEAPON_DAMAGE_POWER_SCALE,
  accuracy: 0.75,
  critChance: 0.02,
  critMultiplier: 0.01,
  dodgeChance: 0.02,
  extraAttackChance: 0.02,
  threat: 0
} as const;
const WEAPON_RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.1,
  rare: 1.22,
  epic: 1.36
};

const ITEM_AFFIX_DEFINITIONS: Partial<Record<PlayerStatKey, ItemAffixDefinition>> = {
  strength: {
    scaleKey: "attr_primary",
    statKey: "strength",
    unit: "flat",
    prefixNames: ["Forceful", "Brutal", "Worldrend"],
    affixNames: ["of Striking", "of Cleaving", "of the Warbringer"]
  },
  intelligence: {
    scaleKey: "attr_primary",
    statKey: "intelligence",
    unit: "flat",
    prefixNames: ["Imbued", "Arcane", "Void-touched"],
    affixNames: ["of Sparks", "of Sorcery", "of Cataclysm"]
  },
  dexterity: {
    scaleKey: "attr_primary",
    statKey: "dexterity",
    unit: "flat",
    prefixNames: ["Keen", "Deadeye", "Windpiercer"],
    affixNames: ["of Aim", "of Piercing", "of the Ballista"]
  },
  vitality: {
    scaleKey: "vitality_primary",
    statKey: "vitality",
    unit: "flat",
    prefixNames: ["Stout", "Vigorous", "Colossal"],
    affixNames: ["of Endurance", "of Deep Reserves", "of the Undying"]
  },
  initiative: {
    scaleKey: "attr_primary",
    statKey: "initiative",
    unit: "flat",
    prefixNames: ["Swift", "Quickened", "Lightning-borne"],
    affixNames: ["of Haste", "of the Tempest", "of Relentless Motion"]
  },
  luck: {
    scaleKey: "attr_primary",
    statKey: "luck",
    unit: "flat",
    prefixNames: ["Fortunate", "Lucky", "Fatebound"],
    affixNames: ["of Fortune", "of the Gambler", "of Twisted Fate"]
  },
  armor: {
    scaleKey: "resistance_primary",
    statKey: "armor",
    unit: "flat",
    prefixNames: ["Reinforced", "Ironbound", "Bastionforged"],
    affixNames: ["of Guarding", "of the Bulwark", "of Unyielding Stone"]
  },
  spellShield: {
    scaleKey: "resistance_primary",
    statKey: "spellShield",
    unit: "flat",
    prefixNames: ["Warded", "Runed", "Nullbound"],
    affixNames: ["of Warding", "of the Barrier", "of Arcane Silence"]
  },
  missileResistance: {
    scaleKey: "resistance_primary",
    statKey: "missileResistance",
    unit: "flat",
    prefixNames: ["Deflecting", "Arrowproof", "Stormguard"],
    affixNames: ["of Deflection", "of the Iron Screen", "of the Unerring Wall"]
  },
  maxHitpoints: {
    scaleKey: "max_hitpoints_primary",
    statKey: "maxHitpoints",
    unit: "flat",
    prefixNames: ["Stout", "Vigorous", "Colossal"],
    affixNames: ["of Endurance", "of Deep Reserves", "of the Undying"]
  },
  dodgeChance: {
    scaleKey: "double_attack_chance",
    statKey: "dodgeChance",
    unit: "basis_points",
    prefixNames: ["Evasive", "Elusive", "Ghoststride"],
    affixNames: ["of Evasion", "of Sidestepping", "of Vanishing"]
  },
  damage: {
    scaleKey: "damage_primary",
    statKey: "damage",
    unit: "flat",
    prefixNames: ["Sharpened", "Deadly", "Kingslayer's"],
    affixNames: ["of Force", "of Slaying", "of Ruin"]
  },
  critChance: {
    scaleKey: "crit_chance",
    statKey: "critChance",
    unit: "basis_points",
    prefixNames: ["Fortunate", "Lucky", "Fatebound"],
    affixNames: ["of Fortune", "of the Gambler", "of Twisted Fate"]
  },
  critMultiplier: {
    scaleKey: "crit_damage",
    statKey: "critMultiplier",
    unit: "basis_points",
    prefixNames: ["Punishing", "Devastating", "Doom-marked"],
    affixNames: ["of Impact", "of Ruin", "of Final Judgment"]
  },
  accuracy: {
    scaleKey: "damage_primary",
    statKey: "accuracy",
    unit: "flat",
    prefixNames: ["True", "Sure", "Unerring"],
    affixNames: ["of Focus", "of Precision", "of Perfect Aim"]
  },
  extraAttackChance: {
    scaleKey: "double_attack_chance",
    statKey: "extraAttackChance",
    unit: "basis_points",
    prefixNames: ["Opportunistic", "Relentless", "Frenzied"],
    affixNames: ["of Momentum", "of the Second Strike", "of Endless Assault"]
  },
  threat: {
    scaleKey: "threat_bps",
    statKey: "threat",
    unit: "basis_points",
    prefixNames: ["Provoking", "Challenger's", "Dreadbound"],
    affixNames: ["of Veiled Presence", "of Silent Footing", "of Fading Echoes"]
  }
};

const ARMOR_PROFILES: Record<ArmorArchetype, Partial<Record<EquipmentSlotId, ArmorProfile>>> = {
  heavy: {
    helmet: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "initiative", "luck", "threat"]
    },
    upperArmor: {
      baseStatBonuses: {},
      basePower: 8,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "initiative", "luck", "threat"]
    },
    belt: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "initiative", "luck", "threat"]
    },
    pauldrons: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "armor", "missileResistance", "vitality", "luck", "threat"]
    },
    gloves: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "armor", "accuracy", "initiative", "luck", "threat"]
    },
    lowerArmor: {
      baseStatBonuses: {},
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "luck", "threat"]
    },
    boots: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["vitality", "armor", "initiative", "luck", "maxHitpoints", "threat"]
    }
  },
  light: {
    helmet: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "dodgeChance", "luck", "accuracy", "threat"]
    },
    upperArmor: {
      baseStatBonuses: {},
      basePower: 9,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "vitality", "missileResistance", "dodgeChance", "initiative", "luck", "threat"]
    },
    belt: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "accuracy", "luck", "dodgeChance", "threat"]
    },
    pauldrons: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "missileResistance", "dodgeChance", "initiative", "luck", "threat"]
    },
    gloves: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "accuracy", "initiative", "luck", "critChance", "threat"]
    },
    lowerArmor: {
      baseStatBonuses: {},
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "vitality", "missileResistance", "dodgeChance", "luck", "threat"]
    },
    boots: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "dodgeChance", "luck", "extraAttackChance", "threat"]
    }
  },
  robe: {
    helmet: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "initiative", "spellShield", "luck", "accuracy", "threat"]
    },
    upperArmor: {
      baseStatBonuses: {},
      basePower: 9,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "vitality", "spellShield", "maxHitpoints", "initiative", "luck", "threat"]
    },
    belt: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "spellShield", "maxHitpoints", "initiative", "luck", "threat"]
    },
    pauldrons: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "spellShield", "initiative", "luck", "accuracy", "threat"]
    },
    gloves: {
      baseStatBonuses: {},
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "accuracy", "critChance", "initiative", "luck", "threat"]
    },
    lowerArmor: {
      baseStatBonuses: {},
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "vitality", "spellShield", "maxHitpoints", "luck", "threat"]
    },
    boots: {
      baseStatBonuses: {},
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "initiative", "extraAttackChance", "luck", "maxHitpoints", "threat"]
    }
  }
};

const JEWELRY_PROFILES: Record<JewelryCsvRow["slotFamily"], JewelryProfile> = {
  necklace: {
    allowedSlotIds: ["necklace"],
    category: "Necklace",
    baseStatBonuses: {},
    basePower: 5,
    powerPerLevel: 2,
    eligibleAffixKeys: ["vitality", "luck", "maxHitpoints", "critChance", "threat"]
  },
  ring: {
    allowedSlotIds: ["ringLeft", "ringRight"],
    category: "Ring",
    baseStatBonuses: {},
    basePower: 4,
    powerPerLevel: 2,
    eligibleAffixKeys: ["initiative", "luck", "critChance", "critMultiplier", "threat"]
  }
};

const WEAPON_PROFILES: Record<WeaponFamily, WeaponProfile> = {
  sword: {
    baseStatBonuses: {},
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["strength", "vitality", "damage", "accuracy", "critChance", "critMultiplier", "luck", "threat"]
  },
  axe: {
    baseStatBonuses: {},
    basePower: 12,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 2],
      maxRollRange: [6, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["strength", "vitality", "damage", "critChance", "critMultiplier", "luck", "threat"]
  },
  wand: {
    baseStatBonuses: {},
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 4],
      maxRollRange: [4, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["intelligence", "initiative", "luck", "damage", "accuracy", "critChance", "critMultiplier", "threat"]
  },
  staff: {
    baseStatBonuses: {},
    basePower: 12,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["intelligence", "spellShield", "initiative", "damage", "critChance", "critMultiplier", "luck", "threat"]
  },
  sling: {
    baseStatBonuses: {},
    basePower: 10,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 2],
      maxRollRange: [4, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["dexterity", "initiative", "luck", "damage", "accuracy", "critChance", "extraAttackChance", "threat"]
  },
  bow: {
    baseStatBonuses: {},
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["dexterity", "initiative", "luck", "damage", "accuracy", "critChance", "extraAttackChance", "threat"]
  }
};

function resolveDataPath(fileName: string): string {
  const fromRepoRoot = resolve(process.cwd(), "docs", "data", fileName);
  if (existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  return resolve(process.cwd(), "..", "..", "docs", "data", fileName);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).replaceAll("\"\"", "\"");
  }
  return trimmed;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      const nextChar = index + 1 < line.length ? line[index + 1] : "";
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(stripQuotes(current));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(stripQuotes(current));
  return cells;
}

function parseCsv(fileName: string): Record<string, string>[] {
  const raw = readFileSync(resolveDataPath(fileName), "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = cells[index] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildAffixScalingLookup(fileName: string): Map<string, AffixScalingRow> {
  const lookup = new Map<string, AffixScalingRow>();

  for (const row of parseCsv(fileName)) {
    const tier = row.tier as typeof TIER_ORDER[number];
    lookup.set(`${toInt(row.level)}:${row.scale_key}:${tier}`, {
      scaleKey: row.scale_key as AffixScalingRow["scaleKey"],
      tier,
      rollMin: toInt(row.roll_min),
      rollMax: toInt(row.roll_max),
      unit: row.unit as ItemModifier["unit"]
    });
  }

  return lookup;
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toCategoryLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function addStatBonus(totals: PlayerStatBonuses, statKey: PlayerStatKey, value: number): void {
  totals[statKey] = (totals[statKey] ?? 0) + value;
}

function getStatBonusPower(statBonuses: PlayerStatBonuses): number {
  return Math.floor(
    Object.entries(statBonuses).reduce((sum, [statKey, value]) => {
      if (typeof value !== "number") {
        return sum;
      }
      return sum + value * (STAT_POWER_WEIGHT[statKey as PlayerStatKey] ?? 0);
    }, 0)
  );
}

function getFixedDefenseValue(
  template: ItemTemplate,
  rarity: ItemRarity,
  itemLevel: number
): number {
  if (!template.fixedDefenseProfile) {
    return 0;
  }

  const row = FIXED_DEFENSE_LOOKUPS[template.fixedDefenseProfile.tableId].get(`${itemLevel}:${rarity}`);
  const rawValue = row?.[template.fixedDefenseProfile.rowSlot] ?? 0;
  return template.fixedDefenseProfile.tableId === "jewelry" && template.fixedDefenseProfile.rowSlot === "ring"
    ? Math.floor(rawValue / 2)
    : rawValue;
}

function isEquipmentGroup(value: string): value is EquipmentGroup {
  return equipmentGroupSchema.safeParse(value).success;
}

function isPlayerClass(value: string): value is PlayerClass {
  return playerClassSchema.safeParse(value).success;
}

function isArmorArchetype(value: string): value is ArmorArchetype {
  return armorArchetypeSchema.safeParse(value).success;
}

function isWeaponFamily(value: string): value is WeaponFamily {
  return weaponFamilySchema.safeParse(value).success;
}

function mapSlotFamilyToSlotId(slotFamily: string): EquipmentSlotId | null {
  return SLOT_ID_BY_FAMILY[slotFamily as keyof typeof SLOT_ID_BY_FAMILY] ?? null;
}

function buildArmorRows(fileName: string): ArmorCsvRow[] {
  return parseCsv(fileName)
    .map((row) => {
      if (!isArmorArchetype(row.archetype) || !isEquipmentGroup(row.allowed_class)) {
        return null;
      }

      return {
        sequence: toInt(row.sequence),
        itemName: row.item_name,
        itemType: row.item_type,
        archetype: row.archetype,
        slotFamily: row.slot_family,
        allowedClass: row.allowed_class,
        flavorText: row.flavor_text,
        baseLevel: toInt(row.base_level),
        dropMinLevel: toInt(row.drop_min_level),
        dropMaxLevel: toInt(row.drop_max_level_capped)
      } satisfies ArmorCsvRow;
    })
    .filter((row): row is ArmorCsvRow => row !== null);
}

function buildJewelryRows(fileName: string): JewelryCsvRow[] {
  return parseCsv(fileName)
    .map((row) => {
      if (row.slot_family !== "ring" && row.slot_family !== "necklace") {
        return null;
      }

      return {
        sequence: toInt(row.sequence),
        itemName: row.item_name,
        itemType: row.item_type,
        slotFamily: row.slot_family,
        flavorText: row.flavor_text,
        baseLevel: toInt(row.base_level),
        dropMinLevel: toInt(row.drop_min_level),
        dropMaxLevel: toInt(row.drop_max_level_capped)
      } satisfies JewelryCsvRow;
    })
    .filter((row): row is JewelryCsvRow => row !== null);
}

function buildWeaponRows(fileName: string): WeaponCsvRow[] {
  return parseCsv(fileName)
    .map((row) => {
      const normalizedWeaponType = normalizeIdentifier(row.weapon_type);
      if (!isWeaponFamily(normalizedWeaponType) || !isEquipmentGroup(row.allowed_class)) {
        return null;
      }

      return {
        sequence: toInt(row.sequence),
        weaponName: row.weapon_name,
        weaponType: row.weapon_type,
        weaponFamily: normalizedWeaponType,
        allowedClass: row.allowed_class,
        flavorText: row.flavor_text,
        baseLevel: toInt(row.base_level),
        dropMinLevel: toInt(row.drop_min_level),
        dropMaxLevel: toInt(row.drop_max_level_capped)
      } satisfies WeaponCsvRow;
    })
    .filter((row): row is WeaponCsvRow => row !== null);
}

function buildArmorTemplate(row: ArmorCsvRow): ItemTemplate | null {
  const slotId = mapSlotFamilyToSlotId(row.slotFamily);
  if (!slotId) {
    return null;
  }

  const profile = ARMOR_PROFILES[row.archetype][slotId];
  if (!profile) {
    return null;
  }

  const slug = normalizeIdentifier(row.itemName);
  return {
    id: `${row.allowedClass}_${slug}`,
    itemCode: `${row.allowedClass}_${slug}`,
    itemName: row.itemName,
    category: toCategoryLabel(row.itemType),
    description: row.flavorText,
    rarity: "common",
    levelRequirement: Math.max(1, row.baseLevel),
    baseLevel: row.baseLevel,
    dropMinLevel: row.dropMinLevel,
    dropMaxLevel: row.dropMaxLevel,
    allowedClass: row.allowedClass,
    sequence: row.sequence,
    allowedSlotIds: [slotId],
    archetype: {
      majorCategory: "armor",
      armorArchetype: row.archetype
    },
    baseStatBonuses: profile.baseStatBonuses,
    statGrowthPerLevel: profile.statGrowthPerLevel,
    basePower: profile.basePower,
    powerPerLevel: profile.powerPerLevel,
    fixedDefenseProfile: {
      tableId:
        row.archetype === "heavy"
          ? "heavyArmor"
          : row.archetype === "light"
            ? "lightArmor"
            : "robeArmor",
      rowSlot:
        slotId === "upperArmor" ||
        slotId === "lowerArmor" ||
        slotId === "helmet" ||
        slotId === "pauldrons" ||
        slotId === "gloves" ||
        slotId === "belt" ||
        slotId === "boots"
          ? slotId
          : "helmet",
      statKey: "physicalDefense"
    },
    eligibleAffixKeys: profile.eligibleAffixKeys
  };
}

function buildJewelryTemplate(row: JewelryCsvRow): ItemTemplate {
  const profile = JEWELRY_PROFILES[row.slotFamily];
  const slug = normalizeIdentifier(row.itemName);

  return {
    id: `all_${slug}`,
    itemCode: `all_${slug}`,
    itemName: row.itemName,
    category: profile.category,
    description: row.flavorText,
    rarity: "common",
    levelRequirement: Math.max(1, row.baseLevel),
    baseLevel: row.baseLevel,
    dropMinLevel: row.dropMinLevel,
    dropMaxLevel: row.dropMaxLevel,
    allowedClass: "all",
    sequence: row.sequence,
    allowedSlotIds: profile.allowedSlotIds,
    archetype: {
      majorCategory: "jewelry"
    },
    baseStatBonuses: profile.baseStatBonuses,
    statGrowthPerLevel: profile.statGrowthPerLevel,
    basePower: profile.basePower,
    powerPerLevel: profile.powerPerLevel,
    fixedDefenseProfile: {
      tableId: "jewelry",
      rowSlot: row.slotFamily,
      statKey: "magicDefense"
    },
    eligibleAffixKeys: profile.eligibleAffixKeys
  };
}

function buildWeaponTemplate(row: WeaponCsvRow): ItemTemplate {
  const profile = WEAPON_PROFILES[row.weaponFamily];
  return {
    id: `${row.allowedClass}_${normalizeIdentifier(row.weaponName)}`,
    itemCode: `${row.allowedClass}_${normalizeIdentifier(row.weaponName)}`,
    itemName: row.weaponName,
    category: row.weaponType,
    description: row.flavorText,
    rarity: "common",
    levelRequirement: Math.max(1, row.baseLevel),
    baseLevel: row.baseLevel,
    dropMinLevel: row.dropMinLevel,
    dropMaxLevel: row.dropMaxLevel,
    allowedClass: row.allowedClass,
    sequence: row.sequence,
    allowedSlotIds: ["weapon"],
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: WEAPON_ARCHETYPE_BY_FAMILY[row.weaponFamily],
      weaponFamily: row.weaponFamily
    },
    baseStatBonuses: profile.baseStatBonuses,
    statGrowthPerLevel: profile.statGrowthPerLevel,
    basePower: profile.basePower,
    powerPerLevel: profile.powerPerLevel,
    weaponDamageTableId:
      row.weaponFamily === "sword" || row.weaponFamily === "axe"
        ? "meleeWeapon"
        : row.weaponFamily === "sling" || row.weaponFamily === "bow"
          ? "rangedWeapon"
          : "arcaneWeapon",
    weaponDamageProfile: profile.weaponDamageProfile,
    eligibleAffixKeys: profile.eligibleAffixKeys
  };
}

function buildItemTemplates(): ItemTemplate[] {
  const armorRows = [
    ...buildArmorRows(DATA_FILES.heavyArmor),
    ...buildArmorRows(DATA_FILES.lightArmor),
    ...buildArmorRows(DATA_FILES.robeArmor)
  ];
  const jewelryRows = [
    ...buildJewelryRows(DATA_FILES.ringJewelry),
    ...buildJewelryRows(DATA_FILES.necklaceJewelry)
  ];
  const weaponRows = [
    ...buildWeaponRows(DATA_FILES.meleeWeapons),
    ...buildWeaponRows(DATA_FILES.rangedWeapons),
    ...buildWeaponRows(DATA_FILES.arcaneWeapons)
  ];

  return [
    ...armorRows.map((row) => buildArmorTemplate(row)).filter((template): template is ItemTemplate => template !== null),
    ...jewelryRows.map((row) => buildJewelryTemplate(row)),
    ...weaponRows.map((row) => buildWeaponTemplate(row))
  ].sort((left, right) => {
    if (left.allowedClass !== right.allowedClass) {
      return left.allowedClass.localeCompare(right.allowedClass);
    }
    if (left.archetype.majorCategory !== right.archetype.majorCategory) {
      return left.archetype.majorCategory.localeCompare(right.archetype.majorCategory);
    }
    if (left.baseLevel !== right.baseLevel) {
      return left.baseLevel - right.baseLevel;
    }
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    return left.itemName.localeCompare(right.itemName);
  });
}

const ITEM_TEMPLATES: readonly ItemTemplate[] = buildItemTemplates();
const ITEM_TEMPLATE_BY_ID = new Map(ITEM_TEMPLATES.map((template) => [template.id, template] as const));

type FixedDefenseRow = Partial<Record<NonNullable<ItemTemplate["fixedDefenseProfile"]>["rowSlot"], number>>;
type WeaponDamageLookupRow = {
  minRollRange: [number, number];
  maxRollRange: [number, number];
};

function buildFixedDefenseLookup(
  fileName: string,
  slots: readonly NonNullable<ItemTemplate["fixedDefenseProfile"]>["rowSlot"][]
): Map<string, FixedDefenseRow> {
  const lookup = new Map<string, FixedDefenseRow>();
  for (const row of parseCsv(fileName)) {
    const rarity = row.rarity as ItemRarity;
    const values: FixedDefenseRow = {};
    for (const slot of slots) {
      values[slot] = toInt(row[slot]);
    }
    lookup.set(`${toInt(row.ilvl)}:${rarity}`, values);
  }
  return lookup;
}

function buildWeaponDamageLookup(fileName: string): Map<string, WeaponDamageLookupRow> {
  const lookup = new Map<string, WeaponDamageLookupRow>();

  for (const row of parseCsv(fileName)) {
    const rarity = row.rarity as ItemRarity;
    lookup.set(`${toInt(row.ilvl)}:${rarity}`, {
      minRollRange: [toInt(row.item_roll_min_low), toInt(row.item_roll_min_high)],
      maxRollRange: [toInt(row.item_roll_max_low), toInt(row.item_roll_max_high)]
    });
  }

  return lookup;
}

const FIXED_DEFENSE_LOOKUPS = {
  heavyArmor: buildFixedDefenseLookup(DATA_FILES.heavyArmorDefense, [
    "helmet",
    "upperArmor",
    "belt",
    "pauldrons",
    "gloves",
    "lowerArmor",
    "boots"
  ]),
  lightArmor: buildFixedDefenseLookup(DATA_FILES.lightArmorDefense, [
    "helmet",
    "upperArmor",
    "belt",
    "pauldrons",
    "gloves",
    "lowerArmor",
    "boots"
  ]),
  robeArmor: buildFixedDefenseLookup(DATA_FILES.robeArmorDefense, [
    "helmet",
    "upperArmor",
    "belt",
    "pauldrons",
    "gloves",
    "lowerArmor",
    "boots"
  ]),
  jewelry: buildFixedDefenseLookup(DATA_FILES.jewelryDefense, ["necklace", "ring"])
} as const;

const WEAPON_DAMAGE_LOOKUPS = {
  meleeWeapon: buildWeaponDamageLookup(DATA_FILES.meleeWeaponScaling),
  rangedWeapon: buildWeaponDamageLookup(DATA_FILES.rangedWeaponScaling),
  arcaneWeapon: buildWeaponDamageLookup(DATA_FILES.arcaneWeaponScaling)
} as const;

const AFFIX_SCALING_LOOKUP = buildAffixScalingLookup(DATA_FILES.affixScaling);

function pickStarterTemplateId(playerClass: PlayerClass, predicate: (template: ItemTemplate) => boolean): string {
  // Item templates still use the legacy equipment-group keys ("warrior"|"mage"|"ranger").
  const group = classToEquipmentGroup(playerClass);
  const template = ITEM_TEMPLATES.find((itemTemplate) => itemTemplate.allowedClass === group && predicate(itemTemplate));
  if (!template) {
    throw new Error(`Missing starter template for '${playerClass}' (group '${group}').`);
  }
  return template.id;
}

export const MERCHANT_HEAVY_ARMOR_TEMPLATE_IDS: ReadonlyArray<string> = ITEM_TEMPLATES
  .filter(
    (template) =>
      template.allowedClass === "warrior" &&
      template.archetype.majorCategory === "armor" &&
      template.archetype.armorArchetype === "heavy" &&
      template.baseLevel <= 4
  )
  .map((template) => template.id);

export const MERCHANT_MELEE_WEAPON_TEMPLATE_IDS: ReadonlyArray<string> = ITEM_TEMPLATES
  .filter(
    (template) =>
      template.allowedClass === "warrior" &&
      template.archetype.majorCategory === "weapon" &&
      template.archetype.weaponArchetype === "melee" &&
      template.baseLevel <= 4
  )
  .map((template) => template.id);

export const MERCHANT_TEMPLATE_IDS: ReadonlyArray<string> = [
  ...MERCHANT_HEAVY_ARMOR_TEMPLATE_IDS,
  ...MERCHANT_MELEE_WEAPON_TEMPLATE_IDS
];

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

function getItemLevel(template: ItemTemplate, itemLevelOverride?: number): number {
  return Math.max(1, itemLevelOverride ?? template.levelRequirement);
}

function getLevelDelta(template: ItemTemplate, itemLevel: number): number {
  return Math.max(0, itemLevel - template.baseLevel);
}

function scaleBaseStatBonuses(template: ItemTemplate, itemLevel: number): PlayerStatBonuses {
  const totals: PlayerStatBonuses = { ...template.baseStatBonuses };
  const levelDelta = getLevelDelta(template, itemLevel);

  if (!template.statGrowthPerLevel || levelDelta === 0) {
    return totals;
  }

  for (const [statKey, valuePerLevel] of Object.entries(template.statGrowthPerLevel)) {
    if (typeof valuePerLevel !== "number" || valuePerLevel === 0) {
      continue;
    }
    addStatBonus(totals, statKey as PlayerStatKey, valuePerLevel * levelDelta);
  }

  return totals;
}

function rollWeaponDamage(
  template: ItemTemplate,
  rarity: ItemRarity,
  deterministic: boolean,
  itemLevel: number
): WeaponDamageRoll | undefined {
  const lookupRow = template.weaponDamageTableId
    ? WEAPON_DAMAGE_LOOKUPS[template.weaponDamageTableId].get(`${itemLevel}:${rarity}`)
    : undefined;

  if (lookupRow) {
    const [minLow, minHigh] = lookupRow.minRollRange;
    const [maxLow, maxHigh] = lookupRow.maxRollRange;
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

  if (!template.weaponDamageProfile) {
    return undefined;
  }

  const levelDelta = getLevelDelta(template, itemLevel);
  const minGrowth = template.weaponDamageProfile.minGrowthPerLevel ?? 0;
  const maxGrowth = template.weaponDamageProfile.maxGrowthPerLevel ?? 0;
  const rarityMultiplier = WEAPON_RARITY_MULTIPLIER[rarity];
  const [baseMinLow, baseMinHigh] = template.weaponDamageProfile.minRollRange;
  const [baseMaxLow, baseMaxHigh] = template.weaponDamageProfile.maxRollRange;
  const minLow = maybeRound((baseMinLow + levelDelta * minGrowth) * rarityMultiplier);
  const minHigh = Math.max(minLow, maybeRound((baseMinHigh + levelDelta * minGrowth) * rarityMultiplier));
  const maxLow = Math.max(minHigh, maybeRound((baseMaxLow + levelDelta * maxGrowth) * rarityMultiplier));
  const maxHigh = Math.max(maxLow, maybeRound((baseMaxHigh + levelDelta * maxGrowth) * rarityMultiplier));
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

function getModifierSign(definition: ItemAffixDefinition, kind: ItemModifier["kind"]): number {
  return definition.statKey === "threat" && kind === "affix" ? -1 : 1;
}

function buildModifier(
  definition: ItemAffixDefinition,
  kind: ItemModifier["kind"],
  itemLevel: number,
  tier: typeof TIER_ORDER[number]
): ItemModifier {
  const tierIndex = TIER_ORDER.indexOf(tier);
  const scalingRow = AFFIX_SCALING_LOOKUP.get(`${itemLevel}:${definition.scaleKey}:${tier}`);
  if (!scalingRow) {
    throw new Error(`Missing affix scaling row for ${definition.scaleKey} at level ${itemLevel} (${tier}).`);
  }

  return {
    kind,
    tier,
    name: kind === "prefix" ? definition.prefixNames[tierIndex] : definition.affixNames[tierIndex],
    statKey: definition.statKey,
    value: randomInt(scalingRow.rollMin, scalingRow.rollMax) * getModifierSign(definition, kind),
    unit: scalingRow.unit
  };
}

function getModifierTierWeights(): Record<typeof TIER_ORDER[number], number> {
  return {
    T1: 0.6,
    T2: 0.3,
    T3: 0.1
  };
}

function getExpectedScalingValue(scaleKey: ItemAffixDefinition["scaleKey"], itemLevel: number): number {
  const tierWeights = getModifierTierWeights();
  let total = 0;

  for (const tier of TIER_ORDER) {
    const row = AFFIX_SCALING_LOOKUP.get(`${itemLevel}:${scaleKey}:${tier}`);
    if (!row) {
      continue;
    }
    total += (((row.rollMin + row.rollMax) / 2) * tierWeights[tier]);
  }

  return total;
}

function buildExpectedModifierBonuses(
  template: ItemTemplate,
  itemLevel: number,
  rarity: ItemRarity
): PlayerStatBonuses {
  if (rarity === "common") {
    return {};
  }

  const eligibleDefinitions = pickEligibleAffixDefinitions(template);
  if (eligibleDefinitions.length === 0) {
    return {};
  }

  const totals: PlayerStatBonuses = {};
  const addExpectedDefinitionValue = (definition: ItemAffixDefinition, kind: ItemModifier["kind"], weight: number) => {
    addStatBonus(
      totals,
      definition.statKey,
      getExpectedScalingValue(definition.scaleKey, itemLevel) * getModifierSign(definition, kind) * weight
    );
  };

  if (rarity === "uncommon") {
    const definitionWeight = 1 / eligibleDefinitions.length;
    for (const definition of eligibleDefinitions) {
      addExpectedDefinitionValue(definition, "prefix", definitionWeight * 0.5);
      addExpectedDefinitionValue(definition, "affix", definitionWeight * 0.5);
    }
    return totals;
  }

  const definitionWeight = 1 / eligibleDefinitions.length;
  for (const prefixDefinition of eligibleDefinitions) {
    addExpectedDefinitionValue(prefixDefinition, "prefix", definitionWeight);
    const affixPool = eligibleDefinitions.filter((definition) => definition.statKey !== prefixDefinition.statKey);
    const normalizedAffixPool = affixPool.length > 0 ? affixPool : [eligibleDefinitions[0]!];
    const affixWeight = definitionWeight / normalizedAffixPool.length;
    for (const affixDefinition of normalizedAffixPool) {
      addExpectedDefinitionValue(affixDefinition, "affix", affixWeight);
    }
  }

  return totals;
}

function rollModifiers(
  template: ItemTemplate,
  itemLevel: number,
  rarity: ItemRarity
): { prefix?: ItemModifier; affix?: ItemModifier } {
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

function buildPower(
  template: ItemTemplate,
  rarity: ItemRarity,
  itemLevel: number,
  statBonuses: PlayerStatBonuses,
  damageRoll: WeaponDamageRoll | undefined,
  prefix?: ItemModifier,
  affix?: ItemModifier
): number {
  const bonusPowerStats: PlayerStatBonuses = { ...statBonuses };
  const fixedDefenseValue = getFixedDefenseValue(template, rarity, itemLevel);

  if (fixedDefenseValue > 0) {
    const statKey = template.fixedDefenseProfile?.statKey;
    if (statKey) {
      const current = bonusPowerStats[statKey] ?? 0;
      const remainder = current - fixedDefenseValue;
      if (remainder > 0) {
        bonusPowerStats[statKey] = remainder;
      } else {
        delete bonusPowerStats[statKey];
      }
    }
  }

  const intrinsicPower =
    template.archetype.majorCategory === "weapon"
      ? (damageRoll?.averageDamage ?? 0) * WEAPON_DAMAGE_POWER_SCALE
      : fixedDefenseValue * DEFENSE_POWER_SCALE;

  return Math.max(0, Math.round(intrinsicPower + getStatBonusPower(bonusPowerStats)));
}

function buildStatBonuses(
  template: ItemTemplate,
  itemLevel: number,
  rarity: ItemRarity,
  prefix?: ItemModifier,
  affix?: ItemModifier
): PlayerStatBonuses {
  const totals = scaleBaseStatBonuses(template, itemLevel);
  if (template.fixedDefenseProfile) {
    const row = FIXED_DEFENSE_LOOKUPS[template.fixedDefenseProfile.tableId].get(`${itemLevel}:${rarity}`);
    const rawValue = row?.[template.fixedDefenseProfile.rowSlot] ?? 0;
    const value =
      template.fixedDefenseProfile.tableId === "jewelry" && template.fixedDefenseProfile.rowSlot === "ring"
        ? Math.floor(rawValue / 2)
        : rawValue;
    addStatBonus(totals, template.fixedDefenseProfile.statKey, value);
  }
  if (prefix) {
    addStatBonus(totals, prefix.statKey, prefix.value);
  }
  if (affix) {
    addStatBonus(totals, affix.statKey, affix.value);
  }
  return totals;
}

function buildExpectedWeaponDamage(
  template: ItemTemplate,
  rarity: ItemRarity,
  itemLevel: number
): WeaponDamageRoll | undefined {
  const lookupRow = template.weaponDamageTableId
    ? WEAPON_DAMAGE_LOOKUPS[template.weaponDamageTableId].get(`${itemLevel}:${rarity}`)
    : undefined;

  if (lookupRow) {
    const [minLow, minHigh] = lookupRow.minRollRange;
    const [maxLow, maxHigh] = lookupRow.maxRollRange;
    const rolledMin = (minLow + minHigh) / 2;
    const rolledMax = (maxLow + maxHigh) / 2;

    return {
      minRollRange: [minLow, minHigh],
      rolledMin: Math.round(rolledMin),
      rolledMax: Math.round(Math.max(rolledMin, rolledMax)),
      maxRollRange: [maxLow, maxHigh],
      averageDamage: (rolledMin + rolledMax) / 2
    };
  }

  if (!template.weaponDamageProfile) {
    return undefined;
  }

  const levelDelta = getLevelDelta(template, itemLevel);
  const minGrowth = template.weaponDamageProfile.minGrowthPerLevel ?? 0;
  const maxGrowth = template.weaponDamageProfile.maxGrowthPerLevel ?? 0;
  const rarityMultiplier = WEAPON_RARITY_MULTIPLIER[rarity];
  const [baseMinLow, baseMinHigh] = template.weaponDamageProfile.minRollRange;
  const [baseMaxLow, baseMaxHigh] = template.weaponDamageProfile.maxRollRange;
  const minLow = (baseMinLow + (levelDelta * minGrowth)) * rarityMultiplier;
  const minHigh = Math.max(minLow, (baseMinHigh + (levelDelta * minGrowth)) * rarityMultiplier);
  const maxLow = Math.max(minHigh, (baseMaxLow + (levelDelta * maxGrowth)) * rarityMultiplier);
  const maxHigh = Math.max(maxLow, (baseMaxHigh + (levelDelta * maxGrowth)) * rarityMultiplier);
  const rolledMin = (minLow + minHigh) / 2;
  const rolledMax = (maxLow + maxHigh) / 2;

  return {
    minRollRange: [Math.round(minLow), Math.round(minHigh)],
    rolledMin: Math.round(rolledMin),
    rolledMax: Math.round(Math.max(rolledMin, rolledMax)),
    maxRollRange: [Math.round(maxLow), Math.round(maxHigh)],
    averageDamage: (rolledMin + rolledMax) / 2
  };
}

function buildExpectedStatBonuses(
  template: ItemTemplate,
  itemLevel: number,
  rarity: ItemRarity
): PlayerStatBonuses {
  const totals = scaleBaseStatBonuses(template, itemLevel);
  if (template.fixedDefenseProfile) {
    const row = FIXED_DEFENSE_LOOKUPS[template.fixedDefenseProfile.tableId].get(`${itemLevel}:${rarity}`);
    const rawValue = row?.[template.fixedDefenseProfile.rowSlot] ?? 0;
    const value =
      template.fixedDefenseProfile.tableId === "jewelry" && template.fixedDefenseProfile.rowSlot === "ring"
        ? Math.floor(rawValue / 2)
        : rawValue;
    addStatBonus(totals, template.fixedDefenseProfile.statKey, value);
  }

  const expectedModifierBonuses = buildExpectedModifierBonuses(template, itemLevel, rarity);
  for (const [statKey, value] of Object.entries(expectedModifierBonuses)) {
    if (typeof value !== "number" || value === 0) {
      continue;
    }
    addStatBonus(totals, statKey as PlayerStatKey, value);
  }

  return totals;
}

function buildExplicitModifierBonuses(prefix?: ItemModifier, affix?: ItemModifier): PlayerStatBonuses {
  const totals: PlayerStatBonuses = {};
  if (prefix) {
    addStatBonus(totals, prefix.statKey, prefix.value);
  }
  if (affix) {
    addStatBonus(totals, affix.statKey, affix.value);
  }
  return totals;
}

function slotToFixedDefenseRowSlot(slotId: EquipmentSlotId): NonNullable<ItemTemplate["fixedDefenseProfile"]>["rowSlot"] | null {
  if (slotId === "ringLeft" || slotId === "ringRight") {
    return "ring";
  }
  if (slotId === "helmet" || slotId === "upperArmor" || slotId === "belt" || slotId === "pauldrons" || slotId === "gloves" || slotId === "lowerArmor" || slotId === "boots" || slotId === "necklace") {
    return slotId;
  }
  return null;
}

function addFixedDefenseBonus(
  totals: PlayerStatBonuses,
  args: {
    majorCategory: InventoryItem["archetype"]["majorCategory"];
    armorArchetype?: InventoryItem["archetype"]["armorArchetype"];
    allowedSlotIds: readonly EquipmentSlotId[];
    rarity: ItemRarity;
    itemLevel: number;
  }
): void {
  const slotId = args.allowedSlotIds[0];
  if (!slotId) {
    return;
  }

  if (args.majorCategory === "armor") {
    if (!args.armorArchetype) {
      return;
    }
    const tableId =
      args.armorArchetype === "heavy"
        ? "heavyArmor"
        : args.armorArchetype === "light"
          ? "lightArmor"
          : "robeArmor";
    const rowSlot = slotToFixedDefenseRowSlot(slotId);
    if (!rowSlot || rowSlot === "ring" || rowSlot === "necklace") {
      return;
    }
    const row = FIXED_DEFENSE_LOOKUPS[tableId].get(`${args.itemLevel}:${args.rarity}`);
    addStatBonus(totals, "physicalDefense", row?.[rowSlot] ?? 0);
    return;
  }

  if (args.majorCategory === "jewelry") {
    const rowSlot = slotToFixedDefenseRowSlot(slotId);
    if (!rowSlot || (rowSlot !== "necklace" && rowSlot !== "ring")) {
      return;
    }
    const row = FIXED_DEFENSE_LOOKUPS.jewelry.get(`${args.itemLevel}:${args.rarity}`);
    const rawValue = row?.[rowSlot] ?? 0;
    addStatBonus(totals, "magicDefense", rowSlot === "ring" ? Math.floor(rawValue / 2) : rawValue);
  }
}

function normalizeStoredStatBonuses(args: {
  archetype: Pick<InventoryItem["archetype"], "majorCategory">;
  armorArchetype?: InventoryItem["archetype"]["armorArchetype"];
  statBonuses?: PlayerStatBonuses;
  prefix?: ItemModifier;
  affix?: ItemModifier;
  allowedSlotIds: readonly EquipmentSlotId[];
  rarity: ItemRarity;
  itemLevel: number;
}): PlayerStatBonuses {
  if (args.archetype.majorCategory === "weapon") {
    return buildExplicitModifierBonuses(args.prefix, args.affix);
  }

  if (args.archetype.majorCategory === "armor" || args.archetype.majorCategory === "jewelry") {
    const totals = buildExplicitModifierBonuses(args.prefix, args.affix);
    addFixedDefenseBonus(totals, {
      majorCategory: args.archetype.majorCategory,
      armorArchetype: args.armorArchetype,
      allowedSlotIds: args.allowedSlotIds,
      rarity: args.rarity,
      itemLevel: args.itemLevel
    });
    return totals;
  }

  return args.statBonuses ?? {};
}

function buildItemCode(template: ItemTemplate, rarity: ItemRarity, itemLevel: number, deterministicCode?: string): string {
  if (deterministicCode) {
    return deterministicCode;
  }
  return `${template.itemCode}_lvl${itemLevel}_${rarity}_${randomUUID().slice(0, 8)}`;
}

function scaleDamageRollByBonus(
  damageRoll: WeaponDamageRoll,
  bonusScaleBps: number
): WeaponDamageRoll {
  const multiplier = 1 + (Math.max(0, bonusScaleBps) / 10_000);
  const scaleInt = (value: number) => Math.max(0, Math.round(value * multiplier));
  const scaleFloat = (value: number) => Math.max(0, Math.round(value * multiplier * 100) / 100);

  return weaponDamageRollSchema.parse({
    minRollRange: [scaleInt(damageRoll.minRollRange[0]), scaleInt(damageRoll.minRollRange[1])],
    rolledMin: scaleInt(damageRoll.rolledMin),
    rolledMax: scaleInt(damageRoll.rolledMax),
    maxRollRange: [scaleInt(damageRoll.maxRollRange[0]), scaleInt(damageRoll.maxRollRange[1])],
    averageDamage: scaleFloat(damageRoll.averageDamage)
  });
}

function applyWeaponForgeDataToItem(
  item: InventoryItem,
  forgeData: StoredWeaponForgeData | null
): InventoryItem {
  if (item.archetype.majorCategory !== "weapon" || !item.damageRoll || !forgeData) {
    return item;
  }

  // Apply tempering failure flag and optional damage penalty
  if (forgeData.temperingFailed) {
    if (forgeData.damagePenaltyBps && forgeData.damagePenaltyBps > 0) {
      const penaltyMultiplier = Math.max(0, 1 - forgeData.damagePenaltyBps / 10_000);
      const base = forgeData.baseDamageRoll;
      const penalizedRoll = weaponDamageRollSchema.parse({
        minRollRange: [Math.round(base.minRollRange[0] * penaltyMultiplier), Math.round(base.minRollRange[1] * penaltyMultiplier)],
        rolledMin: Math.round(base.rolledMin * penaltyMultiplier),
        rolledMax: Math.round(base.rolledMax * penaltyMultiplier),
        maxRollRange: [Math.round(base.maxRollRange[0] * penaltyMultiplier), Math.round(base.maxRollRange[1] * penaltyMultiplier)],
        averageDamage: Math.round((base.averageDamage * penaltyMultiplier) * 100) / 100
      });
      const penalizedPower = Math.max(0, Math.round(forgeData.basePower * penaltyMultiplier));
      return inventoryItemSchema.parse({
        ...item,
        damageRoll: penalizedRoll,
        power: penalizedPower,
        temperingFailed: true,
        damagePenaltyBps: forgeData.damagePenaltyBps
      });
    }
    // No penalty bps stored (legacy item) — still mark as tempering-failed
    return inventoryItemSchema.parse({ ...item, temperingFailed: true });
  }

  if (forgeData.level <= 0) {
    return item;
  }

  const effectiveDamageRoll = scaleDamageRollByBonus(forgeData.baseDamageRoll, forgeData.bonusScaleBps);
  const damageDelta = Math.max(0, effectiveDamageRoll.averageDamage - forgeData.baseDamageRoll.averageDamage);
  const effectivePower = Math.max(
    forgeData.basePower,
    Math.round(forgeData.basePower + (damageDelta * WEAPON_DAMAGE_POWER_SCALE))
  );

  return inventoryItemSchema.parse({
    ...item,
    damageRoll: effectiveDamageRoll,
    power: effectivePower,
    enchanting: itemEnchantingSchema.parse({
      track: "weapon",
      level: forgeData.level,
      bonusScaleBps: forgeData.bonusScaleBps
    } satisfies ItemEnchanting)
  });
}

/**
 * Re-applies tempering failure to an already-parsed weapon item using the
 * damage penalty from forge instability state. Used when the item's stored
 * forgeData pre-dates the temperingFailed field (legacy repair path).
 */
export function markWeaponTemperingFailed(
  item: InventoryItem,
  damagePenaltyBps: number
): InventoryItem {
  if (item.archetype.majorCategory !== "weapon" || !item.damageRoll) {
    return item;
  }
  // item.damageRoll is the unpenalized base because applyWeaponForgeDataToItem
  // fell through (no temperingFailed in forgeData) and left it unchanged.
  if (damagePenaltyBps > 0) {
    const penaltyMultiplier = Math.max(0, 1 - damagePenaltyBps / 10_000);
    const base = item.damageRoll;
    const penalizedRoll = weaponDamageRollSchema.parse({
      minRollRange: [Math.round(base.minRollRange[0] * penaltyMultiplier), Math.round(base.minRollRange[1] * penaltyMultiplier)],
      rolledMin: Math.round(base.rolledMin * penaltyMultiplier),
      rolledMax: Math.round(base.rolledMax * penaltyMultiplier),
      maxRollRange: [Math.round(base.maxRollRange[0] * penaltyMultiplier), Math.round(base.maxRollRange[1] * penaltyMultiplier)],
      averageDamage: Math.round((base.averageDamage * penaltyMultiplier) * 100) / 100
    });
    const penalizedPower = Math.max(0, Math.round(item.power * penaltyMultiplier));
    return inventoryItemSchema.parse({
      ...item,
      damageRoll: penalizedRoll,
      power: penalizedPower,
      temperingFailed: true,
      damagePenaltyBps
    });
  }
  return inventoryItemSchema.parse({ ...item, temperingFailed: true });
}

export function getStoredWeaponForgeData(
  itemData: unknown,
  fallbackItem: Pick<InventoryItem, "archetype" | "damageRoll" | "power">
): StoredWeaponForgeData | null {
  if (fallbackItem.archetype.majorCategory !== "weapon" || !fallbackItem.damageRoll) {
    return null;
  }

  if (itemData && typeof itemData === "object" && !Array.isArray(itemData)) {
    const parsed = storedWeaponForgeDataSchema.safeParse((itemData as Record<string, unknown>).forgeData);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return {
    track: "weapon",
    level: 0,
    bonusScaleBps: 0,
    basePower: fallbackItem.power,
    baseDamageRoll: fallbackItem.damageRoll
  };
}

export function withStoredWeaponForgeData(
  itemData: unknown,
  forgeData: StoredWeaponForgeData | null
): Record<string, unknown> {
  const baseRecord =
    itemData && typeof itemData === "object" && !Array.isArray(itemData)
      ? { ...(itemData as Record<string, unknown>) }
      : {};
  delete baseRecord.enchanting;

  if (!forgeData) {
    delete baseRecord.forgeData;
    return baseRecord;
  }

  // Keep forgeData even at level 0 when temperingFailed is set
  if (forgeData.level <= 0 && !forgeData.temperingFailed) {
    delete baseRecord.forgeData;
    return baseRecord;
  }

  baseRecord.forgeData = storedWeaponForgeDataSchema.parse(forgeData);
  return baseRecord;
}

function buildItemId(playerId: string, itemCode: string, deterministic: boolean, explicitId?: string): string {
  if (explicitId) {
    return explicitId;
  }
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
  return [
    pickStarterTemplateId(playerClass, (template) => template.allowedSlotIds.includes("upperArmor")),
    pickStarterTemplateId(playerClass, (template) => template.allowedSlotIds.includes("weapon"))
  ];
}

export function rollInventoryItem(args: {
  playerId: string;
  templateId: string;
  rarity?: ItemRarity;
  deterministic?: boolean;
  deterministicCode?: string;
  itemLevel?: number;
  explicitId?: string;
}): InventoryItem {
  const template = getItemTemplate(args.templateId);
  const rarity = args.rarity ?? template.rarity;
  const deterministic = args.deterministic === true;
  const itemLevel = getItemLevel(template, args.itemLevel);
  const modifiers = deterministic ? {} : rollModifiers(template, itemLevel, rarity);
  const damageRoll = rollWeaponDamage(template, rarity, deterministic, itemLevel);
  const statBonuses = buildStatBonuses(template, itemLevel, rarity, modifiers.prefix, modifiers.affix);
  const itemCode = buildItemCode(template, rarity, itemLevel, args.deterministicCode);

  return inventoryItemSchema.parse({
    id: buildItemId(args.playerId, itemCode, deterministic, args.explicitId),
    itemCode,
    itemName: template.itemName,
    rarity,
    category: template.category || capitalizeCategory(template.archetype.majorCategory),
    equipable: true,
    levelRequirement: itemLevel,
    allowedSlotIds: [...template.allowedSlotIds],
    baseLevel: itemLevel,
    power: buildPower(template, rarity, itemLevel, statBonuses, damageRoll, modifiers.prefix, modifiers.affix),
    archetype: template.archetype,
    statBonuses,
    damageRoll,
    prefix: modifiers.prefix,
    affix: modifiers.affix,
    description: template.description
  });
}

export function buildExpectedInventoryItem(args: {
  playerId: string;
  templateId: string;
  rarity?: ItemRarity;
  itemLevel?: number;
  explicitId?: string;
}): InventoryItem {
  const template = getItemTemplate(args.templateId);
  const rarity = args.rarity ?? template.rarity;
  const itemLevel = getItemLevel(template, args.itemLevel);
  const damageRoll = buildExpectedWeaponDamage(template, rarity, itemLevel);
  const statBonuses = Object.fromEntries(
    Object.entries(buildExpectedStatBonuses(template, itemLevel, rarity))
      .filter(([, value]) => typeof value === "number" && Math.round(value) !== 0)
      .map(([statKey, value]) => [statKey, Math.round(value)])
  ) as PlayerStatBonuses;
  const itemCode = `expected_${template.itemCode}_lvl${itemLevel}_${rarity}`;

  return inventoryItemSchema.parse({
    id: args.explicitId ?? `itm_expected_${args.playerId}_${template.id}_${itemLevel}_${rarity}`,
    itemCode,
    itemName: template.itemName,
    rarity,
    category: template.category || capitalizeCategory(template.archetype.majorCategory),
    equipable: true,
    levelRequirement: itemLevel,
    allowedSlotIds: [...template.allowedSlotIds],
    baseLevel: itemLevel,
    power: buildPower(template, rarity, itemLevel, statBonuses, damageRoll),
    archetype: template.archetype,
    statBonuses,
    damageRoll,
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
      deterministicCode: `starter_${templateId}`,
      itemLevel: 1
    })
  );
}

export function cloneInventoryItemForPlayer(args: {
  item: InventoryItem;
  playerId: string;
  explicitId?: string;
}): InventoryItem {
  const suffix = randomUUID().slice(0, 8);
  const itemCode = `${args.item.itemCode}_owned_${suffix}`;

  return inventoryItemSchema.parse({
    ...args.item,
    id: buildItemId(args.playerId, itemCode, false, args.explicitId),
    itemCode
  });
}

export function parseStoredInventoryItem(item: { id: string; itemCode: string; itemData: unknown; quantity?: number } | null): InventoryItem | null {
  if (!item || !item.itemData || typeof item.itemData !== "object" || Array.isArray(item.itemData)) {
    return null;
  }

  const parsedCurrent = inventoryItemSchema.safeParse({
    ...item.itemData,
    id: item.id,
    itemCode: item.itemCode,
    quantity: item.quantity
  });
  if (parsedCurrent.success) {
    const normalizedCurrent = inventoryItemSchema.parse({
      ...parsedCurrent.data,
      statBonuses: normalizeStoredStatBonuses({
        archetype: parsedCurrent.data.archetype,
        armorArchetype: parsedCurrent.data.archetype.armorArchetype,
        statBonuses: parsedCurrent.data.statBonuses,
        prefix: parsedCurrent.data.prefix,
        affix: parsedCurrent.data.affix,
        allowedSlotIds: parsedCurrent.data.allowedSlotIds,
        rarity: parsedCurrent.data.rarity,
        itemLevel: parsedCurrent.data.baseLevel ?? parsedCurrent.data.levelRequirement
      })
    });
    return applyWeaponForgeDataToItem(
      normalizedCurrent,
      getStoredWeaponForgeData(item.itemData, normalizedCurrent)
    );
  }

  const parsedLegacy = legacyStoredItemSchema.safeParse({
    ...item.itemData,
    id: item.id,
    itemCode: item.itemCode,
    quantity: item.quantity
  });
  if (!parsedLegacy.success) {
    return null;
  }

  const normalizedLegacy = inventoryItemSchema.parse({
    id: item.id,
    itemCode: item.itemCode,
    quantity: item.quantity,
    itemName: parsedLegacy.data.itemName,
    rarity: parsedLegacy.data.rarity,
    category: capitalizeCategory(parsedLegacy.data.archetype.majorCategory),
    equipable: parsedLegacy.data.equipable,
    levelRequirement: parsedLegacy.data.levelRequirement,
    allowedSlotIds: [parsedLegacy.data.equipSlotId],
    baseLevel: parsedLegacy.data.baseLevel,
    power: parsedLegacy.data.power,
    archetype: parsedLegacy.data.archetype,
    statBonuses: normalizeStoredStatBonuses({
    archetype: parsedLegacy.data.archetype,
    armorArchetype: parsedLegacy.data.archetype.armorArchetype,
    statBonuses: parsedLegacy.data.statBonuses ?? {},
    prefix: parsedLegacy.data.prefix,
    affix: parsedLegacy.data.affix,
    allowedSlotIds: [parsedLegacy.data.equipSlotId],
    rarity: parsedLegacy.data.rarity,
    itemLevel: parsedLegacy.data.baseLevel ?? parsedLegacy.data.levelRequirement
  }),
    damageRoll: parsedLegacy.data.damageRoll,
    prefix: parsedLegacy.data.prefix,
    affix: parsedLegacy.data.affix,
    description: parsedLegacy.data.description ?? ""
  });
  return applyWeaponForgeDataToItem(
    normalizedLegacy,
    getStoredWeaponForgeData(item.itemData, normalizedLegacy)
  );
}

export function canItemEquipInSlot(item: Pick<InventoryItem, "allowedSlotIds">, slotId: EquipmentSlotId): boolean {
  return item.allowedSlotIds.includes(slotId);
}

export const allDefinedItemTemplates = ITEM_TEMPLATES;
export const allDefinedPlayerClasses: readonly PlayerClass[] = playerClassSchema.options;
