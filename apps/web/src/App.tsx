import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactElement
} from "react";

import {
  isItemUsableByClass,
  mainStatToFlatDamageRatio,
  type ArmorArchetype,
  type ItemMajorCategory,
  type PlayerClass,
  type PlayerState,
  type VestigeId,
  type WeaponArchetype,
  type WeaponFamily
} from "@ebonkeep/shared";

import { devGuestLogin, fetchPlayerState } from "./api";

type LandingTab =
  | "inventory"
  | "contracts"
  | "missions"
  | "arena"
  | "guild"
  | "castles"
  | "auctionHouse"
  | "merchant"
  | "leaderboards"
  | "settings";
type Rarity = "common" | "uncommon" | "rare" | "epic";
type ContractDifficulty = "easy" | "medium" | "hard";
type ContractRoll = "low" | "medium" | "high";
type LayoutMode = "compact" | "standard" | "wide";
type ProfileSideTab = "inventory" | "consumables" | "stats";
type InventoryInsertPosition = "before" | "after";
type TrainableStatKey = "strength" | "intelligence" | "dexterity" | "vitality" | "initiative" | "luck";

type EquipmentSlotId =
  | "helmet"
  | "necklace"
  | "upperArmor"
  | "belt"
  | "ringLeft"
  | "weapon"
  | "pauldrons"
  | "gloves"
  | "lowerArmor"
  | "boots"
  | "ringRight"
  | "vestige1"
  | "vestige2"
  | "vestige3";

type EquipmentSlot = {
  label: string;
  majorCategory: ItemMajorCategory;
};

type InventoryItem = {
  id: string;
  itemName: string;
  rarity: Rarity;
  category: string;
  iconAssetPath?: string;
  equipable: boolean;
  archetype?: {
    majorCategory: ItemMajorCategory;
    armorArchetype?: ArmorArchetype;
    weaponArchetype?: WeaponArchetype;
    weaponFamily?: WeaponFamily;
    vestigeId?: VestigeId;
  };
  equipSlotId: EquipmentSlotId;
  levelRequirement: number;
  statBonuses?: Partial<Record<TrainableStatKey, number>>;
  damageRoll?: WeaponDamageRoll;
  prefix?: ItemModifier;
  affix?: ItemModifier;
  power: number;
  description: string;
};

type ModifierTier = "T1" | "T2" | "T3";

type ItemModifier = {
  kind: "prefix" | "affix";
  tier: ModifierTier;
  name: string;
  bonusLabel: string;
  bonusValue: string;
};

type ItemModifierStatLine = {
  id: string;
  tier: ModifierTier;
  label: string;
  value: string;
};

type WeaponDamageRoll = {
  minRollRange: [number, number];
  rolledMin: number;
  rolledMax: number;
  maxRollRange: [number, number];
  averageDamage: number;
};

type MeleeDamageRollWindow = {
  minLow: number;
  minHigh: number;
  maxLow: number;
  maxHigh: number;
};

type EquippedItems = Record<EquipmentSlotId, InventoryItem | null>;

type DragPayload =
  | { source: "inventory"; itemId: string }
  | { source: "equipment"; slotId: EquipmentSlotId; itemId: string };

type InventoryComparisonHoverState = {
  targetItemId: string;
  slotId: EquipmentSlotId;
  top: number;
  left: number;
  width: number;
};

type ContractBand = {
  low: number;
  medium: number;
  high: number;
};

type ContractTemplate = {
  id: string;
  name: string;
  difficulty: ContractDifficulty;
  experience: ContractBand;
  ducats: ContractBand;
  materials: ContractBand;
  itemDrop: ContractBand;
  staminaCost: ContractBand;
};

type ContractOffer = {
  instanceId: string;
  template: ContractTemplate;
  rollCue: {
    experience: ContractRoll;
    ducats: ContractRoll;
    materials: ContractRoll;
    itemDrop: ContractRoll;
    staminaCost: ContractRoll;
  };
  expiresAt: number;
};

type ContractSlotState = {
  slotIndex: number;
  offer: ContractOffer | null;
  replenishReadyAt: number | null;
};

type StatContributionLine = {
  label: string;
  ratioLabel: string;
  valueLabel: string;
};
type DevWeaponInventorySeed = NonNullable<PlayerState["devWeapons"]>[number];

const INVENTORY_ITEM_LIMIT = 20;
const CONTRACT_SLOT_COUNT = 6;
const CONTRACT_REPLENISH_MIN_MS = 60 * 60 * 1000;
const CONTRACT_REPLENISH_MAX_MS = 120 * 60 * 1000;
const STAT_TRAIN_DURATION_MS = 10 * 60 * 1000;
const TEST_MIN_DUCATS = 1000;
const MAIN_STAT_DEFENSE_RATIO = 0.2;
const LUCK_CRIT_CHANCE_PERCENT_PER_POINT = 0.1;
const LUCK_CRIT_DAMAGE_PERCENT_PER_POINT = 0.2;
const INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT = 0.1;
const INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT = 0.2;
const VITALITY_MAX_HP_PER_POINT = 10;
const DRAG_PAYLOAD_MIME = "application/x-ebonkeep-drag-payload";

const MENU_ITEMS: Array<{ id: LandingTab; label: string }> = [
  { id: "inventory", label: "Inventory" },
  { id: "contracts", label: "Contracts" },
  { id: "missions", label: "Missions" },
  { id: "arena", label: "Arena" },
  { id: "guild", label: "Guild" },
  { id: "castles", label: "Castles" },
  { id: "auctionHouse", label: "Auction House" },
  { id: "merchant", label: "Merchant" },
  { id: "leaderboards", label: "Leaderboards" },
  { id: "settings", label: "Settings" }
];

const EQUIPMENT_LEFT_SLOTS: EquipmentSlotId[] = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft"
];
const EQUIPMENT_RIGHT_SLOTS: EquipmentSlotId[] = [
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight"
];
const EQUIPMENT_VESTIGE_SLOTS: EquipmentSlotId[] = ["vestige1", "vestige2", "vestige3"];

const ALL_EQUIPMENT_SLOTS: EquipmentSlotId[] = [
  ...EQUIPMENT_LEFT_SLOTS,
  "weapon",
  ...EQUIPMENT_RIGHT_SLOTS,
  ...EQUIPMENT_VESTIGE_SLOTS
];

const EQUIPMENT_SLOTS: Record<EquipmentSlotId, EquipmentSlot> = {
  helmet: { label: "Helmet", majorCategory: "armor" },
  necklace: { label: "Necklace", majorCategory: "jewelry" },
  upperArmor: { label: "Upper Armor", majorCategory: "armor" },
  belt: { label: "Belt", majorCategory: "armor" },
  ringLeft: { label: "Ring I", majorCategory: "jewelry" },
  weapon: { label: "Weapon", majorCategory: "weapon" },
  pauldrons: { label: "Pauldrons", majorCategory: "armor" },
  gloves: { label: "Gloves", majorCategory: "armor" },
  lowerArmor: { label: "Lower Armor", majorCategory: "armor" },
  boots: { label: "Boots", majorCategory: "armor" },
  ringRight: { label: "Ring II", majorCategory: "jewelry" },
  vestige1: { label: "Vestige I", majorCategory: "vestige" },
  vestige2: { label: "Vestige II", majorCategory: "vestige" },
  vestige3: { label: "Vestige III", majorCategory: "vestige" }
};

function createEmptyEquippedItems(): EquippedItems {
  return ALL_EQUIPMENT_SLOTS.reduce(
    (accumulator, slotId) => ({
      ...accumulator,
      [slotId]: null
    }),
    {} as EquippedItems
  );
}

function getModifierPool(item: Pick<InventoryItem, "archetype">): {
  prefixNames: [string, string, string];
  affixNames: [string, string, string];
  prefixBonusLabel: string;
  affixBonusLabel: string;
  prefixBonusValues: [string, string, string];
  affixBonusValues: [string, string, string];
} {
  if (item.archetype?.majorCategory === "weapon") {
    if (item.archetype.weaponArchetype === "melee") {
      return {
        prefixNames: ["Forceful", "Brutal", "Worldrend"],
        affixNames: ["of Striking", "of Cleaving", "of the Warbringer"],
        prefixBonusLabel: "Melee Damage",
        affixBonusLabel: "Melee Damage",
        prefixBonusValues: ["+2", "+4", "+6"],
        affixBonusValues: ["+2", "+4", "+6"]
      };
    }
    if (item.archetype.weaponArchetype === "arcane") {
      return {
        prefixNames: ["Imbued", "Arcane", "Void-touched"],
        affixNames: ["of Sparks", "of Sorcery", "of Cataclysm"],
        prefixBonusLabel: "Spell Damage",
        affixBonusLabel: "Spell Shield",
        prefixBonusValues: ["+2", "+4", "+6"],
        affixBonusValues: ["+1", "+2", "+3"]
      };
    }
    return {
      prefixNames: ["Keen", "Deadeye", "Windpiercer"],
      affixNames: ["of Aim", "of Piercing", "of the Ballista"],
      prefixBonusLabel: "Ranged Damage",
      affixBonusLabel: "Missile Resistance",
      prefixBonusValues: ["+2", "+4", "+6"],
      affixBonusValues: ["+1", "+2", "+3"]
    };
  }

  if (item.archetype?.majorCategory === "armor" && item.archetype.armorArchetype === "heavy") {
    return {
      prefixNames: ["Reinforced", "Ironbound", "Bastionforged"],
      affixNames: ["of Guarding", "of the Bulwark", "of Unyielding Stone"],
      prefixBonusLabel: "Armor",
      affixBonusLabel: "Max Hitpoints",
      prefixBonusValues: ["+2", "+4", "+6"],
      affixBonusValues: ["+10", "+20", "+30"]
    };
  }

  if (item.archetype?.majorCategory === "armor" && item.archetype.armorArchetype === "robe") {
    return {
      prefixNames: ["Warded", "Runed", "Nullbound"],
      affixNames: ["of Warding", "of the Barrier", "of Arcane Silence"],
      prefixBonusLabel: "Spell Shield",
      affixBonusLabel: "Spell Damage",
      prefixBonusValues: ["+1", "+2", "+3"],
      affixBonusValues: ["+2", "+4", "+6"]
    };
  }

  return {
    prefixNames: ["Deflecting", "Arrowproof", "Stormguard"],
    affixNames: ["of Deflection", "of the Iron Screen", "of the Unerring Wall"],
    prefixBonusLabel: "Missile Resistance",
    affixBonusLabel: "Ranged Damage",
    prefixBonusValues: ["+1", "+2", "+3"],
    affixBonusValues: ["+2", "+4", "+6"]
  };
}

function tierIndex(tier: ModifierTier): 0 | 1 | 2 {
  if (tier === "T1") {
    return 0;
  }
  if (tier === "T2") {
    return 1;
  }
  return 2;
}

