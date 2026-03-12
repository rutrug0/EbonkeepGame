import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import {
  armorArchetypeSchema,
  classToEquipmentGroup,
  equipmentGroupSchema,
  equipmentSlotIdSchema,
  inventoryItemSchema,
  itemModifierSchema,
  playerClassSchema,
  weaponFamilySchema,
  type ArmorArchetype,
  type EquipmentGroup,
  type EquipmentSlotId,
  type InventoryItem,
  type ItemModifier,
  type ItemRarity,
  type PlayerClass,
  type PlayerStatBonuses,
  type PlayerStatKey,
  type WeaponDamageRoll,
  type WeaponFamily
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
  allowedClass: EquipmentGroup;
  sequence: number;
  allowedSlotIds: readonly EquipmentSlotId[];
  archetype: InventoryItem["archetype"];
  baseStatBonuses: PlayerStatBonuses;
  statGrowthPerLevel?: Partial<Record<PlayerStatKey, number>>;
  basePower: number;
  powerPerLevel?: number;
  weaponDamageProfile?: {
    minRollRange: readonly [number, number];
    maxRollRange: readonly [number, number];
    minGrowthPerLevel?: number;
    maxGrowthPerLevel?: number;
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

type ArmorProfile = Pick<
  ItemTemplate,
  "baseStatBonuses" | "statGrowthPerLevel" | "basePower" | "powerPerLevel" | "eligibleAffixKeys"
>;

type WeaponProfile = ArmorProfile & {
  weaponDamageProfile: NonNullable<ItemTemplate["weaponDamageProfile"]>;
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
  meleeWeapons: "warrior_melee_weapon_name_ranges_v4.csv",
  rangedWeapons: "ranger_ranged_weapon_name_ranges_v3.csv",
  arcaneWeapons: "mage_arcane_weapon_name_ranges_v3.csv"
} as const;

const TIER_ORDER = ["T1", "T2", "T3"] as const;
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

const ARMOR_PROFILES: Record<ArmorArchetype, Partial<Record<EquipmentSlotId, ArmorProfile>>> = {
  heavy: {
    helmet: {
      baseStatBonuses: { strength: 1, armor: 1 },
      statGrowthPerLevel: { armor: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "initiative", "luck"]
    },
    upperArmor: {
      baseStatBonuses: { strength: 1, vitality: 1, armor: 2, maxHitpoints: 6 },
      statGrowthPerLevel: { vitality: 1, armor: 1, maxHitpoints: 2 },
      basePower: 8,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "initiative", "luck"]
    },
    belt: {
      baseStatBonuses: { vitality: 1, armor: 1, maxHitpoints: 3 },
      statGrowthPerLevel: { armor: 1, maxHitpoints: 2 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "initiative", "luck"]
    },
    pauldrons: {
      baseStatBonuses: { strength: 1, armor: 1, missileResistance: 1 },
      statGrowthPerLevel: { armor: 1, missileResistance: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "armor", "missileResistance", "vitality", "luck"]
    },
    gloves: {
      baseStatBonuses: { strength: 1, armor: 1, accuracy: 1 },
      statGrowthPerLevel: { armor: 1, accuracy: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "armor", "accuracy", "initiative", "luck"]
    },
    lowerArmor: {
      baseStatBonuses: { vitality: 1, armor: 2, maxHitpoints: 5 },
      statGrowthPerLevel: { vitality: 1, armor: 1, maxHitpoints: 2 },
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["strength", "vitality", "armor", "maxHitpoints", "luck"]
    },
    boots: {
      baseStatBonuses: { vitality: 1, armor: 1, initiative: 1 },
      statGrowthPerLevel: { armor: 1, initiative: 1 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["vitality", "armor", "initiative", "luck", "maxHitpoints"]
    }
  },
  light: {
    helmet: {
      baseStatBonuses: { dexterity: 1, initiative: 1, dodgeChance: 15 },
      statGrowthPerLevel: { initiative: 1, dodgeChance: 5 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "dodgeChance", "luck", "accuracy"]
    },
    upperArmor: {
      baseStatBonuses: { dexterity: 1, vitality: 1, missileResistance: 2, dodgeChance: 20 },
      statGrowthPerLevel: { missileResistance: 1, dodgeChance: 5 },
      basePower: 9,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "vitality", "missileResistance", "dodgeChance", "initiative", "luck"]
    },
    belt: {
      baseStatBonuses: { dexterity: 1, initiative: 1, accuracy: 1 },
      statGrowthPerLevel: { initiative: 1, accuracy: 1 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "accuracy", "luck", "dodgeChance"]
    },
    pauldrons: {
      baseStatBonuses: { dexterity: 1, missileResistance: 1, dodgeChance: 10 },
      statGrowthPerLevel: { missileResistance: 1, dodgeChance: 5 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "missileResistance", "dodgeChance", "initiative", "luck"]
    },
    gloves: {
      baseStatBonuses: { dexterity: 1, accuracy: 1, initiative: 1 },
      statGrowthPerLevel: { accuracy: 1, initiative: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "accuracy", "initiative", "luck", "critChance"]
    },
    lowerArmor: {
      baseStatBonuses: { vitality: 1, missileResistance: 2, dodgeChance: 15 },
      statGrowthPerLevel: { vitality: 1, missileResistance: 1, dodgeChance: 5 },
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "vitality", "missileResistance", "dodgeChance", "luck"]
    },
    boots: {
      baseStatBonuses: { dexterity: 1, initiative: 1, dodgeChance: 10 },
      statGrowthPerLevel: { initiative: 1, dodgeChance: 5 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["dexterity", "initiative", "dodgeChance", "luck", "extraAttackChance"]
    }
  },
  robe: {
    helmet: {
      baseStatBonuses: { intelligence: 1, initiative: 1, spellShield: 1 },
      statGrowthPerLevel: { initiative: 1, spellShield: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "initiative", "spellShield", "luck", "accuracy"]
    },
    upperArmor: {
      baseStatBonuses: { intelligence: 1, vitality: 1, spellShield: 2, maxHitpoints: 6 },
      statGrowthPerLevel: { spellShield: 1, maxHitpoints: 2 },
      basePower: 9,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "vitality", "spellShield", "maxHitpoints", "initiative", "luck"]
    },
    belt: {
      baseStatBonuses: { intelligence: 1, spellShield: 1, maxHitpoints: 3 },
      statGrowthPerLevel: { spellShield: 1, maxHitpoints: 2 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "spellShield", "maxHitpoints", "initiative", "luck"]
    },
    pauldrons: {
      baseStatBonuses: { intelligence: 1, spellShield: 1, initiative: 1 },
      statGrowthPerLevel: { spellShield: 1, initiative: 1 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "spellShield", "initiative", "luck", "accuracy"]
    },
    gloves: {
      baseStatBonuses: { intelligence: 1, accuracy: 1, critChance: 20 },
      statGrowthPerLevel: { accuracy: 1, critChance: 5 },
      basePower: 6,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "accuracy", "critChance", "initiative", "luck"]
    },
    lowerArmor: {
      baseStatBonuses: { vitality: 1, spellShield: 2, maxHitpoints: 5 },
      statGrowthPerLevel: { vitality: 1, spellShield: 1, maxHitpoints: 2 },
      basePower: 7,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "vitality", "spellShield", "maxHitpoints", "luck"]
    },
    boots: {
      baseStatBonuses: { intelligence: 1, initiative: 1, extraAttackChance: 20 },
      statGrowthPerLevel: { initiative: 1, extraAttackChance: 5 },
      basePower: 5,
      powerPerLevel: 2,
      eligibleAffixKeys: ["intelligence", "initiative", "extraAttackChance", "luck", "maxHitpoints"]
    }
  }
};

