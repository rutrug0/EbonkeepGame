import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement
} from "react";
import { useTranslation } from "react-i18next";

import {
  combatPlaybackActionResolvedSchema,
  combatPlaybackEncounterSchema,
  combatPlaybackEventSchema,
  isItemUsableByClass,
  mainStatToFlatDamageRatio,
  type AccountOverviewResponse,
  type ArmorArchetype,
  type CombatPlaybackActionResolved,
  type CombatPlaybackEncounter,
  type CombatPlaybackEvent,
  type ItemMajorCategory,
  type PlayerClass,
  type PlayerState,
  type SupportedLocale,
  type VestigeId,
  type WeaponArchetype,
  type WeaponFamily
} from "@ebonkeep/shared";

import { devGuestLogin, fetchPlayerState, forgotPassword, getAccountOverview, login, register, resendVerificationEmail, resetPassword, updatePlayerPreferences, verifyEmail } from "./api";
import { CombatEncounterPanel } from "./components/CombatEncounterPanel";
import { GENERATED_ITEM_ICON_PATHS } from "./generated/itemArtManifest";
import {
  GENERATED_ITEM_ENCYCLOPEDIA_DATA,
  type GeneratedEncyclopediaItem
} from "./generated/itemEncyclopediaData";
import i18n, { setLocale } from "./i18n";
import { LOCALE_OPTIONS, LOCALE_STORAGE_KEY, normalizeLocale } from "./i18n/supportedLocales";

type LandingTab =
  | "inventory"
  | "encyclopedia"
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
type InventoryCategoryFilter = "weapon" | "armor" | "jewelry";
type ChatChannel = "world" | "guild";
type EncyclopediaCategory = "armor" | "weapon" | "jewelry" | "monster";
type EncyclopediaArmorArchetype = "heavy" | "light" | "robe";
type EncyclopediaWeaponArchetype = "melee" | "ranged" | "arcane";

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
  labelKey: string;
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
  baseLevel?: number;
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

type ContractEncounterPhase = "board" | "travel" | "combat";

type CombatEncounterResolutionState = "playing" | "summarizing" | "awaiting_return";

type ActiveContractEncounterState = {
  slotIndex: number;
  offer: ContractOffer;
  phase: ContractEncounterPhase;
  travelEndsAt: number | null;
  encounter: CombatPlaybackEncounter;
  travelDescription: string;
  timeline: CombatPlaybackEvent[];
  currentEventIndex: number;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  activeAction: CombatPlaybackActionResolved | null;
  impactTargetId: string | null;
  resolutionState: CombatEncounterResolutionState;
  finalSummaryLine: string | null;
  typedSummaryLine: string;
  playbackRate: 1 | 5;
  segmentPlaybackRate: 1 | 5;
  playbackProgressMs: number;
  lastPlaybackTickAtMs: number | null;
};

type StatContributionLine = {
  label: string;
  ratioLabel: string;
  valueLabel: string;
};
type DevWeaponInventorySeed = NonNullable<PlayerState["devWeapons"]>[number];
type ChatMessage = {
  id: string;
  channel: ChatChannel;
  sender: string;
  text: string;
  sentAtMs: number;
};

const INVENTORY_ITEM_LIMIT = 20;
const CONTRACT_SLOT_COUNT = 6;
const CONTRACT_REPLENISH_MIN_MS = 60 * 60 * 1000;
const CONTRACT_REPLENISH_MAX_MS = 120 * 60 * 1000;
const CONTRACT_TRAVEL_DURATION_MS = 5 * 1000;
const COMBAT_PLAYBACK_START_DELAY_MS = 500;
const COMBAT_PLAYBACK_IMPACT_DELAY_MS = 1140;
const COMBAT_PLAYBACK_BEAT_MS = 2200;
const COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
const COMBAT_FAST_FORWARD_ANIMATION_RATE = 8;
const STAT_TRAIN_DURATION_MS = 10 * 60 * 1000;
const TEST_MIN_DUCATS = 1000;
const MAIN_STAT_DEFENSE_RATIO = 0.2;
const LUCK_CRIT_CHANCE_PERCENT_PER_POINT = 0.1;
const LUCK_CRIT_DAMAGE_PERCENT_PER_POINT = 0.2;
const INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT = 0.1;
const INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT = 0.2;
const VITALITY_MAX_HP_PER_POINT = 10;
const DRAG_PAYLOAD_MIME = "application/x-ebonkeep-drag-payload";
const CHAT_DOCK_TOLERANCE_PX = 1;
const CHAT_CHANNEL_LABEL_KEYS: Record<ChatChannel, string> = {
  world: "chat.world",
  guild: "chat.guild"
};
const GENERATED_CHARACTER_VISUALS: Array<{ key: string; assetName: string; path: string }> = Object.entries(
  GENERATED_ITEM_ICON_PATHS
)
  .filter(([key, assetPath]) => key.startsWith("character:") && assetPath.startsWith("/assets/items/generated/character/"))
  .map(([key, path]) => ({
    key,
    assetName: key.split(":")[2] ?? "",
    path
  }))
  .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));

