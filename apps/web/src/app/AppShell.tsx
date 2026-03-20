import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type WheelEvent as ReactWheelEvent
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { AuthScreen } from "./AuthScreen";
import { CharacterHubTabs } from "./CharacterHubTabs";
import { ChatPanel } from "./ChatPanel";
import { PlaceholderPanel } from "./PlaceholderPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ClassIcon } from "./ClassIcon";
import { createInventoryInteractions, type InventoryInsertPosition } from "./inventoryInteractions";
import { createInitialChatMessages, type ChatMessage } from "./chat";
import {
  formatMenuLabel,
  formatMenuGroupLabel,
  getMenuGroupForTab,
  getLayoutMode,
  MENU_GROUPS,
  renderMenuIcon,
  type CharacterHubTab,
  type ChatChannel,
  type LandingTab,
  type LayoutMode,
  type MenuGroupId,
  type ProfileSideTab
} from "./navigation";
import {
  classToStatTree,
  mainStatToFlatDamageRatio,
  type ArmorArchetype,
  type EquipmentGroup,
  type EquipmentSlotId as SharedEquipmentSlotId,
  type ItemMajorCategory,
  type PlayerClass,
  type SupportedLocale,
  type WeaponArchetype,
  type WeaponFamily,
} from "@ebonkeep/shared/core";
import { type AccountOverviewResponse } from "@ebonkeep/shared/auth";
import {
  combatPlaybackActionResolvedSchema,
  type CombatPlaybackActionResolved
} from "../features/combat/playback";
import {
  isItemUsableByClass,
  type DevWeapon,
  type EquipmentState as SharedEquipmentState,
  type ItemEnchanting as SharedItemEnchanting,
  type InventoryItem as SharedInventoryItem,
  type ItemRarity,
  type ItemModifier as SharedItemModifier,
  type ModifierTier,
  type VestigeId,
  type WeaponDamageRoll
} from "@ebonkeep/shared/inventory";
import { type MerchantState as SharedMerchantState, type MerchantTransactionResponse } from "@ebonkeep/shared/economy";
import { MAX_GARDEN_SLOT_COUNT, MIN_GARDEN_UNLOCKED_SLOT_COUNT } from "@ebonkeep/shared/garden";
import { type PlayerState } from "@ebonkeep/shared/player";

import {
  forgotPassword,
  getAccountOverview,
  checkAvailability,
  login,
  register,
  resendVerificationEmail,
  resetPassword,
  verifyEmail
} from "../features/auth";
import {
  devGuestLogin,
  fetchPlayerState,
  generateEquipmentCheats,
  grantCurrencyCheats,
  levelUpPlayerCheats,
  moveInventoryItem,
  replenishPlayerCheats,
  restPlayer,
  updatePlayerCheatSettings,
  updatePlayerPreferences,
  updatePortrait
} from "../features/player";
import { buyMerchantOffer, fetchMerchantState, restockMerchant, sellMerchantItem } from "../features/economy";
import {
  AuctionHouse
} from "../features/auction";
import { fetchGardenState, updateGardenUnlockedSlots } from "../features/garden";
import {
  CombatEncounterArenaPanel,
  CombatEncounterLogPanel,
  CombatEncounterPanel,
  CombatEncounterTurnTrackPanel
} from "../features/combat";
import {
  COMBAT_FAST_FORWARD_ANIMATION_RATE,
  COMBAT_PLAYBACK_BEAT_MS,
  COMBAT_PLAYBACK_IMPACT_DELAY_MS,
  COMBAT_PLAYBACK_START_DELAY_MS,
  COMBAT_SUMMARY_TYPE_DELAY_MS,
  ContractsPanel,
  DeveloperContractsSimulationPanel,
  abandonContractsSlot,
  buildOfferFromRun,
  buildResolvedEncounterState,
  buildTravelEncounterState,
  claimContractRun,
  fetchContractRun,
  fetchContractsBoard,
  getEncounterAnimationRate,
  getEncounterPlaybackProgress,
  getEncounterPlaybackThresholdMs,
  mapBoardSlotsToUi,
  resetCombatEncounterPlayback,
  skipToEndCombatPlayback,
  snapshotEncounterPlayback,
  startContractsRun,
  type ActiveContractEncounterState,
  type ContractEfficiencyTier,
  type ContractOffer,
  type ContractRoll,
  type ContractSlotState
} from "../features/contracts";
import { ImperialShop, MerchantPanel } from "../features/economy";
import { ArenaPanel } from "../features/arena";
import { ForgePanel } from "../features/forge";
import { GardenPanel } from "../features/garden";
import { RefineryPanel } from "../features/refinery";
import { JobsPanel, fetchJobsState, getStoredJobsLockReleaseAtMs } from "../features/jobs";
import { GuildPanel } from "../features/guild";
import { Leaderboard } from "../features/leaderboard";
import {
  DEFAULT_RENOWN_NODE_ID,
  EncyclopediaPanel,
  GENERATED_WEAPON_ICON_PATHS_BY_NAME,
  InventoryManagementPanel,
  ITEM_POWER_BASE_PER_LEVEL,
  LedgerEntryCard,
  MODIFIER_TIER_POWER_PER_LEVEL,
  MOCK_BASE_ARMOR_AND_JEWELRY_ITEMS,
  MOCK_MELEE_DAMAGE_ROLL_WINDOW_BY_LEVEL,
  MOCK_MELEE_RARITY_POOL,
  MOCK_MELEE_WEAPON_TEMPLATES,
  ProfileSidePanel,
  RARITY_POWER_BONUS_RATE,
  RENOWN_INITIAL_VIEW,
  RENOWN_MAX_SCALE,
  RENOWN_MIN_SCALE,
  RENOWN_SCENE_HEIGHT,
  RENOWN_SCENE_WIDTH,
  RenownPanel,
  getMyRenownState,
  unlockRenownNodeApi,
  WEAPON_BASE_LEVEL_POWER_WEIGHT,
  WEAPON_POWER_MULTIPLIER,
  normalizeEncyclopediaItems,
  type EncyclopediaArmorArchetype,
  type EncyclopediaCategory,
  type EncyclopediaWeaponArchetype,
  type MockInventoryItemSeed,
  type RenownViewState
} from "../features/profile";
import type { RenownState } from "@ebonkeep/shared/player";
import { DUCATS_ICON_PATH, IMPERIALS_ICON_PATH } from "../constants/uiAssets";
import { DEFAULT_PORTRAIT_ID, PORTRAIT_POOL, PORTRAIT_POOL_BY_TREE, getPortraitPath, getDefaultPortraitId, BACKGROUND_POOL, getBackgroundPath, DEFAULT_BACKGROUND_ID } from "../constants/portraits";
import { GENERATED_ITEM_ICON_PATHS } from "../generated/itemArtManifest";
import { GENERATED_ITEM_ENCYCLOPEDIA_DATA, type GeneratedEncyclopediaItem } from "../generated/itemEncyclopediaData";
import i18n, { setLocale } from "../i18n";
import { LOCALE_STORAGE_KEY, normalizeLocale } from "../i18n/supportedLocales";
type Rarity = "common" | "uncommon" | "rare" | "epic";
type TrainableStatKey = "strength" | "intelligence" | "dexterity" | "vitality" | "initiative" | "luck";
type InventoryStatFlashKey = TrainableStatKey | "gearScore";
type InventoryStatFlashDirection = "positive" | "negative";
type InventoryStatFlash = {
  direction: InventoryStatFlashDirection;
};
type InventoryCategoryFilter = "weapon" | "armor" | "jewelry";
type LedgerZoneGroup = {
  zoneId: string;
  zoneName: string;
  familyName: string;
  baseLevel: number;
  items: GeneratedEncyclopediaItem[];
};

type EquipmentSlotId = SharedEquipmentSlotId;

type EquipmentSlot = {
  labelKey: string;
  majorCategory: ItemMajorCategory;
};

type InventoryItem = {
  id: string;
  itemCode?: string;
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
  prefix?: ItemModifier;
  affix?: ItemModifier;
  enchanting?: SharedItemEnchanting;
  power: number;
  description: string;
};

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

type EquippedItems = Record<EquipmentSlotId, InventoryItem | null>;

type MerchantOffer = {
  offerId: string;
  offerIndex: number;
  item: InventoryItem;
  buyPriceDucats: number;
  sold: boolean;
  refreshAtMs: number;
};

type MerchantState = {
  offers: MerchantOffer[];
  sellPrices: Record<string, number>;
  nextRefreshAtMs: number;
};

