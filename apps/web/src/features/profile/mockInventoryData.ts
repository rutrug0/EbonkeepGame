import type {
  ArmorArchetype,
  EquipmentSlotId,
  ItemMajorCategory,
  WeaponArchetype,
  WeaponFamily
} from "@ebonkeep/shared/core";
import type { ModifierTier, VestigeId, WeaponDamageRoll } from "@ebonkeep/shared/inventory";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";

type Rarity = "common" | "uncommon" | "rare" | "epic";

export type MeleeDamageRollWindow = {
  minLow: number;
  minHigh: number;
  maxLow: number;
  maxHigh: number;
};

export type MockInventoryItemSeed = {
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
  allowedSlotIds?: EquipmentSlotId[];
  levelRequirement: number;
  baseLevel?: number;
  statBonuses?: Partial<Record<string, number>>;
  damageRoll?: WeaponDamageRoll;
  description: string;
};

export const ITEM_POWER_BASE_PER_LEVEL = 8;
export const WEAPON_POWER_MULTIPLIER = 2;
export const WEAPON_BASE_LEVEL_POWER_WEIGHT = 0.25;
export const RARITY_POWER_BONUS_RATE: Record<Rarity, number> = {
  common: 0,
  uncommon: 0.1,
  rare: 0.2,
  epic: 0.3
};
export const MODIFIER_TIER_POWER_PER_LEVEL: Record<ModifierTier, number> = {
  T1: 0.25,
  T2: 0.5,
  T3: 0.75
};
export const MOCK_MELEE_RARITY_POOL: Rarity[] = ["uncommon", "rare", "epic"];
const GENERATED_WEAPON_ICON_KEYS_BY_NAME: Record<string, string> = {
  "ashbound rod": "weapon:arcane:ashbound rod",
  "aetherwake staff": "weapon:arcane:aetherwake staff",
  "cathedral spire": "weapon:arcane:cathedral spire",
  "seraphim ashrod": "weapon:arcane:seraphim ashrod",
  "oracle s eclipse": "weapon:arcane:oracle s eclipse",
  "dominion arcanum": "weapon:arcane:dominion arcanum",
  "dormant hazel wand": "weapon:arcane:dormant hazel wand",
  "cinderprick wand": "weapon:arcane:cinderprick wand",
  "mothglass wand": "weapon:arcane:mothglass wand",
  "starveil wand": "weapon:arcane:starveil wand",
  "eclipsed scepter": "weapon:arcane:eclipsed scepter",
  "abyssal choir wand": "weapon:arcane:abyssal choir wand",
  "woodcutter s axe": "weapon:melee:woodcutter s axe",
  "bearded war axe": "weapon:melee:bearded war axe",
  valenmark: "weapon:melee:valenmark",
  "durnholde axe": "weapon:melee:durnholde axe",
  harthorn: "weapon:melee:harthorn",
  "stormvale axe": "weapon:melee:stormvale axe",
  "plainsteel longsword": "weapon:melee:plainsteel longsword",
  valdaryn: "weapon:melee:valdaryn",
  "redmark sabre": "weapon:melee:redmark sabre",
  "tempered longblade": "weapon:melee:tempered longblade",
  "gilded bastard sword": "weapon:melee:gilded bastard sword",
  "highguard claymore": "weapon:melee:highguard claymore",
  "longreach recurve": "weapon:ranged:longreach recurve",
  "skylash longbow": "weapon:ranged:skylash longbow",
  "dreadfletch bow": "weapon:ranged:dreadfletch bow",
  "black meridian bow": "weapon:ranged:black meridian bow",
  "eclipsed huntmaster": "weapon:ranged:eclipsed huntmaster",
  "hollowsnap sling": "weapon:ranged:hollowsnap sling",
  "shardwhistle sling": "weapon:ranged:shardwhistle sling"
};
export const GENERATED_WEAPON_ICON_PATHS_BY_NAME: Record<string, string> = {};
for (const [itemName, key] of Object.entries(GENERATED_WEAPON_ICON_KEYS_BY_NAME)) {
  const iconPath = GENERATED_ITEM_ICON_PATHS[key];
  if (iconPath) {
    GENERATED_WEAPON_ICON_PATHS_BY_NAME[itemName] = iconPath;
  }
}

function normalizeItemNameForGeneratedIconLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getGeneratedWeaponIconPath(itemName: string): string | undefined {
  return GENERATED_WEAPON_ICON_PATHS_BY_NAME[normalizeItemNameForGeneratedIconLookup(itemName)];
}
export const MOCK_MELEE_DAMAGE_ROLL_WINDOW_BY_LEVEL: Record<number, Record<Rarity, MeleeDamageRollWindow>> = {
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
export const MOCK_MELEE_WEAPON_TEMPLATES: Array<{
  itemName: string;
  levelRequirement: number;
  weaponFamily: WeaponFamily;
  description: string;
  iconAssetPath?: string;
}> = [
  {
    itemName: "Plainsteel Longsword",
    levelRequirement: 18,
    weaponFamily: "sword",
    description: "Balanced steel with practical wear from constant drill work.",
    iconAssetPath: getGeneratedWeaponIconPath("Plainsteel Longsword")
  },
  {
    itemName: "Woodcutter's Axe",
    levelRequirement: 18,
    weaponFamily: "axe",
    description: "Repurposed work axe hardened by militia duty.",
    iconAssetPath: getGeneratedWeaponIconPath("Woodcutter's Axe")
  },
  {
    itemName: "Valdaryn",
    levelRequirement: 19,
    weaponFamily: "sword",
    description: "Slim blade profile made for fast pressure and quick recovery.",
    iconAssetPath: getGeneratedWeaponIconPath("Valdaryn")
  },
  {
    itemName: "Bearded War Axe",
    levelRequirement: 19,
    weaponFamily: "axe",
    description: "Broad-bearded head built to hook and break defensive lines.",
    iconAssetPath: getGeneratedWeaponIconPath("Bearded War Axe")
  },
  {
    itemName: "Redmark Sabre",
    levelRequirement: 20,
    weaponFamily: "sword",
    description: "Curved sabre favored by riders who strike on the pass.",
    iconAssetPath: getGeneratedWeaponIconPath("Redmark Sabre")
  },
  {
    itemName: "Tempered Longblade",
    levelRequirement: 20,
    weaponFamily: "sword",
    description: "Heat-treated steel that keeps edge alignment under stress.",
    iconAssetPath: getGeneratedWeaponIconPath("Tempered Longblade")
  },
  {
    itemName: "Valenmark",
    levelRequirement: 21,
    weaponFamily: "axe",
    description: "A grim standard among wardens of besieged keeps.",
    iconAssetPath: getGeneratedWeaponIconPath("Valenmark")
  },
  {
    itemName: "Durnholde Axe",
    levelRequirement: 21,
    weaponFamily: "axe",
    description: "Each notch in its head marks a broken line of men.",
    iconAssetPath: getGeneratedWeaponIconPath("Durnholde Axe")
  },
  {
    itemName: "Gilded Bastard Sword",
    levelRequirement: 22,
    weaponFamily: "sword",
    description: "Court-finished steel tuned for battlefield authority.",
    iconAssetPath: getGeneratedWeaponIconPath("Gilded Bastard Sword")
  },
  {
    itemName: "Harthorn",
    levelRequirement: 22,
    weaponFamily: "axe",
    description: "Its crescent edge howls through plate at full swing.",
    iconAssetPath: getGeneratedWeaponIconPath("Harthorn")
  },
  {
    itemName: "Highguard Claymore",
    levelRequirement: 22,
    weaponFamily: "sword",
    description: "Long two-hander built for line-breaking overhead cuts.",
    iconAssetPath: getGeneratedWeaponIconPath("Highguard Claymore")
  },
  {
    itemName: "Stormvale Axe",
    levelRequirement: 22,
    weaponFamily: "axe",
    description: "Storm-battered steel that lands like a falling gate.",
    iconAssetPath: getGeneratedWeaponIconPath("Stormvale Axe")
  }
];

export const MOCK_BASE_ARMOR_AND_JEWELRY_ITEMS: MockInventoryItemSeed[] = [
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