function formatChatTime(sentAtMs: number): string {
  const sentAt = new Date(sentAtMs);
  const hours = sentAt.getHours().toString().padStart(2, "0");
  const minutes = sentAt.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createInitialChatMessages(nowMs: number = Date.now()): Record<ChatChannel, ChatMessage[]> {
  return {
    world: [
      {
        id: "world-seed-1",
        channel: "world",
        sender: "Town Crier",
        text: "World bosses are stirring near Dreadmoor.",
        sentAtMs: nowMs - 5 * 60 * 1000
      },
      {
        id: "world-seed-2",
        channel: "world",
        sender: "Mercenary-Rin",
        text: "Selling rare iron bundles, whisper me.",
        sentAtMs: nowMs - 3 * 60 * 1000
      },
      {
        id: "world-seed-3",
        channel: "world",
        sender: "Archmage Sol",
        text: "Need one more for hard contract chain.",
        sentAtMs: nowMs - 90 * 1000
      }
    ],
    guild: [
      {
        id: "guild-seed-1",
        channel: "guild",
        sender: "Guildmaster",
        text: "Guild reset at dawn. Donate materials before then.",
        sentAtMs: nowMs - 6 * 60 * 1000
      },
      {
        id: "guild-seed-2",
        channel: "guild",
        sender: "Quartermaster",
        text: "Bench upgrades are queued after tonight's run.",
        sentAtMs: nowMs - 2 * 60 * 1000
      }
    ]
  };
}

const MENU_ITEMS: LandingTab[] = [
  "inventory",
  "encyclopedia",
  "contracts",
  "missions",
  "arena",
  "guild",
  "castles",
  "auctionHouse",
  "merchant",
  "leaderboards",
  "settings"
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
  helmet: { labelKey: "slots.helmet", majorCategory: "armor" },
  necklace: { labelKey: "slots.necklace", majorCategory: "jewelry" },
  upperArmor: { labelKey: "slots.upperArmor", majorCategory: "armor" },
  belt: { labelKey: "slots.belt", majorCategory: "armor" },
  ringLeft: { labelKey: "slots.ringLeft", majorCategory: "jewelry" },
  weapon: { labelKey: "slots.weapon", majorCategory: "weapon" },
  pauldrons: { labelKey: "slots.pauldrons", majorCategory: "armor" },
  gloves: { labelKey: "slots.gloves", majorCategory: "armor" },
  lowerArmor: { labelKey: "slots.lowerArmor", majorCategory: "armor" },
  boots: { labelKey: "slots.boots", majorCategory: "armor" },
  ringRight: { labelKey: "slots.ringRight", majorCategory: "jewelry" },
  vestige1: { labelKey: "slots.vestige1", majorCategory: "vestige" },
  vestige2: { labelKey: "slots.vestige2", majorCategory: "vestige" },
  vestige3: { labelKey: "slots.vestige3", majorCategory: "vestige" }
};
const ENCYCLOPEDIA_ARMOR_SLOT_ORDER: string[] = [
  "helmet",
  "upper_armor",
  "pauldrons",
  "gloves",
  "belt",
  "lower_armor",
  "boots"
];
const ENCYCLOPEDIA_CATEGORY_ORDER: EncyclopediaCategory[] = ["armor", "weapon", "jewelry", "monster"];
const ENCYCLOPEDIA_ARMOR_ARCHETYPE_ORDER: EncyclopediaArmorArchetype[] = ["heavy", "light", "robe"];
const ENCYCLOPEDIA_WEAPON_ARCHETYPE_ORDER: EncyclopediaWeaponArchetype[] = ["melee", "ranged", "arcane"];

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
const WEAPON_BASE_LEVEL_POWER_WEIGHT = 0.25;
const MOCK_WARRIOR_LEVEL = 80;
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
const GENERATED_WEAPON_ICON_PATHS_BY_NAME: Record<string, string> = {
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
  item: Pick<InventoryItem, "levelRequirement" | "baseLevel" | "rarity" | "archetype" | "prefix" | "affix">
): number {
  const effectiveLevel =
    item.archetype?.majorCategory === "weapon"
      ? item.levelRequirement * (1 - WEAPON_BASE_LEVEL_POWER_WEIGHT) +
        (item.baseLevel ?? item.levelRequirement) * WEAPON_BASE_LEVEL_POWER_WEIGHT
      : item.levelRequirement;
  const basePower = effectiveLevel * ITEM_POWER_BASE_PER_LEVEL;
  const rarityBonus = basePower * RARITY_POWER_BONUS_RATE[item.rarity];
  const prefixBonus = item.prefix ? effectiveLevel * MODIFIER_TIER_POWER_PER_LEVEL[item.prefix.tier] : 0;
  const affixBonus = item.affix ? effectiveLevel * MODIFIER_TIER_POWER_PER_LEVEL[item.affix.tier] : 0;
  const totalBeforeCategoryMultiplier = basePower + rarityBonus + prefixBonus + affixBonus;
  return Math.round(totalBeforeCategoryMultiplier * getPowerCategoryMultiplier(item));
}

function createMockMeleeWeaponItems(): MockInventoryItemSeed[] {
  return MOCK_MELEE_WEAPON_TEMPLATES.map((template, index) => {
    const levelRequirement = template.levelRequirement;
    const rarity = randomRarityFromPool(MOCK_MELEE_RARITY_POOL);
    const baseStrength = Math.max(4, Math.round(levelRequirement / 4));
    return {
      id: `itm_mock_melee_${index}_${levelRequirement}`,
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
    melee_damage: i18n.t("profile.meleeDamage"),
    ranged_damage: i18n.t("profile.rangedDamage"),
    spell_damage: i18n.t("profile.spellDamage"),
    crit_damage: i18n.t("profile.critDamage"),
    crit_chance: i18n.t("profile.critChance"),
    extra_attack_chance: i18n.t("profile.extraAttackChance"),
    double_attack_chance: i18n.t("profile.extraAttackChance")
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

function localizeKnownLabel(label: string): string {
  const keyByLabel: Record<string, string> = {
    "Melee Damage": "profile.meleeDamage",
    "Ranged Damage": "profile.rangedDamage",
    "Spell Damage": "profile.spellDamage",
    "Crit Damage": "profile.critDamage",
    "Crit Chance": "profile.critChance",
    "Extra Attack Chance": "profile.extraAttackChance",
    "Armor": "profile.armor",
    "Spell Shield": "profile.spellShield",
    "Missile Resistance": "profile.missileResistance",
    "Max Hitpoints": "profile.maxHitpoints",
  };
  const key = keyByLabel[label];
  if (key) {
    return i18n.t(key);
  }
  return label;
}

function normalizeItemNameForArtLookup(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getJewelryTypeForSlot(slotId: EquipmentSlotId | undefined): "ring" | "necklace" | undefined {
  if (!slotId) {
    return undefined;
  }
  if (slotId === "ringLeft" || slotId === "ringRight") {
    return "ring";
  }
  if (slotId === "necklace") {
    return "necklace";
  }
  return undefined;
}

function getGeneratedItemIconPath(args: {
  majorCategory?: ItemMajorCategory;
  itemName: string;
  weaponArchetype?: WeaponArchetype;
  armorArchetype?: ArmorArchetype;
  equipSlotId?: EquipmentSlotId;
}): string | undefined {
  const itemName = normalizeItemNameForArtLookup(args.itemName);
  if (!itemName || !args.majorCategory) {
    return undefined;
  }

  if (args.majorCategory === "weapon" && args.weaponArchetype) {
    const key = `weapon:${args.weaponArchetype}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key] ?? GENERATED_WEAPON_ICON_PATHS_BY_NAME[itemName];
  }

  if (args.majorCategory === "armor" && args.armorArchetype) {
    const key = `armor:${args.armorArchetype}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key];
  }

  if (args.majorCategory === "jewelry") {
    const jewelryType = getJewelryTypeForSlot(args.equipSlotId);
    if (!jewelryType) {
      return undefined;
    }
    const key = `jewelry:${jewelryType}:${itemName}`;
    return GENERATED_ITEM_ICON_PATHS[key];
  }

  return undefined;
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
    iconAssetPath: getGeneratedItemIconPath({
      majorCategory: "weapon",
      weaponArchetype: weapon.weaponFamily,
      itemName: baseItemName,
      equipSlotId: "weapon"
    }),
    equipable: true,
    archetype: {
      majorCategory: "weapon",
      weaponArchetype: weapon.weaponFamily,
      weaponFamily: toWeaponFamily(weapon.weaponFamily)
    },
    equipSlotId: "weapon",
    levelRequirement: weapon.level,
    baseLevel: weapon.baseLevel,
    damageRoll: {
      minRollRange: [weapon.minRollLow, weapon.minRollHigh] as [number, number],
      rolledMin: weapon.minDamage,
      rolledMax: weapon.maxDamage,
      maxRollRange: [weapon.maxRollLow, weapon.maxRollHigh] as [number, number],
      averageDamage: (weapon.minDamage + weapon.maxDamage) / 2
    },
    prefix,
    affix,
    description: weapon.flavorText,
    power: 0
  } satisfies InventoryItem;

  return {
    ...itemWithModifiers,
    power: weapon.power
  };
}

function createMockInventoryItems(devWeapons?: PlayerState["devWeapons"]): InventoryItem[] {
  const baseItems = MOCK_BASE_ARMOR_AND_JEWELRY_ITEMS.map((item) => {
    const modifiers = buildRarityModifiers(item);
    const itemWithModifiers: InventoryItem = {
      ...item,
      ...modifiers,
      iconAssetPath:
        item.iconAssetPath ??
        getGeneratedItemIconPath({
          majorCategory: item.archetype?.majorCategory,
          armorArchetype: item.archetype?.armorArchetype,
          weaponArchetype: item.archetype?.weaponArchetype,
          itemName: item.itemName,
          equipSlotId: item.equipSlotId
        }),
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
      iconAssetPath:
        getGeneratedItemIconPath({
          majorCategory: "weapon",
          weaponArchetype: item.archetype?.weaponArchetype,
          itemName: item.itemName,
          equipSlotId: item.equipSlotId
        }) ?? item.iconAssetPath,
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

  if (devWeapons && devWeapons.length > 0) {
    return prioritizedWeaponItems;
  }

  return [...baseItems, ...prioritizedWeaponItems];
}

function applyMockPlayerStateOverrides(state: PlayerState): PlayerState {
  return {
    ...state
    // Removed mock overrides for class and level - using real data from registration
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

function getMonsterAssetPath(key: string): string | undefined {
  return GENERATED_ITEM_ICON_PATHS[key];
}

function getEncounterTravelDescription(difficulty: ContractDifficulty): string {
  switch (difficulty) {
    case "easy":
      return "Torch smoke drifts through cramped goblin tunnels ahead. The hollow is close, noisy, and badly kept.";
    case "medium":
      return "Cold mirewater gathers around reed roots and black pools. Something in the hollow is already listening.";
    case "hard":
      return "Dead furnaces and ash-choked brick lie ahead. The kiln yard looks abandoned until the heat shifts.";
    default:
      return "The path ahead tightens toward the contract target.";
  }
}

function getEncounterPreset(difficulty: ContractDifficulty): {
  locationName: string;
  enemyId: string;
  enemyName: string;
  enemyMaxHp: number;
  travelImagePath?: string;
  travelImageMode: "image" | "silhouette";
  avatarPath?: string;
  usesSilhouetteFallback?: boolean;
} {
  switch (difficulty) {
    case "easy":
      return {
        locationName: "Snagtooth Hollow",
        enemyId: "enemy-snagtooth-boss",
        enemyName: "Snagtooth Boss",
        enemyMaxHp: 72,
        travelImagePath: getMonsterAssetPath("monster:snagtooth_hollow_00:snagtooth boss"),
        travelImageMode: "image",
        avatarPath: getMonsterAssetPath("monster:snagtooth_hollow_00:snagtooth boss")
      };
    case "medium":
      return {
        locationName: "Mirepool Hollow",
        enemyId: "enemy-mire-croaker",
        enemyName: "The Mire Croaker",
        enemyMaxHp: 88,
        travelImagePath: getMonsterAssetPath("monster:mirepool_boglings_04:the mire croaker"),
        travelImageMode: "image",
        avatarPath: getMonsterAssetPath("monster:mirepool_boglings_04:the mire croaker")
      };
    case "hard":
      return {
        locationName: "The Cinder Kiln",
        enemyId: "enemy-kiln-master",
        enemyName: "The Kiln Master",
        enemyMaxHp: 102,
        travelImageMode: "silhouette",
        usesSilhouetteFallback: true
      };
    default:
      return {
        locationName: "Unknown Reach",
        enemyId: "enemy-unknown",
        enemyName: "Unknown Enemy",
        enemyMaxHp: 80,
        travelImageMode: "silhouette",
        usesSilhouetteFallback: true
      };
  }
}

function buildMockCombatEncounterState(args: {
  offer: ContractOffer;
  slotIndex: number;
  playerName: string;
  playerAvatarPath?: string | null;
  nowMs: number;
}): ActiveContractEncounterState {
  const { offer, slotIndex, playerName, playerAvatarPath, nowMs } = args;
  const preset = getEncounterPreset(offer.template.difficulty);
  const playerMaxHp = 100;
  const playerActor = {
    id: "player-warden",
    side: "player" as const,
    name: playerName,
    maxHp: playerMaxHp,
    avatarPath: playerAvatarPath ?? undefined
  };
  const enemyActor = {
    id: preset.enemyId,
    side: "enemy" as const,
    name: preset.enemyName,
    maxHp: preset.enemyMaxHp,
    avatarPath: preset.avatarPath,
    usesSilhouetteFallback: preset.usesSilhouetteFallback
  };
  const encounter = combatPlaybackEncounterSchema.parse({
    encounterId: `${offer.instanceId}-encounter`,
    contractInstanceId: offer.instanceId,
    contractName: offer.template.name,
    difficulty: offer.template.difficulty,
    locationName: preset.locationName,
    travelImagePath: preset.travelImagePath,
    travelImageMode: preset.travelImageMode,
    player: playerActor,
    enemies: [enemyActor]
  });
  const timeline = combatPlaybackEventSchema.array().parse([
    {
      type: "CombatPlaybackStarted",
      eventId: `${encounter.encounterId}-start`,
      encounterId: encounter.encounterId
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-1`,
      encounterId: encounter.encounterId,
      turnIndex: 1,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: 18,
      targetHpAfter: Math.max(0, enemyActor.maxHp - 18),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} strikes ${enemyActor.name} for 18 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-2`,
      encounterId: encounter.encounterId,
      turnIndex: 2,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: 9,
      targetHpAfter: Math.max(0, playerActor.maxHp - 9),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} clips ${playerActor.name} for 9 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-3`,
      encounterId: encounter.encounterId,
      turnIndex: 3,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: 17,
      targetHpAfter: Math.max(0, enemyActor.maxHp - 35),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} presses forward and deals 17 damage to ${enemyActor.name}.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-4`,
      encounterId: encounter.encounterId,
      turnIndex: 4,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: 8,
      targetHpAfter: Math.max(0, playerActor.maxHp - 17),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} catches ${playerActor.name} for 8 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-5`,
      encounterId: encounter.encounterId,
      turnIndex: 5,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: Math.max(0, enemyActor.maxHp - 35),
      targetHpAfter: 0,
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} finishes ${enemyActor.name} with a final blow.`
    },
    {
      type: "CombatPlaybackEnded",
      eventId: `${encounter.encounterId}-end`,
      encounterId: encounter.encounterId,
      winnerSide: "player",
      summaryLine: `${offer.template.name} is complete. ${enemyActor.name} has been driven off.`
    }
  ]);

  return {
    slotIndex,
    offer,
    phase: "travel",
    travelEndsAt: nowMs + CONTRACT_TRAVEL_DURATION_MS,
    encounter,
    travelDescription: getEncounterTravelDescription(offer.template.difficulty),
    timeline,
    currentEventIndex: 0,
    hpByActorId: {
      [playerActor.id]: playerActor.maxHp,
      [enemyActor.id]: enemyActor.maxHp
    },
    combatLogEntries: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackRate: 1,
    segmentPlaybackRate: 1,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

function resetCombatEncounterPlayback(previousEncounter: ActiveContractEncounterState): ActiveContractEncounterState {
  return {
    ...previousEncounter,
    phase: "combat",
    travelEndsAt: null,
    currentEventIndex: 0,
    hpByActorId: {
      [previousEncounter.encounter.player.id]: previousEncounter.encounter.player.maxHp,
      ...Object.fromEntries(
        previousEncounter.encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const)
      )
    },
    combatLogEntries: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackRate: previousEncounter.playbackRate,
    segmentPlaybackRate: previousEncounter.playbackRate,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

function getEncounterPlaybackProgress(encounter: ActiveContractEncounterState, nowMs: number = Date.now()): number {
  if (encounter.lastPlaybackTickAtMs === null) {
    return encounter.playbackProgressMs;
  }
  return encounter.playbackProgressMs + Math.max(0, nowMs - encounter.lastPlaybackTickAtMs) * encounter.segmentPlaybackRate;
}

function snapshotEncounterPlayback(encounter: ActiveContractEncounterState, nowMs: number = Date.now()) {
  return {
    ...encounter,
    playbackProgressMs: getEncounterPlaybackProgress(encounter, nowMs),
    lastPlaybackTickAtMs: nowMs
  };
}

function getEncounterAnimationRate(encounter: ActiveContractEncounterState): number {
  if (encounter.segmentPlaybackRate === 5) {
    return COMBAT_FAST_FORWARD_ANIMATION_RATE;
  }
  return encounter.segmentPlaybackRate;
}

function getEncounterPlaybackThresholdMs(baseMs: number, encounter: ActiveContractEncounterState): number {
  return (baseMs * encounter.segmentPlaybackRate) / getEncounterAnimationRate(encounter);
}

function getDisplayedEncounterTurn(encounter: ActiveContractEncounterState): number | null {
  if (encounter.phase !== "combat") {
    return null;
  }

  if (encounter.activeAction) {
    return encounter.activeAction.turnIndex;
  }

  const currentEvent = encounter.timeline[encounter.currentEventIndex] ?? null;
  if (currentEvent?.type === "CombatPlaybackActionResolved") {
    return currentEvent.turnIndex;
  }

  for (let index = encounter.currentEventIndex - 1; index >= 0; index -= 1) {
    const event = encounter.timeline[index];
    if (event?.type === "CombatPlaybackActionResolved") {
      return event.turnIndex;
    }
  }

  for (let index = encounter.currentEventIndex + 1; index < encounter.timeline.length; index += 1) {
    const event = encounter.timeline[index];
    if (event?.type === "CombatPlaybackActionResolved") {
      return event.turnIndex;
    }
  }

  return null;
}

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
    case "encyclopedia":
      return (
        <svg {...iconProps}>
          <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4z" />
          <path d="M7 8h8M7 12h8M7 16h6" />
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
  return i18n.t(`class.${playerClass}`);
}

function formatRarityLabel(rarity: Rarity): string {
  return i18n.t(`rarity.${rarity}`);
}

function formatArchetypeLabel(value: string): string {
  const translated = i18n.t(`archetype.${value}`);
  if (translated && translated !== `archetype.${value}`) {
    return translated;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTokenLabel(value: unknown): string {
  const normalized = typeof value === "string" ? value : String(value ?? "");
  if (!normalized) {
    return i18n.t("item.unknown");
  }
  const cleaned = normalized.trim();
  if (!cleaned) {
    return i18n.t("item.unknown");
  }
  return cleaned
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMenuLabel(tab: LandingTab): string {
  return i18n.t(`menu.${tab}`);
}

function formatEquipmentSlotLabel(slotId: EquipmentSlotId): string {
  return i18n.t(EQUIPMENT_SLOTS[slotId].labelKey);
}

function formatChatChannelLabel(channel: ChatChannel): string {
  return i18n.t(CHAT_CHANNEL_LABEL_KEYS[channel]);
}

function sanitizeEncyclopediaItem(raw: GeneratedEncyclopediaItem): GeneratedEncyclopediaItem {
  return {
    key: typeof raw.key === "string" && raw.key.length > 0 ? raw.key : `unknown:${Math.random().toString(36).slice(2)}`,
    contentId:
      typeof raw.contentId === "string" && raw.contentId.length > 0
        ? raw.contentId
        : `unknown:${Math.random().toString(36).slice(2)}`,
    majorCategory: typeof raw.majorCategory === "string" ? raw.majorCategory : "unknown",
    archetype: typeof raw.archetype === "string" ? raw.archetype : "unknown",
    family: typeof raw.family === "string" ? raw.family : "unknown",
    familyId: typeof raw.familyId === "string" ? raw.familyId : "",
    slotFamily: typeof raw.slotFamily === "string" ? raw.slotFamily : "unknown",
    itemType: typeof raw.itemType === "string" ? raw.itemType : i18n.t("item.unknown"),
    itemName: typeof raw.itemName === "string" ? raw.itemName : i18n.t("item.missingItem"),
    flavorText: typeof raw.flavorText === "string" ? raw.flavorText : "",
    baseLevel: Number.isFinite(raw.baseLevel) ? raw.baseLevel : 0,
    dropMinLevel: Number.isFinite(raw.dropMinLevel) ? raw.dropMinLevel : 0,
    dropMaxLevel: Number.isFinite(raw.dropMaxLevel) ? raw.dropMaxLevel : 0,
    iconPath: typeof raw.iconPath === "string" ? raw.iconPath : null,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : "unknown",
    sequence: Number.isFinite(raw.sequence) ? raw.sequence : 0,
    locationName: typeof raw.locationName === "string" ? raw.locationName : "",
    isBoss: raw.isBoss === true,
    bossKind: typeof raw.bossKind === "string" ? raw.bossKind : "",
  };
}

function normalizeEncyclopediaItems(input: GeneratedEncyclopediaItem[]): GeneratedEncyclopediaItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => sanitizeEncyclopediaItem(item));
}

function getItemSubtypeLabel(item: InventoryItem): string {
  const majorCategory = item.archetype?.majorCategory;
  if (majorCategory === "armor" && item.archetype?.armorArchetype) {
    return `${formatArchetypeLabel(item.archetype.armorArchetype)} ${i18n.t("profile.armor")}`;
  }
  if (majorCategory === "weapon" && item.archetype?.weaponArchetype) {
    return `${formatArchetypeLabel(item.archetype.weaponArchetype)} ${i18n.t("slots.weapon")}`;
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
    damageLine: i18n.t("item.damage", { value: formatOneDecimal(averageDamage) }),
    rollLine: i18n.t("item.roll", {
      minLow: minRollRange[0],
      minHigh: minRollRange[1],
      rolledMin,
      rolledMax,
      maxLow: maxRollRange[0],
      maxHigh: maxRollRange[1]
    })
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
  const useImageOnlyIcon = Boolean(item.iconAssetPath);

  return (
    <>
      <div className="inventoryCardTop">
        <div className="inventoryCardMeta">
          <h4>{renderItemDisplayName(item)}</h4>
          <p className="inventoryCardCategory">{subtypeLabel}</p>
        </div>
        <span className="inventoryCardRarity">{formatRarityLabel(item.rarity)}</span>
      </div>
      <div className="inventoryCardVisual">
        {renderItemIcon({
          majorCategory: item.archetype?.majorCategory,
          category: item.category,
          itemName: displayItemName,
          iconAssetPath: item.iconAssetPath,
          className: useImageOnlyIcon ? undefined : `inventoryCardIcon${canUseItem ? "" : " isRestricted"}`,
          renderMode: useImageOnlyIcon ? "imageOnly" : "default"
        })}
      </div>
      <div className="inventoryCardContent">
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
                  {localizeKnownLabel(line.label)} {line.value}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="inventoryCardDetails">
        <p className="inventoryCardDescription inventoryCardFlavor">{item.description}</p>
        <div className="inventoryCardFooter">
          <span className="inventoryCardPower">{i18n.t("inventory.power", { value: item.power })}</span>
          <span className="inventoryCardLevel">{i18n.t("inventory.requiredLevel", { value: item.levelRequirement })}</span>
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
  renderMode?: "default" | "imageOnly";
}): ReactElement {
  const iconVisual = resolveItemIconVisual(args);
  if (args.iconAssetPath && args.renderMode === "imageOnly") {
    return <img className="itemVisualImage itemVisualImageCard" src={args.iconAssetPath} alt="" loading="lazy" />;
  }
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
  return i18n.t("profile.namePattern", { id: idSuffix });
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
  return i18n.t("profile.derivedFlat", { value: formatOneDecimal(value) });
}

function formatDerivedPercent(value: number): string {
  return i18n.t("profile.derivedPercent", { value: formatOneDecimal(value) });
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
          label: mainOffenseStat === "strength" ? i18n.t("profile.mainDamage") : i18n.t("profile.meleeDamage"),
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: i18n.t("profile.armor"),
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "intelligence":
      return [
        {
          label:
            mainOffenseStat === "intelligence" ? i18n.t("profile.mainDamage") : i18n.t("profile.spellDamage"),
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: i18n.t("profile.spellShield"),
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "dexterity":
      return [
        {
          label: mainOffenseStat === "dexterity" ? i18n.t("profile.mainDamage") : i18n.t("profile.rangedDamage"),
          ratioLabel: formatPercentRatio(mainStatToFlatDamageRatio),
          valueLabel: formatDerivedFlat(statValue * mainStatToFlatDamageRatio)
        },
        {
          label: i18n.t("profile.missileResistance"),
          ratioLabel: formatPercentRatio(MAIN_STAT_DEFENSE_RATIO),
          valueLabel: formatDerivedFlat(statValue * MAIN_STAT_DEFENSE_RATIO)
        }
      ];
    case "luck":
      return [
        {
          label: i18n.t("profile.critChance"),
          ratioLabel: `${formatOneDecimal(LUCK_CRIT_CHANCE_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * LUCK_CRIT_CHANCE_PERCENT_PER_POINT)
        },
        {
          label: i18n.t("profile.critDamage"),
          ratioLabel: `${formatOneDecimal(LUCK_CRIT_DAMAGE_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * LUCK_CRIT_DAMAGE_PERCENT_PER_POINT)
        }
      ];
    case "initiative":
      return [
        {
          label: i18n.t("profile.combatSpeed"),
          ratioLabel: `${formatOneDecimal(INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT)
        },
        {
          label: i18n.t("profile.extraAttackChance"),
          ratioLabel: `${formatOneDecimal(INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT)}%/pt`,
          valueLabel: formatDerivedPercent(statValue * INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT)
        }
      ];
    case "vitality":
      return [
        {
          label: i18n.t("profile.maxHitpoints"),
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
  useTranslation();
  const initialContractSlots = useMemo(() => createContractSlots(Date.now()), []);
  const landingPageRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLElement | null>(null);
  const sidePanelScrollRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  const panelViewportGroupRef = useRef<HTMLDivElement | null>(null);
  const panelViewportMainRef = useRef<HTMLDivElement | null>(null);
  const panelViewportSideRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(() =>
    normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? i18n.resolvedLanguage ?? i18n.language)
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("inventory");
  const [encyclopediaCategory, setEncyclopediaCategory] = useState<EncyclopediaCategory>("armor");
  const [encyclopediaArmorArchetype, setEncyclopediaArmorArchetype] = useState<EncyclopediaArmorArchetype>("heavy");
  const [encyclopediaWeaponArchetype, setEncyclopediaWeaponArchetype] =
    useState<EncyclopediaWeaponArchetype>("melee");
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRepeatPassword, setAuthRepeatPassword] = useState("");
  const [authClass, setAuthClass] = useState<PlayerClass>("warrior");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(true); // assume true until we check
  const [verifyEmailMessage, setVerifyEmailMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountOverviewResponse | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    createMockInventoryItems().slice(0, INVENTORY_ITEM_LIMIT)
  );
  const [equippedItems, setEquippedItems] = useState<EquippedItems>(() => createEmptyEquippedItems());
  const [contractSlots, setContractSlots] = useState<ContractSlotState[]>(() => initialContractSlots);
  const [activeContractEncounter, setActiveContractEncounter] = useState<ActiveContractEncounterState | null>(null);
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
  const [showOnlyWeapons, setShowOnlyWeapons] = useState(false);
  const [showOnlyArmor, setShowOnlyArmor] = useState(false);
  const [showOnlyJewelry, setShowOnlyJewelry] = useState(false);
  const [showOnlyWearable, setShowOnlyWearable] = useState(false);
  const [powerSortDirection, setPowerSortDirection] = useState<"desc" | "asc">("asc");
  const [activeChatChannel, setActiveChatChannel] = useState<ChatChannel>("world");
  const [chatMessagesByChannel, setChatMessagesByChannel] = useState<Record<ChatChannel, ChatMessage[]>>(() =>
    createInitialChatMessages()
  );
  const [chatDraft, setChatDraft] = useState("");
  const [canDockInventoryChat, setCanDockInventoryChat] = useState(false);
  const [isInventoryChatDockedVisible, setIsInventoryChatDockedVisible] = useState(true);
  const [isInventoryChatOverlayOpen, setIsInventoryChatOverlayOpen] = useState(false);
  const [baseStats, setBaseStats] = useState<Record<TrainableStatKey, number> | null>(null);
  const [currencies, setCurrencies] = useState<{ ducats: number; imperials: number } | null>(null);
  const [activeStatTraining, setActiveStatTraining] = useState<{
    stat: TrainableStatKey;
    completesAt: number;
  } | null>(null);
  const [activeCharacterVisualIndex, setActiveCharacterVisualIndex] = useState<number>(() => {
    const total = GENERATED_CHARACTER_VISUALS.length;
    if (total === 0) {
      return -1;
    }
    return Math.floor(Math.random() * total);
  });
  const [isSavingLocale, setIsSavingLocale] = useState(false);
  const [localeStatusMessage, setLocaleStatusMessage] = useState<string | null>(null);

  const profileName = accountInfo?.username ?? (playerState ? getDisplayName(playerState) : i18n.t("profile.defaultName"));
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
  const activeInventoryCategoryFilters = useMemo<InventoryCategoryFilter[]>(() => {
    const filters: InventoryCategoryFilter[] = [];
    if (showOnlyWeapons) {
      filters.push("weapon");
    }
    if (showOnlyArmor) {
      filters.push("armor");
    }
    if (showOnlyJewelry) {
      filters.push("jewelry");
    }
    return filters;
  }, [showOnlyArmor, showOnlyJewelry, showOnlyWeapons]);
  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (showOnlyWearable && !item.equipable) {
        return false;
      }
      if (activeInventoryCategoryFilters.length === 0) {
        return true;
      }
      const category = item.archetype?.majorCategory;
      if (!category) {
        return false;
      }
      return activeInventoryCategoryFilters.includes(category as InventoryCategoryFilter);
    });
  }, [activeInventoryCategoryFilters, inventoryItems, showOnlyWearable]);
  const activeChatMessages = chatMessagesByChannel[activeChatChannel];
  const isInventoryChatVisible = canDockInventoryChat ? isInventoryChatDockedVisible : isInventoryChatOverlayOpen;
  const activeCharacterVisual =
    activeCharacterVisualIndex >= 0 ? GENERATED_CHARACTER_VISUALS[activeCharacterVisualIndex] ?? null : null;
  const activeCharacterVisualPath =
    activeCharacterVisual?.path ?? null;
  const activeCharacterVisualName = activeCharacterVisual?.assetName ?? null;
  const canCycleCharacterVisuals = GENERATED_CHARACTER_VISUALS.length > 1;

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

  // Check for reset password token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    if (token) {
      setResetToken(token);
    }
    // Check for email verification token
    const verifyToken = params.get("verifyToken");
    if (verifyToken && !token) {
      (async () => {
        try {
          const response = await verifyEmail({ token: verifyToken });
          setVerifyEmailMessage(response.message);
          // Remove token from URL after verification
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err: unknown) {
          setVerifyEmailMessage(err instanceof Error ? err.message : "Email verification failed");
        }
      })();
    }
  }, []);

  useEffect(() => {
    setLocale(preferredLocale);
  }, [preferredLocale]);

  useEffect(() => {
    if (activeTab !== "inventory") {
      setDraggingInventoryCardId(null);
      setDraggingEquipmentSlotId(null);
      setDropTargetInventoryCardId(null);
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
      setInventoryComparisonHover(null);
      setCanDockInventoryChat(false);
      setIsInventoryChatOverlayOpen(false);
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
    if (activeTab !== "inventory") {
      return;
    }

    const recalculateChatDocking = () => {
      if (layoutMode === "compact") {
        setCanDockInventoryChat(false);
        return;
      }

      const landingPage = landingPageRef.current;
      const leftPanel = leftPanelRef.current;
      const panelGroup = panelViewportGroupRef.current;
      const mainPanel = panelViewportMainRef.current;
      const sidePanel = panelViewportSideRef.current;
      if (!landingPage || !leftPanel || !panelGroup || !mainPanel || !sidePanel) {
        setCanDockInventoryChat(false);
        return;
      }

      const landingPageWidth = landingPage.getBoundingClientRect().width;
      const leftPanelWidth = leftPanel.getBoundingClientRect().width;
      const landingPageStyle = window.getComputedStyle(landingPage);
      const landingColumnGap = Number.parseFloat(landingPageStyle.columnGap || landingPageStyle.gap || "0") || 0;
      const availableRightPanelWidth = Math.max(0, landingPageWidth - leftPanelWidth - landingColumnGap);
      const mainPanelWidth = mainPanel.getBoundingClientRect().width;
      const sidePanelWidth = sidePanel.getBoundingClientRect().width;
      const groupStyle = window.getComputedStyle(panelGroup);
      const groupColumnGap = Number.parseFloat(groupStyle.columnGap || groupStyle.gap || "0") || 0;
      const requiredWidth = mainPanelWidth + sidePanelWidth * 2 + groupColumnGap * 2;
      setCanDockInventoryChat(availableRightPanelWidth + CHAT_DOCK_TOLERANCE_PX >= requiredWidth);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => recalculateChatDocking()) : null;
    if (resizeObserver) {
      if (landingPageRef.current) {
        resizeObserver.observe(landingPageRef.current);
      }
      if (leftPanelRef.current) {
        resizeObserver.observe(leftPanelRef.current);
      }
      if (rightPanelRef.current) {
        resizeObserver.observe(rightPanelRef.current);
      }
      if (panelViewportGroupRef.current) {
        resizeObserver.observe(panelViewportGroupRef.current);
      }
      if (panelViewportMainRef.current) {
        resizeObserver.observe(panelViewportMainRef.current);
      }
      if (panelViewportSideRef.current) {
        resizeObserver.observe(panelViewportSideRef.current);
      }
    }

    const rafId = window.requestAnimationFrame(recalculateChatDocking);
    window.addEventListener("resize", recalculateChatDocking);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalculateChatDocking);
      resizeObserver?.disconnect();
    };
  }, [activeTab, layoutMode]);

  useEffect(() => {
    if (canDockInventoryChat) {
      setIsInventoryChatOverlayOpen(false);
    }
  }, [canDockInventoryChat]);

  useEffect(() => {
    const scrollContainer = chatMessagesScrollRef.current;
    if (!scrollContainer) {
      return;
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [activeChatChannel, activeChatMessages.length]);

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
          const resolvedLocale = normalizeLocale(state.preferredLocale);
          setPreferredLocale(resolvedLocale);
          setLocaleStatusMessage(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setPlayerState(null);
          setError(err instanceof Error ? err.message : i18n.t("errors.stateLoadFailed"));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingState(false);
        }
      });

    // Fetch account info
    void getAccountOverview(token)
      .then((info) => {
        if (active) {
          setAccountInfo(info);
          setEmailVerified(info.emailVerified);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          console.error("Failed to fetch account info:", err);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    // Clear form fields when switching between login and register
    setAuthEmail("");
    setAuthPassword("");
    setAuthRepeatPassword("");
    setAuthUsername("");
    setShowPassword(false);
    setShowRepeatPassword(false);
    setError(null);
  }, [authMode]);

  useEffect(() => {
    if (!playerState) {
      setBaseStats(null);
      setCurrencies(null);
      setActiveStatTraining(null);
      return;
    }

    setChatMessagesByChannel(createInitialChatMessages());
    setActiveChatChannel("world");
    setChatDraft("");
    setIsInventoryChatDockedVisible(true);
    setIsInventoryChatOverlayOpen(false);

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
    setActiveContractEncounter(null);
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
    if (!activeContractEncounter || activeContractEncounter.phase !== "travel" || activeContractEncounter.travelEndsAt === null) {
      return;
    }
    if (nowMs < activeContractEncounter.travelEndsAt) {
      return;
    }
    setActiveContractEncounter((previousEncounter) => {
      if (!previousEncounter || previousEncounter.phase !== "travel") {
        return previousEncounter;
      }
      return {
        ...previousEncounter,
        phase: "combat",
        travelEndsAt: null,
        segmentPlaybackRate: previousEncounter.playbackRate,
        playbackProgressMs: 0,
        lastPlaybackTickAtMs: null
      };
    });
  }, [activeContractEncounter?.phase, activeContractEncounter?.travelEndsAt, nowMs]);

  useEffect(() => {
    if (!activeContractEncounter || activeContractEncounter.phase !== "combat") {
      return;
    }
    if (activeContractEncounter.resolutionState === "awaiting_return") {
      return;
    }

    const nowMs = Date.now();

    if (activeContractEncounter.lastPlaybackTickAtMs === null) {
      setActiveContractEncounter((previousEncounter) => {
        if (!previousEncounter || previousEncounter.phase !== "combat" || previousEncounter.lastPlaybackTickAtMs !== null) {
          return previousEncounter;
        }
        return {
          ...previousEncounter,
          segmentPlaybackRate: previousEncounter.playbackRate,
          lastPlaybackTickAtMs: nowMs
        };
      });
      return;
    }

    const effectiveProgressMs = getEncounterPlaybackProgress(activeContractEncounter, nowMs);

    if (activeContractEncounter.resolutionState === "summarizing") {
      if (activeContractEncounter.finalSummaryLine === null) {
        return;
      }

      const typedLength = Math.min(
        activeContractEncounter.finalSummaryLine.length,
        Math.floor(effectiveProgressMs / COMBAT_SUMMARY_TYPE_DELAY_MS)
      );
      const nextTypedSummaryLine = activeContractEncounter.finalSummaryLine.slice(0, typedLength);

      if (nextTypedSummaryLine !== activeContractEncounter.typedSummaryLine) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.resolutionState !== "summarizing" ||
            previousEncounter.finalSummaryLine === null
          ) {
            return previousEncounter;
          }

          const snapshot = snapshotEncounterPlayback(previousEncounter);
          const finalSummaryLine = snapshot.finalSummaryLine;
          if (finalSummaryLine === null) {
            return snapshot;
          }
          const snapshotTypedLength = Math.min(
            finalSummaryLine.length,
            Math.floor(snapshot.playbackProgressMs / COMBAT_SUMMARY_TYPE_DELAY_MS)
          );

          return {
            ...snapshot,
            typedSummaryLine: finalSummaryLine.slice(0, snapshotTypedLength)
          };
        });
        return;
      }

      if (typedLength >= activeContractEncounter.finalSummaryLine.length) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.resolutionState !== "summarizing"
          ) {
            return previousEncounter;
          }
          return {
            ...snapshotEncounterPlayback(previousEncounter),
            resolutionState: "awaiting_return"
          };
        });
        return;
      }

      const nextCharacterThresholdMs = (typedLength + 1) * COMBAT_SUMMARY_TYPE_DELAY_MS;
      const remainingRealMs = Math.max(
        0,
        (nextCharacterThresholdMs - effectiveProgressMs) / activeContractEncounter.segmentPlaybackRate
      );
      const summaryTimer = window.setTimeout(() => {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.resolutionState !== "summarizing"
          ) {
            return previousEncounter;
          }
          return snapshotEncounterPlayback(previousEncounter);
        });
      }, remainingRealMs);

      return () => {
        window.clearTimeout(summaryTimer);
      };
    }

    const currentEvent = activeContractEncounter.timeline[activeContractEncounter.currentEventIndex] ?? null;
    if (!currentEvent) {
      return;
    }

    if (currentEvent.type === "CombatPlaybackStarted") {
      if (effectiveProgressMs >= COMBAT_PLAYBACK_START_DELAY_MS) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted"
          ) {
            return previousEncounter;
          }
          return {
            ...previousEncounter,
            currentEventIndex: previousEncounter.currentEventIndex + 1,
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null
          };
        });
        return;
      }

      const startTimer = window.setTimeout(() => {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted"
          ) {
            return previousEncounter;
          }
          return snapshotEncounterPlayback(previousEncounter);
        });
      }, Math.max(0, (COMBAT_PLAYBACK_START_DELAY_MS - effectiveProgressMs) / activeContractEncounter.segmentPlaybackRate));

      return () => {
        window.clearTimeout(startTimer);
      };
    }

    if (currentEvent.type === "CombatPlaybackActionResolved") {
      const impactThresholdMs = getEncounterPlaybackThresholdMs(COMBAT_PLAYBACK_IMPACT_DELAY_MS, activeContractEncounter);
      const beatThresholdMs = getEncounterPlaybackThresholdMs(COMBAT_PLAYBACK_BEAT_MS, activeContractEncounter);

      if (activeContractEncounter.activeAction?.eventId !== currentEvent.eventId) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId
          ) {
            return previousEncounter;
          }
          return {
            ...snapshotEncounterPlayback(previousEncounter),
            segmentPlaybackRate: previousEncounter.playbackRate,
            activeAction: combatPlaybackActionResolvedSchema.parse(currentEvent),
            impactTargetId: null
          };
        });
        return;
      }

      const impactApplied =
        activeContractEncounter.impactTargetId === currentEvent.targetId &&
        activeContractEncounter.hpByActorId[currentEvent.targetId] === currentEvent.targetHpAfter &&
        activeContractEncounter.combatLogEntries.includes(currentEvent.logLine);

      if (!impactApplied && effectiveProgressMs >= impactThresholdMs) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId
          ) {
            return previousEncounter;
          }
          const snapshot = snapshotEncounterPlayback(previousEncounter);
          return {
            ...snapshot,
            hpByActorId: {
              ...snapshot.hpByActorId,
              [currentEvent.targetId]: currentEvent.targetHpAfter
            },
            combatLogEntries: snapshot.combatLogEntries.includes(currentEvent.logLine)
              ? snapshot.combatLogEntries
              : [...snapshot.combatLogEntries, currentEvent.logLine],
            impactTargetId: currentEvent.targetId
          };
        });
        return;
      }

      if (effectiveProgressMs >= beatThresholdMs) {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId
          ) {
            return previousEncounter;
          }
          return {
            ...previousEncounter,
            activeAction: null,
            impactTargetId: null,
            currentEventIndex: previousEncounter.currentEventIndex + 1,
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null
          };
        });
        return;
      }

      const nextThresholdMs = impactApplied ? beatThresholdMs : impactThresholdMs;
      const actionTimer = window.setTimeout(() => {
        setActiveContractEncounter((previousEncounter) => {
          if (
            !previousEncounter ||
            previousEncounter.phase !== "combat" ||
            previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId
          ) {
            return previousEncounter;
          }
          return snapshotEncounterPlayback(previousEncounter);
        });
      }, Math.max(0, (nextThresholdMs - effectiveProgressMs) / activeContractEncounter.segmentPlaybackRate));

      return () => {
        window.clearTimeout(actionTimer);
      };
    }

    if (effectiveProgressMs >= COMBAT_PLAYBACK_START_DELAY_MS) {
      setActiveContractEncounter((previousEncounter) => {
        if (
          !previousEncounter ||
          previousEncounter.phase !== "combat" ||
          previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackEnded"
        ) {
          return previousEncounter;
        }
        return {
          ...previousEncounter,
          activeAction: null,
          impactTargetId: null,
          currentEventIndex: previousEncounter.currentEventIndex + 1,
          segmentPlaybackRate: previousEncounter.playbackRate,
          resolutionState: "summarizing",
          finalSummaryLine: currentEvent.summaryLine,
          typedSummaryLine: "",
          playbackProgressMs: 0,
          lastPlaybackTickAtMs: null
        };
      });
      return;
    }

    const endTimer = window.setTimeout(() => {
      setActiveContractEncounter((previousEncounter) => {
        if (
          !previousEncounter ||
          previousEncounter.phase !== "combat" ||
          previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackEnded"
        ) {
          return previousEncounter;
        }
        return snapshotEncounterPlayback(previousEncounter);
      });
    }, Math.max(0, (COMBAT_PLAYBACK_START_DELAY_MS - effectiveProgressMs) / activeContractEncounter.segmentPlaybackRate));

    return () => {
      window.clearTimeout(endTimer);
    };
  }, [
    activeContractEncounter?.activeAction?.eventId,
    activeContractEncounter?.combatLogEntries.length,
    activeContractEncounter?.currentEventIndex,
    activeContractEncounter?.impactTargetId,
    activeContractEncounter?.lastPlaybackTickAtMs,
    activeContractEncounter?.phase,
    activeContractEncounter?.playbackProgressMs,
    activeContractEncounter?.playbackRate,
    activeContractEncounter?.resolutionState,
    activeContractEncounter?.typedSummaryLine
  ]);

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
      const loginResponse = await devGuestLogin();
      window.localStorage.setItem("ebonkeep.dev.token", loginResponse.accessToken);
      setActiveTab("inventory");
      setToken(loginResponse.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.loginFailed"));
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      
      // Validate passwords match
      if (authPassword !== authRepeatPassword) {
        setError("Passwords do not match");
        return;
      }
      
      const response = await register({
        username: authUsername,
        email: authEmail,
        password: authPassword,
        class: authClass
      });
      window.localStorage.setItem("ebonkeep.dev.token", response.accessToken);
      setActiveTab("inventory");
      setToken(response.accessToken);
      // Check email verification status
      try {
        const accountInfo = await getAccountOverview(response.accessToken);
        setEmailVerified(accountInfo.emailVerified);
        setAccountInfo(accountInfo);
      } catch {
        // Ignore if we can't fetch account info
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.registrationFailed"));
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const response = await login({
        email: authEmail,
        password: authPassword
      });
      window.localStorage.setItem("ebonkeep.dev.token", response.accessToken);
      setActiveTab("inventory");
      setToken(response.accessToken);
      // Check email verification status
      try {
        const accountInfo = await getAccountOverview(response.accessToken);
        setEmailVerified(accountInfo.emailVerified);
        setAccountInfo(accountInfo);
      } catch {
        // Ignore if we can't fetch account info
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.loginFailed"));
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    try {
      setForgotPasswordMessage(null);
      const response = await forgotPassword({
        email: forgotPasswordEmail
      });
      setForgotPasswordMessage(response.message);
    } catch (err: unknown) {
      setForgotPasswordMessage(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function handleResetPasswordForm(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetPasswordMessage("Passwords do not match");
      return;
    }
    if (!resetToken) {
      setResetPasswordMessage("Invalid reset token");
      return;
    }
    try {
      setResetPasswordMessage(null);
      const response = await resetPassword({
        token: resetToken,
        newPassword
      });
      setResetPasswordMessage(response.message);
      // Clear the form and token after 2 seconds, redirect to login
      setTimeout(() => {
        setResetToken(null);
        setNewPassword("");
        setConfirmPassword("");
        setResetPasswordMessage(null);
        // Remove the token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 2000);
    } catch (err: unknown) {
      setResetPasswordMessage(err instanceof Error ? err.message : "Password reset failed");
    }
  }

  async function handleResendVerification() {
    if (!token) return;
    try {
      const response = await resendVerificationEmail(token);
      alert(response.message || "Verification email sent!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to resend verification email");
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
    setActiveChatChannel("world");
    setChatMessagesByChannel(createInitialChatMessages());
    setChatDraft("");
    setCanDockInventoryChat(false);
    setIsInventoryChatDockedVisible(true);
    setIsInventoryChatOverlayOpen(false);
    setBaseStats(null);
    setCurrencies(null);
    setActiveStatTraining(null);
    setContractSlots(createContractSlots(Date.now()));
    setActiveContractEncounter(null);
  }

  async function handleLocaleChange(nextLocale: SupportedLocale) {
    if (nextLocale === preferredLocale) {
      return;
    }
    setPreferredLocale(nextLocale);
    setLocaleStatusMessage(null);

    if (!token) {
      return;
    }

    try {
      setIsSavingLocale(true);
      const payload = await updatePlayerPreferences(token, { preferredLocale: nextLocale });
      setPreferredLocale(normalizeLocale(payload.preferredLocale));
      setLocaleStatusMessage(i18n.t("settings.saveSuccess"));
    } catch {
      setLocaleStatusMessage(i18n.t("settings.saveFailed"));
    } finally {
      setIsSavingLocale(false);
    }
  }

  function startStatTraining(stat: TrainableStatKey) {
    if (!baseStats || !currencies) {
      return;
    }
    if (activeStatTraining) {
      setError(i18n.t("training.alreadyInProgress"));
      return;
    }

    const trainingCost = getTrainingCost(baseStats[stat]);
    if (currencies.ducats < trainingCost) {
      setError(i18n.t("training.notEnoughDucats"));
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
      return i18n.t("errors.itemCannotBeEquipped");
    }
    if (item.equipSlotId !== targetSlotId) {
      return i18n.t("errors.wrongSlot", { slotLabel: formatEquipmentSlotLabel(item.equipSlotId) });
    }

    if (!playerState) {
      return i18n.t("errors.playerStateUnavailable");
    }

    if (item.levelRequirement > playerState.level) {
      return i18n.t("errors.requiresLevel", { level: item.levelRequirement });
    }

    if (item.archetype) {
      const archetypeClassKey = item.archetype.weaponArchetype ?? item.archetype.armorArchetype;
      if (!isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey)) {
        return i18n.t("errors.classRestriction");
      }

      if (item.archetype.majorCategory === "vestige" && item.archetype.vestigeId) {
        const equippedVestigeIds = EQUIPMENT_VESTIGE_SLOTS
          .map((slotId) => equippedItems[slotId]?.archetype?.vestigeId)
          .filter((vestigeId): vestigeId is VestigeId => vestigeId !== undefined);
        if (
          equippedVestigeIds.includes(item.archetype.vestigeId) &&
          equippedItems[targetSlotId]?.archetype?.vestigeId !== item.archetype.vestigeId
        ) {
          return i18n.t("errors.duplicateVestige");
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
      setError(i18n.t("errors.inventoryFullSwap"));
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
      setError(i18n.t("errors.inventoryFullUnequip"));
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

  function toggleInventoryPowerSort() {
    const nextDirection = powerSortDirection === "asc" ? "desc" : "asc";
    setPowerSortDirection(nextDirection);
    setInventoryItems((previousItems) =>
      [...previousItems].sort((firstItem, secondItem) =>
        nextDirection === "desc"
          ? secondItem.power - firstItem.power
          : firstItem.power - secondItem.power
      )
    );
  }

  function toggleExclusiveInventoryCategoryFilter(filter: InventoryCategoryFilter) {
    const isCurrentlyActive =
      filter === "weapon" ? showOnlyWeapons : filter === "armor" ? showOnlyArmor : showOnlyJewelry;
    const nextActive = !isCurrentlyActive;

    setShowOnlyWeapons(filter === "weapon" ? nextActive : false);
    setShowOnlyArmor(filter === "armor" ? nextActive : false);
    setShowOnlyJewelry(filter === "jewelry" ? nextActive : false);
  }

  function openInventoryChat() {
    if (canDockInventoryChat) {
      setIsInventoryChatDockedVisible(true);
      return;
    }
    setIsInventoryChatOverlayOpen(true);
  }

  function closeInventoryChat() {
    if (canDockInventoryChat) {
      setIsInventoryChatDockedVisible(false);
      return;
    }
    setIsInventoryChatOverlayOpen(false);
  }

  function sendChatMessage() {
    const trimmedMessage = chatDraft.trim();
    if (!trimmedMessage) {
      return;
    }

    const sentAtMs = Date.now();
    const nextMessage: ChatMessage = {
      id: `${activeChatChannel}-${sentAtMs}-${Math.floor(Math.random() * 10000)}`,
      channel: activeChatChannel,
      sender: profileName,
      text: trimmedMessage,
      sentAtMs
    };

    setChatMessagesByChannel((previousMessages) => ({
      ...previousMessages,
      [activeChatChannel]: [...previousMessages[activeChatChannel], nextMessage]
    }));
    setChatDraft("");
  }

  function handleChatComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendChatMessage();
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
    const validationError = sourceItem ? getEquipValidationError(sourceItem, targetSlotId) : i18n.t("errors.invalidItem");
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
      if (filteredInventoryItems.length === 0) {
        unequipItemToInventory(payload.slotId);
        clearDragState();
        return;
      }

      const containerRect = event.currentTarget.getBoundingClientRect();
      const insertAtEnd = event.clientY >= containerRect.top + containerRect.height / 2;
      const targetItemId = insertAtEnd
        ? filteredInventoryItems[filteredInventoryItems.length - 1].id
        : filteredInventoryItems[0].id;
      const fallbackPosition: InventoryInsertPosition = insertAtEnd ? "after" : "before";
      const resolvedPosition =
        dropTargetInventoryCardId !== null ? dropInsertPosition : fallbackPosition;
      unequipItemToInventory(payload.slotId, targetItemId, resolvedPosition);
      clearDragState();
      return;
    }

    if (filteredInventoryItems.length === 0) {
      clearDragState();
      return;
    }

    const containerRect = event.currentTarget.getBoundingClientRect();
    const insertAtEnd = event.clientY >= containerRect.top + containerRect.height / 2;
    const targetItem = insertAtEnd
      ? filteredInventoryItems[filteredInventoryItems.length - 1]
      : filteredInventoryItems[0];
    const fallbackPosition: InventoryInsertPosition = insertAtEnd ? "after" : "before";
    const resolvedPosition =
      dropTargetInventoryCardId !== null ? dropInsertPosition : fallbackPosition;

    reorderInventoryItems(payload.itemId, targetItem.id, resolvedPosition);
    clearDragState();
  }

  function formatContractDifficulty(difficulty: ContractDifficulty): string {
    return i18n.t(`contracts.difficulty${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`);
  }

  function formatContractRoll(roll: ContractRoll): string {
    return i18n.t(`contracts.roll${roll.charAt(0).toUpperCase()}${roll.slice(1)}`);
  }

  function startContractEncounter(slotIndex: number, offer: ContractOffer) {
    setActiveContractEncounter(
      buildMockCombatEncounterState({
        offer,
        slotIndex,
        playerName: profileName,
        playerAvatarPath: activeCharacterVisualPath,
        nowMs: Date.now()
      })
    );
  }

  function returnToContractsBoard() {
    setActiveContractEncounter(null);
  }

  function replayContractEncounter() {
    setActiveContractEncounter((previousEncounter) => {
      if (!previousEncounter || previousEncounter.phase !== "combat") {
        return previousEncounter;
      }
      return resetCombatEncounterPlayback(previousEncounter);
    });
  }

  function toggleCombatFastForward() {
    setActiveContractEncounter((previousEncounter) => {
      if (!previousEncounter || previousEncounter.phase !== "combat") {
        return previousEncounter;
      }
      const toggledAtMs = Date.now();
      return {
        ...snapshotEncounterPlayback(previousEncounter, toggledAtMs),
        playbackRate: previousEncounter.playbackRate === 5 ? 1 : 5,
        lastPlaybackTickAtMs: toggledAtMs
      };
    });
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

  function handleContractRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    slotIndex: number,
    offer: ContractOffer
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    startContractEncounter(slotIndex, offer);
  }

  function renderEquipmentSlotCell(
    slotId: EquipmentSlotId,
    extraClassName = "",
    tooltipPlacement: "left" | "right" | "top" = "right"
  ) {
    const slot = EQUIPMENT_SLOTS[slotId];
    const slotLabel = i18n.t(slot.labelKey);
    const equippedItem = equippedItems[slotId];
    const displayItemName = equippedItem ? getDisplayItemName(equippedItem) : null;
    const hasItem = equippedItem !== null;
    const useImageOnlyIcon = Boolean(equippedItem?.iconAssetPath);
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
        aria-label={hasItem ? `${slotLabel}: ${displayItemName}` : `${slotLabel}: ${i18n.t("item.empty")}`}
      >
        {hasItem ? (
          <div className="inventoryCardVisual equipmentSlotVisual">
            {renderItemIcon({
              majorCategory: equippedItem?.archetype?.majorCategory ?? slot.majorCategory,
              category: equippedItem?.category ?? slotLabel,
              itemName: displayItemName ?? slotLabel,
              iconAssetPath: equippedItem?.iconAssetPath,
              className: useImageOnlyIcon ? undefined : "equipmentItemIcon",
              renderMode: useImageOnlyIcon ? "imageOnly" : "default"
            })}
            {equippedItem && useImageOnlyIcon ? (
              <span className="equipmentSlotPower" aria-hidden="true">
                {equippedItem.power}
              </span>
            ) : null}
          </div>
        ) : null}
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
              <h2>{i18n.t("menu.inventory")}</h2>
              <p>{i18n.t("inventory.loading")}</p>
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
              <h2>{i18n.t("menu.inventory")}</h2>
              <p>{i18n.t("inventory.unavailable")}</p>
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
    const mainStatColumns: Array<{ key: TrainableStatKey; label: string; iconPath: string }> = [
      { key: "strength", label: "STR", iconPath: "M6.2 17c-1.2 0-2.2-1-2.2-2.2V10h1.9V7.8a1 1 0 112 0V10h.8V7.2a1 1 0 112 0V10h.8V7.5a1 1 0 112 0V10h.7a2 2 0 012 2v2.8c0 1.2-1 2.2-2.2 2.2H6.2z" },
      { key: "intelligence", label: "INT", iconPath: "M4 4h5a3 3 0 013 3v9a3 3 0 00-3-3H4V4zm12 0h-5a3 3 0 00-3 3v9a3 3 0 013-3h5V4z" },
      { key: "dexterity", label: "DEX", iconPath: "M4 5h5l1 4h4l2 3H4V5zm0 8h13v2H4v-2z" },
      { key: "vitality", label: "VIT", iconPath: "M10 17l-1.4-1.2C5 12.6 3 10.8 3 8.5 3 6.6 4.6 5 6.5 5c1.1 0 2.2.5 2.9 1.4.7-.9 1.8-1.4 2.9-1.4C14.4 5 16 6.6 16 8.5c0 2.3-2 4.1-5.6 7.3L10 17zM9 7h2v2h2v2h-2v2H9v-2H7V9h2V7z" },
      { key: "initiative", label: "INI", iconPath: "M9 2l-5 9h4l-1 7 8-11h-4l1-5H9z" },
      { key: "luck", label: "LCK", iconPath: "M5 4h10a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm2 2a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zM10 9a1 1 0 100 2 1 1 0 000-2zm-3 3a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z" }
    ];

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{i18n.t("menu.inventory")}</h2>
          </article>

          <article className="contentCard">
            <div className="equipmentBoard">
              <div className="equipmentColumn equipmentColumnLeft">
                {EQUIPMENT_LEFT_SLOTS.map((slotId) => renderEquipmentSlotCell(slotId, "", "right"))}
              </div>

              <div className="equipmentCenterColumn">
                <div className="characterVisual">
                  <div className="characterVisualFrame">
                    {activeCharacterVisualPath ? (
                      <img
                        src={activeCharacterVisualPath}
                        alt={`${activeCharacterVisualName ?? profileName} ${i18n.t("profile.portraitSuffix")}`}
                        className="characterVisualImage"
                        draggable={false}
                      />
                    ) : (
                      <div className="characterSilhouette" aria-hidden="true" />
                    )}
                    {canCycleCharacterVisuals ? (
                      <>
                        <button
                          type="button"
                          className="characterCycleButton characterCycleButtonPrev"
                          onClick={() => {
                            setActiveCharacterVisualIndex((currentIndex) => {
                              const total = GENERATED_CHARACTER_VISUALS.length;
                              if (total === 0) {
                                return -1;
                              }
                              const safeIndex = currentIndex >= 0 ? currentIndex : 0;
                              return (safeIndex - 1 + total) % total;
                            });
                          }}
                          aria-label={i18n.t("profile.showPreviousPortrait")}
                        >
                          <span aria-hidden="true">{"<"}</span>
                        </button>
                        <button
                          type="button"
                          className="characterCycleButton characterCycleButtonNext"
                          onClick={() => {
                            setActiveCharacterVisualIndex((currentIndex) => {
                              const total = GENERATED_CHARACTER_VISUALS.length;
                              if (total === 0) {
                                return -1;
                              }
                              const safeIndex = currentIndex >= 0 ? currentIndex : 0;
                              return (safeIndex + 1) % total;
                            });
                          }}
                          aria-label={i18n.t("profile.showNextPortrait")}
                        >
                          <span aria-hidden="true">{">"}</span>
                        </button>
                      </>
                    ) : null}
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
                <span>{i18n.t("currencies.ducats")}</span>
                <strong>{effectiveCurrencies.ducats}</strong>
              </div>
              <div className="economyItem">
                <span className="currencyIcon imperialIcon" aria-hidden="true">
                  ◇
                </span>
                <span>{i18n.t("currencies.imperials")}</span>
                <strong>{effectiveCurrencies.imperials}</strong>
              </div>
              <div className="economyItem">
                <span className="currencyIcon gearScoreIcon" aria-hidden="true">
                  ⛨
                </span>
                <span>{i18n.t("currencies.gearScore")}</span>
                <strong>{playerState.gearScore}</strong>
              </div>
            </div>

            <div className="mainStatsTraining">
              <div className="statTrainingColumns">
                {mainStatColumns.map((statColumn, statIndex) => {
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

                  const statTooltipAnchorClass =
                    statIndex === 0
                      ? "statTrainingTooltipAnchorStart"
                      : statIndex === mainStatColumns.length - 1
                        ? "statTrainingTooltipAnchorEnd"
                        : "";

                  return (
                    <div key={statColumn.key} className="statTrainingColumn">
                      <span className="statTrainingSymbol" aria-hidden="true">
                        <svg viewBox="0 0 20 20" focusable="false">
                          <path d={statColumn.iconPath} />
                        </svg>
                      </span>
                      <span className="statTrainingLabel">{statColumn.label}</span>
                      <div
                        className={`statTrainingTooltip${statTooltipAnchorClass ? ` ${statTooltipAnchorClass}` : ""}`}
                        role="tooltip"
                      >
                        <p className="statTrainingTooltipTitle">{i18n.t("training.derivedContributions")}</p>
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
                          {isTrainingThisStat
                            ? i18n.t("training.training")
                            : isTrainingAnyStat
                              ? i18n.t("training.busy")
                              : i18n.t("training.train")}
                        </button>
                        {isTrainingThisStat ? (
                          <>
                            <div
                              className="statTrainingProgressTrack"
                              role="progressbar"
                              aria-label={i18n.t("training.progressAria", { stat: statColumn.label })}
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
      return <p>{i18n.t("inventory.noItems")}</p>;
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
              <h2>{i18n.t("profile.panel")}</h2>
              <p>{i18n.t("profile.loading")}</p>
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
              <h2>{i18n.t("profile.panel")}</h2>
              <p>{i18n.t("inventory.unavailable")}</p>
            </article>
          </section>
        </section>
      );
    }

    const unavailableLabel = i18n.t("profile.definedInDocs");
    const mainOffenseStat =
      playerState.class === "mage"
        ? playerState.stats.intelligence
        : playerState.class === "ranger"
          ? playerState.stats.dexterity
          : playerState.stats.strength;
    const mainOffenseTypeLabel =
      playerState.class === "mage"
        ? i18n.t("profile.spellDamage")
        : playerState.class === "ranger"
          ? i18n.t("profile.rangedAttackDamage")
          : i18n.t("profile.meleeDamage");
    const flatBonusDamage = (mainOffenseStat * 0.1).toFixed(1);

    const groupedStats: Array<{
      title: string;
      rows: Array<{ label: string; value: string | number }>;
    }> = [
      {
        title: i18n.t("profile.defensive"),
        rows: [
          { label: i18n.t("profile.armor"), value: unavailableLabel },
          { label: i18n.t("profile.spellShield"), value: unavailableLabel },
          { label: i18n.t("profile.missileResistance"), value: unavailableLabel },
          { label: i18n.t("profile.maxHitpoints"), value: unavailableLabel }
        ]
      },
      {
        title: i18n.t("profile.offensive"),
        rows: [
          { label: mainOffenseTypeLabel, value: unavailableLabel },
          { label: i18n.t("profile.critChance"), value: unavailableLabel },
          { label: i18n.t("profile.critDamage"), value: unavailableLabel },
          { label: i18n.t("profile.combatSpeed"), value: unavailableLabel },
          { label: i18n.t("profile.chanceToExtraAttack"), value: unavailableLabel },
          { label: i18n.t("profile.flatBonusMainStat"), value: flatBonusDamage }
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
                {i18n.t("profile.inventoryTab")}
              </button>
              <button
                className={`profileSwitchButton${profileSideTab === "consumables" ? " active" : ""}`}
                onClick={() => setProfileSideTab("consumables")}
              >
                {i18n.t("profile.consumablesTab")}
              </button>
              <button
                className={`profileSwitchButton${profileSideTab === "stats" ? " active" : ""}`}
                onClick={() => setProfileSideTab("stats")}
              >
                {i18n.t("profile.statsTab")}
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
                  <div className="inventoryToolbarSticky">
                    <div className="inventoryControlsRow">
                      <div className="inventoryControlWithTooltip">
                        <button
                          type="button"
                          className="inventoryIconButton"
                          onClick={toggleInventoryPowerSort}
                          aria-label={i18n.t("inventory.sortByPower")}
                          aria-describedby="inventory-power-sort-tooltip"
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="M7 4L4 7h2v9h2V7h2L7 4zM13 16l3-3h-2V4h-2v9h-2l3 3z" />
                          </svg>
                        </button>
                        <div
                          id="inventory-power-sort-tooltip"
                          className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorStart"
                          role="tooltip"
                        >
                            <p className="uiHoverTooltipTitle">{i18n.t("inventory.sortItems")}</p>
                        </div>
                      </div>

                      <div className="inventoryFilterButtons">
                        <div className="inventoryControlWithTooltip">
                          <button
                            type="button"
                            className={`inventoryIconButton${showOnlyWeapons ? " active" : ""}`}
                            onClick={() => toggleExclusiveInventoryCategoryFilter("weapon")}
                            aria-label={i18n.t("inventory.filterWeaponsAria")}
                            aria-pressed={showOnlyWeapons}
                            aria-describedby="inventory-filter-weapons-tooltip"
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                              <path d="M4 16l4-4 2 2-4 4H4v-2zm8-9l1.5-1.5L16 8l-1.5 1.5L12 7zM10.5 8.5l1-1 1.5 1.5-1 1-1.5-1.5zM8 11l2-2 1.5 1.5-2 2L8 11z" />
                            </svg>
                          </button>
                          <div
                            id="inventory-filter-weapons-tooltip"
                            className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorEnd"
                            role="tooltip"
                          >
                            <p className="uiHoverTooltipTitle">{i18n.t("inventory.filterWeapons")}</p>
                          </div>
                        </div>
                        <div className="inventoryControlWithTooltip">
                          <button
                            type="button"
                            className={`inventoryIconButton${showOnlyArmor ? " active" : ""}`}
                            onClick={() => toggleExclusiveInventoryCategoryFilter("armor")}
                            aria-label={i18n.t("inventory.filterArmorAria")}
                            aria-pressed={showOnlyArmor}
                            aria-describedby="inventory-filter-armor-tooltip"
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                              <path d="M10 3l5 2v4c0 3.5-2.2 6-5 8-2.8-2-5-4.5-5-8V5l5-2zm0 2.2L7 6.3v2.6c0 2.4 1.4 4.3 3 5.8 1.6-1.5 3-3.4 3-5.8V6.3l-3-1.1z" />
                            </svg>
                          </button>
                          <div
                            id="inventory-filter-armor-tooltip"
                            className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorEnd"
                            role="tooltip"
                          >
                            <p className="uiHoverTooltipTitle">{i18n.t("inventory.filterArmor")}</p>
                          </div>
                        </div>
                        <div className="inventoryControlWithTooltip">
                          <button
                            type="button"
                            className={`inventoryIconButton${showOnlyJewelry ? " active" : ""}`}
                            onClick={() => toggleExclusiveInventoryCategoryFilter("jewelry")}
                            aria-label={i18n.t("inventory.filterJewelryAria")}
                            aria-pressed={showOnlyJewelry}
                            aria-describedby="inventory-filter-jewelry-tooltip"
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                              <path d="M10 5a5 5 0 105 5 5 5 0 00-5-5zm0 2a3 3 0 110 6 3 3 0 010-6zM4 4h3v2H4zM13 4h3v2h-3z" />
                            </svg>
                          </button>
                          <div
                            id="inventory-filter-jewelry-tooltip"
                            className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorEnd"
                            role="tooltip"
                          >
                            <p className="uiHoverTooltipTitle">{i18n.t("inventory.filterJewelry")}</p>
                          </div>
                        </div>
                        <div className="inventoryControlWithTooltip">
                          <button
                            type="button"
                            className={`inventoryIconButton${showOnlyWearable ? " active" : ""}`}
                            onClick={() => setShowOnlyWearable((previous) => !previous)}
                            aria-label={i18n.t("inventory.filterWearableAria")}
                            aria-pressed={showOnlyWearable}
                            aria-describedby="inventory-filter-wearable-tooltip"
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                              <path d="M7 3h6l2 3-2 2-1-1v9H8V7L7 8 5 6l2-3z" />
                            </svg>
                          </button>
                          <div
                            id="inventory-filter-wearable-tooltip"
                            className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorEnd"
                            role="tooltip"
                          >
                            <p className="uiHoverTooltipTitle">{i18n.t("inventory.filterWearable")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="inventoryFilterSummary">
                      {i18n.t("inventory.summary", {
                        shown: filteredInventoryItems.length,
                        total: inventoryItems.length
                      })}
                    </p>
                  </div>
                  {renderInventoryCards(filteredInventoryItems, true)}
                </>
              ) : null}

              {profileSideTab === "consumables" ? (
                <>
                  <div className="inventoryHeader">
                    <h3>{i18n.t("inventory.consumables")}</h3>
                    <p>{i18n.t("inventory.itemCount", { count: consumableItems.length })}</p>
                  </div>
                  {renderInventoryCards(consumableItems, false)}
                </>
              ) : null}

              {profileSideTab === "stats" ? (
                <>
                  <div className="profileMeta">
                    <p>
                      {i18n.t("profile.class")}: <strong>{formatClassLabel(playerState.class)}</strong>
                    </p>
                    <p>
                      {i18n.t("profile.level")}: <strong>{playerState.level}</strong>
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

  function renderChatPanel() {
    return (
      <section className="contentShell statsViewportShell">
        <section className="contentStack statsViewportStack chatPanelStack">
          <article className="contentCard chatPanelTabsCard">
            <div className="chatPanelHeaderRow">
              <div className="chatChannelTabs" role="tablist" aria-label={i18n.t("chat.channels")}>
                {Object.keys(CHAT_CHANNEL_LABEL_KEYS).map((channel) => (
                  <button
                    key={channel}
                    className={`profileSwitchButton${activeChatChannel === channel ? " active" : ""}`}
                    onClick={() => setActiveChatChannel(channel as ChatChannel)}
                    role="tab"
                    aria-selected={activeChatChannel === channel}
                  >
                    {formatChatChannelLabel(channel as ChatChannel)}
                  </button>
                ))}
              </div>
              <button className="chatOverlayCloseButton" onClick={closeInventoryChat} aria-label={i18n.t("chat.close")}>
                x
              </button>
            </div>
          </article>

          <article className="contentCard statsViewportBody sidePanelBodyCard chatMessagesCard">
            <div className="chatMessagesScroll" ref={chatMessagesScrollRef}>
              {activeChatMessages.length > 0 ? (
                <ul className="chatMessageList">
                  {activeChatMessages.map((message) => (
                    <li key={message.id} className="chatMessageItem">
                      <p className="chatMessageMeta">
                        <strong>{message.sender}</strong>
                        <span>{formatChatTime(message.sentAtMs)}</span>
                      </p>
                      <p className="chatMessageText">{message.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="chatEmptyState">{i18n.t("chat.empty")}</p>
              )}
            </div>

            <form className="chatComposer" onSubmit={handleChatComposerSubmit}>
              <input
                type="text"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.currentTarget.value)}
                placeholder={i18n.t("chat.messagePlaceholder", {
                  channel: formatChatChannelLabel(activeChatChannel)
                })}
                maxLength={180}
              />
              <button type="submit" disabled={chatDraft.trim().length === 0}>
                {i18n.t("chat.send")}
              </button>
            </form>
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
              <h2>{i18n.t("menu.contracts")}</h2>
              <p>{i18n.t("contracts.loading")}</p>
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
              <h2>{i18n.t("menu.contracts")}</h2>
              <p>{i18n.t("inventory.unavailable")}</p>
            </article>
          </section>
        </section>
      );
    }

    if (activeContractEncounter && activeContractEncounter.phase !== "board") {
      return (
        <CombatEncounterPanel
          phase={activeContractEncounter.phase}
          encounter={activeContractEncounter.encounter}
          nowMs={nowMs}
          travelEndsAt={activeContractEncounter.travelEndsAt}
          travelDescription={activeContractEncounter.travelDescription}
          hpByActorId={activeContractEncounter.hpByActorId}
          combatLogEntries={activeContractEncounter.combatLogEntries}
          currentAction={activeContractEncounter.activeAction}
          currentTurnIndex={getDisplayedEncounterTurn(activeContractEncounter)}
          impactTargetId={activeContractEncounter.impactTargetId}
          resolutionState={activeContractEncounter.resolutionState}
          typedSummaryLine={activeContractEncounter.typedSummaryLine}
          playbackRate={getEncounterAnimationRate(activeContractEncounter)}
          isFastForwardEnabled={activeContractEncounter.playbackRate === 5}
          onToggleFastForward={toggleCombatFastForward}
          onReplayCombat={replayContractEncounter}
          onBackToBoard={returnToContractsBoard}
          formatContractDifficulty={formatContractDifficulty}
          formatDurationFromMs={formatDurationFromMs}
        />
      );
    }

    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <div className="contractsHeader">
              <h2>{i18n.t("menu.contracts")}</h2>
              <p>
                {i18n.t("contracts.available", {
                  available: availableContractSlots.length,
                  total: CONTRACT_SLOT_COUNT,
                  replenishing: replenishingContractSlots.length
                })}
              </p>
            </div>
            <p>{i18n.t("contracts.description")}</p>
          </article>

          <article className="contentCard">
            <div className="contractsTableWrap">
              <table className="contractsTable">
                <thead>
                  <tr>
                    <th>{i18n.t("contracts.table.contract")}</th>
                    <th>{i18n.t("contracts.table.difficulty")}</th>
                    <th>{i18n.t("contracts.table.experienceRoll")}</th>
                    <th>{i18n.t("contracts.table.ducatsRoll")}</th>
                    <th>{i18n.t("contracts.table.materialsRoll")}</th>
                    <th>{i18n.t("contracts.table.itemDropRoll")}</th>
                    <th>{i18n.t("contracts.table.staminaRoll")}</th>
                    <th>{i18n.t("contracts.table.expiresIn")}</th>
                    <th>{i18n.t("contracts.table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {contractSlots.map((slot) => {
                    if (!slot.offer) {
                      return (
                        <tr key={slot.slotIndex} className="contractsReplenishRow">
                          <td data-label={i18n.t("contracts.table.contract")}>
                            <div className="contractsNameCell">
                              <strong>{i18n.t("contracts.slot", { index: slot.slotIndex })}</strong>
                              <span>{i18n.t("contracts.replenishing")}</span>
                            </div>
                          </td>
                          <td data-label="Status" colSpan={8} className="contractsReplenishMessage">
                            {i18n.t("contracts.newIn", {
                              duration: slot.replenishReadyAt
                                ? formatDurationFromMs(slot.replenishReadyAt - nowMs)
                                : "00m 00s"
                            })}
                          </td>
                        </tr>
                      );
                    }

                    const { template, rollCue } = slot.offer;

                    return (
                      <tr
                        key={slot.slotIndex}
                        className="contractsActionRow"
                        tabIndex={0}
                        role="button"
                        aria-label={i18n.t("contracts.enterAria", {
                          contract: template.name,
                          difficulty: formatContractDifficulty(template.difficulty)
                        })}
                        onClick={() => startContractEncounter(slot.slotIndex, slot.offer as ContractOffer)}
                        onKeyDown={(event) =>
                          handleContractRowKeyDown(event, slot.slotIndex, slot.offer as ContractOffer)
                        }
                      >
                        <td data-label={i18n.t("contracts.table.contract")}>
                          <div className="contractsNameCell">
                            <strong>{template.name}</strong>
                            <span>{i18n.t("contracts.slot", { index: slot.slotIndex })}</span>
                          </div>
                        </td>
                        <td data-label={i18n.t("contracts.table.difficulty")}>
                          <span className={`contractDifficulty contractDifficulty-${template.difficulty}`}>
                            {formatContractDifficulty(template.difficulty)}
                          </span>
                        </td>
                        <td data-label={i18n.t("contracts.table.experienceRoll")}>{formatContractRoll(rollCue.experience)}</td>
                        <td data-label={i18n.t("contracts.table.ducatsRoll")}>{formatContractRoll(rollCue.ducats)}</td>
                        <td data-label={i18n.t("contracts.table.materialsRoll")}>{formatContractRoll(rollCue.materials)}</td>
                        <td data-label={i18n.t("contracts.table.itemDropRoll")}>{formatContractRoll(rollCue.itemDrop)}</td>
                        <td data-label={i18n.t("contracts.table.staminaRoll")}>{formatContractRoll(rollCue.staminaCost)}</td>
                        <td data-label={i18n.t("contracts.table.expiresIn")} className="contractsTimeCell">
                          {formatDurationFromMs(slot.offer.expiresAt - nowMs)}
                        </td>
                        <td data-label={i18n.t("contracts.table.action")}>
                          <button
                            className="contractAbandonButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              abandonContractSlot(slot.slotIndex);
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {i18n.t("contracts.abandon")}
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

  function renderSettingsPanel() {
    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{i18n.t("settings.title")}</h2>
            <p>{i18n.t("settings.description")}</p>
          </article>
          {accountInfo && (
            <article className="contentCard">
              <h3 style={{ marginTop: 0 }}>Account Information</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                  <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>Username</span>
                  <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "var(--text-main)" }}>{accountInfo.username || "Not set"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                  <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>Email</span>
                  <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "var(--text-main)" }}>{accountInfo.email || "Not set"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                  <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>Email Verified</span>
                  <span style={{ flex: "0 0 60%", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "bold", color: accountInfo.emailVerified ? "#6f8d5f" : "#97504a" }}>
                      {accountInfo.emailVerified ? "✓ Verified" : "✗ Not Verified"}
                    </span>
                    {!accountInfo.emailVerified && (
                      <button
                        onClick={handleResendVerification}
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          background: "var(--accent-focus)",
                          color: "var(--bg-stone)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "600"
                        }}
                      >
                        Resend Email
                      </button>
                    )}
                  </span>
                </div>
                {accountInfo.currency && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                      <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>Ducats</span>
                      <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "#be9651" }}>{accountInfo.currency.ducats.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
                      <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>Imperials</span>
                      <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "#9d7bb8" }}>{accountInfo.currency.imperials.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </article>
          )}
          <article className="contentCard">
            <div className="settingsRow">
              <label htmlFor="language-select">{i18n.t("settings.languageLabel")}</label>
              <select
                id="language-select"
                value={preferredLocale}
                onChange={(event) => void handleLocaleChange(normalizeLocale(event.currentTarget.value))}
                disabled={isSavingLocale}
              >
                {LOCALE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.nativeName}
                  </option>
                ))}
              </select>
            </div>
            {isSavingLocale ? <p>{i18n.t("settings.saving")}</p> : null}
            {localeStatusMessage ? <p>{localeStatusMessage}</p> : null}
          </article>
        </section>
      </section>
    );
  }

  function renderEncyclopediaItemCard(
    item: GeneratedEncyclopediaItem | null,
    fallbackLabel: string | null = null
  ): ReactElement {
    const isMonster = item?.majorCategory === "monster";
    const cardLabel = isMonster
      ? [item?.isBoss ? i18n.t("encyclopedia.boss") : formatTokenLabel(item?.slotFamily), formatTokenLabel(item?.itemType)]
          .filter((value) => typeof value === "string" && value.length > 0)
          .join(" • ")
      : formatTokenLabel(item?.slotFamily || item?.family || item?.itemType || fallbackLabel || "item");
    return (
      <article
        className={`encyclopediaItemCard${item ? "" : " isMissing"}${isMonster ? " isMonster" : ""}${
          item?.isBoss ? " isBoss" : ""
        }`}
      >
        <div className="encyclopediaItemImageWrap" aria-hidden="true">
          {item?.iconPath ? (
            <img className="encyclopediaItemImage" src={item.iconPath} alt={item.itemName} loading="lazy" />
          ) : (
            <div className="encyclopediaItemPlaceholder">{i18n.t("item.artPending")}</div>
          )}
        </div>
        <div className="encyclopediaItemBody">
          <p className="encyclopediaItemMeta">{cardLabel}</p>
          <h3 className="encyclopediaItemName">{item?.itemName ?? i18n.t("item.missingItem")}</h3>
          <p className="encyclopediaItemFlavor">{item?.flavorText || i18n.t("item.noEntry")}</p>
        </div>
      </article>
    );
  }

  function renderEncyclopediaPanel() {
    try {
      const allItems = normalizeEncyclopediaItems(GENERATED_ITEM_ENCYCLOPEDIA_DATA);
      return (
        <section className="contentShell">
          <section className="contentStack">
            <article className="contentCard encyclopediaControlsCard">
              <h2>{i18n.t("menu.encyclopedia")}</h2>
              <p>{i18n.t("encyclopedia.description")}</p>
              <div className="encyclopediaTabRow">
                {ENCYCLOPEDIA_CATEGORY_ORDER.map((category) => (
                  <button
                    key={category}
                    className={`profileSwitchButton${encyclopediaCategory === category ? " active" : ""}`}
                    onClick={() => setEncyclopediaCategory(category)}
                  >
                    {formatTokenLabel(category)}
                  </button>
                ))}
              </div>
              {encyclopediaCategory === "armor" ? (
                <div className="encyclopediaTabRow">
                  {ENCYCLOPEDIA_ARMOR_ARCHETYPE_ORDER.map((archetype) => (
                    <button
                      key={archetype}
                      className={`profileSwitchButton${encyclopediaArmorArchetype === archetype ? " active" : ""}`}
                      onClick={() => setEncyclopediaArmorArchetype(archetype)}
                    >
                      {formatTokenLabel(archetype)}
                    </button>
                  ))}
                </div>
              ) : null}
              {encyclopediaCategory === "weapon" ? (
                <div className="encyclopediaTabRow">
                  {ENCYCLOPEDIA_WEAPON_ARCHETYPE_ORDER.map((archetype) => (
                    <button
                      key={archetype}
                      className={`profileSwitchButton${encyclopediaWeaponArchetype === archetype ? " active" : ""}`}
                      onClick={() => setEncyclopediaWeaponArchetype(archetype)}
                    >
                      {formatTokenLabel(archetype)}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            {encyclopediaCategory === "armor" ? (
              (() => {
                const armorItems = allItems.filter(
                  (item) => item.majorCategory === "armor" && item.archetype === encyclopediaArmorArchetype
                );
                const byBaseLevel = new Map<number, Map<string, GeneratedEncyclopediaItem>>();
                for (const item of armorItems) {
                  const slotMap = byBaseLevel.get(item.baseLevel) ?? new Map<string, GeneratedEncyclopediaItem>();
                  slotMap.set(item.slotFamily, item);
                  byBaseLevel.set(item.baseLevel, slotMap);
                }
                const levels = [...byBaseLevel.keys()].sort((left, right) => left - right);
                if (levels.length === 0) {
                  return (
                    <article className="contentCard">
                      <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyArmor")}</p>
                    </article>
                  );
                }
                return (
                  <article className="contentCard encyclopediaSetListCard">
                    <div className="encyclopediaSetList">
                      {levels.map((baseLevel) => {
                        const slotMap = byBaseLevel.get(baseLevel);
                        return (
                          <section
                            className="encyclopediaSetSection"
                            key={`armor-${encyclopediaArmorArchetype}-${baseLevel}`}
                          >
                            <div className="encyclopediaSetHeader">
                              <h3>
                                {i18n.t("encyclopedia.armorSet", {
                                  archetype: formatTokenLabel(encyclopediaArmorArchetype)
                                })}
                              </h3>
                              <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: baseLevel })}</span>
                            </div>
                            <div className="encyclopediaSetGrid">
                              {ENCYCLOPEDIA_ARMOR_SLOT_ORDER.map((slotFamily) => (
                                <div key={`slot-${baseLevel}-${slotFamily}`}>
                                  {renderEncyclopediaItemCard(slotMap?.get(slotFamily) ?? null, slotFamily)}
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </article>
                );
              })()
            ) : null}

            {encyclopediaCategory === "weapon" ? (
              (() => {
                const weaponItems = allItems.filter(
                  (item) => item.majorCategory === "weapon" && item.archetype === encyclopediaWeaponArchetype
                );
                type WeaponGroup = {
                  family: string;
                  baseLevel: number;
                  items: GeneratedEncyclopediaItem[];
                };
                const byGroup = new Map<string, WeaponGroup>();
                for (const item of weaponItems) {
                  const key = `${item.family}:${item.baseLevel}`;
                  const current = byGroup.get(key);
                  if (current) {
                    current.items.push(item);
                    continue;
                  }
                  byGroup.set(key, { family: item.family, baseLevel: item.baseLevel, items: [item] });
                }
                const groups = [...byGroup.values()].sort((left, right) => {
                  if (left.baseLevel !== right.baseLevel) {
                    return left.baseLevel - right.baseLevel;
                  }
                  return String(left.family).localeCompare(String(right.family), preferredLocale);
                });
                if (groups.length === 0) {
                  return (
                    <article className="contentCard">
                      <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyWeapon")}</p>
                    </article>
                  );
                }
                return (
                  <article className="contentCard encyclopediaGroupListCard">
                    <div className="encyclopediaGroupList">
                      {groups.map((group) => (
                        <section
                          className="encyclopediaGroupSection"
                          key={`weapon-${encyclopediaWeaponArchetype}-${group.family}-${group.baseLevel}`}
                        >
                          <div className="encyclopediaSetHeader">
                            <h3>{formatTokenLabel(group.family)}</h3>
                            <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
                          </div>
                          <div className="encyclopediaGroupGrid">
                            {group.items
                              .slice()
                              .sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), preferredLocale))
                              .map((item) => (
                                <div key={item.key}>{renderEncyclopediaItemCard(item)}</div>
                              ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })()
            ) : null}

            {encyclopediaCategory === "jewelry" ? (
              (() => {
                const jewelryItems = allItems.filter((item) => item.majorCategory === "jewelry");
                if (jewelryItems.length === 0) {
                  return (
                    <article className="contentCard">
                      <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyJewelry")}</p>
                    </article>
                  );
                }
                type JewelryGroup = {
                  family: string;
                  baseLevel: number;
                  items: GeneratedEncyclopediaItem[];
                };
                const byGroup = new Map<string, JewelryGroup>();
                for (const item of jewelryItems) {
                  const key = `${item.family}:${item.baseLevel}`;
                  const current = byGroup.get(key);
                  if (current) {
                    current.items.push(item);
                    continue;
                  }
                  byGroup.set(key, { family: item.family, baseLevel: item.baseLevel, items: [item] });
                }
                const groups = [...byGroup.values()].sort((left, right) => {
                  if (left.family !== right.family) {
                    return String(left.family).localeCompare(String(right.family), preferredLocale);
                  }
                  return left.baseLevel - right.baseLevel;
                });
                return (
                  <article className="contentCard encyclopediaGroupListCard">
                    <div className="encyclopediaGroupList">
                      {groups.map((group) => (
                        <section className="encyclopediaGroupSection" key={`jewelry-${group.family}-${group.baseLevel}`}>
                          <div className="encyclopediaSetHeader">
                            <h3>{formatTokenLabel(group.family)}</h3>
                            <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
                          </div>
                          <div className="encyclopediaGroupGrid">
                            {group.items
                              .slice()
                              .sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), preferredLocale))
                              .map((item) => (
                                <div key={item.key}>{renderEncyclopediaItemCard(item)}</div>
                              ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })()
            ) : null}

            {encyclopediaCategory === "monster" ? (
              (() => {
                const monsterItems = allItems.filter((item) => item.majorCategory === "monster");
                if (monsterItems.length === 0) {
                  return (
                    <article className="contentCard">
                      <p className="encyclopediaEmptyState">{i18n.t("encyclopedia.emptyMonster")}</p>
                    </article>
                  );
                }
                type MonsterGroup = {
                  familyId: string;
                  familyName: string;
                  locationName: string;
                  baseLevel: number;
                  items: GeneratedEncyclopediaItem[];
                };
                const byGroup = new Map<string, MonsterGroup>();
                for (const item of monsterItems) {
                  const key = item.familyId || `${item.family}:${item.baseLevel}`;
                  const current = byGroup.get(key);
                  if (current) {
                    current.items.push(item);
                    continue;
                  }
                  byGroup.set(key, {
                    familyId: item.familyId,
                    familyName: item.family,
                    locationName: item.locationName,
                    baseLevel: item.baseLevel,
                    items: [item]
                  });
                }
                const groups = [...byGroup.values()].sort((left, right) => {
                  if (left.baseLevel !== right.baseLevel) {
                    return left.baseLevel - right.baseLevel;
                  }
                  return String(left.familyName).localeCompare(String(right.familyName), preferredLocale);
                });
                return (
                  <article className="contentCard encyclopediaGroupListCard">
                    <div className="encyclopediaGroupList">
                      {groups.map((group) => (
                        <section className="encyclopediaGroupSection" key={`monster-${group.familyId}-${group.baseLevel}`}>
                          <div className="encyclopediaSetHeader">
                            <div className="encyclopediaSectionHeading">
                              <h3>{group.familyName}</h3>
                              {group.locationName ? (
                                <p className="encyclopediaSectionSubline">
                                  {i18n.t("encyclopedia.location", { value: group.locationName })}
                                </p>
                              ) : null}
                            </div>
                            <span className="encyclopediaSetBadge">{i18n.t("encyclopedia.base", { value: group.baseLevel })}</span>
                          </div>
                          <div className="encyclopediaGroupGrid encyclopediaMonsterGrid">
                            {group.items
                              .slice()
                              .sort((left, right) => left.sequence - right.sequence)
                              .map((item) => (
                                <div key={item.key}>{renderEncyclopediaItemCard(item)}</div>
                              ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })()
            ) : null}
          </section>
        </section>
      );
    } catch {
      return renderPlaceholderPanel(
        i18n.t("menu.encyclopedia"),
        i18n.t("encyclopedia.renderError")
      );
    }
  }

  function renderActivePanel() {
    switch (activeTab) {
      case "inventory":
        return renderProfilePanel();
      case "encyclopedia":
        return renderEncyclopediaPanel();
      case "contracts":
        return renderContractsPanel();
      case "missions":
        return renderPlaceholderPanel(i18n.t("menu.missions"), i18n.t("placeholders.missions"));
      case "arena":
        return renderPlaceholderPanel(i18n.t("menu.arena"), i18n.t("placeholders.arena"));
      case "guild":
        return renderPlaceholderPanel(i18n.t("menu.guild"), i18n.t("placeholders.guild"));
      case "castles":
        return renderPlaceholderPanel(i18n.t("menu.castles"), i18n.t("placeholders.castles"));
      case "auctionHouse":
        return renderPlaceholderPanel(
          i18n.t("menu.auctionHouse"),
          i18n.t("placeholders.auctionHouse")
        );
      case "merchant":
        return renderPlaceholderPanel(i18n.t("menu.merchant"), i18n.t("placeholders.merchant"));
      case "leaderboards":
        return renderPlaceholderPanel(i18n.t("menu.leaderboards"), i18n.t("placeholders.leaderboards"));
      case "settings":
        return renderSettingsPanel();
      default:
        return renderPlaceholderPanel(i18n.t("settings.title"), i18n.t("placeholders.panelUnavailable"));
    }
  }

  if (!token) {
    return (
      <main className={`appRoot layout-${layoutMode}`}>
        <div className="appSurface">
          <section className="authPage">
            <section className="authCard">
              <h1>{i18n.t("app.title")}</h1>
              <p>{i18n.t("auth.subtitle")}</p>
              
              {resetToken ? (
                <>
                  <h2 style={{ marginTop: 0 }}>Reset Your Password</h2>
                  <form onSubmit={handleResetPasswordForm} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      style={{ padding: "8px", fontSize: "16px" }}
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      style={{ padding: "8px", fontSize: "16px" }}
                    />
                    <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                      Reset Password
                    </button>
                  </form>
                  {resetPasswordMessage && (
                    <div style={{ 
                      marginTop: "12px", 
                      padding: "8px", 
                      background: resetPasswordMessage.includes("success") ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", 
                      borderRadius: "4px" 
                    }}>
                      {resetPasswordMessage}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <button 
                      onClick={() => setAuthMode("login")}
                      style={{ 
                        flex: 1,
                        opacity: authMode === "login" ? 1 : 0.6,
                        fontWeight: authMode === "login" ? "bold" : "normal"
                      }}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setAuthMode("register")}
                      style={{ 
                        flex: 1,
                        opacity: authMode === "register" ? 1 : 0.6,
                        fontWeight: authMode === "register" ? "bold" : "normal"
                      }}
                    >
                      Register
                    </button>
                  </div>

                  <form onSubmit={authMode === "login" ? handleLogin : handleRegister} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {authMode === "register" && (
                      <input
                        type="text"
                        placeholder="Username"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        required
                        minLength={3}
                        maxLength={32}
                        pattern="[a-zA-Z0-9_]+"
                        title="Username can only contain letters, numbers, and underscores"
                        style={{ padding: "8px", fontSize: "16px" }}
                      />
                    )}
                    <input
                      type="email"
                      placeholder="Email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      style={{ padding: "8px", fontSize: "16px" }}
                    />
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                        minLength={authMode === "register" ? 8 : 6}
                        style={{ padding: "8px", paddingRight: "40px", fontSize: "16px", width: "100%", boxSizing: "border-box" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          padding: "4px"
                        }}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "👁️" : "👁️‍🗨️"}
                      </button>
                    </div>
                    
                    {authMode === "register" && (
                      <div style={{ position: "relative" }}>
                        <input
                          type={showRepeatPassword ? "text" : "password"}
                          placeholder="Repeat Password"
                          value={authRepeatPassword}
                          onChange={(e) => setAuthRepeatPassword(e.target.value)}
                          required
                          minLength={8}
                          style={{ padding: "8px", paddingRight: "40px", fontSize: "16px", width: "100%", boxSizing: "border-box" }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                          style={{
                            position: "absolute",
                            right: "8px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "18px",
                            padding: "4px"
                          }}
                          title={showRepeatPassword ? "Hide password" : "Show password"}
                        >
                          {showRepeatPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    )}
                
                {authMode === "login" && (
                  <div style={{ textAlign: "right" }}>
                    <button 
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        color: "#60a5fa", 
                        cursor: "pointer", 
                        fontSize: "14px",
                        textDecoration: "underline",
                        padding: 0
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
                
                {authMode === "register" && (
                  <select
                    value={authClass}
                    onChange={(e) => setAuthClass(e.target.value as PlayerClass)}
                    style={{ padding: "8px", fontSize: "16px" }}
                  >
                    <option value="warrior">Warrior</option>
                    <option value="ranger">Ranger</option>
                    <option value="mage">Mage</option>
                  </select>
                )}

                <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                  {authMode === "login" ? "Login" : "Create Account"}
                </button>
              </form>

              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                <button onClick={handleGuestLogin} style={{ width: "100%", opacity: 0.7 }}>
                  {i18n.t("auth.loginGuest")}
                </button>
              </div>

              {error ? <div className="error">{i18n.t("app.errorPrefix")}: {error}</div> : null}
                </>
              )}
            </section>

            {showForgotPassword && (
              <section className="authCard" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10, minWidth: "400px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ margin: 0 }}>Reset Password</h2>
                  <button 
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordMessage(null);
                      setForgotPasswordEmail("");
                    }}
                    style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", padding: "0 8px" }}
                  >
                    ×
                  </button>
                </div>
                
                <p style={{ marginBottom: "16px" }}>Enter your email address and we'll send you a link to reset your password.</p>
                
                <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    style={{ padding: "8px", fontSize: "16px" }}
                  />
                  <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                    Send Reset Link
                  </button>
                </form>

                {forgotPasswordMessage && (
                  <div style={{ marginTop: "12px", padding: "8px", background: "rgba(96, 165, 250, 0.2)", borderRadius: "4px" }}>
                    {forgotPasswordMessage}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
      <main className={`appRoot layout-${layoutMode}`}>
        <div className="appSurface">
        {!emailVerified && (
          <div style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 1000, 
            background: "rgba(234, 179, 8, 0.9)", 
            color: "#000", 
            padding: "12px 20px", 
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            ⚠️ Please verify your email address. Check your inbox for the verification link.
          </div>
        )}
        {verifyEmailMessage && (
          <div style={{ 
            position: "fixed", 
            top: emailVerified ? 0 : "52px", 
            left: 0, 
            right: 0, 
            zIndex: 999, 
            background: verifyEmailMessage.includes("success") ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)", 
            color: "#fff", 
            padding: "12px 20px", 
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            {verifyEmailMessage}
            <button 
              onClick={() => setVerifyEmailMessage(null)}
              style={{ 
                marginLeft: "16px", 
                background: "rgba(255,255,255,0.2)", 
                border: "1px solid rgba(255,255,255,0.5)", 
                color: "#fff", 
                padding: "4px 12px", 
                borderRadius: "4px", 
                cursor: "pointer" 
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="landingPage" ref={landingPageRef}>
          <aside className="leftPanel" ref={leftPanelRef}>
            <div className="leftPanelShell">
              <section className="playerCard">
                <div className="identityRow">
                  <div className="avatar" aria-hidden="true">
                    {avatarInitial}
                  </div>
                  <div className="identityText">
                    <h1>{profileName}</h1>
                    <p>{playerState ? formatClassLabel(playerState.class) : i18n.t("player.classUnknown")}</p>
                    <p>{i18n.t("player.level", { value: playerState?.level ?? "-" })}</p>
                  </div>
                </div>

                <div className="barBlock">
                  <p className="barLabel">{i18n.t("bars.health")}</p>
                  <div className="barShell">
                    <div className="barFill healthFill" style={{ width: `${healthPercent}%` }} />
                  </div>
                </div>

                <div className="barBlock">
                  <p className="barLabel">{i18n.t("bars.experience")}</p>
                  <div className="barShell">
                    <div className="barFill xpFill" style={{ width: `${xpPercent}%` }} />
                  </div>
                </div>
              </section>

              <section className="menuCard">
                <h2>{i18n.t("menu.title")}</h2>
                <nav className="menuList">
                  {MENU_ITEMS.map((menuItemId) => (
                    <button
                      key={menuItemId}
                      className={`menuButton${activeTab === menuItemId ? " active" : ""}`}
                      onClick={() => setActiveTab(menuItemId)}
                    >
                      <span className="menuButtonIcon" aria-hidden="true">
                        {renderMenuIcon(menuItemId)}
                      </span>
                      <span className="menuButtonLabel">{formatMenuLabel(menuItemId)}</span>
                    </button>
                  ))}
                </nav>
                <button className="logoutButton" onClick={handleLogout}>
                  {i18n.t("menu.logout")}
                </button>
              </section>
            </div>
          </aside>

          <section className="rightPanel" ref={rightPanelRef}>
            {activeTab === "inventory" ? (
              <div
                className={`panelViewportGroup${
                  canDockInventoryChat && isInventoryChatDockedVisible ? " panelViewportGroupWithChat" : ""
                }`}
                ref={panelViewportGroupRef}
              >
                <div className="panelViewportProfileMain" ref={panelViewportMainRef}>
                  {renderProfilePanel()}
                </div>
                <div
                  className={`panelViewportSide${
                    !canDockInventoryChat && isInventoryChatOverlayOpen ? " panelViewportSideChatCovered" : ""
                  }`}
                  ref={panelViewportSideRef}
                >
                  {renderProfileSidePanel()}
                </div>
                {canDockInventoryChat && isInventoryChatDockedVisible ? (
                  <div className="panelViewportSide panelViewportChat">{renderChatPanel()}</div>
                ) : null}
                {!canDockInventoryChat && isInventoryChatOverlayOpen ? (
                  <section className="inventoryChatPanelOverlayViewport">{renderChatPanel()}</section>
                ) : null}
              </div>
            ) : (
              <div className="panelViewport">{renderActivePanel()}</div>
            )}
          </section>

          {activeTab === "inventory" && !isInventoryChatVisible ? (
            <>
              <button
                className="inventoryChatFloatingToggle"
                onClick={openInventoryChat}
                aria-label={i18n.t("inventory.messageShowChat")}
                aria-pressed="false"
              >
                <svg
                  className="inventoryChatFloatingToggleIcon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M4 5h16v10H8l-4 4V5zm2 2v7.17L7.17 13H18V7H6zm3 2h6v2H9V9z" />
                </svg>
              </button>
            </>
          ) : null}

          {error ? <div className="error floatingError">{i18n.t("app.errorPrefix")}: {error}</div> : null}
        </div>
      </div>
    </main>
  );
}