const ITEM_POWER_BASE_PER_LEVEL = 8;
const WEAPON_POWER_MULTIPLIER = 2;
const MOCK_WARRIOR_LEVEL = 20;
const MOCK_WARRIOR_CLASS: PlayerState["class"] = "warrior";
const RARITY_POWER_BONUS_RATE: Record<Rarity, number> = {
  common: 0,
  uncommon: 0.1,
  rare: 0.2,
  epic: 0.3
};
const MODIFIER_TIER_POWER_PER_LEVEL: Record<ModifierTier, number> = {
  T1: 0.25,
  T2: 0.5,
  T3: 0.75
};
const MOCK_MELEE_RARITY_POOL: Rarity[] = ["uncommon", "rare", "epic"];
const MOCK_MELEE_WEAPON_LEVELS = [18, 19, 20, 21, 22] as const;
const GENERATED_WEAPON_ICON_PATHS_BY_NAME: Record<string, string> = {
  "greyfen blade": "/assets/items/generated/weapon/weapon/melee/sword/warrior_melee_manual_004_greyfen-blade.png",
  valenmark: "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_012_valenmark.png",
  "durnholde axe": "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_014_durnholde-axe.png",
  harthorn: "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_018_harthorn.png",
  "stormvale axe": "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_020_stormvale-axe.png"
};
const MOCK_MELEE_DAMAGE_ROLL_WINDOW_BY_LEVEL: Record<number, Record<Rarity, MeleeDamageRollWindow>> = {
  // Source: docs/data/warrior_melee_weapon_ilvl_scaling_v2.csv
  18: {
    common: { minLow: 41, minHigh: 48, maxLow: 50, maxHigh: 59 },
    uncommon: { minLow: 43, minHigh: 51, maxLow: 53, maxHigh: 62 },
    rare: { minLow: 45, minHigh: 53, maxLow: 55, maxHigh: 65 },
    epic: { minLow: 47, minHigh: 56, maxLow: 58, maxHigh: 68 }
  },
  19: {
    common: { minLow: 43, minHigh: 50, maxLow: 53, maxHigh: 62 },
    uncommon: { minLow: 45, minHigh: 53, maxLow: 55, maxHigh: 65 },
    rare: { minLow: 47, minHigh: 55, maxLow: 58, maxHigh: 68 },
    epic: { minLow: 49, minHigh: 58, maxLow: 60, maxHigh: 71 }
  },
  20: {
    common: { minLow: 45, minHigh: 52, maxLow: 55, maxHigh: 64 },
    uncommon: { minLow: 47, minHigh: 55, maxLow: 57, maxHigh: 67 },
    rare: { minLow: 49, minHigh: 58, maxLow: 60, maxHigh: 71 },
    epic: { minLow: 51, minHigh: 60, maxLow: 63, maxHigh: 74 }
  },
  21: {
    common: { minLow: 46, minHigh: 55, maxLow: 57, maxHigh: 67 },
    uncommon: { minLow: 49, minHigh: 57, maxLow: 60, maxHigh: 70 },
    rare: { minLow: 51, minHigh: 60, maxLow: 62, maxHigh: 73 },
    epic: { minLow: 53, minHigh: 63, maxLow: 65, maxHigh: 77 }
  },
  22: {
    common: { minLow: 48, minHigh: 57, maxLow: 59, maxHigh: 69 },
    uncommon: { minLow: 51, minHigh: 59, maxLow: 62, maxHigh: 73 },
    rare: { minLow: 53, minHigh: 62, maxLow: 65, maxHigh: 76 },
    epic: { minLow: 55, minHigh: 65, maxLow: 68, maxHigh: 80 }
  }
};
const MOCK_MELEE_WEAPON_TEMPLATES: Array<{
  itemName: string;
  weaponFamily: WeaponFamily;
  description: string;
  iconAssetPath: string;
}> = [
  {
    itemName: "Greyfen Blade",
    weaponFamily: "sword",
    description: "Mud-stained steel that has only tasted petty duels.",
    iconAssetPath:
      "/assets/items/generated/weapon/weapon/melee/sword/warrior_melee_manual_004_greyfen-blade.png"
  },
  {
    itemName: "Valenmark",
    weaponFamily: "axe",
    description: "A grim standard among wardens of besieged keeps.",
    iconAssetPath:
      "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_012_valenmark.png"
  },
  {
    itemName: "Durnholde Axe",
    weaponFamily: "axe",
    description: "Each notch in its head marks a broken line of men.",
    iconAssetPath:
      "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_014_durnholde-axe.png"
  },
  {
    itemName: "Harthorn",
    weaponFamily: "axe",
    description: "Its crescent edge howls through plate at full swing.",
    iconAssetPath:
      "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_018_harthorn.png"
  },
  {
    itemName: "Stormvale Axe",
    weaponFamily: "axe",
    description: "Storm-battered steel that lands like a falling gate.",
    iconAssetPath:
      "/assets/items/generated/weapon/weapon/melee/axe/warrior_melee_manual_020_stormvale-axe.png"
  }
];

type MockInventoryItemSeed = Omit<InventoryItem, "power" | "prefix" | "affix">;

const MOCK_BASE_ARMOR_AND_JEWELRY_ITEMS: MockInventoryItemSeed[] = [
  {
    id: "itm_mock_ironwall_helm",
    itemName: "Braced Plate",
    rarity: "uncommon",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    equipSlotId: "helmet",
    levelRequirement: 18,
    statBonuses: { strength: 3, vitality: 4 },
    description: "Reinforced steel with a practical fit for regular frontline duty."
  },
  {
    id: "itm_mock_bastion_cuirass",
    itemName: "Guard Plate",
    rarity: "rare",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    equipSlotId: "upperArmor",
    levelRequirement: 20,
    statBonuses: { strength: 4, vitality: 5 },
    description: "Dense field-forged armor built to absorb repeated close impacts."
  },
  {
    id: "itm_mock_legion_girdle",
    itemName: "Field Belt",
    rarity: "uncommon",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    equipSlotId: "belt",
    levelRequirement: 19,
    statBonuses: { vitality: 3, initiative: 2 },
    description: "A stabilized belt that keeps heavy kit settled through long fights."
  },
  {
    id: "itm_mock_bulwark_greaves",
    itemName: "War Greaves",
    rarity: "rare",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    equipSlotId: "lowerArmor",
    levelRequirement: 21,
    statBonuses: { strength: 3, vitality: 4 },
    description: "Weighted leg armor tuned for steady pressure over quick pivots."
  },
  {
    id: "itm_mock_duskstalker_gloves",
    itemName: "Trail Gloves",
    rarity: "uncommon",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "light"
    },
    equipSlotId: "gloves",
    levelRequirement: 20,
    statBonuses: { dexterity: 4, initiative: 2 },
    description: "Light reinforced gloves that keep grip control stable under motion."
  },
  {
    id: "itm_mock_runespun_mantle",
    itemName: "Runed Weave",
    rarity: "epic",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "robe"
    },
    equipSlotId: "upperArmor",
    levelRequirement: 22,
    statBonuses: { intelligence: 5, vitality: 2, initiative: 2 },
    description: "Arcane-thread cloth layered with stable ward marks for hard casting."
  },
  {
    id: "itm_mock_oath_loop",
    itemName: "Oath Ring",
    rarity: "rare",
    category: "Jewelry",
    equipable: true,
    archetype: {
      majorCategory: "jewelry"
    },
    equipSlotId: "ringLeft",
    levelRequirement: 19,
    statBonuses: { luck: 3, initiative: 2 },
    description: "A field-forged ring favored by officers trusted with rapid response."
  },
  {
    id: "itm_mock_warden_charm",
    itemName: "Guard Charm",
    rarity: "uncommon",
    category: "Jewelry",
    equipable: true,
    archetype: {
      majorCategory: "jewelry"
    },
    equipSlotId: "necklace",
    levelRequirement: 20,
    statBonuses: { vitality: 3, luck: 2 },
    description: "A simple steel charm that helps keep focus when fights turn chaotic."
  }
];

function randomRarityFromPool(pool: Rarity[]): Rarity {
  return pool[randomInRange(0, pool.length - 1)];
}

function rollModifierTier(): ModifierTier {
  const roll = Math.random();
  if (roll < 0.6) {
    return "T1";
  }
  if (roll < 0.9) {
    return "T2";
  }
  return "T3";
}

function rollMeleeWeaponDamage(levelRequirement: number, rarity: Rarity): WeaponDamageRoll {
  const byRarity = MOCK_MELEE_DAMAGE_ROLL_WINDOW_BY_LEVEL[levelRequirement] ?? MOCK_MELEE_DAMAGE_ROLL_WINDOW_BY_LEVEL[20];
  const window = byRarity[rarity];
  const rolledMin = randomInRange(window.minLow, window.minHigh);
  const rolledMax = randomInRange(Math.max(window.maxLow, rolledMin), window.maxHigh);
  return {
    minRollRange: [window.minLow, window.minHigh],
    rolledMin,
    rolledMax,
    maxRollRange: [window.maxLow, window.maxHigh],
    averageDamage: (rolledMin + rolledMax) / 2
  };
}

function buildRarityModifiers(item: Pick<InventoryItem, "rarity" | "archetype">): Pick<InventoryItem, "prefix" | "affix"> {
  if (item.rarity === "common") {
    return {};
  }

  const pool = getModifierPool(item);
  const prefixTier = rollModifierTier();
  const affixTier = rollModifierTier();
  const prefix: ItemModifier = {
    kind: "prefix",
    tier: prefixTier,
    name: pool.prefixNames[tierIndex(prefixTier)],
    bonusLabel: pool.prefixBonusLabel,
    bonusValue: pool.prefixBonusValues[tierIndex(prefixTier)]
  };
  const affix: ItemModifier = {
    kind: "affix",
    tier: affixTier,
    name: pool.affixNames[tierIndex(affixTier)],
    bonusLabel: pool.affixBonusLabel,
    bonusValue: pool.affixBonusValues[tierIndex(affixTier)]
  };

  if (item.rarity === "uncommon") {
    return Math.random() < 0.5 ? { prefix } : { affix };
  }

  return { prefix, affix };
}

function getPowerCategoryMultiplier(item: Pick<InventoryItem, "archetype">): number {
  return item.archetype?.majorCategory === "weapon" ? WEAPON_POWER_MULTIPLIER : 1;
}

function computeMockItemPower(
  item: Pick<InventoryItem, "levelRequirement" | "rarity" | "archetype" | "prefix" | "affix">
): number {
  const basePower = item.levelRequirement * ITEM_POWER_BASE_PER_LEVEL;
  const rarityBonus = basePower * RARITY_POWER_BONUS_RATE[item.rarity];
  const prefixBonus = item.prefix ? item.levelRequirement * MODIFIER_TIER_POWER_PER_LEVEL[item.prefix.tier] : 0;
  const affixBonus = item.affix ? item.levelRequirement * MODIFIER_TIER_POWER_PER_LEVEL[item.affix.tier] : 0;
  const totalBeforeCategoryMultiplier = basePower + rarityBonus + prefixBonus + affixBonus;
  return Math.round(totalBeforeCategoryMultiplier * getPowerCategoryMultiplier(item));
}