const WEAPON_PROFILES: Record<WeaponFamily, WeaponProfile> = {
  sword: {
    baseStatBonuses: { strength: 2, damage: 1, accuracy: 1 },
    statGrowthPerLevel: { damage: 1 },
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["strength", "vitality", "damage", "accuracy", "critChance", "critMultiplier", "luck"]
  },
  axe: {
    baseStatBonuses: { strength: 2, damage: 2 },
    statGrowthPerLevel: { damage: 1, vitality: 1 },
    basePower: 12,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 2],
      maxRollRange: [6, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["strength", "vitality", "damage", "critChance", "critMultiplier", "luck"]
  },
  wand: {
    baseStatBonuses: { intelligence: 2, damage: 1, accuracy: 1 },
    statGrowthPerLevel: { damage: 1 },
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 4],
      maxRollRange: [4, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["intelligence", "initiative", "luck", "damage", "accuracy", "critChance", "critMultiplier"]
  },
  staff: {
    baseStatBonuses: { intelligence: 2, damage: 2, spellShield: 1 },
    statGrowthPerLevel: { damage: 1, spellShield: 1 },
    basePower: 12,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["intelligence", "spellShield", "initiative", "damage", "critChance", "critMultiplier", "luck"]
  },
  sling: {
    baseStatBonuses: { dexterity: 2, damage: 1, accuracy: 1 },
    statGrowthPerLevel: { damage: 1 },
    basePower: 10,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 2],
      maxRollRange: [4, 6],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["dexterity", "initiative", "luck", "damage", "accuracy", "critChance", "extraAttackChance"]
  },
  bow: {
    baseStatBonuses: { dexterity: 2, damage: 1, accuracy: 1 },
    statGrowthPerLevel: { damage: 1 },
    basePower: 11,
    powerPerLevel: 3,
    weaponDamageProfile: {
      minRollRange: [2, 3],
      maxRollRange: [5, 7],
      minGrowthPerLevel: 1,
      maxGrowthPerLevel: 2
    },
    eligibleAffixKeys: ["dexterity", "initiative", "luck", "damage", "accuracy", "critChance", "extraAttackChance"]
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
  const weaponRows = [
    ...buildWeaponRows(DATA_FILES.meleeWeapons),
    ...buildWeaponRows(DATA_FILES.rangedWeapons),
    ...buildWeaponRows(DATA_FILES.arcaneWeapons)
  ];

  return [
    ...armorRows.map((row) => buildArmorTemplate(row)).filter((template): template is ItemTemplate => template !== null),
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
  prefix?: ItemModifier,
  affix?: ItemModifier
): number {
  return (
    template.basePower +
    getLevelDelta(template, itemLevel) * (template.powerPerLevel ?? 2) +
    RARITY_BONUS[rarity] +
    (prefix ? TIER_POWER_BONUS[prefix.tier] : 0) +
    (affix ? TIER_POWER_BONUS[affix.tier] : 0)
  );
}

function buildStatBonuses(
  template: ItemTemplate,
  itemLevel: number,
  prefix?: ItemModifier,
  affix?: ItemModifier
): PlayerStatBonuses {
  const totals = scaleBaseStatBonuses(template, itemLevel);
  if (prefix) {
    addStatBonus(totals, prefix.statKey, prefix.value);
  }
  if (affix) {
    addStatBonus(totals, affix.statKey, affix.value);
  }
  return totals;
}

function buildItemCode(template: ItemTemplate, rarity: ItemRarity, itemLevel: number, deterministicCode?: string): string {
  if (deterministicCode) {
    return deterministicCode;
  }
  return `${template.itemCode}_lvl${itemLevel}_${rarity}_${randomUUID().slice(0, 8)}`;
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
    power: buildPower(template, rarity, itemLevel, modifiers.prefix, modifiers.affix),
    archetype: template.archetype,
    statBonuses: buildStatBonuses(template, itemLevel, modifiers.prefix, modifiers.affix),
    damageRoll: rollWeaponDamage(template, rarity, deterministic, itemLevel),
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