type InventoryComparisonHoverState = {
  hoverKey: string;
  sourceItem: InventoryItem;
  comparisonSlotId: EquipmentSlotId | null;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type InventoryFilterState = {
  showOnlyWeapons: boolean;
  showOnlyArmor: boolean;
  showOnlyJewelry: boolean;
  showOnlyWearable: boolean;
  powerSortDirection: "desc" | "asc";
};

export type InventoryGridEntry =
  | { kind: "item"; item: InventoryItem }
  | { kind: "empty"; id: string; slotIndex: number };
type MerchantOfferGridEntry =
  | { kind: "offer"; offer: MerchantOffer }
  | { kind: "empty"; id: string; slotIndex: number };
type MerchantSellGridEntry =
  | { kind: "sell"; entry: { item: InventoryItem; fromSlot: string } }
  | { kind: "empty"; id: string; slotIndex: number };

type StatContributionLine = {
  label: string;
  ratioLabel: string;
  valueLabel: string;
};
type PlayerCardScoreBreakdown = {
  gear: number;
  offense: number;
  defense: number;
  offenseParts: {
    weaponDamage: number;
    itemDamageBonus: number;
    mainStatBonus: number;
    critFactor: number;
    extraAttackFactor: number;
    accuracyFactor: number;
    baseOffense: number;
  };
  defenseParts: {
    maxHitpoints: number;
    meleeMitigation: number;
    rangedMitigation: number;
    magicMitigation: number;
    averageMitigation: number;
    hitpointContribution: number;
    mitigationContribution: number;
    dodgeFactor: number;
  };
};
type DevWeaponInventorySeed = DevWeapon;
type PendingContractResultPlayerState = {
  level: number;
  experience: number;
  experienceIntoLevel: number;
  experienceToNextLevel: number;
  health: {
    current: number;
    max: number;
  };
  stamina: {
    current: number;
    max: number;
    nextPointAt: string | null;
  };
  ducats: number;
};

type CheatActionKey = "settings" | "replenish" | "levelUp" | "generateEquipment" | "grantCurrency" | "gardenUnlocks";

const INVENTORY_ITEM_LIMIT = 20;
const STAT_TRAIN_DURATION_MS = 10 * 60 * 1000;
const CHEAT_FAST_TRAVEL_DURATION_MS = 2_000;
const INVENTORY_STAT_FLASH_DURATION_MS = 2100;
const TEST_MIN_DUCATS = 0;
const MAIN_STAT_DEFENSE_RATIO = 0.2;
const LUCK_CRIT_CHANCE_PERCENT_PER_POINT = 0.1;
const LUCK_CRIT_DAMAGE_PERCENT_PER_POINT = 0.2;
const INITIATIVE_COMBAT_SPEED_PERCENT_PER_POINT = 0.1;
const INITIATIVE_EXTRA_ATTACK_PERCENT_PER_POINT = 0.2;
const VITALITY_MAX_HP_PER_POINT = 10;
const CHAT_DOCK_TOLERANCE_PX = 1;
const DEFAULT_INVENTORY_FILTER_STATE: InventoryFilterState = {
  showOnlyWeapons: false,
  showOnlyArmor: false,
  showOnlyJewelry: false,
  showOnlyWearable: false,
  powerSortDirection: "asc"
};
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
const LEDGER_MOCK_DISCOVERED_ZONE_IDS: string[] = [
  "snagtooth_hollow_00",
  "mirepool_boglings_04",
  "ternfield_hobgoblins_08"
];

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
    strength: "Strength",
    intelligence: "Intelligence",
    dexterity: "Dexterity",
    vitality: "Vitality",
    initiative: "Initiative",
    luck: "Luck",
    armor: i18n.t("profile.armor"),
    spellShield: i18n.t("profile.spellShield"),
    missileResistance: i18n.t("profile.missileResistance"),
    physicalDefense: i18n.t("profile.physicalDefense"),
    magicDefense: i18n.t("profile.magicDefense"),
    maxHitpoints: i18n.t("profile.maxHitpoints"),
    dodgeChance: "Dodge Chance",
    damage: i18n.t("profile.mainDamage"),
    critChance: i18n.t("profile.critChance"),
    critMultiplier: i18n.t("profile.critDamage"),
    accuracy: "Accuracy",
    extraAttackChance: i18n.t("profile.extraAttackChance"),
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
    .replace(/([a-z])([A-Z])/g, "$1 $2")
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
    "Physical Defense": "profile.physicalDefense",
    "P.Def": "profile.physicalDefense",
    "Magic Defense": "profile.magicDefense",
    "M.Def": "profile.magicDefense",
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

function toLocalItemModifier(modifier: SharedItemModifier | undefined): ItemModifier | undefined {
  if (!modifier) {
    return undefined;
  }
  return {
    kind: modifier.kind,
    tier: modifier.tier,
    name: modifier.name,
    bonusLabel: formatModifierStatLabel(modifier.statKey),
    bonusValue: formatModifierValue(modifier.value, modifier.unit)
  };
}

function toLocalInventoryItem(item: SharedInventoryItem): InventoryItem {
  const preferredSlotId = item.allowedSlotIds[0];
  return {
    id: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    rarity: item.rarity,
    category: item.category,
    iconAssetPath:
      getGeneratedItemIconPath({
        majorCategory: item.archetype.majorCategory,
        weaponArchetype: item.archetype.weaponArchetype,
        armorArchetype: item.archetype.armorArchetype,
        itemName: item.itemName,
        equipSlotId: preferredSlotId
      }) ?? undefined,
    equipable: item.equipable,
    archetype: item.archetype,
    equipSlotId: preferredSlotId,
    allowedSlotIds: [...item.allowedSlotIds],
    levelRequirement: item.levelRequirement,
    baseLevel: item.baseLevel,
    statBonuses: item.statBonuses,
    damageRoll: item.damageRoll,
    prefix: toLocalItemModifier(item.prefix),
    affix: toLocalItemModifier(item.affix),
    enchanting: item.enchanting,
    power: item.power,
    description: item.description
  };
}

function toLocalEquipmentState(equipment: SharedEquipmentState): EquippedItems {
  return {
    helmet: equipment.helmet ? toLocalInventoryItem(equipment.helmet) : null,
    necklace: equipment.necklace ? toLocalInventoryItem(equipment.necklace) : null,
    upperArmor: equipment.upperArmor ? toLocalInventoryItem(equipment.upperArmor) : null,
    belt: equipment.belt ? toLocalInventoryItem(equipment.belt) : null,
    ringLeft: equipment.ringLeft ? toLocalInventoryItem(equipment.ringLeft) : null,
    weapon: equipment.weapon ? toLocalInventoryItem(equipment.weapon) : null,
    pauldrons: equipment.pauldrons ? toLocalInventoryItem(equipment.pauldrons) : null,
    gloves: equipment.gloves ? toLocalInventoryItem(equipment.gloves) : null,
    lowerArmor: equipment.lowerArmor ? toLocalInventoryItem(equipment.lowerArmor) : null,
    boots: equipment.boots ? toLocalInventoryItem(equipment.boots) : null,
    ringRight: equipment.ringRight ? toLocalInventoryItem(equipment.ringRight) : null,
    vestige1: equipment.vestige1 ? toLocalInventoryItem(equipment.vestige1) : null,
    vestige2: equipment.vestige2 ? toLocalInventoryItem(equipment.vestige2) : null,
    vestige3: equipment.vestige3 ? toLocalInventoryItem(equipment.vestige3) : null
  };
}

function toLocalMerchantState(state: SharedMerchantState): MerchantState {
  return {
    offers: state.offers.map((offer) => ({
      offerId: offer.offerId,
      offerIndex: offer.offerIndex,
      item: toLocalInventoryItem(offer.item),
      buyPriceDucats: offer.buyPriceDucats,
      sold: offer.sold,
      refreshAtMs: Date.parse(offer.refreshAt)
    })),
    sellPrices: { ...state.sellPrices },
    nextRefreshAtMs: Date.parse(state.nextRefreshAt)
  };
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

function createMockInventoryItems(devWeapons?: DevWeapon[]): InventoryItem[] {
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

function renderPlayerCardScoreIcon(kind: "gear" | "offense" | "defense") {
  const iconProps = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (kind) {
    case "gear":
      return (
        <svg {...iconProps}>
          <path d="M10 2.6 15.7 6v8L10 17.4 4.3 14V6z" />
          <path d="M10 2.6V9m0 0 5.7-3M10 9 4.3 6" />
        </svg>
      );
    case "offense":
      return (
        <svg {...iconProps}>
          <path d="m5 15 4.8-4.8" />
          <path d="m8.1 5.4 1.7-1.7 5.1 5.1-1.7 1.7" />
          <path d="m4.2 15.8 1.7-1.7 1.9 1.9-1.7 1.7z" />
          <path d="m12.3 5.1 2.6-2.6" />
        </svg>
      );
    case "defense":
      return (
        <svg {...iconProps}>
          <path d="M10 2.8 15.8 5v4.4c0 3.3-2.2 5.9-5.8 7.8-3.6-1.9-5.8-4.5-5.8-7.8V5z" />
          <path d="M10 6.1v7.5" />
          <path d="M7.2 9.2H10" />
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

function formatEquipmentSlotLabel(slotId: EquipmentSlotId): string {
  return i18n.t(EQUIPMENT_SLOTS[slotId].labelKey);
}

function getLedgerMockKillCount(item: GeneratedEncyclopediaItem): number {
  const zoneIndex = Math.max(0, LEDGER_MOCK_DISCOVERED_ZONE_IDS.indexOf(item.familyId));
  if (item.isBoss) {
    return zoneIndex + 1;
  }
  const roleBonus =
    item.itemType === "strength" ? 4 : item.itemType === "intelligence" ? 2 : item.slotFamily === "ambusher" ? 3 : 0;
  return Math.max(1, 24 - item.sequence + zoneIndex * 6 + roleBonus);
}

function getLedgerMockFamilyBonusPercent(totalKills: number): number {
  const milestoneCount = Math.floor(totalKills / 40);
  return Math.min(3, 0.4 + milestoneCount * 0.2);
}

function formatLedgerBonusPercent(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
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
  const enchantPrefix = item.enchanting?.level ? `+${item.enchanting.level} ` : "";
  const prefixName = item.prefix?.name ? `${item.prefix.name} ` : "";
  const affixName = item.affix?.name ? ` ${item.affix.name}` : "";
  return `${enchantPrefix}${prefixName}${item.itemName}${affixName}`.trim();
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
      {item.enchanting?.level ? <span>{`+${item.enchanting.level} `}</span> : null}
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

function getDefenseSummary(item: InventoryItem): { primaryLine: string; secondaryLine?: string } | null {
  const physicalDefense = item.statBonuses?.physicalDefense;
  if (typeof physicalDefense === "number" && physicalDefense > 0) {
    return {
      primaryLine: `${i18n.t("profile.physicalDefense")}: ${physicalDefense}`
    };
  }

  const magicDefense = item.statBonuses?.magicDefense;
  if (typeof magicDefense === "number" && magicDefense > 0) {
    return {
      primaryLine: `${i18n.t("profile.magicDefense")}: ${magicDefense}`
    };
  }

  return null;
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

function renderInventoryItemCardBody(item: InventoryItem, canUseItem: boolean, priceLabel?: string): ReactElement {
  const displayItemName = getDisplayItemName(item);
  const useImageOnlyIcon = Boolean(item.iconAssetPath);

  return (
    <div className={`inventoryCompactVisual${canUseItem ? "" : " isRestricted"}`}>
      {priceLabel ? <span className="inventoryCompactPrice">{priceLabel}</span> : null}
      {renderItemIcon({
        majorCategory: item.archetype?.majorCategory,
        category: item.category,
        itemName: displayItemName,
        iconAssetPath: item.iconAssetPath,
        className: useImageOnlyIcon ? undefined : `inventoryCompactIcon${canUseItem ? "" : " isRestricted"}`,
        renderMode: useImageOnlyIcon ? "imageOnly" : "default"
      })}
      <span className="inventoryCompactPowerBadge" aria-hidden="true">
        {item.power}
      </span>
      <span className={`inventoryCompactLevelBadge${canUseItem ? "" : " isRestricted"}`} aria-hidden="true">
        Lv. {item.levelRequirement}
      </span>
    </div>
  );
}

function renderEmptyInventorySlotCardBody(): ReactElement {
  return <div className="inventoryCompactVisual inventoryCompactVisualEmpty" aria-hidden="true" />;
}

function renderInventoryItemDetailCardBody(
  item: InventoryItem,
  canUseItem: boolean,
  priceLabel?: string,
  asideNote?: string,
  powerDelta?: number
): ReactElement {
  const subtypeLabel = getItemSubtypeLabel(item);
  const modifierLines = getItemModifierStatLines(item);
  const weaponDamageSummary = getWeaponDamageSummary(item);
  const defenseSummary = getDefenseSummary(item);
  const displayItemName = getDisplayItemName(item);
  const useImageOnlyIcon = Boolean(item.iconAssetPath);

  return (
    <>
      <div className="inventoryCardTop">
        <div className="inventoryCardMeta">
          <h4>{renderItemDisplayName(item)}</h4>
          <p className="inventoryCardCategory">{subtypeLabel}</p>
        </div>
        <div className="inventoryCardTopAside">
          <span className="inventoryCardRarity">{formatRarityLabel(item.rarity)}</span>
          {priceLabel ? <span className="merchantCardPriceOverlay">{priceLabel}</span> : null}
          {asideNote ? <span className="inventoryCardTopAsideNote">{asideNote}</span> : null}
        </div>
      </div>
      <div className={`inventoryCardVisual${canUseItem ? "" : " isRestricted"}`}>
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
        {defenseSummary ? (
          <div className="inventoryCardDamageBlock">
            <p className="inventoryCardDamagePrimary">{defenseSummary.primaryLine}</p>
            {defenseSummary.secondaryLine ? (
              <p className="inventoryCardDamageRollMeta">{defenseSummary.secondaryLine}</p>
            ) : null}
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
          <span className="inventoryCardPower">
            {i18n.t("inventory.power", { value: item.power })}
            {typeof powerDelta === "number" && powerDelta !== 0 ? (
              <span className={`inventoryCardPowerDelta ${powerDelta > 0 ? "positive" : "negative"}`}>
                {" "}
                ({powerDelta > 0 ? `+${powerDelta}` : powerDelta})
              </span>
            ) : null}
          </span>
          <span className={`inventoryCardLevel${canUseItem ? "" : " isRestricted"}`}>
            {i18n.t("inventory.requiredLevel", { value: item.levelRequirement })}
          </span>
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

export function createFixedInventoryGridEntries(items: InventoryItem[], slotCapacity: number): InventoryGridEntry[] {
  const normalizedSlotCapacity = Math.max(0, slotCapacity);
  const visibleItems = items.slice(0, normalizedSlotCapacity);
  const entries: InventoryGridEntry[] = visibleItems.map((item) => ({
    kind: "item",
    item
  }));

  for (let slotIndex = visibleItems.length; slotIndex < normalizedSlotCapacity; slotIndex += 1) {
    entries.push({
      kind: "empty",
      id: `empty-slot-${slotIndex}`,
      slotIndex
    });
  }

  return entries;
}

export function createFixedMerchantOfferEntries(offers: MerchantOffer[], slotCapacity: number): MerchantOfferGridEntry[] {
  const normalizedSlotCapacity = Math.max(0, slotCapacity);
  const visibleOffers = offers.slice(0, normalizedSlotCapacity);
  const entries: MerchantOfferGridEntry[] = visibleOffers.map((offer) => ({
    kind: "offer",
    offer
  }));

  for (let slotIndex = visibleOffers.length; slotIndex < normalizedSlotCapacity; slotIndex += 1) {
    entries.push({
      kind: "empty",
      id: `merchant-offer-empty-slot-${slotIndex}`,
      slotIndex
    });
  }

  return entries;
}

export function createFixedMerchantSellEntries(
  entries: Array<{ item: InventoryItem; fromSlot: string }>,
  slotCapacity: number
): MerchantSellGridEntry[] {
  const normalizedSlotCapacity = Math.max(0, slotCapacity);
  const visibleEntries = entries.slice(0, normalizedSlotCapacity);
  const paddedEntries: MerchantSellGridEntry[] = visibleEntries.map((entry) => ({
    kind: "sell",
    entry
  }));

  for (let slotIndex = visibleEntries.length; slotIndex < normalizedSlotCapacity; slotIndex += 1) {
    paddedEntries.push({
      kind: "empty",
      id: `merchant-player-empty-slot-${slotIndex}`,
      slotIndex
    });
  }

  return paddedEntries;
}

type InventoryCardGridProps = {
  entries: InventoryGridEntry[];
  allowDrag: boolean;
  playerState: PlayerState | null;
  draggingInventoryCardId: string | null;
  dropTargetInventoryCardId: string | null;
  dropInsertPosition: InventoryInsertPosition;
  onInventoryCardDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onInventoryCardDragOver: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onInventoryCardDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onInventoryCardDoubleClick: (itemId: string) => Promise<void> | void;
  onInventoryCardMouseEnter: (
    item: InventoryItem,
    hoverKey: string,
    cardElement: HTMLElement,
    placement?: "left" | "right"
  ) => void;
  onInventoryCardMouseLeave: (hoverKey: string) => void;
  onInventoryCardDragEnd: () => void;
};

export function InventoryCardGrid(props: InventoryCardGridProps): ReactElement {
  if (props.entries.length === 0) {
    return <p>{i18n.t("inventory.noItems")}</p>;
  }

  return (
    <div className="inventoryCards">
      {props.entries.map((entry) => {
        if (entry.kind === "empty") {
          return (
            <article
              key={entry.id}
              className="inventoryItemCard inventoryItemCardEmpty"
              data-testid={`inventory-empty-slot-${entry.slotIndex}`}
              draggable={false}
              aria-label={i18n.t("item.empty")}
            >
              {renderEmptyInventorySlotCardBody()}
            </article>
          );
        }

        const { item } = entry;
        const dragSourceClass = props.draggingInventoryCardId === item.id ? " isDragSource" : "";
        const dropCueClass =
          props.dropTargetInventoryCardId === item.id && props.draggingInventoryCardId !== item.id
            ? props.dropInsertPosition === "before"
              ? " dropCueBefore"
              : " dropCueAfter"
            : "";
        const canUseItem = canPlayerUseItem(item, props.playerState);

        return (
          <article
            key={item.id}
            className={`inventoryItemCard rarity-${item.rarity}${dragSourceClass}${dropCueClass}`}
            data-testid={`inventory-card-${item.id}`}
            draggable={props.allowDrag}
            onDragStart={props.allowDrag ? (event) => props.onInventoryCardDragStart(event, item.id) : undefined}
            onDragOver={props.allowDrag ? (event) => props.onInventoryCardDragOver(event, item.id) : undefined}
            onDrop={props.allowDrag ? (event) => props.onInventoryCardDrop(event) : undefined}
            onDoubleClick={props.allowDrag ? () => props.onInventoryCardDoubleClick(item.id) : undefined}
            onContextMenu={
              props.allowDrag
                ? (event) => {
                    event.preventDefault();
                    void props.onInventoryCardDoubleClick(item.id);
                  }
                : undefined
            }
            onMouseEnter={
              props.allowDrag
                ? (event) => props.onInventoryCardMouseEnter(item, item.id, event.currentTarget, "left")
                : undefined
            }
            onMouseLeave={props.allowDrag ? () => props.onInventoryCardMouseLeave(item.id) : undefined}
            onDragEnd={props.allowDrag ? props.onInventoryCardDragEnd : undefined}
          >
            {renderInventoryItemCardBody(item, canUseItem)}
          </article>
        );
      })}
    </div>
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

function formatTwoDecimalPercentRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatDerivedFlat(value: number): string {
  return i18n.t("profile.derivedFlat", { value: formatOneDecimal(value) });
}

function formatDerivedPercent(value: number): string {
  return i18n.t("profile.derivedPercent", { value: formatOneDecimal(value) });
}

function formatBasisPoints(value: number): string {
  return `${formatOneDecimal(value / 100)}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMainOffenseStatKey(playerClass: PlayerClass): TrainableStatKey {
  const tree = classToStatTree(playerClass);
  if (tree === "intelligence") return "intelligence";
  if (tree === "dexterity") return "dexterity";
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

const JOB_ACTIVITY_LOCKED_TABS: LandingTab[] = ["contracts", "missions", "arena", "garden", "refinery", "forge"];

function isTabLockedByJobs(lockReleaseAtMs: number | null, nowMs: number, tab: LandingTab): boolean {
  return lockReleaseAtMs !== null && nowMs < lockReleaseAtMs && JOB_ACTIVITY_LOCKED_TABS.includes(tab);
}

export function AppShell() {
  useTranslation();
  const landingPageRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLElement | null>(null);
  const sidePanelScrollRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  const panelViewportGroupRef = useRef<HTMLDivElement | null>(null);
  const panelViewportMainRef = useRef<HTMLDivElement | null>(null);
  const panelViewportSideRef = useRef<HTMLDivElement | null>(null);
  const pendingContractResultPlayerStateRef = useRef<PendingContractResultPlayerState | null>(null);
  const renownViewportRef = useRef<HTMLDivElement | null>(null);
  const renownDragStateRef = useRef<{
    pointerX: number;
    pointerY: number;
    viewX: number;
    viewY: number;
  } | null>(null);
  const chatMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(
    () => window.localStorage.getItem("ebonkeep.dev.token")
  );
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(() =>
    normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? i18n.resolvedLanguage ?? i18n.language)
  );
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [activeTab, setActiveTab] = useState<LandingTab>("inventory");
  const [expandedMenuGroup, setExpandedMenuGroup] = useState<MenuGroupId>("profile");
  const [characterHubTab, setCharacterHubTab] = useState<CharacterHubTab>("character");
  const [selectedRenownNodeId, setSelectedRenownNodeId] = useState<string>(DEFAULT_RENOWN_NODE_ID);
  const [renownView, setRenownView] = useState<RenownViewState>(RENOWN_INITIAL_VIEW);
  const [isRenownDragging, setIsRenownDragging] = useState(false);
  const [renownState, setRenownState] = useState<RenownState | null>(null);
  const [isUnlockingRenown, setIsUnlockingRenown] = useState(false);
  const [selectedLedgerZoneId, setSelectedLedgerZoneId] = useState<string>(LEDGER_MOCK_DISCOVERED_ZONE_IDS[0]);
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
  const [authClass, setAuthClass] = useState<PlayerClass>("juggernaut");
  const [authPortraitId, setAuthPortraitId] = useState<string>(DEFAULT_PORTRAIT_ID);
  const [authBackgroundId, setAuthBackgroundId] = useState<string>(DEFAULT_BACKGROUND_ID);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(true); // assume true until we check
  const [verifyEmailMessage, setVerifyEmailMessage] = useState<string | null>(null);
  const [resendEmailNotif, setResendEmailNotif] = useState<{ msg: string; success: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountOverviewResponse | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [equippedItems, setEquippedItems] = useState<EquippedItems>(() => createEmptyEquippedItems());
  const [isInventoryMutating, setIsInventoryMutating] = useState(false);
  const [merchantState, setMerchantState] = useState<MerchantState | null>(null);
  const [isMerchantLoading, setIsMerchantLoading] = useState(false);
  const [isMerchantMutating, setIsMerchantMutating] = useState(false);
  const [draggingMerchantOfferId, setDraggingMerchantOfferId] = useState<string | null>(null);
  const [merchantOfferFilters, setMerchantOfferFilters] = useState<InventoryFilterState>(DEFAULT_INVENTORY_FILTER_STATE);
  const [merchantPlayerFilters, setMerchantPlayerFilters] = useState<InventoryFilterState>(DEFAULT_INVENTORY_FILTER_STATE);
  const [contractSlots, setContractSlots] = useState<ContractSlotState[]>([]);
  const [activeContractEncounter, setActiveContractEncounter] = useState<ActiveContractEncounterState | null>(null);
  const [activeContractRunId, setActiveContractRunId] = useState<string | null>(null);
  const [pendingContractResultPlayerState, setPendingContractResultPlayerState] =
    useState<PendingContractResultPlayerState | null>(null);
  const [jobsLockReleaseAtMs, setJobsLockReleaseAtMs] = useState<number | null>(() => getStoredJobsLockReleaseAtMs());
  const [isGuildMissionActive, setIsGuildMissionActive] = useState(false);
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
  const [isCombatLogVisible, setIsCombatLogVisible] = useState(true);
  const [hoveredCombatActorId, setHoveredCombatActorId] = useState<string | null>(null);
  const [baseStats, setBaseStats] = useState<Record<TrainableStatKey, number> | null>(null);
  const [currencies, setCurrencies] = useState<{ ducats: number; imperials: number } | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [activeStatTraining, setActiveStatTraining] = useState<{
    stat: TrainableStatKey;
    startedAt: number;
    completesAt: number;
  } | null>(null);
  const [activeCheatAction, setActiveCheatAction] = useState<CheatActionKey | null>(null);
  const [cheatStatusMessage, setCheatStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !playerState) {
      setJobsLockReleaseAtMs(null);
      return;
    }

    let cancelled = false;

    void fetchJobsState(token)
      .then((jobsState) => {
        if (cancelled) {
          return;
        }

        setJobsLockReleaseAtMs(jobsState.activeRun ? Date.parse(jobsState.activeRun.releaseAt) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setJobsLockReleaseAtMs(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [playerState, token]);
  const [cheatLevelInput, setCheatLevelInput] = useState("");
  const [cheatEquipmentRarity, setCheatEquipmentRarity] = useState<ItemRarity>("rare");
  const [cheatGardenUnlockedSlotsInput, setCheatGardenUnlockedSlotsInput] = useState(
    String(MIN_GARDEN_UNLOCKED_SLOT_COUNT)
  );
  const [inventoryStatFlashes, setInventoryStatFlashes] = useState<Partial<Record<InventoryStatFlashKey, InventoryStatFlash>>>({});
  const inventoryStatFlashTimeoutsRef = useRef<Partial<Record<InventoryStatFlashKey, number>>>({});
  const inventoryStatFlashFrameRefs = useRef<Partial<Record<InventoryStatFlashKey, number>>>({});

  // Portrait system — driven by playerState.portraitId (persisted in DB)
  const [activePortraitId, setActivePortraitId] = useState<string>(DEFAULT_PORTRAIT_ID);
  const [activeBackgroundId, setActiveBackgroundId] = useState<string>(DEFAULT_BACKGROUND_ID);

  // Sync portrait from loaded playerState
  useEffect(() => {
    if (playerState?.portraitId) {
      setActivePortraitId(playerState.portraitId);
    }
  }, [playerState?.portraitId]);

  // Sync background from loaded playerState
  useEffect(() => {
    if (playerState?.backgroundId) {
      setActiveBackgroundId(playerState.backgroundId);
    }
  }, [playerState?.backgroundId]);

  const activeCharacterVisualPath = getPortraitPath(activePortraitId);
  const activeBackgroundPath = getBackgroundPath(activeBackgroundId);
  const activeCharacterVisualName = activePortraitId;
  const canCycleCharacterVisuals = PORTRAIT_POOL.length > 1;

  const [isSavingLocale, setIsSavingLocale] = useState(false);
  const [localeStatusMessage, setLocaleStatusMessage] = useState<string | null>(null);
  const cheatSettings = playerState?.cheatSettings ?? {
    fastTravelEnabled: false,
    fastContractReplenishEnabled: false,
    fastArenaReplenishEnabled: false,
    invincibilityEnabled: false,
    fastTrainTimeEnabled: false,
    unlimitedAcademyDonationsEnabled: false
  };

  function isCheatActionPending(action: CheatActionKey): boolean {
    return activeCheatAction === action;
  }

  function getEffectiveTrainingCompletionTime(training: { startedAt: number; completesAt: number } | null): number | null {
    if (!training) {
      return null;
    }
    return cheatSettings.fastTrainTimeEnabled ? training.startedAt : training.completesAt;
  }

  function getEffectiveTravelEndsAt(encounter: ActiveContractEncounterState | null): number | null {
    if (!encounter || encounter.phase !== "travel" || encounter.travelEndsAt === null) {
      return encounter?.travelEndsAt ?? null;
    }
    if (!cheatSettings.fastTravelEnabled) {
      return encounter.travelEndsAt;
    }
    const travelStartedAt = encounter.travelEndsAt - encounter.travelDurationMs;
    return Math.min(encounter.travelEndsAt, travelStartedAt + CHEAT_FAST_TRAVEL_DURATION_MS);
  }

  function getEffectiveTravelDurationMs(encounter: ActiveContractEncounterState | null): number {
    if (!encounter || encounter.phase !== "travel" || encounter.travelEndsAt === null) {
      return encounter?.travelDurationMs ?? 0;
    }
    const effectiveTravelEndsAt = getEffectiveTravelEndsAt(encounter);
    if (effectiveTravelEndsAt === null) {
      return encounter.travelDurationMs;
    }
    return Math.max(0, effectiveTravelEndsAt - (encounter.travelEndsAt - encounter.travelDurationMs));
  }

  const profileName = accountInfo?.username ?? (playerState ? getDisplayName(playerState) : i18n.t("profile.defaultName"));

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
  function getActiveInventoryCategoryFilters(filters: InventoryFilterState): InventoryCategoryFilter[] {
    const activeFilters: InventoryCategoryFilter[] = [];
    if (filters.showOnlyWeapons) {
      activeFilters.push("weapon");
    }
    if (filters.showOnlyArmor) {
      activeFilters.push("armor");
    }
    if (filters.showOnlyJewelry) {
      activeFilters.push("jewelry");
    }
    return activeFilters;
  }

  function applyInventoryFilters(items: InventoryItem[], filters: InventoryFilterState): InventoryItem[] {
    const activeFilters = getActiveInventoryCategoryFilters(filters);
    const filteredItems = items.filter((item) => {
      if (filters.showOnlyWearable && !item.equipable) {
        return false;
      }
      if (activeFilters.length === 0) {
        return true;
      }
      const category = item.archetype?.majorCategory;
      if (!category) {
        return false;
      }
      return activeFilters.includes(category as InventoryCategoryFilter);
    });

    return [...filteredItems].sort((firstItem, secondItem) =>
      filters.powerSortDirection === "desc"
        ? secondItem.power - firstItem.power
        : firstItem.power - secondItem.power
    );
  }

  const filteredInventoryItems = useMemo(() => {
    return applyInventoryFilters(inventoryItems, {
      showOnlyWeapons,
      showOnlyArmor,
      showOnlyJewelry,
      showOnlyWearable,
      powerSortDirection
    });
  }, [inventoryItems, powerSortDirection, showOnlyArmor, showOnlyJewelry, showOnlyWeapons, showOnlyWearable]);
  const activeChatMessages = chatMessagesByChannel[activeChatChannel];
  const isInventoryChatVisible = canDockInventoryChat ? isInventoryChatDockedVisible : isInventoryChatOverlayOpen;

  function clearInventoryStatFlash(key: InventoryStatFlashKey) {
    const timeoutId = inventoryStatFlashTimeoutsRef.current[key];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      delete inventoryStatFlashTimeoutsRef.current[key];
    }
    const frameId = inventoryStatFlashFrameRefs.current[key];
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId);
      delete inventoryStatFlashFrameRefs.current[key];
    }
    setInventoryStatFlashes((previousFlashes) => {
      if (!previousFlashes[key]) {
        return previousFlashes;
      }
      const nextFlashes = { ...previousFlashes };
      delete nextFlashes[key];
      return nextFlashes;
    });
  }

  function queueInventoryStatFlash(key: InventoryStatFlashKey, delta: number) {
    if (delta === 0) {
      clearInventoryStatFlash(key);
      return;
    }

    const direction: InventoryStatFlashDirection = delta > 0 ? "positive" : "negative";
    clearInventoryStatFlash(key);

    inventoryStatFlashFrameRefs.current[key] = window.requestAnimationFrame(() => {
      inventoryStatFlashFrameRefs.current[key] = window.requestAnimationFrame(() => {
        delete inventoryStatFlashFrameRefs.current[key];
        setInventoryStatFlashes((previousFlashes) => ({
          ...previousFlashes,
          [key]: {
            direction
          }
        }));

        inventoryStatFlashTimeoutsRef.current[key] = window.setTimeout(() => {
          clearInventoryStatFlash(key);
        }, INVENTORY_STAT_FLASH_DURATION_MS);
      });
    });
  }

  function triggerInventoryMoveStatFlashes(nextState: PlayerState) {
    if (!playerState) {
      return;
    }

    const effectiveBaseSnapshot: Record<TrainableStatKey, number> = baseStats ?? {
      strength: playerState.statSnapshot.base.strength,
      intelligence: playerState.statSnapshot.base.intelligence,
      dexterity: playerState.statSnapshot.base.dexterity,
      vitality: playerState.statSnapshot.base.vitality,
      initiative: playerState.statSnapshot.base.initiative,
      luck: playerState.statSnapshot.base.luck
    };
    const nextEquipmentSnapshot = nextState.statSnapshot.equipment;
    const statKeys: TrainableStatKey[] = ["strength", "intelligence", "dexterity", "vitality", "initiative", "luck"];

    statKeys.forEach((statKey) => {
      const previousDisplayedValue = effectiveBaseSnapshot[statKey] + equipmentStatBonuses[statKey];
      const nextDisplayedValue = effectiveBaseSnapshot[statKey] + nextEquipmentSnapshot[statKey];
      const delta = nextDisplayedValue - previousDisplayedValue;
      if (delta !== 0) {
        queueInventoryStatFlash(statKey, delta);
      }
    });

    const gearScoreDelta = nextState.gearScore - playerState.gearScore;
    if (gearScoreDelta !== 0) {
      queueInventoryStatFlash("gearScore", gearScoreDelta);
    }
  }

  function applyAuthoritativePlayerState(nextState: PlayerState | null) {
    if (!nextState) {
      (Object.keys(inventoryStatFlashTimeoutsRef.current) as InventoryStatFlashKey[]).forEach((key) => {
        const timeoutId = inventoryStatFlashTimeoutsRef.current[key];
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      });
      (Object.keys(inventoryStatFlashFrameRefs.current) as InventoryStatFlashKey[]).forEach((key) => {
        const frameId = inventoryStatFlashFrameRefs.current[key];
        if (frameId !== undefined) {
          window.cancelAnimationFrame(frameId);
        }
      });
      inventoryStatFlashTimeoutsRef.current = {};
      inventoryStatFlashFrameRefs.current = {};
      setInventoryStatFlashes({});
      setPendingContractResultPlayerState(null);
    }
    setPlayerState(nextState ? applyMockPlayerStateOverrides(nextState) : null);
    setInventoryItems(nextState ? nextState.inventory.map((item) => toLocalInventoryItem(item)) : []);
    setEquippedItems(nextState ? toLocalEquipmentState(nextState.equipment) : createEmptyEquippedItems());
    setAccountInfo((previous) =>
      previous && nextState
        ? {
            ...previous,
            profile: previous.profile
              ? {
                  ...previous.profile,
                  level: nextState.level,
                  gearScore: nextState.gearScore
                }
              : previous.profile,
            currency: {
              ducats: nextState.currency.ducats,
              imperials: nextState.currency.imperials
            }
          }
        : previous
    );
  }

  function applyMerchantTransaction(response: MerchantTransactionResponse) {
    applyAuthoritativePlayerState(response.playerState);
    setMerchantState(toLocalMerchantState(response.merchantState));
  }

  function getAllowedSlotIdsForItem(item: InventoryItem): EquipmentSlotId[] {
    return item.allowedSlotIds && item.allowedSlotIds.length > 0 ? [...item.allowedSlotIds] : [item.equipSlotId];
  }

  function getPreferredEquipSlot(item: InventoryItem): EquipmentSlotId | null {
    const allowedSlotIds = getAllowedSlotIdsForItem(item);
    const currentlyEquippedSlotId = allowedSlotIds.find(
      (slotId) => equippedItems[slotId]?.id === item.id
    );
    if (currentlyEquippedSlotId) {
      return currentlyEquippedSlotId;
    }
    const emptySlotId = allowedSlotIds.find((slotId) => equippedItems[slotId] === null);
    return emptySlotId ?? allowedSlotIds[0] ?? null;
  }

  async function performInventoryMove(itemId: string, fromSlot: string, toSlot: string) {
    if (!token || isInventoryMutating) {
      return;
    }

    try {
      setIsInventoryMutating(true);
      const response = await moveInventoryItem(token, itemId, fromSlot, toSlot);
      triggerInventoryMoveStatFlashes(response.playerState);
      applyAuthoritativePlayerState(response.playerState);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.invalidItem"));
    } finally {
      setIsInventoryMutating(false);
    }
  }

  async function handleMerchantBuy(offerId: string) {
    if (!token || isMerchantMutating) {
      return;
    }

    try {
      setIsMerchantMutating(true);
      const response = await buyMerchantOffer(token, offerId);
      applyMerchantTransaction(response);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Merchant purchase failed");
    } finally {
      setIsMerchantMutating(false);
    }
  }

  async function handleMerchantSell(itemId: string, fromSlot: string) {
    if (!token || isMerchantMutating) {
      return;
    }

    try {
      setIsMerchantMutating(true);
      const response = await sellMerchantItem(token, itemId, fromSlot);
      applyMerchantTransaction(response);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Merchant sale failed");
    } finally {
      setIsMerchantMutating(false);
    }
  }

  async function handleMerchantRestock() {
    if (!token || isMerchantMutating) {
      return;
    }

    try {
      setIsMerchantMutating(true);
      const response = await restockMerchant(token);
      applyMerchantTransaction(response);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Merchant restock failed");
    } finally {
      setIsMerchantMutating(false);
    }
  }

  const displayedPlayerHealth = activeContractEncounter?.phase === "combat"
    ? {
        current: Math.max(
          0,
          Math.min(
            activeContractEncounter.encounter.player.maxHp,
            activeContractEncounter.hpByActorId[activeContractEncounter.encounter.player.id] ??
              activeContractEncounter.encounter.player.maxHp
          )
        ),
        max: activeContractEncounter.encounter.player.maxHp
      }
    : playerState?.health ?? null;
  const healthPercent = displayedPlayerHealth
    ? Math.max(0, Math.min(100, Math.round((displayedPlayerHealth.current / Math.max(1, displayedPlayerHealth.max)) * 100)))
    : 0;
  const healthLabel = displayedPlayerHealth
    ? `${displayedPlayerHealth.current}/${displayedPlayerHealth.max}`
    : "0/0";
  const xpRatio = playerState
    ? playerState.experienceIntoLevel / Math.max(1, playerState.experienceToNextLevel)
    : 0;
  const xpPercent = playerState
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            xpRatio * 100
          )
        )
      )
    : 0;
  const xpLabel = formatTwoDecimalPercentRatio(Math.max(0, Math.min(1, xpRatio)));
  const staminaPercent = playerState
    ? Math.max(0, Math.min(100, Math.round((playerState.stamina.current / Math.max(1, playerState.stamina.max)) * 100)))
    : 0;
  const staminaLabel = playerState
    ? `${playerState.stamina.current}/${playerState.stamina.max}`
    : "0/0";
  const playerCardScoreSummary = useMemo(() => {
    if (!playerState) {
      return {
        gear: 0,
        offense: 0,
        defense: 0,
        offenseParts: {
          weaponDamage: 0,
          itemDamageBonus: 0,
          mainStatBonus: 0,
          critFactor: 1,
          extraAttackFactor: 1,
          accuracyFactor: 0.75,
          baseOffense: 0
        },
        defenseParts: {
          maxHitpoints: 0,
          meleeMitigation: 0,
          rangedMitigation: 0,
          magicMitigation: 0,
          averageMitigation: 0,
          hitpointContribution: 0,
          mitigationContribution: 0,
          dodgeFactor: 1
        }
      } satisfies PlayerCardScoreBreakdown;
    }

    const totalStats = playerState.statSnapshot.total;
    const mainStatKey = getMainOffenseStatKey(playerState.class);
    const mainStatBonus = Math.floor(totalStats[mainStatKey] * 0.1);
    const weaponDamage = Math.round(playerState.equipment.weapon?.damageRoll?.averageDamage ?? 0);
    const baseOffense = totalStats.damage;
    const itemDamageBonus = Math.max(0, baseOffense - weaponDamage - mainStatBonus);
    const critChanceDecimal = totalStats.critChance / 10_000;
    const critMultiplierDecimal = totalStats.critMultiplier / 10_000;
    const extraAttackDecimal = totalStats.extraAttackChance / 10_000;
    const accuracyFactor = clamp(totalStats.accuracy / 100, 0.75, 1);
    const critFactor = 1 + critChanceDecimal * critMultiplierDecimal;
    const extraAttackFactor = 1 + extraAttackDecimal;
    const offense = Math.round(baseOffense * critFactor * extraAttackFactor * accuracyFactor);

    const meleeMitigation = totalStats.armor + totalStats.physicalDefense;
    const rangedMitigation = totalStats.missileResistance + totalStats.physicalDefense;
    const magicMitigation = totalStats.spellShield + totalStats.magicDefense;
    const averageMitigation = (meleeMitigation + rangedMitigation + magicMitigation) / 3;
    const hitpointContribution = totalStats.maxHitpoints / 5;
    const mitigationContribution = averageMitigation * 2;
    const dodgeChanceDecimal = clamp(totalStats.dodgeChance / 10_000, 0, 0.95);
    const dodgeFactor = 1 / (1 - dodgeChanceDecimal);
    const defense = Math.round(((hitpointContribution + mitigationContribution) * dodgeFactor) / 2);

    return {
      gear: playerState.gearScore,
      offense,
      defense,
      offenseParts: {
        weaponDamage,
        itemDamageBonus,
        mainStatBonus,
        critFactor,
        extraAttackFactor,
        accuracyFactor,
        baseOffense
      },
      defenseParts: {
        maxHitpoints: totalStats.maxHitpoints,
        meleeMitigation,
        rangedMitigation,
        magicMitigation,
        averageMitigation,
        hitpointContribution,
        mitigationContribution,
        dodgeFactor
      }
    };
  }, [playerState]);
  const playerCardCurrencies = currencies ?? {
    ducats: Math.max(playerState?.currency.ducats ?? 0, TEST_MIN_DUCATS),
    imperials: playerState?.currency.imperials ?? 0
  };

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
  const merchantInventoryItems = useMemo(
    () => inventoryItems,
    [inventoryItems]
  );
  const merchantEquippedEntries = useMemo(
    () =>
      ALL_EQUIPMENT_SLOTS.map((slotId) => ({
        slotId,
        item: equippedItems[slotId]
      })).filter((entry) => entry.item !== null) as Array<{ slotId: EquipmentSlotId; item: InventoryItem }>,
    [equippedItems]
  );
  const filteredMerchantOffers = useMemo(
    () =>
      (merchantState?.offers ?? [])
        .filter((offer) => applyInventoryFilters([offer.item], merchantOfferFilters).length > 0)
        .sort((left, right) =>
          merchantOfferFilters.powerSortDirection === "desc"
            ? right.item.power - left.item.power
            : left.item.power - right.item.power
        ),
    [merchantOfferFilters, merchantState?.offers]
  );
  const filteredMerchantInventoryItems = useMemo(
    () => applyInventoryFilters(merchantInventoryItems, merchantPlayerFilters),
    [merchantInventoryItems, merchantPlayerFilters]
  );
  const filteredMerchantEquippedEntries = useMemo(
    () =>
      merchantEquippedEntries
        .filter((entry) => applyInventoryFilters([entry.item], merchantPlayerFilters).length > 0)
        .sort((left, right) =>
          merchantPlayerFilters.powerSortDirection === "desc"
            ? right.item.power - left.item.power
            : left.item.power - right.item.power
        ),
    [merchantEquippedEntries, merchantPlayerFilters]
  );

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

  // Handle PayPal return with token parameter
  useEffect(() => {
    if (!token) return; // Wait for authentication
    
    const urlParams = new URLSearchParams(window.location.search);
    const paypalToken = urlParams.get("token");
    
    if (paypalToken) {
      // Automatically switch to shop tab to trigger payment capture
      selectLandingTab("shop");
    }
  }, [token]);

  useEffect(() => {
    setLocale(preferredLocale);
  }, [preferredLocale]);

  function clampRenownViewState(nextX: number, nextY: number, nextScale: number): RenownViewState {
    const scale = Math.max(RENOWN_MIN_SCALE, Math.min(RENOWN_MAX_SCALE, nextScale));
    const viewport = renownViewportRef.current;
    if (!viewport) {
      return { x: nextX, y: nextY, scale };
    }

    const viewportRect = viewport.getBoundingClientRect();
    const contentWidth = RENOWN_SCENE_WIDTH * scale;
    const contentHeight = RENOWN_SCENE_HEIGHT * scale;
    const marginX = Math.max(72, viewportRect.width * 0.08);
    const marginY = Math.max(58, viewportRect.height * 0.08);

    const x =
      contentWidth + marginX * 2 <= viewportRect.width
        ? (viewportRect.width - contentWidth) / 2
        : Math.max(viewportRect.width - contentWidth - marginX, Math.min(marginX, nextX));
    const y =
      contentHeight + marginY * 2 <= viewportRect.height
        ? (viewportRect.height - contentHeight) / 2
        : Math.max(viewportRect.height - contentHeight - marginY, Math.min(marginY, nextY));

    return { x, y, scale };
  }

  function zoomRenownView(scaleFactor: number, origin?: { x: number; y: number }) {
    setRenownView((current) => {
      const viewport = renownViewportRef.current;
      if (!viewport) {
        return clampRenownViewState(current.x, current.y, current.scale * scaleFactor);
      }

      const viewportRect = viewport.getBoundingClientRect();
      const originX = origin?.x ?? viewportRect.width / 2;
      const originY = origin?.y ?? viewportRect.height / 2;
      const nextScale = Math.max(RENOWN_MIN_SCALE, Math.min(RENOWN_MAX_SCALE, current.scale * scaleFactor));
      const sceneX = (originX - current.x) / current.scale;
      const sceneY = (originY - current.y) / current.scale;
      const nextX = originX - sceneX * nextScale;
      const nextY = originY - sceneY * nextScale;
      return clampRenownViewState(nextX, nextY, nextScale);
    });
  }

  function handleRenownViewportMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    renownDragStateRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: renownView.x,
      viewY: renownView.y
    };
    setIsRenownDragging(true);
  }

  async function handleUnlockRenownNode(nodeId: string) {
    if (!token || isUnlockingRenown) return;
    setIsUnlockingRenown(true);
    try {
      const updated = await unlockRenownNodeApi(token, nodeId);
      setRenownState(updated);
    } catch (err) {
      console.error("Failed to unlock renown node:", err);
    } finally {
      setIsUnlockingRenown(false);
    }
  }

  function handleRenownViewportWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const viewport = renownViewportRef.current;
    if (!viewport) {
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const scaleFactor = event.deltaY < 0 ? 1.12 : 0.9;
    zoomRenownView(scaleFactor, {
      x: event.clientX - viewportRect.left,
      y: event.clientY - viewportRect.top
    });
  }

  useEffect(() => {
    const handleRenownMouseMove = (event: MouseEvent) => {
      const dragState = renownDragStateRef.current;
      if (!dragState) {
        return;
      }
      setRenownView((current) =>
        clampRenownViewState(
          dragState.viewX + (event.clientX - dragState.pointerX),
          dragState.viewY + (event.clientY - dragState.pointerY),
          current.scale
        )
      );
    };

    const stopRenownDrag = () => {
      if (!renownDragStateRef.current) {
        return;
      }
      renownDragStateRef.current = null;
      setIsRenownDragging(false);
    };

    window.addEventListener("mousemove", handleRenownMouseMove);
    window.addEventListener("mouseup", stopRenownDrag);

    return () => {
      window.removeEventListener("mousemove", handleRenownMouseMove);
      window.removeEventListener("mouseup", stopRenownDrag);
    };
  }, []);

  useEffect(() => {
    if (characterHubTab !== "renown") {
      renownDragStateRef.current = null;
      setIsRenownDragging(false);
      return;
    }
    setRenownView((current) => clampRenownViewState(current.x, current.y, current.scale));
  }, [characterHubTab, layoutMode]);



  useEffect(() => {
    if (activeTab !== "inventory" || characterHubTab !== "character") {
      setDraggingInventoryCardId(null);
      setDraggingEquipmentSlotId(null);
      setDropTargetInventoryCardId(null);
      setEquipmentDropTargetSlotId(null);
      setEquipmentDropState(null);
      setInventoryComparisonHover(null);
    }
    if (activeTab !== "inventory") {
      setCanDockInventoryChat(false);
      setIsInventoryChatOverlayOpen(false);
    }
  }, [activeTab, characterHubTab]);

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
      setCanDockInventoryChat(false);
      return;
    }

    const recalculateChatDocking = () => {
      if (layoutMode === "compact") {
        setCanDockInventoryChat(false);
        return;
      }

      const landingPage = landingPageRef.current;
      const leftPanel = leftPanelRef.current;
      const mainPanel = panelViewportMainRef.current;
      if (!landingPage || !leftPanel || !mainPanel) {
        setCanDockInventoryChat(false);
        return;
      }

      const landingPageWidth = landingPage.getBoundingClientRect().width;
      const leftPanelWidth = leftPanel.getBoundingClientRect().width;
      const landingPageStyle = window.getComputedStyle(landingPage);
      const landingColumnGap = Number.parseFloat(landingPageStyle.columnGap || landingPageStyle.gap || "0") || 0;
      const availableRightPanelWidth = Math.max(0, landingPageWidth - leftPanelWidth - landingColumnGap);
      const mainPanelWidth = mainPanel.getBoundingClientRect().width;
      const inheritedSpace = Number.parseFloat(landingPageStyle.getPropertyValue("--space-3") || "0") || 0;
      const sidePanelWidth =
        Number.parseFloat(landingPageStyle.getPropertyValue("--panel-stats-max") || "0") ||
        panelViewportSideRef.current?.getBoundingClientRect().width ||
        0;
      const requiredWidth =
        characterHubTab === "character"
          ? mainPanelWidth + sidePanelWidth * 2 + inheritedSpace * 2
          : mainPanelWidth + sidePanelWidth + inheritedSpace;
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
      if (panelViewportMainRef.current) {
        resizeObserver.observe(panelViewportMainRef.current);
      }
      if (panelViewportGroupRef.current) {
        resizeObserver.observe(panelViewportGroupRef.current);
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
  }, [activeTab, characterHubTab, layoutMode]);

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
      applyAuthoritativePlayerState(null);
      setMerchantState(null);
      setRenownState(null);
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
          applyAuthoritativePlayerState(state);
          const resolvedLocale = normalizeLocale(state.preferredLocale);
          setPreferredLocale(resolvedLocale);
          setLocaleStatusMessage(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          applyAuthoritativePlayerState(null);
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

    // Fetch renown state
    void getMyRenownState(token)
      .then((state) => {
        if (active) {
          setRenownState(state);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          console.error("Failed to fetch renown state:", err);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setMerchantState(null);
      setIsMerchantLoading(false);
      return () => {
        active = false;
      };
    }

    if (activeTab !== "merchant") {
      return () => {
        active = false;
      };
    }

    setIsMerchantLoading(true);

    void fetchMerchantState(token)
      .then((state) => {
        if (active) {
          setMerchantState(toLocalMerchantState(state));
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Merchant state failed");
        }
      })
      .finally(() => {
        if (active) {
          setIsMerchantLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, token, playerState?.playerId]);

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
    pendingContractResultPlayerStateRef.current = pendingContractResultPlayerState;
  }, [pendingContractResultPlayerState]);

  useEffect(() => {
    if (!playerState) {
      setBaseStats(null);
      setCurrencies(null);
      setActiveStatTraining(null);
      setCheatLevelInput("");
      setCheatGardenUnlockedSlotsInput(String(MIN_GARDEN_UNLOCKED_SLOT_COUNT));
      setCheatStatusMessage(null);
      return;
    }

    setChatMessagesByChannel(createInitialChatMessages());
    setActiveChatChannel("world");
    setChatDraft("");
    setIsInventoryChatDockedVisible(true);
    setIsInventoryChatOverlayOpen(false);

    setBaseStats({
      strength: playerState.statSnapshot.base.strength,
      intelligence: playerState.statSnapshot.base.intelligence,
      dexterity: playerState.statSnapshot.base.dexterity,
      vitality: playerState.statSnapshot.base.vitality,
      initiative: playerState.statSnapshot.base.initiative,
      luck: playerState.statSnapshot.base.luck
    });
    setCurrencies({
      ducats: Math.max(playerState.currency.ducats, TEST_MIN_DUCATS),
      imperials: playerState.currency.imperials
    });
    setActiveStatTraining(null);
    setActiveContractEncounter(null);
    setActiveContractRunId(null);
    setCheatLevelInput(String(playerState.level));
    setCheatStatusMessage(null);
  }, [playerState?.playerId]);

  useEffect(() => {
    let active = true;

    if (!token || !playerState) {
      return () => {
        active = false;
      };
    }

    void fetchGardenState(token)
      .then((state) => {
        if (!active) {
          return;
        }

        setCheatGardenUnlockedSlotsInput(String(state.unlockedSlotCount));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [playerState?.playerId, token]);

  useEffect(() => {
    if (!playerState) {
      setCurrencies(null);
      return;
    }

    setCurrencies({
      ducats: Math.max(playerState.currency.ducats, TEST_MIN_DUCATS),
      imperials: playerState.currency.imperials
    });
  }, [playerState?.currency.ducats, playerState?.currency.imperials]);

  useEffect(() => {
    let active = true;

    if (!token || !playerState) {
      setContractSlots([]);
      setActiveContractRunId(null);
      return () => {
        active = false;
      };
    }

    if (activeTab !== "contracts" && !activeContractRunId && activeContractEncounter?.phase !== "travel") {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const board = await fetchContractsBoard(token);
        if (!active) {
          return;
        }

        const nextSlots = mapBoardSlotsToUi(board.slots);
        setContractSlots(nextSlots);

        if (activeContractEncounter?.phase === "combat") {
          return;
        }

        const startedRunId = board.slots.find((slot) => slot.startedRunId)?.startedRunId ?? null;
        setActiveContractRunId(startedRunId);

        if (!startedRunId) {
          setActiveContractEncounter((previousEncounter) =>
            previousEncounter?.phase === "travel" ? null : previousEncounter
          );
          return;
        }

        const run = await fetchContractRun(token, startedRunId);
        if (!active) {
          return;
        }

        const offer = nextSlots.find((slot) => slot.slotIndex === run.slotId)?.offer ?? buildOfferFromRun(run);
        if (run.state === "traveling") {
          setActiveContractEncounter(
            buildTravelEncounterState({
              slotIndex: run.slotId,
              offer,
              run,
              playerAvatarPath: activeCharacterVisualPath
            })
          );
          return;
        }

        const result = await claimContractRun(token, startedRunId);
        if (!active) {
          return;
        }

        setPendingContractResultPlayerState(result.playerState ?? null);

        setActiveContractRunId(null);
        setActiveContractEncounter(
          buildResolvedEncounterState({
            slotIndex: result.run.slotId,
            offer,
            result,
            playerAvatarPath: activeCharacterVisualPath
          })
        );
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Contracts state failed");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeTab, activeCharacterVisualPath, activeContractEncounter?.phase, activeContractRunId, playerState?.playerId, token]);

  useEffect(() => {
    let active = true;
    const effectiveTravelEndsAt = getEffectiveTravelEndsAt(activeContractEncounter);

    if (
      !token ||
      !activeContractRunId ||
      !activeContractEncounter ||
      activeContractEncounter.phase !== "travel" ||
      effectiveTravelEndsAt === null ||
      nowMs < effectiveTravelEndsAt
    ) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const result = await claimContractRun(token, activeContractRunId);
        if (!active) {
          return;
        }

        setPendingContractResultPlayerState(result.playerState ?? null);

        setActiveContractRunId(null);
        setActiveContractEncounter(
          buildResolvedEncounterState({
            slotIndex: activeContractEncounter.slotIndex,
            offer: activeContractEncounter.offer,
            result,
            playerAvatarPath: activeCharacterVisualPath
          })
        );
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Claim contract result failed");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCharacterVisualPath, activeContractEncounter, activeContractRunId, cheatSettings.fastTravelEnabled, nowMs, token]);

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
        activeContractEncounter.combatLogEventIds.includes(currentEvent.eventId);

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
            combatLogEntries: [...snapshot.combatLogEntries, currentEvent.logLine],
            combatLogEventIds: [...snapshot.combatLogEventIds, currentEvent.eventId],
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
    if (
      !pendingContractResultPlayerState ||
      !activeContractEncounter ||
      activeContractEncounter.phase !== "combat" ||
      activeContractEncounter.resolutionState !== "awaiting_return"
    ) {
      return;
    }

    applyContractResultPlayerState(pendingContractResultPlayerState);
    setPendingContractResultPlayerState(null);
  }, [activeContractEncounter?.phase, activeContractEncounter?.resolutionState, pendingContractResultPlayerState]);

  useEffect(() => {
    if (!activeStatTraining) {
      return;
    }
    const effectiveTrainingCompletion = getEffectiveTrainingCompletionTime(activeStatTraining);
    const currentTrainingTime = cheatSettings.fastTrainTimeEnabled ? Date.now() : nowMs;
    if (effectiveTrainingCompletion === null || currentTrainingTime < effectiveTrainingCompletion) {
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
  }, [activeStatTraining, cheatSettings.fastTrainTimeEnabled, nowMs]);

  async function handleGuestLogin() {
    try {
      setError(null);
      const loginResponse = await devGuestLogin();
      window.localStorage.setItem("ebonkeep.dev.token", loginResponse.accessToken);
      selectLandingTab("inventory");
      setToken(loginResponse.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.loginFailed"));
    }
  }

  async function handleCheckCredentials(): Promise<boolean> {
    try {
      setError(null);
      await checkAvailability(authEmail, authUsername);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("errors.registrationFailed"));
      return false;
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
        class: authClass,
        portraitId: authPortraitId,
        backgroundId: authBackgroundId
      });
      window.localStorage.setItem("ebonkeep.dev.token", response.accessToken);
      selectLandingTab("inventory");
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
      selectLandingTab("inventory");
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
      setResendEmailNotif({ msg: response.message || i18n.t("auth.resendSuccess"), success: true });
    } catch (err: unknown) {
      setResendEmailNotif({ msg: err instanceof Error ? err.message : i18n.t("auth.resendFailed"), success: false });
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("ebonkeep.dev.token");
    setToken(null);
    applyAuthoritativePlayerState(null);
    selectLandingTab("inventory");
    setError(null);
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
    setMerchantState(null);
    setMerchantOfferFilters(DEFAULT_INVENTORY_FILTER_STATE);
    setMerchantPlayerFilters(DEFAULT_INVENTORY_FILTER_STATE);
    setActiveStatTraining(null);
    setContractSlots([]);
    setActiveContractEncounter(null);
    setActiveContractRunId(null);
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

  async function runCheatAction<T>(
    action: CheatActionKey,
    callback: () => Promise<T>,
    onSuccess: (result: T) => void
  ) {
    if (!token) {
      return;
    }

    try {
      setActiveCheatAction(action);
      setCheatStatusMessage(null);
      setError(null);
      const result = await callback();
      onSuccess(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t("settings.cheats.actionFailed"));
    } finally {
      setActiveCheatAction(null);
    }
  }

  function handleCheatSettingToggle(setting: keyof PlayerState["cheatSettings"], enabled: boolean) {
    void runCheatAction(
      "settings",
      () =>
        updatePlayerCheatSettings(token!, {
          ...cheatSettings,
          [setting]: enabled
        }),
      (response) => {
        applyAuthoritativePlayerState(response.playerState);
        setCheatStatusMessage(i18n.t("settings.cheats.settingsSaved"));
      }
    );
  }

  function handleCheatReplenish() {
    void runCheatAction(
      "replenish",
      () => replenishPlayerCheats(token!),
      (response) => {
        applyAuthoritativePlayerState(response.playerState);
        setCheatStatusMessage(i18n.t("settings.cheats.replenished"));
      }
    );
  }

  function handleCheatLevelUp() {
    const targetLevel = Number.parseInt(cheatLevelInput, 10);
    if (!playerState || !Number.isFinite(targetLevel) || targetLevel < 1 || targetLevel > 100 || targetLevel === playerState.level) {
      setError(i18n.t("settings.cheats.invalidLevel"));
      return;
    }

    void runCheatAction(
      "levelUp",
      () => levelUpPlayerCheats(token!, { targetLevel }),
      (response) => {
        applyAuthoritativePlayerState(response.playerState);
        setCheatLevelInput(String(response.playerState.level));
        setCheatStatusMessage(
          i18n.t("settings.cheats.levelUpSuccess", {
            level: response.playerState.level
          })
        );
      }
    );
  }

  function handleCheatGenerateEquipment() {
    void runCheatAction(
      "generateEquipment",
      () => generateEquipmentCheats(token!, { rarity: cheatEquipmentRarity }),
      (response) => {
        applyAuthoritativePlayerState(response.playerState);
        setCheatStatusMessage(
          i18n.t("settings.cheats.generateEquipmentSuccess", {
            count: response.generatedItems.length,
            rarity: i18n.t(`settings.cheats.rarities.${cheatEquipmentRarity}`)
          })
        );
      }
    );
  }

  function handleCheatGrantCurrency() {
    void runCheatAction(
      "grantCurrency",
      () => grantCurrencyCheats(token!),
      (response) => {
        applyAuthoritativePlayerState(response.playerState);
        setCheatStatusMessage(
          i18n.t("settings.cheats.currencyGranted", {
            ducats: response.ducatsGranted.toLocaleString(),
            imperials: response.imperialsGranted.toLocaleString()
          })
        );
      }
    );
  }

  function handleCheatUnlockGardenSlots() {
    const unlockedSlotCount = Number.parseInt(cheatGardenUnlockedSlotsInput, 10);
    if (
      !Number.isFinite(unlockedSlotCount) ||
      unlockedSlotCount < MIN_GARDEN_UNLOCKED_SLOT_COUNT ||
      unlockedSlotCount > MAX_GARDEN_SLOT_COUNT
    ) {
      setError(
        i18n.t("settings.cheats.invalidGardenSlotCount", {
          min: MIN_GARDEN_UNLOCKED_SLOT_COUNT,
          max: MAX_GARDEN_SLOT_COUNT
        })
      );
      return;
    }

    void runCheatAction(
      "gardenUnlocks",
      () => updateGardenUnlockedSlots(token!, { unlockedSlotCount }),
      (response) => {
        setCheatGardenUnlockedSlotsInput(String(response.garden.unlockedSlotCount));
        setCheatStatusMessage(
          i18n.t("settings.cheats.gardenSlotsUnlocked", {
            count: response.garden.unlockedSlotCount
          })
        );
      }
    );
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
    const startedAt = Date.now();
    if (cheatSettings.fastTrainTimeEnabled) {
      setBaseStats((previousStats) => {
        if (!previousStats) {
          return previousStats;
        }
        return {
          ...previousStats,
          [stat]: previousStats[stat] + 1
        };
      });
      setActiveStatTraining(null);
      setError(null);
      return;
    }
    setActiveStatTraining({
      stat,
      startedAt,
      completesAt: startedAt + STAT_TRAIN_DURATION_MS
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

  function getItemById(itemId: string): InventoryItem | null {
    return inventoryItems.find((item) => item.id === itemId) ?? null;
  }

  function getMerchantOfferById(offerId: string): MerchantOffer | null {
    return merchantState?.offers.find((offer) => offer.offerId === offerId) ?? null;
  }

  function getEquipValidationError(item: InventoryItem, targetSlotId: EquipmentSlotId): string | null {
    if (!item.equipable) {
      return i18n.t("errors.itemCannotBeEquipped");
    }
    if (!getAllowedSlotIdsForItem(item).includes(targetSlotId)) {
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

  async function handleInventoryCardDoubleClick(itemId: string) {
    const item = getItemById(itemId);
    if (!item) {
      return;
    }
    setInventoryComparisonHover(null);
    const targetSlotId = getPreferredEquipSlot(item);
    if (!targetSlotId) {
      setError(i18n.t("errors.invalidItem"));
      return;
    }
    const validationError = getEquipValidationError(item, targetSlotId);
    if (validationError) {
      setError(validationError);
      return;
    }
    await performInventoryMove(itemId, "inventory", targetSlotId);
  }

  async function handleMerchantOfferInteract(offerId: string) {
    const offer = getMerchantOfferById(offerId);
    if (!offer || isMerchantMutating) {
      return;
    }
    await handleMerchantBuy(offerId);
  }

  async function handleMerchantPlayerItemInteract(itemId: string, fromSlot: string) {
    if (isMerchantMutating) {
      return;
    }
    await handleMerchantSell(itemId, fromSlot);
  }

  const {
    readDragPayload,
    handleEquipmentSlotDoubleClick,
    handleInventoryCardDragStart,
    handleEquipmentSlotDragStart,
    handleMerchantOfferDragStart,
    handleInventoryCardDragOver,
    handleInventoryCardDrop,
    handleMerchantInventoryDrop,
    handlePlayerMerchantListDrop,
    handleInventoryCardDragEnd,
    handleEquipmentSlotDragOver,
    handleEquipmentSlotDrop,
    handleEquipmentSlotDragLeave,
    handleInventoryListDragOver,
    handleInventoryListDrop
  } = createInventoryInteractions({
    allEquipmentSlots: ALL_EQUIPMENT_SLOTS,
    dragPayloadMime: "application/x-ebonkeep-drag-payload",
    sidePanelScrollRef,
    equippedItems,
    merchantOffers: merchantState?.offers,
    draggingEquipmentSlotId,
    draggingInventoryCardId,
    draggingMerchantOfferId,
    dropTargetInventoryCardId,
    dropInsertPosition,
    equipmentDropTargetSlotId,
    setDraggingInventoryCardId,
    setDraggingEquipmentSlotId,
    setDraggingMerchantOfferId,
    setDropTargetInventoryCardId,
    setDropInsertPosition,
    setEquipmentDropTargetSlotId,
    setEquipmentDropState,
    clearInventoryComparisonHover: () => setInventoryComparisonHover(null),
    getItemById,
    getEquipValidationError,
    performInventoryMove,
    handleMerchantPlayerItemInteract,
    handleMerchantOfferInteract
  });

  function toggleInventoryPowerSort() {
    const nextDirection = powerSortDirection === "asc" ? "desc" : "asc";
    setPowerSortDirection(nextDirection);
  }

  function toggleExclusiveInventoryCategoryFilter(filter: InventoryCategoryFilter) {
    const isCurrentlyActive =
      filter === "weapon" ? showOnlyWeapons : filter === "armor" ? showOnlyArmor : showOnlyJewelry;
    const nextActive = !isCurrentlyActive;

    setShowOnlyWeapons(filter === "weapon" ? nextActive : false);
    setShowOnlyArmor(filter === "armor" ? nextActive : false);
    setShowOnlyJewelry(filter === "jewelry" ? nextActive : false);
  }

  function toggleFilterStatePowerSort(setter: (updater: (previous: InventoryFilterState) => InventoryFilterState) => void) {
    setter((previous) => ({
      ...previous,
      powerSortDirection: previous.powerSortDirection === "asc" ? "desc" : "asc"
    }));
  }

  function toggleExclusiveFilterStateCategory(
    setter: (updater: (previous: InventoryFilterState) => InventoryFilterState) => void,
    filter: InventoryCategoryFilter
  ) {
    setter((previous) => {
      const isActive =
        filter === "weapon"
          ? previous.showOnlyWeapons
          : filter === "armor"
            ? previous.showOnlyArmor
            : previous.showOnlyJewelry;
      const nextActive = !isActive;

      return {
        ...previous,
        showOnlyWeapons: filter === "weapon" ? nextActive : false,
        showOnlyArmor: filter === "armor" ? nextActive : false,
        showOnlyJewelry: filter === "jewelry" ? nextActive : false
      };
    });
  }

  function toggleFilterStateWearable(setter: (updater: (previous: InventoryFilterState) => InventoryFilterState) => void) {
    setter((previous) => ({
      ...previous,
      showOnlyWearable: !previous.showOnlyWearable
    }));
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

  function openCombatLog() {
    setIsCombatLogVisible(true);
  }

  function closeCombatLog() {
    setIsCombatLogVisible(false);
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

  function handleInventoryCardMouseEnter(
    item: InventoryItem,
    hoverKey: string,
    cardElement: HTMLElement,
    placement: "left" | "right" = "left"
  ) {
    const rect = cardElement.getBoundingClientRect();
    const viewportPadding = 8;
    const gapPx = 12;
    const panelWidth = Math.min(360, Math.max(260, window.innerWidth - viewportPadding * 2));
    const maxHeight = Math.max(220, window.innerHeight - viewportPadding * 2);
    const comparisonSlotId = item.equipable ? getPreferredEquipSlot(item) : null;
    const comparisonItem = comparisonSlotId ? equippedItems[comparisonSlotId] : null;
    const estimatedPanelHeight = Math.min(
      maxHeight,
      comparisonItem && comparisonItem.id !== item.id ? 640 : 360
    );
    const rightSpace = window.innerWidth - rect.right - viewportPadding;
    const leftSpace = rect.left - viewportPadding;
    const canPlaceRight = rightSpace >= panelWidth;
    const canPlaceLeft = leftSpace >= panelWidth;

    let placeOnRight = placement === "right";
    if (placeOnRight && !canPlaceRight && canPlaceLeft) {
      placeOnRight = false;
    } else if (!placeOnRight && !canPlaceLeft && canPlaceRight) {
      placeOnRight = true;
    } else if (!canPlaceLeft && !canPlaceRight) {
      placeOnRight = rightSpace >= leftSpace;
    }

    const unclampedLeft = placeOnRight ? rect.right + gapPx : rect.left - panelWidth - gapPx;
    const left = Math.round(
      Math.max(viewportPadding, Math.min(unclampedLeft, window.innerWidth - viewportPadding - panelWidth))
    );
    const top = Math.round(
      Math.max(viewportPadding, Math.min(rect.top, window.innerHeight - viewportPadding - estimatedPanelHeight))
    );

    setInventoryComparisonHover({
      hoverKey,
      sourceItem: item,
      comparisonSlotId,
      top,
      left,
      width: panelWidth,
      maxHeight
    });
  }

  function handleInventoryCardMouseLeave(hoverKey: string) {
    setInventoryComparisonHover((previousHover) =>
      previousHover?.hoverKey === hoverKey ? null : previousHover
    );
  }

  function renderInventoryComparisonOverlay(): ReactElement | null {
    if (
      !inventoryComparisonHover ||
      (activeTab === "inventory" && profileSideTab !== "inventory") ||
      (activeTab !== "inventory" && activeTab !== "merchant")
    ) {
      return null;
    }

    const sourceItem = inventoryComparisonHover.sourceItem;
    if (!sourceItem) {
      return null;
    }

    const comparisonItem = inventoryComparisonHover.comparisonSlotId
      ? equippedItems[inventoryComparisonHover.comparisonSlotId]
      : null;
    const resolvedComparisonItem = comparisonItem && comparisonItem.id !== sourceItem.id ? comparisonItem : null;
    const canUseSourceItem = canPlayerUseItem(sourceItem, playerState);
    const canUseComparisonItem = resolvedComparisonItem ? canPlayerUseItem(resolvedComparisonItem, playerState) : false;
    const sourcePowerDelta =
      inventoryComparisonHover.comparisonSlotId && comparisonItem?.id !== sourceItem.id
        ? sourceItem.power - (comparisonItem?.power ?? 0)
        : 0;

    return createPortal(
      <div
        className="inventoryComparisonOverlay"
        style={{
          top: inventoryComparisonHover.top,
          left: inventoryComparisonHover.left,
          width: inventoryComparisonHover.width,
          maxHeight: inventoryComparisonHover.maxHeight
        }}
      >
        <div className="inventoryComparisonOverlayStack">
          <article className={`inventoryDetailCard inventoryHoverDetailCard rarity-${sourceItem.rarity}`}>
            {renderInventoryItemDetailCardBody(sourceItem, canUseSourceItem, undefined, undefined, sourcePowerDelta)}
          </article>
          {resolvedComparisonItem ? (
            <article className={`inventoryDetailCard inventoryComparisonCard rarity-${resolvedComparisonItem.rarity}`}>
              {renderInventoryItemDetailCardBody(
                resolvedComparisonItem,
                canUseComparisonItem,
                undefined,
                "Equipped"
              )}
            </article>
          ) : null}
        </div>
      </div>,
      document.body
    );
  }

  function formatContractEfficiencyTier(tier: ContractEfficiencyTier): string {
    if (tier === "low_cost") {
      return i18n.t("contracts.efficiencyLowCost");
    }
    if (tier === "high_cost") {
      return i18n.t("contracts.efficiencyHighCost");
    }
    return i18n.t("contracts.efficiencyStandardCost");
  }

  function formatContractRoll(roll: ContractRoll): string {
    return i18n.t(`contracts.roll${roll.charAt(0).toUpperCase()}${roll.slice(1)}`);
  }

  function applyContractResultPlayerState(resultPlayerState: PendingContractResultPlayerState) {
    setPlayerState((previousState) => {
      if (!previousState) {
        return previousState;
      }
      return {
        ...previousState,
        level: resultPlayerState.level,
        experience: resultPlayerState.experience,
        experienceIntoLevel: resultPlayerState.experienceIntoLevel,
        experienceToNextLevel: resultPlayerState.experienceToNextLevel,
        health: resultPlayerState.health,
        stamina: resultPlayerState.stamina,
        currency: {
          ...previousState.currency,
          ducats: resultPlayerState.ducats
        }
      };
    });
  }

  async function handleRestPlayer() {
    if (!token || !playerState || isResting) {
      return;
    }

    setIsResting(true);
    setError(null);
    try {
      const result = await restPlayer(token);
      setPendingContractResultPlayerState(null);
      applyAuthoritativePlayerState(result.playerState);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rest failed");
    } finally {
      setIsResting(false);
    }
  }

  async function startContractEncounter(slotIndex: number, offer: ContractOffer) {
    if (!playerState || !token) {
      return;
    }
    try {
      setIsLoadingState(true);
      setIsCombatLogVisible(true);
      setHoveredCombatActorId(null);

      const startedRun = await startContractsRun(token, slotIndex);
      const run = await fetchContractRun(token, startedRun.runId);
      const refreshedPlayerState = await fetchPlayerState(token);

      setActiveContractRunId(startedRun.runId);
      applyAuthoritativePlayerState(refreshedPlayerState);
      setActiveContractEncounter(
        buildTravelEncounterState({
          slotIndex,
          offer,
          run,
          playerAvatarPath: activeCharacterVisualPath
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Start contract failed");
    } finally {
      setIsLoadingState(false);
    }
  }

  async function returnToContractsBoard() {
    if (pendingContractResultPlayerStateRef.current) {
      applyContractResultPlayerState(pendingContractResultPlayerStateRef.current);
      setPendingContractResultPlayerState(null);
    }
    setHoveredCombatActorId(null);
    setActiveContractEncounter(null);
    setActiveContractRunId(null);
    if (!token || !playerState) {
      return;
    }
    try {
      const board = await fetchContractsBoard(token);
      setContractSlots(mapBoardSlotsToUi(board.slots));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Contracts board failed");
    }
  }

  function replayContractEncounter() {
    setHoveredCombatActorId(null);
    setActiveContractEncounter((previousEncounter) => {
      if (!previousEncounter || previousEncounter.phase !== "combat") {
        return previousEncounter;
      }
      return resetCombatEncounterPlayback(previousEncounter);
    });
  }

  function skipContractEncounterToEnd() {
    setActiveContractEncounter((previousEncounter) => {
      if (!previousEncounter || previousEncounter.phase !== "combat") {
        return previousEncounter;
      }
      return skipToEndCombatPlayback(previousEncounter);
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

  async function abandonContractSlot(slotIndex: number) {
    if (!token) {
      return;
    }
    try {
      const board = await abandonContractsSlot(token, slotIndex);
      setContractSlots(mapBoardSlotsToUi(board.slots));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Abandon contract failed");
    }
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
        data-testid={`equipment-slot-${slotId}`}
        draggable={hasItem}
        onDragStart={hasItem ? (event) => handleEquipmentSlotDragStart(event, slotId) : undefined}
        onDragOver={(event) => handleEquipmentSlotDragOver(event, slotId, i18n.t("errors.invalidItem"))}
        onDrop={(event) => handleEquipmentSlotDrop(event, slotId)}
        onDragLeave={(event) => handleEquipmentSlotDragLeave(event, slotId)}
        onDoubleClick={hasItem ? () => handleEquipmentSlotDoubleClick(slotId) : undefined}
        onContextMenu={
          hasItem
            ? (event) => {
                event.preventDefault();
                void handleEquipmentSlotDoubleClick(slotId);
              }
            : undefined
        }
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
            <article className={`inventoryDetailCard inventoryHoverDetailCard equipmentTooltipCard rarity-${rarity}`}>
              {renderInventoryItemDetailCardBody(equippedItem, canUseEquippedItem)}
            </article>
          </div>
        ) : null}
      </div>
    );
  }

  function renderCharacterHubTabs(): ReactElement {
    return <CharacterHubTabs activeTab={characterHubTab} onTabChange={setCharacterHubTab} />;
  }

  function renderCharacterHubPlaceholderPanel(
    title: string,
    description: string,
    details: string
  ): ReactElement {
    return (
      <section className="contentShell">
        <section className="contentStack">
          {renderCharacterHubTabs()}
          <article className="contentCard">
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
          <article className="contentCard">
            <p>{details}</p>
          </article>
        </section>
      </section>
    );
  }

  function renderRenownPanel(): ReactElement {
    return (
      <RenownPanel
        renownViewportRef={renownViewportRef}
        selectedRenownNodeId={selectedRenownNodeId}
        renownView={renownView}
        isRenownDragging={isRenownDragging}
        onViewportMouseDown={handleRenownViewportMouseDown}
        onViewportWheel={handleRenownViewportWheel}
        onSelectNode={setSelectedRenownNodeId}
        renderCharacterHubTabs={renderCharacterHubTabs}
        renownState={renownState}
        isUnlocking={isUnlockingRenown}
        onUnlockNode={(nodeId) => { void handleUnlockRenownNode(nodeId); }}
      />
    );
  }

  function renderLedgerEntryCard(
    item: GeneratedEncyclopediaItem,
    killCount: number
  ): ReactElement {
    return (
      <LedgerEntryCard item={item} killCount={killCount} formatTokenLabel={formatTokenLabel} />
    );
  }

  function renderLedgerPanel(): ReactElement {
    try {
      const monsterItems = normalizeEncyclopediaItems(GENERATED_ITEM_ENCYCLOPEDIA_DATA).filter(
        (item) => item.majorCategory === "monster"
      );
      const byZone = new Map<string, LedgerZoneGroup>();
      for (const item of monsterItems) {
        const zoneId = item.familyId || item.locationName || item.family || item.key;
        const current = byZone.get(zoneId);
        if (current) {
          current.items.push(item);
          continue;
        }
        byZone.set(zoneId, {
          zoneId,
          zoneName: item.locationName || formatTokenLabel(zoneId),
          familyName: item.family || item.locationName || formatTokenLabel(zoneId),
          baseLevel: item.baseLevel,
          items: [item]
        });
      }

      const discoveredZones = [...byZone.values()]
        .filter((zone) => LEDGER_MOCK_DISCOVERED_ZONE_IDS.includes(zone.zoneId))
        .sort((left, right) => {
          if (left.baseLevel !== right.baseLevel) {
            return left.baseLevel - right.baseLevel;
          }
          return left.zoneName.localeCompare(right.zoneName, preferredLocale);
        });

      if (discoveredZones.length === 0) {
        return renderCharacterHubPlaceholderPanel(
          "Ledger",
          "Discovered zones and encountered monsters will be recorded here as a growing account knowledge compendium.",
          "Each entry will show the monster portrait, flavor text, name, slain count, and the current passive bonus granted against its family."
        );
      }

      const activeZone =
        discoveredZones.find((zone) => zone.zoneId === selectedLedgerZoneId) ?? discoveredZones[0];
      const sortedItems = activeZone.items.slice().sort((left, right) => left.sequence - right.sequence);
      const familyKillTotal = sortedItems.reduce((sum, item) => sum + getLedgerMockKillCount(item), 0);
      const familyBonusPercent = getLedgerMockFamilyBonusPercent(familyKillTotal);
      const familyBonusLabel = `+${formatLedgerBonusPercent(familyBonusPercent)}% damage vs ${activeZone.familyName}`;

      return (
        <section className="contentShell">
          <section className="contentStack">
            {renderCharacterHubTabs()}
            <article className="contentCard ledgerControlsCard">
              <h2>Ledger</h2>
              <p>
                A growing field record of known threats. Undiscovered regions do not appear here until first contact.
              </p>
              <div className="encyclopediaTabRow">
                {discoveredZones.map((zone) => (
                  <button
                    key={zone.zoneId}
                    type="button"
                    className={`profileSwitchButton${activeZone.zoneId === zone.zoneId ? " active" : ""}`}
                    onClick={() => setSelectedLedgerZoneId(zone.zoneId)}
                  >
                    {zone.zoneName}
                  </button>
                ))}
              </div>
            </article>
            <article className="contentCard ledgerZoneSummaryCard">
              <div className="ledgerZoneSummary">
                <div className="ledgerZoneSummaryCopy">
                  <h3>{activeZone.zoneName}</h3>
                  <p>
                    {sortedItems.length} known threats entered under {activeZone.familyName}. Every confirmed kill sharpens
                    the record and improves the family-wide countermeasure bonus.
                  </p>
                </div>
                <div className="ledgerZoneSummaryStats">
                  <span className="ledgerZoneBadge">{familyKillTotal} kills logged</span>
                  <span className="ledgerZoneBadge">{familyBonusLabel}</span>
                </div>
              </div>
            </article>
            <article className="contentCard ledgerListCard">
              <div className="ledgerEntryList">
                {sortedItems.map((item) => renderLedgerEntryCard(item, getLedgerMockKillCount(item)))}
              </div>
            </article>
          </section>
        </section>
      );
    } catch {
      return renderCharacterHubPlaceholderPanel(
        "Ledger",
        "Discovered zones and encountered monsters will be recorded here as a growing account knowledge compendium.",
        "The ledger mockup could not be rendered from the generated monster data."
      );
    }
  }

  function renderProfilePanel() {
    return (
      <InventoryManagementPanel
        isLoadingState={isLoadingState}
        playerState={playerState}
        baseStats={baseStats}
        currencies={currencies}
        minimumPreviewDucats={TEST_MIN_DUCATS}
        equipmentStatBonuses={equipmentStatBonuses}
        inventorySlotCapacity={INVENTORY_ITEM_LIMIT}
        inventoryStatFlashes={inventoryStatFlashes}
        activeStatTraining={activeStatTraining}
        nowMs={nowMs}
        statTrainDurationMs={STAT_TRAIN_DURATION_MS}
        profileName={profileName}
        activeCharacterVisualPath={activeCharacterVisualPath}
        activeCharacterVisualName={activeCharacterVisualName}
        canCycleCharacterVisuals={canCycleCharacterVisuals}
        equipmentLeftSlots={EQUIPMENT_LEFT_SLOTS}
        equipmentRightSlots={EQUIPMENT_RIGHT_SLOTS}
        equipmentVestigeSlots={EQUIPMENT_VESTIGE_SLOTS}
        renderCharacterHubTabs={renderCharacterHubTabs}
        renderEquipmentSlotCell={renderEquipmentSlotCell}
        onShowPreviousPortrait={() => {
          const tree = playerState ? classToStatTree(playerState.class) : "strength";
          const pool = PORTRAIT_POOL_BY_TREE[tree];
          if (pool.length === 0) return;
          const currentIndex = pool.findIndex((p) => p.id === activePortraitId);
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const newPortrait = pool[(safeIndex - 1 + pool.length) % pool.length]!;
          setActivePortraitId(newPortrait.id);
          if (token) void updatePortrait(token, { portraitId: newPortrait.id }).catch(() => {});
        }}
        onShowNextPortrait={() => {
          const tree = playerState ? classToStatTree(playerState.class) : "strength";
          const pool = PORTRAIT_POOL_BY_TREE[tree];
          if (pool.length === 0) return;
          const currentIndex = pool.findIndex((p) => p.id === activePortraitId);
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const newPortrait = pool[(safeIndex + 1) % pool.length]!;
          setActivePortraitId(newPortrait.id);
          if (token) void updatePortrait(token, { portraitId: newPortrait.id }).catch(() => {});
        }}
        activeBackgroundPath={activeBackgroundPath}
        onShowPreviousBackground={() => {
          const idx = BACKGROUND_POOL.findIndex((b) => b.id === activeBackgroundId);
          const safeIdx = idx >= 0 ? idx : 0;
          const newBg = BACKGROUND_POOL[(safeIdx - 1 + BACKGROUND_POOL.length) % BACKGROUND_POOL.length]!;
          setActiveBackgroundId(newBg.id);
          if (token) void updatePortrait(token, { backgroundId: newBg.id }).catch(() => {});
        }}
        onShowNextBackground={() => {
          const idx = BACKGROUND_POOL.findIndex((b) => b.id === activeBackgroundId);
          const safeIdx = idx >= 0 ? idx : 0;
          const newBg = BACKGROUND_POOL[(safeIdx + 1) % BACKGROUND_POOL.length]!;
          setActiveBackgroundId(newBg.id);
          if (token) void updatePortrait(token, { backgroundId: newBg.id }).catch(() => {});
        }}
        onStartStatTraining={startStatTraining}
        getTrainingCost={getTrainingCost}
        getStatContributionLines={getStatContributionLines}
        formatDurationFromMs={formatDurationFromMs}
      />
    );
  }

  function renderInventoryCards(items: InventoryItem[], allowDrag: boolean, slotCapacity?: number) {
    const entries =
      typeof slotCapacity === "number"
        ? createFixedInventoryGridEntries(items, slotCapacity)
        : items.map((item) => ({ kind: "item", item }) satisfies InventoryGridEntry);

    return (
      <InventoryCardGrid
        entries={entries}
        allowDrag={allowDrag}
        playerState={playerState}
        draggingInventoryCardId={draggingInventoryCardId}
        dropTargetInventoryCardId={dropTargetInventoryCardId}
        dropInsertPosition={dropInsertPosition}
        onInventoryCardDragStart={handleInventoryCardDragStart}
        onInventoryCardDragOver={handleInventoryCardDragOver}
        onInventoryCardDrop={handleInventoryCardDrop}
        onInventoryCardDoubleClick={handleInventoryCardDoubleClick}
        onInventoryCardMouseEnter={handleInventoryCardMouseEnter}
        onInventoryCardMouseLeave={handleInventoryCardMouseLeave}
        onInventoryCardDragEnd={handleInventoryCardDragEnd}
      />
    );
  }

  function renderInventoryControlsRow(args: {
    idPrefix: string;
    filters: InventoryFilterState;
    totalCount: number;
    shownCount: number;
    onTogglePowerSort: () => void;
    onToggleCategory: (filter: InventoryCategoryFilter) => void;
    onToggleWearable: () => void;
  }): ReactElement {
    return (
      <div className="inventoryToolbarSticky">
        <div className="inventoryControlsRow">
          <div className="inventoryControlWithTooltip">
            <button
              type="button"
              className="inventoryIconButton"
              onClick={args.onTogglePowerSort}
              aria-label={i18n.t("inventory.sortByPower")}
              aria-describedby={`${args.idPrefix}-power-sort-tooltip`}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M7 4L4 7h2v9h2V7h2L7 4zM13 16l3-3h-2V4h-2v9h-2l3 3z" />
              </svg>
            </button>
            <div
              id={`${args.idPrefix}-power-sort-tooltip`}
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
                className={`inventoryIconButton${args.filters.showOnlyWeapons ? " active" : ""}`}
                onClick={() => args.onToggleCategory("weapon")}
                aria-label={i18n.t("inventory.filterWeaponsAria")}
                aria-pressed={args.filters.showOnlyWeapons}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M4 16l4-4 2 2-4 4H4v-2zm8-9l1.5-1.5L16 8l-1.5 1.5L12 7zM10.5 8.5l1-1 1.5 1.5-1 1-1.5-1.5zM8 11l2-2 1.5 1.5-2 2L8 11z" />
                </svg>
              </button>
            </div>
            <div className="inventoryControlWithTooltip">
              <button
                type="button"
                className={`inventoryIconButton${args.filters.showOnlyArmor ? " active" : ""}`}
                onClick={() => args.onToggleCategory("armor")}
                aria-label={i18n.t("inventory.filterArmorAria")}
                aria-pressed={args.filters.showOnlyArmor}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M10 3l5 2v4c0 3.5-2.2 6-5 8-2.8-2-5-4.5-5-8V5l5-2zm0 2.2L7 6.3v2.6c0 2.4 1.4 4.3 3 5.8 1.6-1.5 3-3.4 3-5.8V6.3l-3-1.1z" />
                </svg>
              </button>
            </div>
            <div className="inventoryControlWithTooltip">
              <button
                type="button"
                className={`inventoryIconButton${args.filters.showOnlyJewelry ? " active" : ""}`}
                onClick={() => args.onToggleCategory("jewelry")}
                aria-label={i18n.t("inventory.filterJewelryAria")}
                aria-pressed={args.filters.showOnlyJewelry}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M10 5a5 5 0 105 5 5 5 0 00-5-5zm0 2a3 3 0 110 6 3 3 0 010-6zM4 4h3v2H4zM13 4h3v2h-3z" />
                </svg>
              </button>
            </div>
            <div className="inventoryControlWithTooltip">
              <button
                type="button"
                className={`inventoryIconButton${args.filters.showOnlyWearable ? " active" : ""}`}
                onClick={args.onToggleWearable}
                aria-label={i18n.t("inventory.filterWearableAria")}
                aria-pressed={args.filters.showOnlyWearable}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M7 3h6l2 3-2 2-1-1v9H8V7L7 8 5 6l2-3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <p className="inventoryFilterSummary">
          {i18n.t("inventory.summary", {
            shown: args.shownCount,
            total: args.totalCount
          })}
        </p>
      </div>
    );
  }

  function renderMerchantOffers(): ReactElement {
    const offerEntries = createFixedMerchantOfferEntries(filteredMerchantOffers, INVENTORY_ITEM_LIMIT);

    return (
      <div
        className="inventoryCards merchantDropZone"
        onDragOver={(event) => {
          const payload = readDragPayload(event);
          if (!payload || payload.source === "merchant") {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleMerchantInventoryDrop}
      >
        {offerEntries.map((entry) => {
          if (entry.kind === "empty") {
            return (
              <article
                key={entry.id}
                className="inventoryItemCard inventoryItemCardEmpty"
                data-testid={`merchant-offer-empty-slot-${entry.slotIndex}`}
                draggable={false}
                aria-label={i18n.t("item.empty")}
              >
                {renderEmptyInventorySlotCardBody()}
              </article>
            );
          }

          const { offer } = entry;
          const canUseItem = canPlayerUseItem(offer.item, playerState);

          return (
            <article
              key={offer.offerId}
              className={`inventoryItemCard rarity-${offer.item.rarity}${draggingMerchantOfferId === offer.offerId ? " isDragSource" : ""}`}
              data-testid={`merchant-offer-${offer.offerId}`}
              draggable={!isMerchantMutating}
              onDragStart={(event) => handleMerchantOfferDragStart(event, offer.offerId, offer.item.id)}
              onDragEnd={handleInventoryCardDragEnd}
              onDoubleClick={() => void handleMerchantOfferInteract(offer.offerId)}
              onMouseEnter={(event) => handleInventoryCardMouseEnter(offer.item, offer.offerId, event.currentTarget, "right")}
              onMouseLeave={() => handleInventoryCardMouseLeave(offer.offerId)}
              onContextMenu={(event) => {
                event.preventDefault();
                void handleMerchantOfferInteract(offer.offerId);
              }}
            >
              {renderInventoryItemCardBody(offer.item, canUseItem, offer.buyPriceDucats.toLocaleString())}
            </article>
          );
        })}
      </div>
    );
  }

  function renderMerchantSellCards(entries: Array<{ item: InventoryItem; fromSlot: string }>): ReactElement {
    const paddedEntries = createFixedMerchantSellEntries(entries, INVENTORY_ITEM_LIMIT);

    return (
      <div
        className="inventoryCards merchantDropZone"
        onDragOver={(event) => {
          const payload = readDragPayload(event);
          if (!payload || payload.source !== "merchant") {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={handlePlayerMerchantListDrop}
      >
        {paddedEntries.map((entry) => {
          if (entry.kind === "empty") {
            return (
              <article
                key={entry.id}
                className="inventoryItemCard inventoryItemCardEmpty"
                data-testid={`merchant-player-empty-slot-${entry.slotIndex}`}
                draggable={false}
                aria-label={i18n.t("item.empty")}
              >
                {renderEmptyInventorySlotCardBody()}
              </article>
            );
          }

          const { item, fromSlot } = entry.entry;
          const canUseItem = canPlayerUseItem(item, playerState);
          const sellPrice = merchantState?.sellPrices[item.id] ?? 0;

          return (
            <article
              key={`${fromSlot}-${item.id}`}
              className={`inventoryItemCard rarity-${item.rarity}`}
              data-testid={`merchant-player-item-${item.id}`}
              draggable={!isMerchantMutating}
              onDragStart={
                fromSlot === "inventory"
                  ? (event) => handleInventoryCardDragStart(event, item.id)
                  : (event) => handleEquipmentSlotDragStart(event, fromSlot as EquipmentSlotId)
              }
              onDragEnd={handleInventoryCardDragEnd}
              onDoubleClick={() => void handleMerchantPlayerItemInteract(item.id, fromSlot)}
              onMouseEnter={(event) =>
                handleInventoryCardMouseEnter(item, `${fromSlot}-${item.id}`, event.currentTarget, "left")
              }
              onMouseLeave={() => handleInventoryCardMouseLeave(`${fromSlot}-${item.id}`)}
              onContextMenu={(event) => {
                event.preventDefault();
                void handleMerchantPlayerItemInteract(item.id, fromSlot);
              }}
            >
              {renderInventoryItemCardBody(item, canUseItem, sellPrice.toLocaleString())}
            </article>
          );
        })}
      </div>
    );
  }

  function renderMerchantPanel(): ReactElement {
    return (
      <MerchantPanel
        isMerchantLoading={isMerchantLoading}
        playerState={playerState}
        merchantState={merchantState}
        nowMs={nowMs}
        currencies={currencies}
        isMerchantMutating={isMerchantMutating}
        merchantOfferFilters={merchantOfferFilters}
        merchantPlayerFilters={merchantPlayerFilters}
        merchantInventoryItemsCount={merchantInventoryItems.length + merchantEquippedEntries.length}
        filteredMerchantOffersCount={filteredMerchantOffers.length}
        filteredMerchantInventoryItems={[
          ...filteredMerchantInventoryItems.map((item) => ({ item, fromSlot: "inventory" })),
          ...filteredMerchantEquippedEntries.map((entry) => ({ item: entry.item, fromSlot: entry.slotId }))
        ]}
        onRestock={handleMerchantRestock}
        formatDurationFromMs={formatDurationFromMs}
        renderPlaceholderPanel={renderPlaceholderPanel}
        renderInventoryControlsRow={renderInventoryControlsRow}
        renderMerchantOffers={renderMerchantOffers}
        renderMerchantSellCards={renderMerchantSellCards}
        onToggleOfferPowerSort={() => toggleFilterStatePowerSort(setMerchantOfferFilters)}
        onToggleOfferCategory={(filter) => toggleExclusiveFilterStateCategory(setMerchantOfferFilters, filter)}
        onToggleOfferWearable={() => toggleFilterStateWearable(setMerchantOfferFilters)}
        onTogglePlayerPowerSort={() => toggleFilterStatePowerSort(setMerchantPlayerFilters)}
        onTogglePlayerCategory={(filter) => toggleExclusiveFilterStateCategory(setMerchantPlayerFilters, filter)}
        onTogglePlayerWearable={() => toggleFilterStateWearable(setMerchantPlayerFilters)}
        renderInventoryComparisonOverlay={renderInventoryComparisonOverlay}
      />
    );
  }

  function renderProfileSidePanel() {
    if (isLoadingState || !playerState) {
      return (
        <ProfileSidePanel
          isLoadingState={isLoadingState}
          playerState={playerState}
          inventoryItems={inventoryItems}
          inventorySlotCapacity={INVENTORY_ITEM_LIMIT}
          profileSideTab={profileSideTab}
          sidePanelScrollRef={sidePanelScrollRef}
          filteredInventoryItems={filteredInventoryItems}
          consumableItems={[]}
          groupedStats={[]}
          onTabChange={setProfileSideTab}
          onInventoryScroll={() => setInventoryComparisonHover(null)}
          onInventoryDragOver={handleInventoryListDragOver}
          onInventoryDrop={handleInventoryListDrop}
          onToggleInventoryPowerSort={toggleInventoryPowerSort}
          onToggleInventoryCategory={toggleExclusiveInventoryCategoryFilter}
          onToggleWearable={() => setShowOnlyWearable((previous) => !previous)}
          showOnlyWeapons={showOnlyWeapons}
          showOnlyArmor={showOnlyArmor}
          showOnlyJewelry={showOnlyJewelry}
          showOnlyWearable={showOnlyWearable}
          renderInventoryCards={renderInventoryCards}
          renderInventoryComparisonOverlay={renderInventoryComparisonOverlay}
          formatClassLabel={formatClassLabel}
          renderUnavailablePanel={renderPlaceholderPanel}
        />
      );
    }

    const totalStats = playerState.statSnapshot.total;
    const playerStatTree = classToStatTree(playerState.class);
    const mainOffenseStat =
      playerStatTree === "intelligence"
        ? playerState.stats.intelligence
        : playerStatTree === "dexterity"
          ? playerState.stats.dexterity
          : playerState.stats.strength;
    const mainOffenseTypeLabel =
      playerStatTree === "intelligence"
        ? i18n.t("profile.spellDamage")
        : playerStatTree === "dexterity"
          ? i18n.t("profile.rangedAttackDamage")
          : i18n.t("profile.meleeDamage");
    const flatBonusDamage = Math.floor(mainOffenseStat * 0.1).toFixed(1);

    const groupedStats: Array<{
      title: string;
      rows: Array<{ label: string; value: string | number }>;
    }> = [
      {
        title: i18n.t("profile.defensive"),
        rows: [
          { label: i18n.t("profile.armor"), value: totalStats.armor },
          { label: i18n.t("profile.spellShield"), value: totalStats.spellShield },
          { label: i18n.t("profile.missileResistance"), value: totalStats.missileResistance },
          { label: i18n.t("profile.physicalDefense"), value: totalStats.physicalDefense },
          { label: i18n.t("profile.magicDefense"), value: totalStats.magicDefense },
          { label: i18n.t("profile.maxHitpoints"), value: totalStats.maxHitpoints },
          { label: "Dodge Chance", value: formatBasisPoints(totalStats.dodgeChance) }
        ]
      },
      {
        title: i18n.t("profile.offensive"),
        rows: [
          { label: mainOffenseTypeLabel, value: totalStats.damage },
          { label: "Accuracy", value: totalStats.accuracy },
          { label: i18n.t("profile.critChance"), value: formatBasisPoints(totalStats.critChance) },
          { label: i18n.t("profile.critDamage"), value: formatBasisPoints(totalStats.critMultiplier) },
          { label: i18n.t("profile.chanceToExtraAttack"), value: formatBasisPoints(totalStats.extraAttackChance) },
          { label: i18n.t("profile.flatBonusMainStat"), value: flatBonusDamage }
        ]
      }
    ];

    const consumableItems = inventoryItems.filter((item) => item.category === "Consumable");

    return (
      <ProfileSidePanel
        isLoadingState={isLoadingState}
        playerState={playerState}
        inventoryItems={inventoryItems}
        inventorySlotCapacity={INVENTORY_ITEM_LIMIT}
        profileSideTab={profileSideTab}
        sidePanelScrollRef={sidePanelScrollRef}
        filteredInventoryItems={filteredInventoryItems}
        consumableItems={consumableItems}
        groupedStats={groupedStats}
        onTabChange={setProfileSideTab}
        onInventoryScroll={() => setInventoryComparisonHover(null)}
        onInventoryDragOver={handleInventoryListDragOver}
        onInventoryDrop={handleInventoryListDrop}
        onToggleInventoryPowerSort={toggleInventoryPowerSort}
        onToggleInventoryCategory={toggleExclusiveInventoryCategoryFilter}
        onToggleWearable={() => setShowOnlyWearable((previous) => !previous)}
        showOnlyWeapons={showOnlyWeapons}
        showOnlyArmor={showOnlyArmor}
        showOnlyJewelry={showOnlyJewelry}
        showOnlyWearable={showOnlyWearable}
        renderInventoryCards={renderInventoryCards}
        renderInventoryComparisonOverlay={renderInventoryComparisonOverlay}
        formatClassLabel={formatClassLabel}
        renderUnavailablePanel={renderPlaceholderPanel}
      />
    );
  }

  function renderChatPanel() {
    return (
      <ChatPanel
        activeChatChannel={activeChatChannel}
        activeChatMessages={activeChatMessages}
        chatDraft={chatDraft}
        chatMessagesScrollRef={chatMessagesScrollRef}
        onChannelChange={setActiveChatChannel}
        onClose={closeInventoryChat}
        onDraftChange={setChatDraft}
        onSubmit={handleChatComposerSubmit}
      />
    );
  }

  function renderContractsPanel() {
    const effectiveContractEncounter =
      activeContractEncounter?.phase === "travel"
        ? {
            ...activeContractEncounter,
            travelEndsAt: getEffectiveTravelEndsAt(activeContractEncounter),
            travelDurationMs: getEffectiveTravelDurationMs(activeContractEncounter)
          }
        : activeContractEncounter;

    return (
      <ContractsPanel
        isLoadingState={isLoadingState}
        hasPlayerState={Boolean(playerState)}
        activeContractEncounter={effectiveContractEncounter}
        nowMs={nowMs}
        contractSlots={contractSlots}
        availableContractCount={availableContractSlots.length}
        replenishingContractCount={replenishingContractSlots.length}
        onToggleFastForward={toggleCombatFastForward}
        onReplayCombat={replayContractEncounter}
        onBackToBoard={returnToContractsBoard}
        onStartContractEncounter={startContractEncounter}
        onContractRowKeyDown={handleContractRowKeyDown}
        onAbandonContractSlot={abandonContractSlot}
        formatContractEfficiencyTier={formatContractEfficiencyTier}
        formatContractRoll={formatContractRoll}
        formatDurationFromMs={formatDurationFromMs}
      />
    );
  }

  function renderPlaceholderPanel(title: string, description: string, backgroundName?: "forge") {
    return <PlaceholderPanel title={title} description={description} backgroundName={backgroundName} />;
  }

  function renderCheatsPanel() {
    const cheatsUnavailable = !token || !playerState;
    const cheatToggleLabelStyle: CSSProperties = {
      display: "flex",
      alignItems: "flex-start",
      gap: "10px"
    };
    const cheatToggleInputStyle: CSSProperties = {
      width: "24px",
      height: "24px",
      margin: "2px 0 0",
      flex: "0 0 auto"
    };
    const cheatFieldStyle: CSSProperties = {
      minHeight: "52px",
      padding: "12px 14px",
      fontSize: "16px"
    };

    return (
      <article className="contentCard">
        <h3 style={{ marginTop: 0 }}>{i18n.t("settings.cheats.title")}</h3>
        <p style={{ marginTop: 0, color: "var(--text-muted)" }}>{i18n.t("settings.cheats.description")}</p>
        {cheatsUnavailable ? (
          <p>{i18n.t("settings.cheats.unavailable")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "grid", gap: "12px" }}>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.fastTravelEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) => handleCheatSettingToggle("fastTravelEnabled", event.currentTarget.checked)}
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.fastTravelLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.fastTravelHelp")}
                  </span>
                </span>
              </label>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.fastArenaReplenishEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) =>
                    handleCheatSettingToggle("fastArenaReplenishEnabled", event.currentTarget.checked)
                  }
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.fastArenaReplenishLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.fastArenaReplenishHelp")}
                  </span>
                </span>
              </label>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.fastContractReplenishEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) =>
                    handleCheatSettingToggle("fastContractReplenishEnabled", event.currentTarget.checked)
                  }
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.fastContractReplenishLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.fastContractReplenishHelp")}
                  </span>
                </span>
              </label>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.invincibilityEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) => handleCheatSettingToggle("invincibilityEnabled", event.currentTarget.checked)}
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.invincibilityLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.invincibilityHelp")}
                  </span>
                </span>
              </label>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.fastTrainTimeEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) => handleCheatSettingToggle("fastTrainTimeEnabled", event.currentTarget.checked)}
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.fastTrainTimeLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.fastTrainTimeHelp")}
                  </span>
                </span>
              </label>
              <label style={cheatToggleLabelStyle}>
                <input
                  type="checkbox"
                  style={cheatToggleInputStyle}
                  checked={cheatSettings.unlimitedAcademyDonationsEnabled}
                  disabled={isCheatActionPending("settings")}
                  onChange={(event) =>
                    handleCheatSettingToggle("unlimitedAcademyDonationsEnabled", event.currentTarget.checked)
                  }
                />
                <span style={{ flex: 1 }}>
                  <strong>{i18n.t("settings.cheats.unlimitedAcademyDonationsLabel")}</strong>
                  <span style={{ display: "block", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                    {i18n.t("settings.cheats.unlimitedAcademyDonationsHelp")}
                  </span>
                </span>
              </label>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "end" }}>
              <button type="button" onClick={handleCheatReplenish} disabled={isCheatActionPending("replenish")}>
                {isCheatActionPending("replenish") ? i18n.t("settings.cheats.processing") : i18n.t("settings.cheats.replenishButton")}
              </button>
              <div className="settingsRow" style={{ flex: "1 1 220px", margin: 0 }}>
                <label htmlFor="cheat-level-input">{i18n.t("settings.cheats.levelLabel")}</label>
                <input
                  id="cheat-level-input"
                  type="number"
                  min={1}
                  max={100}
                  value={cheatLevelInput}
                  onChange={(event) => setCheatLevelInput(event.currentTarget.value)}
                  disabled={isCheatActionPending("levelUp")}
                  style={cheatFieldStyle}
                />
              </div>
              <button type="button" onClick={handleCheatLevelUp} disabled={isCheatActionPending("levelUp")}>
                {isCheatActionPending("levelUp") ? i18n.t("settings.cheats.processing") : i18n.t("settings.cheats.levelButton")}
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "end" }}>
              <div className="settingsRow" style={{ flex: "1 1 220px", margin: 0 }}>
                <label htmlFor="cheat-rarity-select">{i18n.t("settings.cheats.rarityLabel")}</label>
                <select
                  id="cheat-rarity-select"
                  value={cheatEquipmentRarity}
                  onChange={(event) => setCheatEquipmentRarity(event.currentTarget.value as ItemRarity)}
                  disabled={isCheatActionPending("generateEquipment")}
                  style={cheatFieldStyle}
                >
                  {(["common", "uncommon", "rare", "epic"] as ItemRarity[]).map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {i18n.t(`settings.cheats.rarities.${rarity}`)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={handleCheatGenerateEquipment} disabled={isCheatActionPending("generateEquipment")}>
                {isCheatActionPending("generateEquipment") ? i18n.t("settings.cheats.processing") : i18n.t("settings.cheats.generateEquipmentButton")}
              </button>
              <button type="button" onClick={handleCheatGrantCurrency} disabled={isCheatActionPending("grantCurrency")}>
                {isCheatActionPending("grantCurrency") ? i18n.t("settings.cheats.processing") : i18n.t("settings.cheats.grantCurrencyButton")}
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "end" }}>
              <div className="settingsRow" style={{ flex: "1 1 220px", margin: 0 }}>
                <label htmlFor="cheat-garden-slots-input">{i18n.t("settings.cheats.gardenSlotCountLabel")}</label>
                <input
                  id="cheat-garden-slots-input"
                  type="number"
                  min={MIN_GARDEN_UNLOCKED_SLOT_COUNT}
                  max={MAX_GARDEN_SLOT_COUNT}
                  value={cheatGardenUnlockedSlotsInput}
                  onChange={(event) => setCheatGardenUnlockedSlotsInput(event.currentTarget.value)}
                  disabled={isCheatActionPending("gardenUnlocks")}
                  style={cheatFieldStyle}
                />
              </div>
              <button type="button" onClick={handleCheatUnlockGardenSlots} disabled={isCheatActionPending("gardenUnlocks")}>
                {isCheatActionPending("gardenUnlocks")
                  ? i18n.t("settings.cheats.processing")
                  : i18n.t("settings.cheats.unlockGardenSlotsButton")}
              </button>
            </div>

            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
              {i18n.t("settings.cheats.currencyHelp")}
            </p>
            {cheatStatusMessage ? <p style={{ margin: 0 }}>{cheatStatusMessage}</p> : null}
          </div>
        )}
      </article>
    );
  }

  function renderSettingsPanel() {
    return (
      <SettingsPanel
        accountInfo={accountInfo}
        preferredLocale={preferredLocale}
        isSavingLocale={isSavingLocale}
        localeStatusMessage={localeStatusMessage}
        onResendVerification={handleResendVerification}
        onLocaleChange={(locale) => void handleLocaleChange(locale)}
        cheatsPanel={renderCheatsPanel()}
        developerToolsPanel={
          accountInfo?.developerToolsEnabled && token && playerState ? (
            <DeveloperContractsSimulationPanel token={token} initialPlayerClass={playerState.class} />
          ) : undefined
        }
      />
    );
  }

  function renderEncyclopediaPanel(embedCharacterHubTabs = false) {
    return (
      <EncyclopediaPanel
        embedCharacterHubTabs={embedCharacterHubTabs}
        encyclopediaCategory={encyclopediaCategory}
        encyclopediaArmorArchetype={encyclopediaArmorArchetype}
        encyclopediaWeaponArchetype={encyclopediaWeaponArchetype}
        preferredLocale={preferredLocale}
        onCategoryChange={setEncyclopediaCategory}
        onArmorArchetypeChange={setEncyclopediaArmorArchetype}
        onWeaponArchetypeChange={setEncyclopediaWeaponArchetype}
        formatTokenLabel={formatTokenLabel}
        renderCharacterHubTabs={renderCharacterHubTabs}
        renderErrorPanel={renderPlaceholderPanel}
      />
    );
  }

  function renderCharacterHubActivePanel(): ReactElement {
    switch (characterHubTab) {
      case "character":
        return renderProfilePanel();
      case "renown":
        return renderRenownPanel();
      case "ledger":
        return renderLedgerPanel();
      case "encyclopedia":
        return renderEncyclopediaPanel(true);
      default:
        return renderProfilePanel();
    }
  }

  function handleAuctionDucatsChange(nextDucats: number) {
    setCurrencies((previous) => ({
      ducats: nextDucats,
      imperials: previous?.imperials ?? playerState?.currency.imperials ?? 0
    }));
    setPlayerState((previous) =>
      previous
        ? {
            ...previous,
            currency: {
              ...previous.currency,
              ducats: nextDucats
            }
          }
        : previous
    );
  }

  function handleJobsDucatsGain(addedDucats: number) {
    setCurrencies((previous) => ({
      ducats: (previous?.ducats ?? playerState?.currency.ducats ?? 0) + addedDucats,
      imperials: previous?.imperials ?? playerState?.currency.imperials ?? 0
    }));
    setPlayerState((previous) =>
      previous
        ? {
            ...previous,
            currency: {
              ...previous.currency,
              ducats: previous.currency.ducats + addedDucats
            }
          }
        : previous
    );
  }

  function renderActivePanel() {
    const guildPanelProps = {
      token,
      currentPlayerId: playerState?.playerId ?? null,
      playerLevel: playerState?.level ?? null,
      playerName: profileName,
      playerClass: playerState?.class ?? null,
      playerPower: playerState?.gearScore ?? null,
      playerDucats: currencies?.ducats ?? 0,
      onActiveMissionChange: setIsGuildMissionActive,
      onDucatsChanged: (n: number) => setCurrencies((c) => (c ? { ...c, ducats: n } : null))
    } as const;

    switch (activeTab) {
      case "inventory":
        return renderCharacterHubActivePanel();
      case "encyclopedia":
        return renderEncyclopediaPanel();
      case "contracts":
        return renderContractsPanel();
      case "missions":
        return (
          <GuildPanel
            {...guildPanelProps}
            requestedTab="missions"
            onDetailTabChange={(nextDetailTab) => {
              if (nextDetailTab !== "missions") {
                selectLandingTab("guild");
              }
            }}
          />
        );
      case "arena":
        return (
          <ArenaPanel
            token={token}
            hasPlayerState={Boolean(playerState)}
            playerName={profileName}
            playerClass={playerState?.class ?? null}
            playerLevel={playerState?.level ?? null}
            playerAvatarPath={activeCharacterVisualPath}
            formatDurationFromMs={formatDurationFromMs}
          />
        );
      case "jobs":
        return (
          <JobsPanel
            token={token}
            hasPlayerState={Boolean(playerState)}
            currentDucats={currencies?.ducats ?? 0}
            playerLevel={playerState?.level ?? null}
            developerToolsEnabled={Boolean(accountInfo?.developerToolsEnabled)}
            onGrantDucats={handleJobsDucatsGain}
            onLockReleaseAtChange={setJobsLockReleaseAtMs}
          />
        );
      case "guild":
        return <GuildPanel {...guildPanelProps} />;
      case "castles":
        return renderPlaceholderPanel(i18n.t("menu.castles"), i18n.t("placeholders.castles"));
      case "auctionHouse":
        return <AuctionHouse token={token} currentDucats={currencies?.ducats ?? 0} playerClass={playerState?.class ?? null} playerLevel={playerState?.level ?? null} equipmentBySlot={equippedItems} onDucatsChange={handleAuctionDucatsChange} />;
      case "merchant":
        return renderMerchantPanel();
      case "shop":
        return <ImperialShop token={token} currentImperials={currencies?.imperials ?? 0} />;
    case "garden":
      return <GardenPanel token={token} />;
      case "refinery":
        return <RefineryPanel token={token} />;
      case "forge":
        return (
          <ForgePanel
            token={token}
            playerState={playerState}
            onPlayerStateChange={applyAuthoritativePlayerState}
          />
        );
        case "leaderboards":
          return <Leaderboard token={token} currentPlayerId={playerState?.playerId ?? null} />;
      case "settings":
        return renderSettingsPanel();
      default:
        return renderPlaceholderPanel(i18n.t("settings.title"), i18n.t("placeholders.panelUnavailable"));
    }
  }

  function selectLandingTab(nextTab: LandingTab) {
    if (isTabLockedByJobs(jobsLockReleaseAtMs, nowMs, nextTab)) {
      setError(i18n.t("jobsPanel.lockedNavigation"));
      return;
    }
    setActiveTab(nextTab);
    setExpandedMenuGroup(getMenuGroupForTab(nextTab));
    if (error === i18n.t("jobsPanel.lockedNavigation")) {
      setError(null);
    }
    if (nextTab === "inventory") {
      setCharacterHubTab("character");
    }
  }

  if (!token) {
    return (
      <AuthScreen
        layoutMode={layoutMode}
        resetToken={resetToken}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        resetPasswordMessage={resetPasswordMessage}
        authMode={authMode}
        authUsername={authUsername}
        authEmail={authEmail}
        authPassword={authPassword}
        authRepeatPassword={authRepeatPassword}
        showPassword={showPassword}
        showRepeatPassword={showRepeatPassword}
        authClass={authClass}
        authPortraitId={authPortraitId}
        authBackgroundId={authBackgroundId}
        showForgotPassword={showForgotPassword}
        forgotPasswordEmail={forgotPasswordEmail}
        forgotPasswordMessage={forgotPasswordMessage}
        error={error}
        onResetPasswordSubmit={handleResetPasswordForm}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onAuthModeChange={setAuthMode}
        onLoginSubmit={handleLogin}
        onRegisterSubmit={handleRegister}
        onAuthUsernameChange={(v) => { setAuthUsername(v); if (error) setError(null); }}
        onAuthEmailChange={(v) => { setAuthEmail(v); if (error) setError(null); }}
        onAuthPasswordChange={setAuthPassword}
        onAuthRepeatPasswordChange={setAuthRepeatPassword}
        onToggleShowPassword={() => setShowPassword((previous) => !previous)}
        onToggleShowRepeatPassword={() => setShowRepeatPassword((previous) => !previous)}
        onShowForgotPassword={() => setShowForgotPassword(true)}
        onForgotPasswordClose={() => {
          setShowForgotPassword(false);
          setForgotPasswordMessage(null);
          setForgotPasswordEmail("");
        }}
        onAuthClassChange={setAuthClass}
        onAuthPortraitChange={setAuthPortraitId}
        onAuthBackgroundChange={setAuthBackgroundId}
        onGuestLogin={handleGuestLogin}
        onForgotPasswordSubmit={handleForgotPassword}
        onForgotPasswordEmailChange={setForgotPasswordEmail}
        onCheckCredentials={handleCheckCredentials}
      />
    );
  }

  return (
      <main className={`appRoot layout-${layoutMode}`}>
        <div className="appSurface">
        {!emailVerified && accountInfo?.provider !== "dev-guest" && (
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
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px"
          }}>
            <span>{"\u26A0\uFE0F"} {i18n.t("auth.verifyEmailBanner")}</span>
            <button
              onClick={handleResendVerification}
              style={{
                background: "rgba(0,0,0,0.15)",
                border: "1px solid rgba(0,0,0,0.3)",
                color: "#000",
                padding: "4px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px"
              }}
            >
              {i18n.t("settings.resendEmail")}
            </button>
          </div>
        )}
{resendEmailNotif && (
          <div style={{
            position: "fixed",
            top: emailVerified ? 0 : "52px",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: resendEmailNotif.success ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)",
            color: "#fff",
            padding: "12px 20px",
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px"
          }}>
            {resendEmailNotif.msg}
            <button
              onClick={() => setResendEmailNotif(null)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.5)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {i18n.t("auth.dismiss")}
            </button>
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
              {i18n.t("auth.dismiss")}
            </button>
          </div>
        )}
        <div className="landingPage" ref={landingPageRef} style={{ paddingTop: !emailVerified && accountInfo?.provider !== "dev-guest" ? "52px" : undefined }}>
          <aside className="leftPanel" ref={leftPanelRef}>
            <div className="leftPanelShell">
              <section className="playerCard">
                <div className="identityRow">
                  <div className="avatar" aria-hidden="true">
                    {playerState ? (
                      <ClassIcon playerClass={playerState.class} size={46} className="avatarClassIcon" alt="" />
                    ) : null}
                  </div>
                  <div className="identityText">
                    <h1>{profileName}</h1>
                    <p>{playerState ? formatClassLabel(playerState.class) : i18n.t("player.classUnknown")}</p>
                    <p>{i18n.t("player.level", { value: playerState?.level ?? "-" })}</p>
                  </div>
                </div>

                <div className="playerCardScoreRow" aria-label="Player combat scores">
                  <HoverTooltip
                    tooltipId="menu-gear-score-tooltip"
                    title={i18n.t("currencies.gearScore")}
                    className={`playerCardScoreItem playerCardScoreItem-gear${
                      inventoryStatFlashes.gearScore
                        ? ` inventoryStatFlash inventoryStatFlash-${inventoryStatFlashes.gearScore.direction}`
                        : ""
                    }`}
                  >
                    <span className="playerCardScoreIcon playerCardScoreIcon-gear" aria-hidden="true">
                      {renderPlayerCardScoreIcon("gear")}
                    </span>
                    <strong
                      className={`playerCardScoreValue${
                        inventoryStatFlashes.gearScore
                          ? ` inventoryStatFlashValue inventoryStatFlashValue-${inventoryStatFlashes.gearScore.direction}`
                          : ""
                      }`}
                    >
                      {playerCardScoreSummary.gear}
                    </strong>
                  </HoverTooltip>
                  <HoverTooltip
                    tooltipId="menu-offensive-score-tooltip"
                    title="Offensive Score"
                    className="playerCardScoreItem playerCardScoreItem-offense"
                    tooltipClassName="uiHoverTooltipBottom"
                    body={
                      <>
                        <p className="uiHoverTooltipLine">
                          <strong>Weapon Damage:</strong> {formatOneDecimal(playerCardScoreSummary.offenseParts.weaponDamage)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Item Damage Bonus:</strong> {playerCardScoreSummary.offenseParts.itemDamageBonus}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Main Stat Bonus:</strong> {formatOneDecimal(playerCardScoreSummary.offenseParts.mainStatBonus)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Base Offense:</strong> {formatOneDecimal(playerCardScoreSummary.offenseParts.baseOffense)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Crit Factor:</strong> x{formatOneDecimal(playerCardScoreSummary.offenseParts.critFactor)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Extra Attack:</strong> x{formatOneDecimal(playerCardScoreSummary.offenseParts.extraAttackFactor)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Hit Chance:</strong> {formatOneDecimal(playerCardScoreSummary.offenseParts.accuracyFactor * 100)}%
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Final Score:</strong> {playerCardScoreSummary.offense}
                        </p>
                      </>
                    }
                  >
                    <span className="playerCardScoreIcon playerCardScoreIcon-offense" aria-hidden="true">
                      {renderPlayerCardScoreIcon("offense")}
                    </span>
                    <strong className="playerCardScoreValue">{playerCardScoreSummary.offense}</strong>
                  </HoverTooltip>
                  <HoverTooltip
                    tooltipId="menu-defensive-score-tooltip"
                    title="Defensive Score"
                    className="playerCardScoreItem playerCardScoreItem-defense"
                    tooltipClassName="uiHoverTooltipBottom"
                    body={
                      <>
                        <p className="uiHoverTooltipLine">
                          <strong>Max HP:</strong> {playerCardScoreSummary.defenseParts.maxHitpoints}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Melee Mit:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.meleeMitigation)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Ranged Mit:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.rangedMitigation)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Magic Mit:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.magicMitigation)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Avg Mitigation:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.averageMitigation)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>HP Contribution:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.hitpointContribution)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Mitigation Contribution:</strong> {formatOneDecimal(playerCardScoreSummary.defenseParts.mitigationContribution)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Dodge Factor:</strong> x{formatOneDecimal(playerCardScoreSummary.defenseParts.dodgeFactor)}
                        </p>
                        <p className="uiHoverTooltipLine">
                          <strong>Final Score:</strong> {playerCardScoreSummary.defense}
                        </p>
                      </>
                    }
                  >
                    <span className="playerCardScoreIcon playerCardScoreIcon-defense" aria-hidden="true">
                      {renderPlayerCardScoreIcon("defense")}
                    </span>
                    <strong className="playerCardScoreValue">{playerCardScoreSummary.defense}</strong>
                  </HoverTooltip>
                </div>

                <div className="barBlock">
                  <HoverTooltip tooltipId="menu-health-bar-tooltip" title={i18n.t("bars.health")} className="barShellTooltipTrigger">
                    <div className="barShell" aria-label={i18n.t("bars.health")}>
                      <div className="barFill healthFill" style={{ width: `${healthPercent}%` }} />
                      <span className="barValue">{healthLabel}</span>
                    </div>
                  </HoverTooltip>
                </div>

                <div className="barBlock">
                  <HoverTooltip tooltipId="menu-stamina-bar-tooltip" title={i18n.t("bars.stamina")} className="barShellTooltipTrigger">
                    <div className="barShell" aria-label={i18n.t("bars.stamina")}>
                      <div className="barFill staminaFill" style={{ width: `${staminaPercent}%` }} />
                      <span className="barValue">{staminaLabel}</span>
                    </div>
                  </HoverTooltip>
                </div>

                <div className="barBlock">
                  <HoverTooltip tooltipId="menu-experience-bar-tooltip" title={i18n.t("bars.experience")} className="barShellTooltipTrigger">
                    <div className="barShell" aria-label={i18n.t("bars.experience")}>
                      <div className="barFill xpFill" style={{ width: `${xpPercent}%` }} />
                      <span className="barValue">{xpLabel}</span>
                    </div>
                  </HoverTooltip>
                </div>

                <div className="playerCardActionRow">
                  <button
                    type="button"
                    className="playerCardActionButton"
                    onClick={handleRestPlayer}
                    disabled={!playerState || isResting}
                  >
                    {isResting ? i18n.t("player.resting") : i18n.t("player.rest")}
                  </button>
                </div>

                <div className="playerCardCurrencyRow" aria-label="Player currencies">
                  <HoverTooltip
                    tooltipId="menu-ducats-tooltip"
                    title={i18n.t("currencies.ducats")}
                    className="playerCardCurrencyPair"
                  >
                    <strong className="playerCardCurrencyValue ducats">{playerCardCurrencies.ducats.toLocaleString()}</strong>
                    <span className="currencyIcon ducatIcon ducatCurrencyIcon playerCardCurrencyIcon" aria-hidden="true">
                      <img className="currencyIconImage" src={DUCATS_ICON_PATH} alt="" />
                    </span>
                  </HoverTooltip>
                  <HoverTooltip
                    tooltipId="menu-imperials-tooltip"
                    title={i18n.t("currencies.imperials")}
                    className="playerCardCurrencyPair"
                  >
                    <strong className="playerCardCurrencyValue imperials">{playerCardCurrencies.imperials.toLocaleString()}</strong>
                    <span className="currencyIcon imperialIcon imperialCurrencyIcon playerCardCurrencyIcon" aria-hidden="true">
                      <img className="currencyIconImage" src={IMPERIALS_ICON_PATH} alt="" />
                    </span>
                  </HoverTooltip>
                </div>
              </section>

              <section className="menuCard">
                <nav className="menuList">
                  {MENU_GROUPS.map((menuGroup) => {
                    const isGroupActive = getMenuGroupForTab(activeTab) === menuGroup.id;
                    const isExpanded = expandedMenuGroup === menuGroup.id;

                    return (
                      <div key={menuGroup.id} className={`menuGroup${isExpanded ? " expanded" : ""}`}>
                        <button
                          type="button"
                          className={`menuButton menuGroupButton${isGroupActive ? " active" : ""}`}
                          data-testid={`menu-group-${menuGroup.id}`}
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedMenuGroup(menuGroup.id)}
                        >
                          <span className="menuButtonIcon" aria-hidden="true">
                            {renderMenuIcon(menuGroup.iconTab)}
                          </span>
                          <span className="menuButtonLabel">{formatMenuGroupLabel(menuGroup.id)}</span>
                          <span className={`menuGroupChevron${isExpanded ? " expanded" : ""}`} aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </span>
                        </button>
                        {isExpanded ? (
                          <div className="menuSubList">
                            {menuGroup.tabs.map((menuItemId) => {
                              const isMenuTabLocked = isTabLockedByJobs(jobsLockReleaseAtMs, nowMs, menuItemId);

                              return (
                                <button
                                  key={menuItemId}
                                  type="button"
                                  className={`menuButton menuSubButton${activeTab === menuItemId ? " active" : ""}`}
                                  data-testid={`menu-${menuItemId}`}
                                  aria-disabled={isMenuTabLocked}
                                  data-locked={isMenuTabLocked ? "true" : undefined}
                                  title={isMenuTabLocked ? i18n.t("jobsPanel.lockedNavigation") : undefined}
                                  onClick={() => selectLandingTab(menuItemId)}
                                >
                                  <span className="menuButtonIcon" aria-hidden="true">
                                    {renderMenuIcon(menuItemId)}
                                  </span>
                                  <span className="menuButtonLabel">{formatMenuLabel(menuItemId)}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
                <button className="logoutButton" onClick={handleLogout}>
                  {i18n.t("menu.logout")}
                </button>
              </section>
            </div>
          </aside>

          <section className="rightPanel" ref={rightPanelRef}>
            {activeTab === "inventory" && characterHubTab === "character" ? (
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
            ) : activeTab === "inventory" ? (
              <div
                className={`characterHubViewportGroup${
                  canDockInventoryChat && isInventoryChatDockedVisible ? " characterHubViewportGroupWithChat" : ""
                }`}
                ref={panelViewportGroupRef}
              >
                <div className="panelViewport characterHubExpandedViewport" ref={panelViewportMainRef}>
                  {renderCharacterHubActivePanel()}
                </div>
                {canDockInventoryChat && isInventoryChatDockedVisible ? (
                  <div className="panelViewportSide panelViewportChat" ref={panelViewportSideRef}>
                    {renderChatPanel()}
                  </div>
                ) : null}
                {!canDockInventoryChat && isInventoryChatOverlayOpen ? (
                  <section className="inventoryChatPanelOverlayViewport inventoryChatPanelOverlayViewportRight">
                    {renderChatPanel()}
                  </section>
                ) : null}
              </div>
            ) : activeTab === "contracts" &&
              activeContractEncounter &&
              activeContractEncounter.phase === "travel" ? (
              <div className="panelViewport contractsCombatViewportExpanded">
                {renderContractsPanel()}
              </div>
            ) : activeTab === "contracts" &&
              activeContractEncounter &&
              activeContractEncounter.phase === "combat" ? (
              <>
                {isCombatLogVisible ? (
                  <div className="panelViewportGroup contractsCombatViewportGroup">
                    <div className="panelViewportProfileMain contractsCombatViewportMain">
                      <div className="contractsCombatViewportMainStack">
                        <CombatEncounterTurnTrackPanel
                          encounter={activeContractEncounter.encounter}
                          timeline={activeContractEncounter.timeline}
                          currentEventIndex={activeContractEncounter.currentEventIndex}
                          hpByActorId={activeContractEncounter.hpByActorId}
                          currentAction={activeContractEncounter.activeAction}
                          resolutionState={activeContractEncounter.resolutionState}
                          hoveredActorId={hoveredCombatActorId}
                          onHoverActor={setHoveredCombatActorId}
                        />
                        <CombatEncounterArenaPanel
                          encounter={activeContractEncounter.encounter}
                          timeline={activeContractEncounter.timeline}
                          currentEventIndex={activeContractEncounter.currentEventIndex}
                          hpByActorId={activeContractEncounter.hpByActorId}
                          currentAction={activeContractEncounter.activeAction}
                          impactTargetId={activeContractEncounter.impactTargetId}
                          playbackRate={getEncounterAnimationRate(activeContractEncounter)}
                          isFastForwardEnabled={activeContractEncounter.playbackRate === 5}
                          hoveredActorId={hoveredCombatActorId}
                          resolutionState={activeContractEncounter.resolutionState}
                          onToggleFastForward={toggleCombatFastForward}
                          onSkipToEnd={skipContractEncounterToEnd}
                          onReplayCombat={replayContractEncounter}
                          onBackToBoard={returnToContractsBoard}
                        />
                      </div>
                    </div>
                    <div className="panelViewportSide contractsCombatViewportSide">
                      <CombatEncounterLogPanel
                        encounter={activeContractEncounter.encounter}
                        timeline={activeContractEncounter.timeline}
                        currentEventIndex={activeContractEncounter.currentEventIndex}
                        combatLogEntries={activeContractEncounter.combatLogEntries}
                        combatLogEventIds={activeContractEncounter.combatLogEventIds}
                        resolutionState={activeContractEncounter.resolutionState}
                        typedSummaryLine={activeContractEncounter.typedSummaryLine}
                        onCloseLog={closeCombatLog}
                        onReplayCombat={replayContractEncounter}
                        onBackToBoard={returnToContractsBoard}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="panelViewport contractsCombatViewportExpanded">
                    <div className="contractsCombatViewportMainStack">
                      <CombatEncounterTurnTrackPanel
                        encounter={activeContractEncounter.encounter}
                        timeline={activeContractEncounter.timeline}
                        currentEventIndex={activeContractEncounter.currentEventIndex}
                        hpByActorId={activeContractEncounter.hpByActorId}
                        currentAction={activeContractEncounter.activeAction}
                        resolutionState={activeContractEncounter.resolutionState}
                        hoveredActorId={hoveredCombatActorId}
                        onHoverActor={setHoveredCombatActorId}
                      />
                      <CombatEncounterArenaPanel
                        encounter={activeContractEncounter.encounter}
                        timeline={activeContractEncounter.timeline}
                        currentEventIndex={activeContractEncounter.currentEventIndex}
                        hpByActorId={activeContractEncounter.hpByActorId}
                        currentAction={activeContractEncounter.activeAction}
                        impactTargetId={activeContractEncounter.impactTargetId}
                        playbackRate={getEncounterAnimationRate(activeContractEncounter)}
                        isFastForwardEnabled={activeContractEncounter.playbackRate === 5}
                        hoveredActorId={hoveredCombatActorId}
                        resolutionState={activeContractEncounter.resolutionState}
                        onToggleFastForward={toggleCombatFastForward}
                        onSkipToEnd={skipContractEncounterToEnd}
                        onReplayCombat={replayContractEncounter}
                        onBackToBoard={returnToContractsBoard}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === "guild" && isGuildMissionActive ? (
              <div className="panelViewport contractsCombatViewportExpanded">
                {renderActivePanel()}
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

          {activeTab === "contracts" &&
          activeContractEncounter &&
          activeContractEncounter.phase === "combat" &&
          !isCombatLogVisible ? (
            <button
              className="inventoryChatFloatingToggle combatLogFloatingToggle"
              onClick={openCombatLog}
              aria-label={i18n.t("contracts.combatLog")}
              aria-pressed="false"
              type="button"
            >
              <svg
                className="inventoryChatFloatingToggleIcon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M7 3h8l3 3v14H7V3Zm2 4h6V5H9v2Zm0 4h7V9H9v2Zm0 4h7v-2H9v2Zm0 4h5v-2H9v2Z" />
              </svg>
            </button>
          ) : null}

          {error ? <div className="error floatingError">{i18n.t("app.errorPrefix")}: {error}</div> : null}


        </div>
      </div>
    </main>
  );
}

type HoverTooltipProps = {
  tooltipId: string;
  title: string;
  className?: string;
  tooltipClassName?: string;
  body?: ReactNode;
  children: ReactNode;
};

function HoverTooltip({ tooltipId, title, className, tooltipClassName, body, children }: HoverTooltipProps): ReactElement {
  return (
    <div className={`uiHoverTooltipTrigger${className ? ` ${className}` : ""}`} aria-describedby={tooltipId}>
      {children}
      <div id={tooltipId} className={`uiHoverTooltip${tooltipClassName ? ` ${tooltipClassName}` : ""}`} role="tooltip">
        <p className="uiHoverTooltipTitle">{title}</p>
        {body}
      </div>
    </div>
  );
}

