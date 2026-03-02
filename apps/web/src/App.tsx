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
  itemName: string | null;
  rarity?: Rarity;
  majorCategory: ItemMajorCategory;
  category: string;
  power?: number;
  description?: string;
};

type InventoryItem = {
  id: string;
  itemName: string;
  rarity: Rarity;
  category: string;
  equipable: boolean;
  archetype?: {
    majorCategory: ItemMajorCategory;
    armorArchetype?: ArmorArchetype;
    weaponArchetype?: WeaponArchetype;
    weaponFamily?: WeaponFamily;
    vestigeId?: VestigeId;
  };
  power: number;
  description: string;
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

const INVENTORY_ITEM_LIMIT = 10;
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

const MOCK_EQUIPMENT: Record<EquipmentSlotId, EquipmentSlot> = {
  helmet: {
    label: "Helmet",
    itemName: "Scout Hood",
    rarity: "uncommon",
    majorCategory: "armor",
    category: "Armor",
    power: 31,
    description: "Light reconnaissance hood with reinforced stitching."
  },
  necklace: { label: "Necklace", itemName: null, majorCategory: "jewelry", category: "Jewelry" },
  upperArmor: {
    label: "Upper Armor",
    itemName: "Riveted Vest",
    rarity: "common",
    majorCategory: "armor",
    category: "Armor",
    power: 36,
    description: "Standard issue vest fitted with steel rivets."
  },
  belt: { label: "Belt", itemName: null, majorCategory: "armor", category: "Armor" },
  ringLeft: {
    label: "Ring",
    itemName: "Band of Aim",
    rarity: "uncommon",
    majorCategory: "jewelry",
    category: "Jewelry",
    power: 28,
    description: "A focus ring that sharpens ranged precision."
  },
  weapon: {
    label: "Weapon",
    itemName: "Initiate Iron Blade",
    rarity: "common",
    majorCategory: "weapon",
    category: "Weapon",
    power: 42,
    description: "Balanced training blade used by newly sworn wardens."
  },
  pauldrons: { label: "Pauldrons", itemName: null, majorCategory: "armor", category: "Armor" },
  gloves: { label: "Gloves", itemName: null, majorCategory: "armor", category: "Armor" },
  lowerArmor: {
    label: "Lower Armor",
    itemName: "Braced Legguards",
    rarity: "common",
    majorCategory: "armor",
    category: "Armor",
    power: 33,
    description: "Legguards with articulated plates for steady footing."
  },
  boots: {
    label: "Boots",
    itemName: "Dustwalker Boots",
    rarity: "rare",
    majorCategory: "armor",
    category: "Armor",
    power: 39,
    description: "Hardened soles that hold traction through loose ash."
  },
  ringRight: { label: "Ring", itemName: null, majorCategory: "jewelry", category: "Jewelry" },
  vestige1: {
    label: "Vestige I",
    itemName: "Vestige of Emberwake",
    rarity: "rare",
    majorCategory: "vestige",
    category: "Vestige",
    power: 67,
    description: "A smoldering relic that responds to resolve and aggression."
  },
  vestige2: {
    label: "Vestige II",
    itemName: "Vestige of First Light",
    rarity: "epic",
    majorCategory: "vestige",
    category: "Vestige",
    power: 74,
    description: "Radiant fragment tied to dawn-forged covenant rites."
  },
  vestige3: { label: "Vestige III", itemName: null, majorCategory: "vestige", category: "Vestige" }
};

const EQUIPMENT_STAT_BONUSES: Record<
  EquipmentSlotId,
  Partial<Record<TrainableStatKey, number>>
> = {
  helmet: { intelligence: 1, vitality: 1 },
  necklace: {},
  upperArmor: { strength: 3, vitality: 2 },
  belt: {},
  ringLeft: { dexterity: 2, initiative: 2 },
  weapon: { strength: 4, dexterity: 1 },
  pauldrons: {},
  gloves: {},
  lowerArmor: { strength: 1, vitality: 2 },
  boots: { dexterity: 2, initiative: 1 },
  ringRight: {},
  vestige1: {},
  vestige2: {},
  vestige3: {}
};

const MOCK_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "itm_brigandine_plate",
    itemName: "Brigandine Plate",
    rarity: "rare",
    category: "Armor",
    equipable: true,
    archetype: {
      majorCategory: "armor",
      armorArchetype: "heavy"
    },
    power: 56,
    description: "Riveted chestplate favored by vanguard scouts."
  },
  {
    id: "itm_steel_coffer",
    itemName: "Steel Coffer",
    rarity: "uncommon",
    category: "Container",
    equipable: false,
    power: 24,
    description: "Reinforced lockbox used for contract payouts."
  },
  {
    id: "itm_stamina_minor",
    itemName: "Minor Stamina Draught",
    rarity: "common",
    category: "Consumable",
    equipable: false,
    power: 12,
    description: "Restores a small burst of stamina between encounters."
  },
  {
    id: "itm_rune_fragment",
    itemName: "Rune Fragment",
    rarity: "rare",
    category: "Material",
    equipable: false,
    power: 33,
    description: "Etched shard used in relic inscription."
  },
  {
    id: "itm_worn_satchel",
    itemName: "Worn Satchel",
    rarity: "common",
    category: "Utility",
    equipable: false,
    power: 10,
    description: "Field satchel with spare wraps and thread."
  },
  {
    id: "itm_warden_signet",
    itemName: "Warden Signet",
    rarity: "rare",
    category: "Jewelry",
    equipable: true,
    archetype: {
      majorCategory: "jewelry"
    },
    power: 41,
    description: "Old signet ring recognized by keep sentries."
  },
  {
    id: "itm_ashen_relic",
    itemName: "Ashen Relic",
    rarity: "uncommon",
    category: "Vestige",
    equipable: true,
    archetype: {
      majorCategory: "vestige",
      vestigeId: "ashen-sovereign"
    },
    power: 29,
    description: "Weathered relic that hums near corrupted shrines."
  },
  {
    id: "itm_phoenix_feather",
    itemName: "Phoenix Feather",
    rarity: "epic",
    category: "Rare Material",
    equipable: false,
    power: 68,
    description: "Mythic plume used to temper elite-grade gear."
  },
  {
    id: "itm_potion_cracked",
    itemName: "Cracked Potion",
    rarity: "common",
    category: "Consumable",
    equipable: false,
    power: 9,
    description: "Unstable vial, still useful in low-risk runs."
  },
  {
    id: "itm_bandit_emblem",
    itemName: "Bandit Emblem",
    rarity: "uncommon",
    category: "Trophy",
    equipable: false,
    power: 18,
    description: "Recovered insignia proving local threat clearance."
  }
];

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
  className?: string;
}): ReactElement {
  const iconVisual = resolveItemIconVisual(args);
  const extraClass = args.className ? ` ${args.className}` : "";
  return (
    <span className={`itemVisualIcon itemVisual-${iconVisual.variant}${extraClass}`} aria-hidden="true">
      {iconVisual.label}
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
    MOCK_INVENTORY_ITEMS.slice(0, INVENTORY_ITEM_LIMIT)
  );
  const [contractSlots, setContractSlots] = useState<ContractSlotState[]>(() => initialContractSlots);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => getLayoutMode(window.innerWidth));
  const [profileSideTab, setProfileSideTab] = useState<ProfileSideTab>("inventory");
  const [draggingInventoryCardId, setDraggingInventoryCardId] = useState<string | null>(null);
  const [dropTargetInventoryCardId, setDropTargetInventoryCardId] = useState<string | null>(null);
  const [dropInsertPosition, setDropInsertPosition] = useState<InventoryInsertPosition>("before");
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

    (Object.keys(MOCK_EQUIPMENT) as EquipmentSlotId[]).forEach((slotId) => {
      if (!MOCK_EQUIPMENT[slotId].itemName) {
        return;
      }
      const bonuses = EQUIPMENT_STAT_BONUSES[slotId];
      (Object.keys(bonuses) as TrainableStatKey[]).forEach((statKey) => {
        totals[statKey] += bonuses[statKey] ?? 0;
      });
    });

    return totals;
  }, []);

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
      setDropTargetInventoryCardId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (profileSideTab !== "inventory") {
      setDraggingInventoryCardId(null);
      setDropTargetInventoryCardId(null);
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
          setPlayerState(state);
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
    setInventoryItems(MOCK_INVENTORY_ITEMS.slice(0, INVENTORY_ITEM_LIMIT));
    setDraggingInventoryCardId(null);
    setDropTargetInventoryCardId(null);
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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.setData("application/x-ebonkeep-item-id", itemId);
    setDraggingInventoryCardId(itemId);
    setDropTargetInventoryCardId(itemId);
    setDropInsertPosition("before");
  }

  function handleInventoryCardDragOver(event: DragEvent<HTMLElement>, targetItemId: string) {
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
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryCardDrop(event: DragEvent<HTMLElement>, targetItemId: string) {
    event.preventDefault();
    const sourceItemId =
      event.dataTransfer.getData("application/x-ebonkeep-item-id") ||
      event.dataTransfer.getData("text/plain") ||
      draggingInventoryCardId;
    if (!sourceItemId) {
      return;
    }
    reorderInventoryItems(sourceItemId, targetItemId, dropInsertPosition);
    setDraggingInventoryCardId(null);
    setDropTargetInventoryCardId(null);
  }

  function handleInventoryCardDragEnd() {
    setDraggingInventoryCardId(null);
    setDropTargetInventoryCardId(null);
  }

  function handleInventoryListDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    autoScrollInventoryList(event.clientY);
  }

  function handleInventoryListDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceItemId =
      event.dataTransfer.getData("application/x-ebonkeep-item-id") ||
      event.dataTransfer.getData("text/plain") ||
      draggingInventoryCardId;
    if (!sourceItemId || inventoryItems.length === 0) {
      return;
    }

    const containerRect = event.currentTarget.getBoundingClientRect();
    const insertAtEnd = event.clientY >= containerRect.top + containerRect.height / 2;
    const targetItem = insertAtEnd ? inventoryItems[inventoryItems.length - 1] : inventoryItems[0];
    const fallbackPosition: InventoryInsertPosition = insertAtEnd ? "after" : "before";
    const resolvedPosition =
      dropTargetInventoryCardId !== null ? dropInsertPosition : fallbackPosition;

    reorderInventoryItems(sourceItemId, targetItem.id, resolvedPosition);
    setDraggingInventoryCardId(null);
    setDropTargetInventoryCardId(null);
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
    const slot = MOCK_EQUIPMENT[slotId];
    const hasItem = slot.itemName !== null;
    const rarity = slot.rarity ?? "common";
    const classNames = [
      "equipmentCell",
      "equipmentCellIconOnly",
      extraClassName,
      hasItem ? "hasItem" : "isEmpty",
      hasItem ? `rarity-${rarity}` : ""
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div key={slotId} className={classNames} aria-label={hasItem ? `${slot.label}: ${slot.itemName}` : `${slot.label}: Empty`}>
        {renderItemIcon({
          majorCategory: slot.majorCategory,
          category: slot.category,
          itemName: slot.itemName ?? slot.label,
          className: `equipmentItemIcon${hasItem ? "" : " isPlaceholder"}`
        })}
        {hasItem ? (
          <div className={`equipmentItemTooltip tooltip-${tooltipPlacement}`} role="tooltip">
            <article className={`inventoryItemCard equipmentTooltipCard rarity-${rarity}`}>
              <div className="inventoryCardVisual">
                {renderItemIcon({
                  majorCategory: slot.majorCategory,
                  category: slot.category,
                  itemName: slot.itemName,
                  className: "inventoryCardIcon"
                })}
              </div>
              <div className="inventoryCardContent">
                <div className="inventoryCardTop">
                  <div className="inventoryCardMeta">
                    <h4>{slot.itemName}</h4>
                    <p className="inventoryCardCategory">{slot.category}</p>
                    <p className="inventoryCardCategory">Slot: {slot.label}</p>
                  </div>
                  <span className="inventoryCardRarity">{formatRarityLabel(rarity)}</span>
                </div>
                <p className="inventoryCardDescription">
                  {slot.description ?? `${slot.itemName} is equipped in ${slot.label}.`}
                </p>
                <p className="inventoryCardPower">Power {slot.power ?? 0}</p>
              </div>
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
          const archetypeDetail = item.archetype
            ? `${item.archetype.majorCategory}${
                item.archetype.weaponFamily ? `:${item.archetype.weaponFamily}` : ""
              }`
            : null;
          const archetypeClassKey = item.archetype?.weaponArchetype ?? item.archetype?.armorArchetype;
          const isUsableByClass =
            item.equipable && item.archetype && playerState
              ? isItemUsableByClass(playerState.class, item.archetype.majorCategory, archetypeClassKey)
              : null;
          return (
            <article
              key={item.id}
              className={`inventoryItemCard rarity-${item.rarity}${dragSourceClass}${dropCueClass}`}
              draggable={allowDrag}
              onDragStart={allowDrag ? (event) => handleInventoryCardDragStart(event, item.id) : undefined}
              onDragOver={allowDrag ? (event) => handleInventoryCardDragOver(event, item.id) : undefined}
              onDrop={allowDrag ? (event) => handleInventoryCardDrop(event, item.id) : undefined}
              onDragEnd={allowDrag ? handleInventoryCardDragEnd : undefined}
            >
              <div className="inventoryCardVisual">
                {renderItemIcon({
                  majorCategory: item.archetype?.majorCategory,
                  category: item.category,
                  itemName: item.itemName,
                  className: "inventoryCardIcon"
                })}
              </div>
              <div className="inventoryCardContent">
                <div className="inventoryCardTop">
                  <div className="inventoryCardMeta">
                    <h4>{item.itemName}</h4>
                    <p className="inventoryCardCategory">{item.category}</p>
                    {archetypeDetail ? <p className="inventoryCardCategory">Archetype: {archetypeDetail}</p> : null}
                    {isUsableByClass === false ? (
                      <p className="inventoryCardCategory">Class Restriction: Not usable by your class</p>
                    ) : null}
                  </div>
                  <span className="inventoryCardRarity">{formatRarityLabel(item.rarity)}</span>
                </div>
                <p className="inventoryCardDescription">{item.description}</p>
                <p className="inventoryCardPower">Power {item.power}</p>
              </div>
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
