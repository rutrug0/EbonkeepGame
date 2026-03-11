import type {
  ArmorArchetype,
  EquipmentSlotId,
  ItemMajorCategory,
  WeaponArchetype,
  WeaponFamily
} from "@ebonkeep/shared/core";
import type { ModifierTier, VestigeId, WeaponDamageRoll } from "@ebonkeep/shared/inventory";

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
export const GENERATED_WEAPON_ICON_PATHS_BY_NAME: Record<string, string> = {
  "ashbound rod": "/assets/items/generated/weapon/arcane/staff/mage_arcane_ashbound_rod.png",
  "aetherwake staff": "/assets/items/generated/weapon/arcane/staff/mage_arcane_aetherwake_staff.png",
  "cathedral spire": "/assets/items/generated/weapon/arcane/staff/mage_arcane_cathedral_spire.png",
  "seraphim ashrod": "/assets/items/generated/weapon/arcane/staff/mage_arcane_seraphim_ashrod.png",
  "oracle s eclipse": "/assets/items/generated/weapon/arcane/staff/mage_arcane_oracle_s_eclipse.png",
  "dominion arcanum": "/assets/items/generated/weapon/arcane/staff/mage_arcane_dominion_arcanum.png",
  "dormant hazel wand": "/assets/items/generated/weapon/arcane/wand/mage_arcane_dormant_hazel_wand.png",
  "cinderprick wand": "/assets/items/generated/weapon/arcane/wand/mage_arcane_cinderprick_wand.png",
  "mothglass wand": "/assets/items/generated/weapon/arcane/wand/mage_arcane_mothglass_wand.png",
  "starveil wand": "/assets/items/generated/weapon/arcane/wand/mage_arcane_starveil_wand.png",
  "eclipsed scepter": "/assets/items/generated/weapon/arcane/wand/mage_arcane_eclipsed_scepter.png",
  "abyssal choir wand": "/assets/items/generated/weapon/arcane/wand/mage_arcane_abyssal_choir_wand.png",
  "woodcutter s axe": "/assets/items/generated/weapon/melee/axe/warrior_melee_woodcutter_s_axe.png",
  "bearded war axe": "/assets/items/generated/weapon/melee/axe/warrior_melee_bearded_war_axe.png",
  valenmark: "/assets/items/generated/weapon/melee/axe/warrior_melee_valenmark.png",
  "durnholde axe": "/assets/items/generated/weapon/melee/axe/warrior_melee_durnholde_axe.png",
  harthorn: "/assets/items/generated/weapon/melee/axe/warrior_melee_harthorn.png",
  "stormvale axe": "/assets/items/generated/weapon/melee/axe/warrior_melee_stormvale_axe.png",
  "plainsteel longsword": "/assets/items/generated/weapon/melee/sword/warrior_melee_plainsteel_longsword.png",
  valdaryn: "/assets/items/generated/weapon/melee/sword/warrior_melee_valdaryn.png",
  "redmark sabre": "/assets/items/generated/weapon/melee/sword/warrior_melee_redmark_sabre.png",
  "tempered longblade": "/assets/items/generated/weapon/melee/sword/warrior_melee_tempered_longblade.png",
  "gilded bastard sword": "/assets/items/generated/weapon/melee/sword/warrior_melee_gilded_bastard_sword.png",
  "highguard claymore": "/assets/items/generated/weapon/melee/sword/warrior_melee_highguard_claymore.png",
  "longreach recurve": "/assets/items/generated/weapon/ranged/bow/ranger_ranged_longreach_recurve.png",
  "skylash longbow": "/assets/items/generated/weapon/ranged/bow/ranger_ranged_skylash_longbow.png",
  "dreadfletch bow": "/assets/items/generated/weapon/ranged/bow/ranger_ranged_dreadfletch_bow.png",
  "black meridian bow": "/assets/items/generated/weapon/ranged/bow/ranger_ranged_black_meridian_bow.png",
  "eclipsed huntmaster": "/assets/items/generated/weapon/ranged/bow/ranger_ranged_eclipsed_huntmaster.png",
  "hollowsnap sling": "/assets/items/generated/weapon/ranged/sling/ranger_ranged_hollowsnap_sling.png",
  "shardwhistle sling": "/assets/items/generated/weapon/ranged/sling/ranger_ranged_shardwhistle_sling.png"
};
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
  iconAssetPath: string;
}> = [
  {
    itemName: "Plainsteel Longsword",
    levelRequirement: 18,
    weaponFamily: "sword",
    description: "Balanced steel with practical wear from constant drill work.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_plainsteel_longsword.png"
  },
  {
    itemName: "Woodcutter's Axe",
    levelRequirement: 18,
    weaponFamily: "axe",
    description: "Repurposed work axe hardened by militia duty.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_woodcutter_s_axe.png"
  },
  {
    itemName: "Valdaryn",
    levelRequirement: 19,
    weaponFamily: "sword",
    description: "Slim blade profile made for fast pressure and quick recovery.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_valdaryn.png"
  },
  {
    itemName: "Bearded War Axe",
    levelRequirement: 19,
    weaponFamily: "axe",
    description: "Broad-bearded head built to hook and break defensive lines.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_bearded_war_axe.png"
  },
  {
    itemName: "Redmark Sabre",
    levelRequirement: 20,
    weaponFamily: "sword",
    description: "Curved sabre favored by riders who strike on the pass.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_redmark_sabre.png"
  },
  {
    itemName: "Tempered Longblade",
    levelRequirement: 20,
    weaponFamily: "sword",
    description: "Heat-treated steel that keeps edge alignment under stress.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_tempered_longblade.png"
  },
  {
    itemName: "Valenmark",
    levelRequirement: 21,
    weaponFamily: "axe",
    description: "A grim standard among wardens of besieged keeps.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_valenmark.png"
  },
  {
    itemName: "Durnholde Axe",
    levelRequirement: 21,
    weaponFamily: "axe",
    description: "Each notch in its head marks a broken line of men.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_durnholde_axe.png"
  },
  {
    itemName: "Gilded Bastard Sword",
    levelRequirement: 22,
    weaponFamily: "sword",
    description: "Court-finished steel tuned for battlefield authority.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_gilded_bastard_sword.png"
  },
  {
    itemName: "Harthorn",
    levelRequirement: 22,
    weaponFamily: "axe",
    description: "Its crescent edge howls through plate at full swing.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_harthorn.png"
  },
  {
    itemName: "Highguard Claymore",
    levelRequirement: 22,
    weaponFamily: "sword",
    description: "Long two-hander built for line-breaking overhead cuts.",
    iconAssetPath: "/assets/items/generated/weapon/melee/sword/warrior_melee_highguard_claymore.png"
  },
  {
    itemName: "Stormvale Axe",
    levelRequirement: 22,
    weaponFamily: "axe",
    description: "Storm-battered steel that lands like a falling gate.",
    iconAssetPath: "/assets/items/generated/weapon/melee/axe/warrior_melee_stormvale_axe.png"
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