function createMockMeleeWeaponItems(): MockInventoryItemSeed[] {
  return MOCK_MELEE_WEAPON_LEVELS.map((levelRequirement, index) => {
    const template = MOCK_MELEE_WEAPON_TEMPLATES[index];
    const rarity = randomRarityFromPool(MOCK_MELEE_RARITY_POOL);
    const baseStrength = Math.max(4, Math.round(levelRequirement / 4));
    return {
      id: `itm_mock_melee_${levelRequirement}`,
      itemName: template.itemName,
      rarity,
      category: "Weapon",
      iconAssetPath: template.iconAssetPath,
      equipable: true,
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "melee",
        weaponFamily: template.weaponFamily
      },
      equipSlotId: "weapon",
      levelRequirement,
      statBonuses: {
        strength: baseStrength,
        vitality: levelRequirement % 2 === 0 ? 2 : 1,
        initiative: levelRequirement >= 21 ? 2 : 1
      },
      damageRoll: rollMeleeWeaponDamage(levelRequirement, rarity),
      description: template.description
    };
  });
}

function formatModifierStatLabel(stat: string): string {
  const knownLabels: Record<string, string> = {
    melee_damage: "Melee Damage",
    ranged_damage: "Ranged Damage",
    spell_damage: "Spell Damage",
    crit_damage: "Crit Damage",
    crit_chance: "Crit Chance",
    extra_attack_chance: "Extra Attack Chance",
    double_attack_chance: "Extra Attack Chance"
  };
  if (knownLabels[stat]) {
    return knownLabels[stat];
  }
  return stat
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatModifierValue(value: number, unit: "flat" | "basis_points"): string {
  if (unit === "basis_points") {
    return `+${formatOneDecimal(value / 100)}%`;
  }
  return `+${value}`;
}

function toWeaponFamily(weaponArchetype: WeaponArchetype): WeaponFamily {
  if (weaponArchetype === "melee") {
    return "sword";
  }
  if (weaponArchetype === "ranged") {
    return "bow";
  }
  return "wand";
}

function getBaseItemNameFromDisplay(
  displayName: string,
  prefixName?: string,
  suffixName?: string
): string {
  let baseName = displayName;
  if (prefixName) {
    const prefixWithSpace = `${prefixName} `;
    if (baseName.startsWith(prefixWithSpace)) {
      baseName = baseName.slice(prefixWithSpace.length);
    }
  }
  if (suffixName) {
    const suffixWithSpace = ` ${suffixName}`;
    if (baseName.endsWith(suffixWithSpace)) {
      baseName = baseName.slice(0, -suffixWithSpace.length);
    }
  }
  return baseName.trim() || displayName;
}

function normalizeItemNameForArtLookup(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getGeneratedWeaponIconPath(baseItemName: string): string | undefined {
  return GENERATED_WEAPON_ICON_PATHS_BY_NAME[normalizeItemNameForArtLookup(baseItemName)];
}

function toInventoryWeaponItem(weapon: DevWeaponInventorySeed, index: number): InventoryItem {
  const prefixAffix = weapon.affixes.find((affix) => affix.source === "prefix");
  const suffixAffix = weapon.affixes.find((affix) => affix.source === "suffix");

  const prefix: ItemModifier | undefined = prefixAffix
    ? {
        kind: "prefix",
        tier: prefixAffix.tier,
        name: prefixAffix.name,
        bonusLabel: formatModifierStatLabel(prefixAffix.stat),
        bonusValue: formatModifierValue(prefixAffix.value, prefixAffix.unit)
      }
    : undefined;

  const affix: ItemModifier | undefined = suffixAffix
    ? {
        kind: "affix",
        tier: suffixAffix.tier,
        name: suffixAffix.name,
        bonusLabel: formatModifierStatLabel(suffixAffix.stat),
        bonusValue: formatModifierValue(suffixAffix.value, suffixAffix.unit)
      }
    : undefined;

  const baseItemName = getBaseItemNameFromDisplay(weapon.displayName, prefix?.name, affix?.name);

  const itemWithModifiers = {
    id: `itm_dev_weapon_${index}_${weapon.weaponFamily}_${weapon.level}`,
    itemName: baseItemName,
    rarity: weapon.rarity,
    category: "Weapon",
    iconAssetPath: getGeneratedWeaponIconPath(baseItemName),
    equipable: true,
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: weapon.weaponFamily,
      weaponFamily: toWeaponFamily(weapon.weaponFamily)
    },
    equipSlotId: "weapon",
    levelRequirement: weapon.level,
    damageRoll: {
      minRollRange: [weapon.minDamage, weapon.minDamage] as [number, number],
      rolledMin: weapon.minDamage,
      rolledMax: weapon.maxDamage,
      maxRollRange: [weapon.maxDamage, weapon.maxDamage] as [number, number],
      averageDamage: (weapon.minDamage + weapon.maxDamage) / 2
    },
    prefix,
    affix,
    description: weapon.flavorText,
    power: 0
  } satisfies InventoryItem;

  return {
    ...itemWithModifiers,
    power: computeMockItemPower(itemWithModifiers)
  };
}

function createMockInventoryItems(devWeapons?: PlayerState["devWeapons"]): InventoryItem[] {
  const baseItems = MOCK_BASE_ARMOR_AND_JEWELRY_ITEMS.map((item) => {
    const modifiers = buildRarityModifiers(item);
    const itemWithModifiers: InventoryItem = {
      ...item,
      ...modifiers,
      power: 0
    };
    return {
      ...itemWithModifiers,
      power: computeMockItemPower(itemWithModifiers)
    };
  });

  const previewWeaponItems = createMockMeleeWeaponItems().map((item) => {
    const modifiers = buildRarityModifiers(item);
    const itemWithModifiers: InventoryItem = {
      ...item,
      ...modifiers,
      power: 0
    };
    return {
      ...itemWithModifiers,
      power: computeMockItemPower(itemWithModifiers)
    };
  });

  const mockWeaponItems =
    devWeapons && devWeapons.length > 0
      ? devWeapons.map((weapon, index) => toInventoryWeaponItem(weapon, index))
      : previewWeaponItems;

  const iconWeaponCount = mockWeaponItems.filter((item) => Boolean(item.iconAssetPath)).length;
  const prioritizedWeaponItems =
    iconWeaponCount > 0
      ? [...mockWeaponItems].sort((first, second) => Number(Boolean(second.iconAssetPath)) - Number(Boolean(first.iconAssetPath)))
      : [...previewWeaponItems, ...mockWeaponItems];

  return [...baseItems, ...prioritizedWeaponItems];
}

function applyMockPlayerStateOverrides(state: PlayerState): PlayerState {
  return {
    ...state,
    class: MOCK_WARRIOR_CLASS,
    level: MOCK_WARRIOR_LEVEL
  };
}

const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "ashfen-trail",
    name: "Ashfen Caravan Escort",
    difficulty: "easy",
    experience: { low: 120, medium: 180, high: 260 },
    ducats: { low: 70, medium: 110, high: 170 },
    materials: { low: 2, medium: 4, high: 6 },
    itemDrop: { low: 8, medium: 14, high: 20 },
    staminaCost: { low: 8, medium: 11, high: 14 }
  },
  {
    id: "bogwatch-recon",
    name: "Bogwatch Recon Sweep",
    difficulty: "easy",
    experience: { low: 130, medium: 200, high: 280 },
    ducats: { low: 65, medium: 105, high: 165 },
    materials: { low: 3, medium: 5, high: 7 },
    itemDrop: { low: 9, medium: 15, high: 22 },
    staminaCost: { low: 9, medium: 12, high: 15 }
  },
  {
    id: "cinderhold-rats",
    name: "Cinderhold Purge Detail",
    difficulty: "medium",
    experience: { low: 200, medium: 300, high: 420 },
    ducats: { low: 120, medium: 180, high: 260 },
    materials: { low: 4, medium: 7, high: 10 },
    itemDrop: { low: 12, medium: 20, high: 29 },
    staminaCost: { low: 12, medium: 15, high: 18 }
  },
  {
    id: "spire-wardens",
    name: "Spire Warden Relief",
    difficulty: "medium",
    experience: { low: 210, medium: 320, high: 430 },
    ducats: { low: 125, medium: 190, high: 275 },
    materials: { low: 5, medium: 8, high: 11 },
    itemDrop: { low: 13, medium: 21, high: 30 },
    staminaCost: { low: 12, medium: 16, high: 19 }
  },
  {
    id: "blackbriar-break",
    name: "Blackbriar Siege Break",
    difficulty: "hard",
    experience: { low: 310, medium: 470, high: 620 },
    ducats: { low: 190, medium: 270, high: 380 },
    materials: { low: 7, medium: 11, high: 15 },
    itemDrop: { low: 18, medium: 28, high: 39 },
    staminaCost: { low: 16, medium: 19, high: 22 }
  },
  {
    id: "thornkeep-nightfall",
    name: "Thornkeep Nightfall Hunt",
    difficulty: "hard",
    experience: { low: 330, medium: 490, high: 650 },
    ducats: { low: 200, medium: 285, high: 395 },
    materials: { low: 8, medium: 12, high: 16 },
    itemDrop: { low: 19, medium: 30, high: 41 },
    staminaCost: { low: 17, medium: 20, high: 23 }
  }
];

const CONTRACT_AVAILABILITY_WINDOWS: Record<ContractDifficulty, { minMs: number; maxMs: number }> = {
  easy: { minMs: 35 * 60 * 1000, maxMs: 90 * 60 * 1000 },
  medium: { minMs: 25 * 60 * 1000, maxMs: 75 * 60 * 1000 },
  hard: { minMs: 20 * 60 * 1000, maxMs: 60 * 60 * 1000 }
};

function getLayoutMode(viewportWidth: number): LayoutMode {
  if (viewportWidth < 900) {
    return "compact";
  }
  if (viewportWidth >= 1400) {
    return "wide";
  }
  return "standard";
}

function renderMenuIcon(tab: LandingTab) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (tab) {
    case "inventory":
      return (
        <svg {...iconProps}>
          <path d="M4 9h16v10H4z" />
          <path d="M4 13h16M10 9V7h4v2M11 13h2" />
        </svg>
      );
    case "contracts":
      return (
        <svg {...iconProps}>
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4M9.5 12h5M9.5 15h3" />
          <circle cx="16" cy="17" r="2" />
        </svg>
      );
    case "missions":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="m12 8 3 3-3 5-3-3z" />
        </svg>
      );
    case "arena":
      return (
        <svg {...iconProps}>
          <path d="m8 5 3 3-5 5-2 1 1-2 5-5" />
          <path d="m16 5-3 3 5 5 2 1-1-2-5-5" />
          <path d="M9 19h6" />
        </svg>
      );
    case "guild":
      return (
        <svg {...iconProps}>
          <path d="M6 20V5l8 2 4-2v9l-4 2-8-2" />
          <path d="M10 10h4M10 14h2" />
        </svg>
      );
    case "castles":
      return (
        <svg {...iconProps}>
          <path d="M5 20h14V8h-2V5h-2v3h-2V5h-2v3H9V5H7v3H5z" />
          <path d="M11 20v-4h2v4" />
        </svg>
      );
    case "auctionHouse":
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="3" />
          <path d="m13 13 6 6M15 10l3-3 2 2-3 3z" />
        </svg>
      );
    case "merchant":
      return (
        <svg {...iconProps}>
          <path d="M12 6v12M8 6h8M5 10h6l-3 4zM13 10h6l-3 4zM8 20h8" />
        </svg>
      );
    case "leaderboards":
      return (
        <svg {...iconProps}>
          <path d="M6 19V11M12 19V8M18 19V13M4 19h16" />
          <path d="M7 6c-1 1-2 3-2 5M17 6c1 1 2 3 2 5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...iconProps}>
          <path d="M12 3 14 6 18 6 19 10 22 12 19 14 18 18 14 18 12 21 10 18 6 18 5 14 2 12 5 10 6 6 10 6z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

function formatClassLabel(playerClass: PlayerState["class"]): string {
  return playerClass.charAt(0).toUpperCase() + playerClass.slice(1);
}

function formatRarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function formatArchetypeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getItemSubtypeLabel(item: InventoryItem): string {
  const majorCategory = item.archetype?.majorCategory;
  if (majorCategory === "armor" && item.archetype?.armorArchetype) {
    return `${formatArchetypeLabel(item.archetype.armorArchetype)} Armor`;
  }
  if (majorCategory === "weapon" && item.archetype?.weaponArchetype) {
    return `${formatArchetypeLabel(item.archetype.weaponArchetype)} Weapon`;
  }
  return item.category;
}

function getDisplayItemName(item: InventoryItem): string {
  const prefixName = item.prefix?.name ? `${item.prefix.name} ` : "";
  const affixName = item.affix?.name ? ` ${item.affix.name}` : "";
  return `${prefixName}${item.itemName}${affixName}`.trim();
}

function getModifierTierClassName(tier: ModifierTier): string {
  if (tier === "T1") {
    return "modifierTier-t1";
  }
  if (tier === "T2") {
    return "modifierTier-t2";
  }
  return "modifierTier-t3";
}

function renderItemDisplayName(item: InventoryItem): ReactElement {
  return (
    <>
      {item.prefix ? <>{item.prefix.name} </> : null}
      <span>{item.itemName}</span>
      {item.affix ? <> {item.affix.name}</> : null}
    </>
  );
}

function getItemModifierStatLines(item: InventoryItem): ItemModifierStatLine[] {
  const lines: ItemModifierStatLine[] = [];
  if (item.prefix) {
    lines.push({
      id: `${item.id}-prefix`,
      tier: item.prefix.tier,
      label: item.prefix.bonusLabel,
      value: item.prefix.bonusValue
    });
  }
  if (item.affix) {
    lines.push({
      id: `${item.id}-affix`,
      tier: item.affix.tier,
      label: item.affix.bonusLabel,
      value: item.affix.bonusValue
    });
  }
  return lines;
}

function getWeaponDamageSummary(item: InventoryItem): { damageLine: string; rollLine: string } | null {
  if (!item.damageRoll) {
    return null;
  }
  const { minRollRange, maxRollRange, rolledMin, rolledMax, averageDamage } = item.damageRoll;
  return {
    damageLine: `Damage: ${formatOneDecimal(averageDamage)}`,
    rollLine: `Roll: [${minRollRange[0]}-${minRollRange[1]}] ${rolledMin} - ${rolledMax} [${maxRollRange[0]}-${maxRollRange[1]}]`
  };
}

function canPlayerUseItem(item: InventoryItem, playerState: PlayerState | null): boolean {
  if (!item.equipable || !item.archetype || !playerState) {
    return true;
  }
  const archetypeClassKey = item.archetype.weaponArchetype ?? item.archetype.armorArchetype;
  const isClassEligible = isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey);
  const isLevelEligible = playerState.level >= item.levelRequirement;
  return isClassEligible && isLevelEligible;
}

function renderInventoryItemCardBody(item: InventoryItem, canUseItem: boolean): ReactElement {
  const subtypeLabel = getItemSubtypeLabel(item);
  const modifierLines = getItemModifierStatLines(item);
  const weaponDamageSummary = getWeaponDamageSummary(item);
  const displayItemName = getDisplayItemName(item);

  return (
    <>
      <div className="inventoryCardVisual">
        {renderItemIcon({
          majorCategory: item.archetype?.majorCategory,
          category: item.category,
          itemName: displayItemName,
          iconAssetPath: item.iconAssetPath,
          className: `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`
        })}
      </div>
      <div className="inventoryCardContent">
        <div className="inventoryCardTop">
          <div className="inventoryCardMeta">
            <h4>{renderItemDisplayName(item)}</h4>
            <p className="inventoryCardCategory">{subtypeLabel}</p>
          </div>
          <span className="inventoryCardRarity">{formatRarityLabel(item.rarity)}</span>
        </div>
        {weaponDamageSummary ? (
          <div className="inventoryCardDamageBlock">
            <p className="inventoryCardDamagePrimary">{weaponDamageSummary.damageLine}</p>
            <p className="inventoryCardDamageRollMeta">{weaponDamageSummary.rollLine}</p>
          </div>
        ) : null}
        {modifierLines.length > 0 ? (
          <div className="inventoryCardModifierList">
            {modifierLines.map((line) => (
              <p key={line.id} className="inventoryCardModifierLine">
                <span className={`inventoryModifierTier ${getModifierTierClassName(line.tier)}`}>({line.tier})</span>{" "}
                <span>
                  {line.label} {line.value}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="inventoryCardDetails">
        <p className="inventoryCardDescription inventoryCardFlavor">{item.description}</p>
        <div className="inventoryCardFooter">
          <span className="inventoryCardPower">Power {item.power}</span>
          <span className="inventoryCardLevel">Level {item.levelRequirement}</span>
        </div>
      </div>
    </>
  );
}

type ItemIconVariant =
  | "armor"
  | "weapon"
  | "jewelry"
  | "vestige"
  | "consumable"
  | "material"
  | "container"
  | "utility"
  | "generic";

function resolveItemIconVisual(args: {
  majorCategory?: ItemMajorCategory;
  category?: string;
  itemName?: string | null;
}): { variant: ItemIconVariant; label: string } {
  if (args.majorCategory) {
    if (args.majorCategory === "armor") {
      return { variant: "armor", label: "AR" };
    }
    if (args.majorCategory === "weapon") {
      return { variant: "weapon", label: "WP" };
    }
    if (args.majorCategory === "jewelry") {
      return { variant: "jewelry", label: "JW" };
    }
    if (args.majorCategory === "vestige") {
      return { variant: "vestige", label: "VS" };
    }
  }

  const category = (args.category ?? "").toLowerCase();
  if (category.includes("consumable")) {
    return { variant: "consumable", label: "CO" };
  }
  if (category.includes("material")) {
    return { variant: "material", label: "MT" };
  }
  if (category.includes("container")) {
    return { variant: "container", label: "CT" };
  }
  if (category.includes("utility")) {
    return { variant: "utility", label: "UT" };
  }

  const letters = (args.itemName ?? "IT").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return {
    variant: "generic",
    label: letters.length === 2 ? letters : "IT"
  };
}

function renderItemIcon(args: {
  majorCategory?: ItemMajorCategory;
  category?: string;
  itemName?: string | null;
  iconAssetPath?: string;
  className?: string;
}): ReactElement {
  const iconVisual = resolveItemIconVisual(args);
  const extraClass = args.className ? ` ${args.className}` : "";
  return (
    <span className={`itemVisualIcon itemVisual-${iconVisual.variant}${extraClass}`} aria-hidden="true">
      {args.iconAssetPath ? (
        <img className="itemVisualImage" src={args.iconAssetPath} alt="" loading="lazy" />
      ) : (
        iconVisual.label
      )}
    </span>
  );
}

function getDisplayName(playerState: PlayerState): string {
  const idSuffix = playerState.playerId.slice(-6).toUpperCase();
  return `Warden ${idSuffix}`;
}

function getTrainingCost(baseValue: number): number {
  return 200 + (baseValue * 25);
}

function formatOneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatPercentRatio(ratio: number): string {
  return `${formatOneDecimal(ratio * 100)}%`;
}

function formatDerivedFlat(value: number): string {
  return `+${formatOneDecimal(value)} flat`;
}

function formatDerivedPercent(value: number): string {
  return `+${formatOneDecimal(value)}%`;
}

function getMainOffenseStatKey(playerClass: PlayerClass): TrainableStatKey {
  if (playerClass === "mage") {
    return "intelligence";
  }
  if (playerClass === "ranger") {
    return "dexterity";
  }
  return "strength";
}

function getStatContributionLines(
  stat: TrainableStatKey,
  statValue: number,
  playerClass: PlayerClass
): StatContributionLine[] {
  const mainOffenseStat = getMainOffenseStatKey(playerClass);

  switch (stat) {
    case "strength":
      return [
        {
          label: mainOffenseStat === "strength" ? "Main Damage" : "Melee Damage",
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: "Armor",
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "intelligence":
      return [
        {
          label: mainOffenseStat === "intelligence" ? "Main Damage" : "Spell Damage",
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: "Spell Shield",
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "dexterity":
      return [
        {
          label: mainOffenseStat === "dexterity" ? "Main Damage" : "Ranged Damage",
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: "Missile Resistance",
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "luck":
      return [
        {
          label: "Crit Chance",
          ratioLabel: `${formatOneDecimal(LUCK_CRIT_CHANCE_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * LUCK_CRIT_CHANCE_PERCENT_PER_POINT)
        },
        {
          label: "Crit Damage",
          ratioLabel: `${formatOneDecimal(LUCK_CRIT_DAMAGE_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * LUCK_CRIT_DAMAGE_PERCENT_PER_POINT)
        }
      ];
    case "initiative":
      return [
        {
          label: "Combat Speed",
          ratioLabel: `${formatOneDecimal(INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT)
        },
        {
          label: "Extra Attack Chance",
          ratioLabel: `${formatOneDecimal(INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT)
        }
      ];
    case "vitality":
      return [
        {
          label: "Max Hitpoints",
          ratioLabel: `${formatOneDecimal(VITALITY_MAX_HP_PER_POINT)}/pt`,
          valueLabel: `+${Math.round(statValue * VITALITY_MAX_HP_PER_POINT)} HP`
        }
      ];
    default:
      return [];
  }
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDurationFromMs(value: number): string {
  const clampedSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

function randomContractRoll(): ContractRoll {
  const roll = randomInRange(1, 3);
  if (roll === 1) {
    return "low";
  }
  if (roll === 2) {
    return "medium";
  }
  return "high";
}

function createContractOffer(nowMs: number): ContractOffer {
  const template = CONTRACT_TEMPLATES[randomInRange(0, CONTRACT_TEMPLATES.length - 1)];
  const availabilityWindow = CONTRACT_AVAILABILITY_WINDOWS[template.difficulty];
  const durationMs = randomInRange(availabilityWindow.minMs, availabilityWindow.maxMs);
  return {
    instanceId: `${template.id}-${nowMs}-${randomInRange(1000, 9999)}`,
    template,
    rollCue: {
      experience: randomContractRoll(),
      ducats: randomContractRoll(),
      materials: randomContractRoll(),
      itemDrop: randomContractRoll(),
      staminaCost: randomContractRoll()
    },
    expiresAt: nowMs + durationMs
  };
}

function createContractSlots(nowMs: number): ContractSlotState[] {
  return Array.from({ length: CONTRACT_SLOT_COUNT }, (_, index) => ({
    slotIndex: index + 1,
    offer: createContractOffer(nowMs),
    replenishReadyAt: null
  }));
}

export function App() {
  const initialContractSlots = useMemo(() => createContractSlots(Date.now()), []);
  const sidePanelScrollRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("inventory");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    createMockInventoryItems().slice(0, INVENTORY_ITEM_LIMIT)
  );
  const [equippedItems, setEquippedItems] = useState<EquippedItems>(() => createEmptyEquippedItems());
  const [contractSlots, setContractSlots] = useState<ContractSlotState[]>(() => initialContractSlots);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => getLayoutMode(window.innerWidth));
  const [profileSideTab, setProfileSideTab] = useState<ProfileSideTab>("inventory");
  const [draggingInventoryCardId, setDraggingInventoryCardId] = useState<string | null>(null);
  const [draggingEquipmentSlotId, setDraggingEquipmentSlotId] = useState<EquipmentSlotId | null>(null);
  const [dropTargetInventoryCardId, setDropTargetInventoryCardId] = useState<string | null>(null);
  const [dropInsertPosition, setDropInsertPosition] = useState<InventoryInsertPosition>("before");
  const [equipmentDropTargetSlotId, setEquipmentDropTargetSlotId] = useState<EquipmentSlotId | null>(null);
  const [equipmentDropState, setEquipmentDropState] = useState<"valid" | "invalid" | null>(null);
  const [inventoryComparisonHover, setInventoryComparisonHover] = useState<InventoryComparisonHoverState | null>(null);
  const [baseStats, setBaseStats] = useState<Record<TrainableStatKey, number> | null>(null);
  const [currencies, setCurrencies] = useState<{ ducats: number; imperials: number } | null>(null);
  const [activeStatTraining, setActiveStatTraining] = useState<{
    stat: TrainableStatKey;
    completesAt: number;
  } | null>(null);

  const profileName = playerState ? getDisplayName(playerState) : "Warden";
  const avatarInitial = profileName.charAt(0);

  const availableContractSlots = useMemo(
    () => contractSlots.filter((slot) => slot.offer !== null),
    [contractSlots]
  );
  const replenishingContractSlots = useMemo(
    () => contractSlots.filter((slot) => slot.offer === null && slot.replenishReadyAt !== null),
    [contractSlots]
  );
  const draggingInventoryItem = useMemo(
    () => (draggingInventoryCardId ? inventoryItems.find((item) => item.id === draggingInventoryCardId) ?? null : null),
    [draggingInventoryCardId, inventoryItems]
  );
  const hintedEquipmentSlotId = draggingInventoryItem?.equipSlotId ?? null;

  const healthPercent = playerState
    ? Math.max(10, Math.min(100, Math.round((playerState.stats.vitality / 20) * 100)))
    : 0;
  const xpPercent = playerState ? Math.max(6, (playerState.level * 13) % 100) : 0;

  const equipmentStatBonuses = useMemo(() => {
    const totals: Record<TrainableStatKey, number> = {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      initiative: 0,
      luck: 0
    };

    ALL_EQUIPMENT_SLOTS.forEach((slotId) => {
      const item = equippedItems[slotId];
      if (!item || !item.statBonuses) {
        return;
      }
      (Object.keys(item.statBonuses) as TrainableStatKey[]).forEach((statKey) => {
        totals[statKey] += item.statBonuses?.[statKey] ?? 0;
      });
    });

    return totals;
  }, [equippedItems]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const updateLayoutMode = () => {
      setLayoutMode(getLayoutMode(window.innerWidth));
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => {
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "inventory") {
      setDraggingInventoryCardId(null);
      setDraggingEquipmentSlotId(null);
      setDropTargetInventoryCardId(null);
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
      setInventoryComparisonHover(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (profileSideTab !== "inventory") {
      setDraggingInventoryCardId(null);
      setDraggingEquipmentSlotId(null);
      setDropTargetInventoryCardId(null);
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
      setInventoryComparisonHover(null);
    }
  }, [profileSideTab]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setPlayerState(null);
      setIsLoadingState(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingState(true);
    setError(null);

    void fetchPlayerState(token)
      .then((state) => {
        if (active) {
          setPlayerState(applyMockPlayerStateOverrides(state));
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setPlayerState(null);
          setError(err instanceof Error ? err.message : "State load failed.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingState(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!playerState) {
      setBaseStats(null);
      setCurrencies(null);
      setActiveStatTraining(null);
      return;
    }

    setInventoryItems(createMockInventoryItems(playerState.devWeapons).slice(0, INVENTORY_ITEM_LIMIT));
    setEquippedItems(createEmptyEquippedItems());
    setBaseStats({
      strength: playerState.stats.strength,
      intelligence: playerState.stats.intelligence,
      dexterity: playerState.stats.dexterity,
      vitality: playerState.stats.vitality,
      initiative: playerState.stats.initiative,
      luck: playerState.stats.luck
    });
    setCurrencies({
      ducats: Math.max(playerState.currency.ducats, TEST_MIN_DUCATS),
      imperials: playerState.currency.imperials
    });
    setActiveStatTraining(null);
  }, [playerState]);

  useEffect(() => {
    setContractSlots((previousSlots) => {
      let hasChanges = false;
      const nextSlots = previousSlots.map((slot) => {
        if (slot.offer && nowMs >= slot.offer.expiresAt) {
          hasChanges = true;
          return {
            ...slot,
            offer: null,
            replenishReadyAt: nowMs + randomInRange(CONTRACT_REPLENISH_MIN_MS, CONTRACT_REPLENISH_MAX_MS)
          };
        }
        if (!slot.offer && slot.replenishReadyAt !== null && nowMs >= slot.replenishReadyAt) {
          hasChanges = true;
          return {
            ...slot,
            offer: createContractOffer(nowMs),
            replenishReadyAt: null
          };
        }
        return slot;
      });
      return hasChanges ? nextSlots : previousSlots;
    });
  }, [nowMs]);

  useEffect(() => {
    if (!activeStatTraining) {
      return;
    }
    if (nowMs < activeStatTraining.completesAt) {
      return;
    }

    setBaseStats((previousStats) => {
      if (!previousStats) {
        return previousStats;
      }
      return {
        ...previousStats,
        [activeStatTraining.stat]: previousStats[activeStatTraining.stat] + 1
      };
    });
    setActiveStatTraining(null);
  }, [activeStatTraining, nowMs]);

  async function handleGuestLogin() {
    try {
      setError(null);
      const login = await devGuestLogin();
      window.localStorage.setItem("ebonkeep.dev.token", login.accessToken);
      setActiveTab("inventory");
      setToken(login.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("ebonkeep.dev.token");
    setToken(null);
    setPlayerState(null);
    setActiveTab("inventory");
    setError(null);
    setInventoryItems(createMockInventoryItems().slice(0, INVENTORY_ITEM_LIMIT));
    setEquippedItems(createEmptyEquippedItems());
    setDraggingInventoryCardId(null);
    setDraggingEquipmentSlotId(null);
    setDropTargetInventoryCardId(null);
    setEquipmentDropTargetSlotId(null);
    setEquipmentDropState(null);
    setInventoryComparisonHover(null);
    setBaseStats(null);
    setCurrencies(null);
    setActiveStatTraining(null);
    setContractSlots(createContractSlots(Date.now()));
  }

  function startStatTraining(stat: TrainableStatKey) {
    if (!baseStats || !currencies) {
      return;
    }
    if (activeStatTraining) {
      setError("Training already in progress.");
      return;
    }

    const trainingCost = getTrainingCost(baseStats[stat]);
    if (currencies.ducats < trainingCost) {
      setError("Not enough ducats for training.");
      return;
    }

    setCurrencies({
      ...currencies,
      ducats: currencies.ducats - trainingCost
    });
    setActiveStatTraining({
      stat,
      completesAt: Date.now() + STAT_TRAIN_DURATION_MS
    });
    setError(null);
  }

  function reorderInventoryItems(
    fromItemId: string,
    toItemId: string,
    insertPosition: InventoryInsertPosition
  ) {
    if (fromItemId === toItemId) {
      return;
    }

    setInventoryItems((previousItems) => {
      const fromIndex = previousItems.findIndex((item) => item.id === fromItemId);
      const toIndex = previousItems.findIndex((item) => item.id === toItemId);
      if (fromIndex < 0 || toIndex < 0) {
        return previousItems;
      }

      const nextItems = [...previousItems];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      let insertIndex = toIndex;
      if (fromIndex < toIndex) {
        insertIndex -= 1;
      }
      if (insertPosition === "after") {
        insertIndex += 1;
      }
      nextItems.splice(insertIndex, 0, movedItem);
      return nextItems;
    });
  }

  function isEquipmentSlotId(value: string): value is EquipmentSlotId {
    return ALL_EQUIPMENT_SLOTS.includes(value as EquipmentSlotId);
  }

  function setDragPayload(event: DragEvent<HTMLElement>, payload: DragPayload) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_PAYLOAD_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("application/x-ebonkeep-item-id", payload.itemId);
    event.dataTransfer.setData("text/plain", payload.itemId);
  }

  function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
    const serializedPayload = event.dataTransfer.getData(DRAG_PAYLOAD_MIME);
    if (serializedPayload) {
      try {
        const parsedPayload = JSON.parse(serializedPayload) as Partial<DragPayload>;
        if (parsedPayload.source === "inventory" && typeof parsedPayload.itemId === "string") {
          return { source: "inventory", itemId: parsedPayload.itemId };
        }
        if (
          parsedPayload.source === "equipment" &&
          typeof parsedPayload.itemId === "string" &&
          typeof parsedPayload.slotId === "string" &&
          isEquipmentSlotId(parsedPayload.slotId)
        ) {
          return { source: "equipment", itemId: parsedPayload.itemId, slotId: parsedPayload.slotId };
        }
      } catch {
        return null;
      }
    }

    const fallbackItemId =
      event.dataTransfer.getData("application/x-ebonkeep-item-id") ||
      event.dataTransfer.getData("text/plain");
    if (fallbackItemId) {
      return { source: "inventory", itemId: fallbackItemId };
    }

    if (draggingEquipmentSlotId) {
      const equippedItem = equippedItems[draggingEquipmentSlotId];
      if (equippedItem) {
        return { source: "equipment", slotId: draggingEquipmentSlotId, itemId: equippedItem.id };
      }
    }

    if (draggingInventoryCardId) {
      return { source: "inventory", itemId: draggingInventoryCardId };
    }

    return null;
  }

  function clearDragState() {
    setDraggingInventoryCardId(null);
    setDraggingEquipmentSlotId(null);
    setDropTargetInventoryCardId(null);
    setEquipmentDropTargetSlotId(null);
    setEquipmentDropState(null);
    setInventoryComparisonHover(null);
  }

  function getItemById(itemId: string): InventoryItem | null {
    return inventoryItems.find((item) => item.id === itemId) ?? null;
  }

  function getEquipValidationError(item: InventoryItem, targetSlotId: EquipmentSlotId): string | null {
    if (!item.equipable) {
      return "Item cannot be equipped.";
    }
    if (item.equipSlotId !== targetSlotId) {
      return `Wrong slot. This item fits ${EQUIPMENT_SLOTS[item.equipSlotId].label}.`;
    }

    if (!playerState) {
      return "Player state unavailable.";
    }

    if (item.levelRequirement > playerState.level) {
      return `Requires level ${item.levelRequirement}.`;
    }

    if (item.archetype) {
      const archetypeClassKey = item.archetype.weaponArchetype ?? item.archetype.armorArchetype;
      if (!isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey)) {
        return "Class restriction: your class cannot equip this item.";
      }

      if (item.archetype.majorCategory === "vestige" && item.archetype.vestigeId) {
        const equippedVestigeIds = EQUIPMENT_VESTIGE_SLOTS
          .map((slotId) => equippedItems[slotId]?.archetype?.vestigeId)
          .filter((vestigeId): vestigeId is VestigeId => vestigeId !== undefined);
        if (
          equippedVestigeIds.includes(item.archetype.vestigeId) &&
          equippedItems[targetSlotId]?.archetype?.vestigeId !== item.archetype.vestigeId
        ) {
          return "Duplicate vestige cannot be equipped.";
        }
      }
    }

    return null;
  }

  function insertItemAroundTarget(
    items: InventoryItem[],
    itemToInsert: InventoryItem,
    targetItemId: string,
    insertPosition: InventoryInsertPosition
  ): InventoryItem[] {
    const targetIndex = items.findIndex((item) => item.id === targetItemId);
    if (targetIndex < 0) {
      return [...items, itemToInsert];
    }

    const insertIndex = insertPosition === "after" ? targetIndex + 1 : targetIndex;
    const nextItems = [...items];
    nextItems.splice(insertIndex, 0, itemToInsert);
    return nextItems;
  }

  function equipInventoryItemToSlot(itemId: string, targetSlotId: EquipmentSlotId) {
    const sourceIndex = inventoryItems.findIndex((item) => item.id === itemId);
    if (sourceIndex < 0) {
      return;
    }

    const sourceItem = inventoryItems[sourceIndex];
    const validationError = getEquipValidationError(sourceItem, targetSlotId);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextInventory = [...inventoryItems];
    nextInventory.splice(sourceIndex, 1);
    const displacedItem = equippedItems[targetSlotId];
    if (displacedItem) {
      nextInventory.splice(sourceIndex, 0, displacedItem);
    }

    if (nextInventory.length > INVENTORY_ITEM_LIMIT) {
      setError("Inventory is full. Clear space before swapping.");
      return;
    }

    setInventoryItems(nextInventory);
    setEquippedItems({
      ...equippedItems,
      [targetSlotId]: sourceItem
    });
    setError(null);
  }

  function unequipItemToInventory(
    sourceSlotId: EquipmentSlotId,
    targetItemId?: string,
    insertPosition: InventoryInsertPosition = "after"
  ) {
    const sourceItem = equippedItems[sourceSlotId];
    if (!sourceItem) {
      return;
    }

    if (inventoryItems.length >= INVENTORY_ITEM_LIMIT) {
      setError("Inventory is full. Cannot unequip item.");
      return;
    }

    const nextInventory = targetItemId
      ? insertItemAroundTarget(inventoryItems, sourceItem, targetItemId, insertPosition)
      : [...inventoryItems, sourceItem];

    setInventoryItems(nextInventory);
    setEquippedItems({
      ...equippedItems,
      [sourceSlotId]: null
    });
    setError(null);
  }

  function handleInventoryCardDoubleClick(itemId: string) {
    const item = getItemById(itemId);
    if (!item) {
      return;
    }
    equipInventoryItemToSlot(itemId, item.equipSlotId);
  }

  function handleEquipmentSlotDoubleClick(slotId: EquipmentSlotId) {
    unequipItemToInventory(slotId);
  }

  function autoScrollInventoryList(pointerY: number) {
    const scrollContainer = sidePanelScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const edgeThreshold = 72;
    const maxStep = 24;

    if (pointerY < containerRect.top + edgeThreshold) {
      const intensity = (containerRect.top + edgeThreshold - pointerY) / edgeThreshold;
      scrollContainer.scrollTop -= Math.ceil(maxStep * intensity);
      return;
    }

    if (pointerY > containerRect.bottom - edgeThreshold) {
      const intensity = (pointerY - (containerRect.bottom - edgeThreshold)) / edgeThreshold;
      scrollContainer.scrollTop += Math.ceil(maxStep * intensity);
    }
  }

  function handleInventoryCardDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    setDragPayload(event, { source: "inventory", itemId });
    setDraggingInventoryCardId(itemId);
    setDraggingEquipmentSlotId(null);
    setDropTargetInventoryCardId(itemId);
    setDropInsertPosition("before");
    setEquipmentDropTargetSlotId(null);
    setEquipmentDropState(null);
    setInventoryComparisonHover(null);
  }

  function handleEquipmentSlotDragStart(event: DragEvent<HTMLElement>, slotId: EquipmentSlotId) {
    const sourceItem = equippedItems[slotId];
    if (!sourceItem) {
      return;
    }

    setDragPayload(event, { source: "equipment", slotId, itemId: sourceItem.id });
    setDraggingEquipmentSlotId(slotId);
    setDraggingInventoryCardId(null);
    setDropTargetInventoryCardId(null);
    setEquipmentDropTargetSlotId(null);
    setEquipmentDropState(null);
  }

  function handleInventoryCardDragOver(event: DragEvent<HTMLElement>, targetItemId: string) {
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const cardRect = event.currentTarget.getBoundingClientRect();
    const insertPosition: InventoryInsertPosition =
      event.clientY < cardRect.top + cardRect.height / 2 ? "before" : "after";
    if (dropTargetInventoryCardId !== targetItemId) {
      setDropTargetInventoryCardId(targetItemId);
    }
    if (dropInsertPosition !== insertPosition) {
      setDropInsertPosition(insertPosition);
    }
    if (equipmentDropTargetSlotId !== null) {
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
    }
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryCardDrop(event: DragEvent<HTMLElement>, targetItemId: string) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (payload?.source === "inventory") {
      reorderInventoryItems(payload.itemId, targetItemId, dropInsertPosition);
    } else if (payload?.source === "equipment") {
      unequipItemToInventory(payload.slotId, targetItemId, dropInsertPosition);
    }
    clearDragState();
  }

  function handleInventoryCardDragEnd() {
    clearDragState();
  }

  function handleInventoryCardMouseEnter(item: InventoryItem, cardElement: HTMLElement) {
    if (!item.equipable) {
      setInventoryComparisonHover(null);
      return;
    }

    const comparisonItem = equippedItems[item.equipSlotId];
    if (!comparisonItem) {
      setInventoryComparisonHover(null);
      return;
    }

    const rect = cardElement.getBoundingClientRect();
    const cardWidth = Math.round(rect.width);
    const gapPx = 12;
    const left = Math.max(8, Math.round(rect.left - cardWidth - gapPx));
    const top = Math.max(8, Math.round(rect.top));

    setInventoryComparisonHover({
      targetItemId: item.id,
      slotId: item.equipSlotId,
      top,
      left,
      width: cardWidth
    });
  }

  function handleInventoryCardMouseLeave(itemId: string) {
    setInventoryComparisonHover((previousHover) =>
      previousHover?.targetItemId === itemId ? null : previousHover
    );
  }

  function renderInventoryComparisonOverlay(): ReactElement | null {
    if (!inventoryComparisonHover || profileSideTab !== "inventory") {
      return null;
    }

    const sourceItem = inventoryItems.find((item) => item.id === inventoryComparisonHover.targetItemId);
    if (!sourceItem || !sourceItem.equipable) {
      return null;
    }

    const comparisonItem = equippedItems[inventoryComparisonHover.slotId];
    if (!comparisonItem) {
      return null;
    }

    const canUseComparisonItem = canPlayerUseItem(comparisonItem, playerState);

    return (
      <div
        className="inventoryComparisonOverlay"
        style={{
          top: inventoryComparisonHover.top,
          left: inventoryComparisonHover.left,
          width: inventoryComparisonHover.width
        }}
      >
        <article className={`inventoryItemCard inventoryComparisonCard rarity-${comparisonItem.rarity}`}>
          {renderInventoryItemCardBody(comparisonItem, canUseComparisonItem)}
        </article>
      </div>
    );
  }

  function handleEquipmentSlotDragOver(event: DragEvent<HTMLElement>, targetSlotId: EquipmentSlotId) {
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    event.preventDefault();
    if (payload.source !== "inventory") {
      event.dataTransfer.dropEffect = "none";
      setEquipmentDropTargetSlotId(targetSlotId);
      setEquipmentDropState("invalid");
      return;
    }

    const sourceItem = getItemById(payload.itemId);
    const validationError = sourceItem ? getEquipValidationError(sourceItem, targetSlotId) : "Invalid item.";
    event.dataTransfer.dropEffect = validationError ? "none" : "move";
    setEquipmentDropTargetSlotId(targetSlotId);
    setEquipmentDropState(validationError ? "invalid" : "valid");
  }

  function handleEquipmentSlotDrop(event: DragEvent<HTMLElement>, targetSlotId: EquipmentSlotId) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (payload?.source === "inventory") {
      equipInventoryItemToSlot(payload.itemId, targetSlotId);
    }
    clearDragState();
  }

  function handleEquipmentSlotDragLeave(event: DragEvent<HTMLElement>, targetSlotId: EquipmentSlotId) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    if (equipmentDropTargetSlotId === targetSlotId) {
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
    }
  }

  function handleInventoryListDragOver(event: DragEvent<HTMLDivElement>) {
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (equipmentDropTargetSlotId !== null) {
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
    }
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryListDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) {
      clearDragState();
      return;
    }

    if (payload.source === "equipment") {
      if (inventoryItems.length === 0) {
        unequipItemToInventory(payload.slotId);
        clearDragState();
        return;
      }

      const containerRect = event.currentTarget.getBoundingClientRect();
      const insertAtEnd = event.clientY >= containerRect.top + containerRect.height / 2;
      const targetItemId = insertAtEnd ? inventoryItems[inventoryItems.length - 1].id : inventoryItems[0].id;
      const fallbackPosition: InventoryInsertPosition = insertAtEnd ? "after" : "before";
      const resolvedPosition =
        dropTargetInventoryCardId !== null ? dropInsertPosition : fallbackPosition;
      unequipItemToInventory(payload.slotId, targetItemId, resolvedPosition);
      clearDragState();
      return;
    }

    if (inventoryItems.length === 0) {
      clearDragState();
      return;
    }

    const containerRect = event.currentTarget.getBoundingClientRect();
    const insertAtEnd = event.clientY >= containerRect.top + containerRect.height / 2;
    const targetItem = insertAtEnd ? inventoryItems[inventoryItems.length - 1] : inventoryItems[0];
    const fallbackPosition: InventoryInsertPosition = insertAtEnd ? "after" : "before";
    const resolvedPosition =
      dropTargetInventoryCardId !== null ? dropInsertPosition : fallbackPosition;

    reorderInventoryItems(payload.itemId, targetItem.id, resolvedPosition);
    clearDragState();
  }

  function formatContractDifficulty(difficulty: ContractDifficulty): string {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  }

  function formatContractRoll(roll: ContractRoll): string {
    return roll.charAt(0).toUpperCase() + roll.slice(1);
  }

  function abandonContractSlot(slotIndex: number) {
    const startedAt = Date.now();
    setContractSlots((previousSlots) =>
      previousSlots.map((slot) => {
        if (slot.slotIndex !== slotIndex || !slot.offer) {
          return slot;
        }
        return {
          ...slot,
          offer: null,
          replenishReadyAt: startedAt + randomInRange(CONTRACT_REPLENISH_MIN_MS, CONTRACT_REPLENISH_MAX_MS)
        };
      })
    );
  }

  function renderEquipmentSlotCell(
    slotId: EquipmentSlotId,
    extraClassName = "",
    tooltipPlacement: "left" | "right" | "top" = "right"
  ) {
    const slot = EQUIPMENT_SLOTS[slotId];
    const equippedItem = equippedItems[slotId];
    const displayItemName = equippedItem ? getDisplayItemName(equippedItem) : null;
    const hasItem = equippedItem !== null;
    const rarity = equippedItem?.rarity ?? "common";
    const canUseEquippedItem = equippedItem ? canPlayerUseItem(equippedItem, playerState) : true;
    const dropTargetClass =
      equipmentDropTargetSlotId === slotId && equipmentDropState === "valid"
        ? " dropTargetValid"
        : equipmentDropTargetSlotId === slotId && equipmentDropState === "invalid"
          ? " dropTargetInvalid"
          : "";
    const hintClass = hintedEquipmentSlotId === slotId ? " slotHint" : "";
    const dragSourceClass = draggingEquipmentSlotId === slotId ? " isDragSource" : "";
    const classNames = [
      "equipmentCell",
      "equipmentCellIconOnly",
      extraClassName,
      dropTargetClass,
      hintClass,
      dragSourceClass,
      hasItem ? "hasItem" : "isEmpty",
      hasItem ? `rarity-${rarity}` : ""
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={slotId}
        className={classNames}
        draggable={hasItem}
        onDragStart={hasItem ? (event) => handleEquipmentSlotDragStart(event, slotId) : undefined}
        onDragOver={(event) => handleEquipmentSlotDragOver(event, slotId)}
        onDrop={(event) => handleEquipmentSlotDrop(event, slotId)}
        onDragLeave={(event) => handleEquipmentSlotDragLeave(event, slotId)}
        onDoubleClick={hasItem ? () => handleEquipmentSlotDoubleClick(slotId) : undefined}
        onDragEnd={handleInventoryCardDragEnd}
        aria-label={hasItem ? `${slot.label}: ${displayItemName}` : `${slot.label}: Empty`}
      >
        {renderItemIcon({
          majorCategory: equippedItem?.archetype?.majorCategory ?? slot.majorCategory,
          category: equippedItem?.category ?? slot.label,
          itemName: displayItemName ?? slot.label,
          iconAssetPath: equippedItem?.iconAssetPath,
          className: `equipmentItemIcon${hasItem ? "" : " isPlaceholder"}`
        })}
        {equippedItem ? (
          <div className={`equipmentItemTooltip tooltip-${tooltipPlacement}`} role="tooltip">
            <article className={`inventoryItemCard equipmentTooltipCard rarity-${rarity}`}>
              {renderInventoryItemCardBody(equippedItem, canUseEquippedItem)}
            </article>
          </div>
        ) : null}
      </div>
    );
  }

  function renderProfilePanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Inventory</h2>
              <p>Loading player state...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Inventory</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    const effectiveBaseStats: Record<TrainableStatKey, number> = baseStats ?? {
      strength: playerState.stats.strength,
      intelligence: playerState.stats.intelligence,
      dexterity: playerState.stats.dexterity,
      vitality: playerState.stats.vitality,
      initiative: playerState.stats.initiative,
      luck: playerState.stats.luck
    };
    const effectiveCurrencies = currencies ?? {
      ducats: Math.max(playerState.currency.ducats, TEST_MIN_DUCATS),
      imperials: playerState.currency.imperials
    };
    const mainStatColumns: Array<{ key: TrainableStatKey; label: string }> = [
      { key: "strength", label: "STR" },
      { key: "intelligence", label: "INT" },
      { key: "dexterity", label: "DEX" },
      { key: "vitality", label: "VIT" },
      { key: "initiative", label: "INI" },
      { key: "luck", label: "LCK" }
    ];

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>Inventory</h2>
          </article>

          <article className="contentCard">
            <div className="equipmentBoard">
              <div className="equipmentColumn equipmentColumnLeft">
                {EQUIPMENT_LEFT_SLOTS.map((slotId) => renderEquipmentSlotCell(slotId, "", "right"))}
              </div>

              <div className="equipmentCenterColumn">
                <div className="characterVisual">
                  <div className="characterVisualFrame">
                    <div className="characterSilhouette" aria-hidden="true" />
                    <p className="characterVisualLabel">{profileName}</p>
                    {renderEquipmentSlotCell("weapon", "equipmentWeaponCell equipmentWeaponOverlay", "top")}
                    <div className="vestigeRack vestigeRackOverlay">
                      {EQUIPMENT_VESTIGE_SLOTS.map((slotId) =>
                        renderEquipmentSlotCell(slotId, "vestigeCell", "top")
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="equipmentColumn equipmentColumnRight">
                {EQUIPMENT_RIGHT_SLOTS.map((slotId) => renderEquipmentSlotCell(slotId, "", "left"))}
              </div>
            </div>

            <div className="equipmentEconomyBar">
              <div className="economyItem">
                <span className="currencyIcon ducatIcon" aria-hidden="true">
                  ◎
                </span>
                <span>Ducats</span>
                <strong>{effectiveCurrencies.ducats}</strong>
              </div>
              <div className="economyItem">
                <span className="currencyIcon imperialIcon" aria-hidden="true">
                  ◇
                </span>
                <span>Imperials</span>
                <strong>{effectiveCurrencies.imperials}</strong>
              </div>
              <div className="economyItem">
                <span className="currencyIcon gearScoreIcon" aria-hidden="true">
                  ⛨
                </span>
                <span>Gear Score</span>
                <strong>{playerState.gearScore}</strong>
              </div>
            </div>

            <div className="mainStatsTraining">
              <div className="statTrainingColumns">
                {mainStatColumns.map((statColumn) => {
                  const baseValue = effectiveBaseStats[statColumn.key];
                  const itemBonus = equipmentStatBonuses[statColumn.key];
                  const statContributionLines = getStatContributionLines(
                    statColumn.key,
                    baseValue,
                    playerState.class
                  );
                  const trainingCost = getTrainingCost(baseValue);
                  const hasEnoughDucats = effectiveCurrencies.ducats >= trainingCost;
                  const isTrainingThisStat = activeStatTraining?.stat === statColumn.key;
                  const isTrainingAnyStat = activeStatTraining !== null;
                  const trainingCountdown = isTrainingThisStat
                    ? formatDurationFromMs(activeStatTraining.completesAt - nowMs)
                    : null;
                  const trainingProgressPercent = isTrainingThisStat
                    ? Math.round(
                        ((STAT_TRAIN_DURATION_MS -
                          Math.max(0, activeStatTraining.completesAt - nowMs)) /
                          STAT_TRAIN_DURATION_MS) *
                          100
                      )
                    : 0;

                  return (
                    <div key={statColumn.key} className="statTrainingColumn">
                      <span className="statTrainingLabel">{statColumn.label}</span>
                      <div className="statTrainingTooltip" role="tooltip">
                        <p className="statTrainingTooltipTitle">Derived Contributions</p>
                        {statContributionLines.map((line) => (
                          <p key={`${statColumn.key}-${line.label}`} className="statTrainingTooltipLine">
                            <span>
                              {line.label} ({line.ratioLabel})
                            </span>
                            <strong>{line.valueLabel}</strong>
                          </p>
                        ))}
                      </div>
                      <span className="statTrainingValue">
                        {baseValue}
                        <span className="itemBonusValue">(+{itemBonus})</span>
                      </span>
                      <div className="statTrainingAction">
                        <span className="statTrainingCost">
                          {trainingCost}
                          <span className="currencyIcon ducatIcon" aria-hidden="true">
                            ◎
                          </span>
                        </span>
                        <button
                          className="statTrainButton"
                          onClick={() => startStatTraining(statColumn.key)}
                          disabled={!hasEnoughDucats || isTrainingAnyStat}
                        >
                          {isTrainingThisStat ? "Training" : isTrainingAnyStat ? "Busy" : "Train"}
                        </button>
                        {isTrainingThisStat ? (
                          <>
                            <div
                              className="statTrainingProgressTrack"
                              role="progressbar"
                              aria-label={`${statColumn.label} training progress`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={trainingProgressPercent}
                            >
                              <span
                                className="statTrainingProgressFill"
                                style={{ width: `${Math.max(0, Math.min(100, trainingProgressPercent))}%` }}
                              />
                            </div>
                            <span className="statTrainingTimer">{trainingCountdown}</span>
                          </>
                        ) : (
                          <div className="statTrainingIdleSpacer" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

        </section>
      </section>
    );
  }

  function renderInventoryCards(items: InventoryItem[], allowDrag: boolean) {
    if (items.length === 0) {
      return <p>No items available.</p>;
    }

    return (
      <div className="inventoryCards">
        {items.map((item) => {
          const dragSourceClass = draggingInventoryCardId === item.id ? " isDragSource" : "";
          const dropCueClass =
            dropTargetInventoryCardId === item.id && draggingInventoryCardId !== item.id
              ? dropInsertPosition === "before"
                ? " dropCueBefore"
                : " dropCueAfter"
              : "";
          const canUseItem = canPlayerUseItem(item, playerState);
          return (
            <article
              key={item.id}
              className={`inventoryItemCard rarity-${item.rarity}${dragSourceClass}${dropCueClass}`}
              draggable={allowDrag}
              onDragStart={allowDrag ? (event) => handleInventoryCardDragStart(event, item.id) : undefined}
              onDragOver={allowDrag ? (event) => handleInventoryCardDragOver(event, item.id) : undefined}
              onDrop={allowDrag ? (event) => handleInventoryCardDrop(event, item.id) : undefined}
              onDoubleClick={allowDrag ? () => handleInventoryCardDoubleClick(item.id) : undefined}
              onMouseEnter={allowDrag ? (event) => handleInventoryCardMouseEnter(item, event.currentTarget) : undefined}
              onMouseLeave={allowDrag ? () => handleInventoryCardMouseLeave(item.id) : undefined}
              onDragEnd={allowDrag ? handleInventoryCardDragEnd : undefined}
            >
              {renderInventoryItemCardBody(item, canUseItem)}
            </article>
          );
        })}
      </div>
    );
  }

  function renderProfileSidePanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Profile Panel</h2>
              <p>Loading profile data...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Profile Panel</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    const unavailableLabel = "Defined in docs (API pending)";
    const mainOffenseStat =
      playerState.class === "mage"
        ? playerState.stats.intelligence
        : playerState.class === "ranger"
          ? playerState.stats.dexterity
          : playerState.stats.strength;
    const mainOffenseTypeLabel =
      playerState.class === "mage"
        ? "Spell Damage"
        : playerState.class === "ranger"
          ? "Ranged Attack Damage"
          : "Melee Damage";
    const flatBonusDamage = (mainOffenseStat * 0.1).toFixed(1);

    const groupedStats: Array<{
      title: string;
      rows: Array<{ label: string; value: string | number }>;
    }> = [
      {
        title: "Defensive",
        rows: [
          { label: "Armor", value: unavailableLabel },
          { label: "Spell Shield", value: unavailableLabel },
          { label: "Missile Resistance", value: unavailableLabel },
          { label: "Max Hitpoints", value: unavailableLabel }
        ]
      },
      {
        title: "Offensive",
        rows: [
          { label: mainOffenseTypeLabel, value: unavailableLabel },
          { label: "Crit Chance", value: unavailableLabel },
          { label: "Crit Damage", value: unavailableLabel },
          { label: "Combat Speed", value: unavailableLabel },
          { label: "Chance to Extra Attack", value: unavailableLabel },
          { label: "Flat Bonus Damage (Main Stat x 0.10)", value: flatBonusDamage }
        ]
      }
    ];

    const consumableItems = inventoryItems.filter((item) => item.category === "Consumable");

    return (
      <section className="contentShell statsViewportShell">
        <section className="contentStack statsViewportStack sidePanelStack">
          <article className="contentCard sidePanelTabsCard">
            <div className="profileSideTabs">
              <button
                className={`profileSwitchButton${profileSideTab === "inventory" ? " active" : ""}`}
                onClick={() => setProfileSideTab("inventory")}
              >
                Inventory
              </button>
              <button
                className={`profileSwitchButton${profileSideTab === "consumables" ? " active" : ""}`}
                onClick={() => setProfileSideTab("consumables")}
              >
                Consumables
              </button>
              <button
                className={`profileSwitchButton${profileSideTab === "stats" ? " active" : ""}`}
                onClick={() => setProfileSideTab("stats")}
              >
                Stats
              </button>
            </div>
          </article>

          <article className="contentCard statsViewportBody sidePanelBodyCard">
            <div
              className="sidePanelScroll"
              ref={sidePanelScrollRef}
              onScroll={profileSideTab === "inventory" ? () => setInventoryComparisonHover(null) : undefined}
              onDragOver={profileSideTab === "inventory" ? handleInventoryListDragOver : undefined}
              onDrop={profileSideTab === "inventory" ? handleInventoryListDrop : undefined}
            >
              {profileSideTab === "inventory" ? (
                <>
                  <div className="inventoryHeader">
                    <h3>Inventory Items</h3>
                    <p>
                      Stored: {inventoryItems.length}/{INVENTORY_ITEM_LIMIT}
                    </p>
                  </div>
                  <p>Drag and drop cards to reorder your inventory list.</p>
                  {renderInventoryCards(inventoryItems, true)}
                </>
              ) : null}

              {profileSideTab === "consumables" ? (
                <>
                  <div className="inventoryHeader">
                    <h3>Consumables</h3>
                    <p>{consumableItems.length} items</p>
                  </div>
                  {renderInventoryCards(consumableItems, false)}
                </>
              ) : null}

              {profileSideTab === "stats" ? (
                <>
                  <div className="profileMeta">
                    <p>
                      Class: <strong>{formatClassLabel(playerState.class)}</strong>
                    </p>
                    <p>
                      Level: <strong>{playerState.level}</strong>
                    </p>
                  </div>
                  <div className="statsGroups">
                    {groupedStats.map((group) => (
                      <section key={group.title} className="statsGroup">
                        <h3 className="statsGroupTitle">{group.title}</h3>
                        <div className="statsRows">
                          {group.rows.map((row) => (
                            <div key={row.label} className="statsRow">
                              <span className="statsRowLabel">{row.label}</span>
                              <span className="statsRowValue">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
              {renderInventoryComparisonOverlay()}
            </div>
          </article>
        </section>
      </section>
    );
  }

  function renderContractsPanel() {
    if (isLoadingState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Contracts</h2>
              <p>Loading contracts board...</p>
            </article>
          </section>
        </section>
      );
    }

    if (!playerState) {
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard">
              <h2>Contracts</h2>
              <p>Player state unavailable. Login again to refresh your data.</p>
            </article>
          </section>
        </section>
      );
    }

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <div className="contractsHeader">
              <h2>Contracts</h2>
              <p>
                Available: {availableContractSlots.length}/{CONTRACT_SLOT_COUNT} | Replenishing:{" "}
                {replenishingContractSlots.length}
              </p>
            </div>
            <p>
              Contracts expire when their availability timer ends. Abandoning a contract starts its refill timer
              immediately.
            </p>
          </article>

          <article className="contentCard">
            <div className="contractsTableWrap">
              <table className="contractsTable">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Difficulty</th>
                    <th>Experience Roll</th>
                    <th>Ducats Roll</th>
                    <th>Materials Roll</th>
                    <th>Item Drop Roll</th>
                    <th>Stamina Roll</th>
                    <th>Expires In</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {contractSlots.map((slot) => {
                    if (!slot.offer) {
                      return (
                        <tr key={slot.slotIndex} className="contractsReplenishRow">
                          <td data-label="Contract">
                            <div className="contractsNameCell">
                              <strong>Slot {slot.slotIndex}</strong>
                              <span>Replenishing</span>
                            </div>
                          </td>
                          <td data-label="Status" colSpan={8} className="contractsReplenishMessage">
                            New contract available in{" "}
                            {slot.replenishReadyAt
                              ? formatDurationFromMs(slot.replenishReadyAt - nowMs)
                              : "00m 00s"}
                          </td>
                        </tr>
                      );
                    }

                    const { template, rollCue } = slot.offer;

                    return (
                      <tr key={slot.slotIndex}>
                        <td data-label="Contract">
                          <div className="contractsNameCell">
                            <strong>{template.name}</strong>
                            <span>Slot {slot.slotIndex}</span>
                          </div>
                        </td>
                        <td data-label="Difficulty">
                          <span className={`contractDifficulty contractDifficulty-${template.difficulty}`}>
                            {formatContractDifficulty(template.difficulty)}
                          </span>
                        </td>
                        <td data-label="Experience Roll">{formatContractRoll(rollCue.experience)}</td>
                        <td data-label="Ducats Roll">{formatContractRoll(rollCue.ducats)}</td>
                        <td data-label="Materials Roll">{formatContractRoll(rollCue.materials)}</td>
                        <td data-label="Item Drop Roll">{formatContractRoll(rollCue.itemDrop)}</td>
                        <td data-label="Stamina Roll">{formatContractRoll(rollCue.staminaCost)}</td>
                        <td data-label="Expires In" className="contractsTimeCell">
                          {formatDurationFromMs(slot.offer.expiresAt - nowMs)}
                        </td>
                        <td data-label="Action">
                          <button className="contractAbandonButton" onClick={() => abandonContractSlot(slot.slotIndex)}>
                            Abandon
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </section>
    );
  }

  function renderPlaceholderPanel(title: string, description: string) {
    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        </section>
      </section>
    );
  }

  function renderActivePanel() {
    switch (activeTab) {
      case "inventory":
        return renderProfilePanel();
      case "contracts":
        return renderContractsPanel();
      case "missions":
        return renderPlaceholderPanel("Missions", "Mission selection and launch board will appear here.");
      case "arena":
        return renderPlaceholderPanel("Arena", "Arena matchmaking and battle history will appear here.");
      case "guild":
        return renderPlaceholderPanel("Guild", "Guild management and clan tools will appear here.");
      case "castles":
        return renderPlaceholderPanel("Castles", "Castle conquest systems and holdings will appear here.");
      case "auctionHouse":
        return renderPlaceholderPanel(
          "Auction House",
          "Marketplace listings will appear here. This is a placeholder panel for the first iteration."
        );
      case "merchant":
        return renderPlaceholderPanel("Merchant", "Merchant offers, rerolls, and purchases will appear here.");
      case "leaderboards":
        return renderPlaceholderPanel("Leaderboards", "Season rankings and score ladders will appear here.");
      case "settings":
        return renderPlaceholderPanel(
          "Settings",
          "Account and gameplay options will appear here. This is a placeholder panel for now."
        );
      default:
        return renderPlaceholderPanel("Panel", "Panel unavailable.");
    }
  }

  if (!token) {
    return (
      <main className={`appRoot layout-${layoutMode}`}>
        <div className="appSurface">
          <section className="authPage">
            <section className="authCard">
              <h1>Ebonkeep</h1>
              <p>Login to open your post-login landing page.</p>
              <button onClick={handleGuestLogin}>Login as Guest</button>
              {error ? <div className="error">Error: {error}</div> : null}
            </section>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`appRoot layout-${layoutMode}`}>
      <div className="appSurface">
        <div className="landingPage">
          <aside className="leftPanel">
            <div className="leftPanelShell">
              <section className="playerCard">
                <div className="identityRow">
                  <div className="avatar" aria-hidden="true">
                    {avatarInitial}
                  </div>
                  <div className="identityText">
                    <h1>{profileName}</h1>
                    <p>{playerState ? formatClassLabel(playerState.class) : "Class unknown"}</p>
                    <p>Level {playerState?.level ?? "-"}</p>
                  </div>
                </div>

                <div className="barBlock">
                  <p className="barLabel">Health</p>
                  <div className="barShell">
                    <div className="barFill healthFill" style={{ width: `${healthPercent}%` }} />
                  </div>
                </div>

                <div className="barBlock">
                  <p className="barLabel">Experience</p>
                  <div className="barShell">
                    <div className="barFill xpFill" style={{ width: `${xpPercent}%` }} />
                  </div>
                </div>
              </section>

              <section className="menuCard">
                <h2>Menu</h2>
                <nav className="menuList">
                  {MENU_ITEMS.map((menuItem) => (
                    <button
                      key={menuItem.id}
                      className={`menuButton${activeTab === menuItem.id ? " active" : ""}`}
                      onClick={() => setActiveTab(menuItem.id)}
                    >
                      <span className="menuButtonIcon" aria-hidden="true">
                        {renderMenuIcon(menuItem.id)}
                      </span>
                      <span className="menuButtonLabel">{menuItem.label}</span>
                    </button>
                  ))}
                </nav>
                <button className="logoutButton" onClick={handleLogout}>
                  Logout
                </button>
              </section>
            </div>
          </aside>

          <section className="rightPanel">
            {activeTab === "inventory" ? (
              <div className="panelViewportGroup">
                <div className="panelViewportProfileMain">{renderProfilePanel()}</div>
                <div className="panelViewportSide">{renderProfileSidePanel()}</div>
              </div>
            ) : (
              <div className="panelViewport">{renderActivePanel()}</div>
            )}
          </section>

          {error ? <div className="error floatingError">Error: {error}</div> : null}
        </div>
      </div>
    </main>
  );
}
