import { inventoryItemSchema, type InventoryItem } from "@ebonkeep/shared";

type LegacyAuctionItemData = {
  itemCode?: string;
  itemName?: string;
  name?: string;
  rarity?: string;
  category?: string;
  levelRequirement?: number;
  level?: number;
  baseLevel?: number;
  power?: number;
  equipable?: boolean;
  allowedSlotIds?: string[];
  statBonuses?: Record<string, number>;
  stats?: Record<string, number>;
  damageRoll?: InventoryItem["damageRoll"];
  prefix?: InventoryItem["prefix"];
  affix?: InventoryItem["affix"];
  description?: string;
  iconAssetPath?: string;
  archetype?: InventoryItem["archetype"];
  weaponType?: string;
  armorType?: string;
  jewelryType?: string;
};

export type AuctionItemViewData = {
  itemCode: string;
  itemName: string;
  rarity: string;
  category: string;
  levelRequirement: number;
  baseLevel?: number;
  power: number;
  equipable: boolean;
  allowedSlotIds?: string[];
  statBonuses: Record<string, number>;
  damageRoll?: InventoryItem["damageRoll"];
  prefix?: InventoryItem["prefix"];
  affix?: InventoryItem["affix"];
  description: string;
  iconAssetPath?: string;
  archetype?: InventoryItem["archetype"];
};

type ParsedAuctionItemPayload = {
  inventoryItem: InventoryItem | null;
  viewData: AuctionItemViewData;
};

function parseStoredPayload(storedItemCode: string): unknown {
  try {
    return JSON.parse(storedItemCode);
  } catch {
    return null;
  }
}

function inferArchetype(payload: LegacyAuctionItemData): InventoryItem["archetype"] | undefined {
  if (payload.archetype) {
    return payload.archetype;
  }

  const category = (payload.category ?? "").toLowerCase();
  if (payload.armorType) {
    return {
      majorCategory: "armor",
      armorArchetype: payload.armorType === "platemail" ? "heavy" : payload.armorType === "cloth" ? "robe" : "light"
    };
  }

  if (payload.weaponType) {
    return {
      majorCategory: "weapon",
      weaponArchetype:
        payload.weaponType === "staff" || payload.weaponType === "wand"
          ? "arcane"
          : payload.weaponType === "bow" || payload.weaponType === "crossbow" || payload.weaponType === "sling"
            ? "ranged"
            : "melee",
      weaponFamily:
        payload.weaponType === "crossbow"
          ? "bow"
          : (payload.weaponType as InventoryItem["archetype"]["weaponFamily"] | undefined)
    };
  }

  if (payload.jewelryType || category.includes("ring") || category.includes("necklace") || category.includes("jewelry")) {
    return {
      majorCategory: "jewelry"
    };
  }

  if (category.includes("armor")) {
    return {
      majorCategory: "armor",
      armorArchetype: "heavy"
    };
  }

  if (category.includes("weapon")) {
    return {
      majorCategory: "weapon",
      weaponArchetype: "melee",
      weaponFamily: "sword"
    };
  }

  return undefined;
}

function buildLegacyViewData(payload: LegacyAuctionItemData, storedItemCode: string): AuctionItemViewData {
  return {
    itemCode: payload.itemCode ?? storedItemCode,
    itemName: payload.itemName ?? payload.name ?? "Unknown item",
    rarity: payload.rarity ?? "common",
    category: payload.category ?? "misc",
    levelRequirement: Math.max(1, payload.levelRequirement ?? payload.level ?? payload.baseLevel ?? 1),
    baseLevel: payload.baseLevel,
    power: Math.max(0, payload.power ?? 0),
    equipable: payload.equipable ?? true,
    allowedSlotIds: payload.allowedSlotIds,
    statBonuses: payload.statBonuses ?? payload.stats ?? {},
    damageRoll: payload.damageRoll,
    prefix: payload.prefix,
    affix: payload.affix,
    description: payload.description ?? "",
    iconAssetPath: payload.iconAssetPath,
    archetype: inferArchetype(payload)
  };
}

export function parseAuctionStoredItem(storedItemCode: string): ParsedAuctionItemPayload {
  const parsedPayload = parseStoredPayload(storedItemCode);
  const parsedInventoryItem = inventoryItemSchema.safeParse(parsedPayload);

  if (parsedInventoryItem.success) {
    return {
      inventoryItem: parsedInventoryItem.data,
      viewData: parsedInventoryItem.data
    };
  }

  if (parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)) {
    return {
      inventoryItem: null,
      viewData: buildLegacyViewData(parsedPayload as LegacyAuctionItemData, storedItemCode)
    };
  }

  return {
    inventoryItem: null,
    viewData: buildLegacyViewData({}, storedItemCode)
  };
}

export function buildInventoryItemRecordFromAuctionPayload(args: {
  playerId: string;
  storedItemCode: string;
}): {
  playerId: string;
  slotKey: string;
  itemCode: string;
  quantity: number;
  itemData?: InventoryItem;
} {
  const parsedItem = parseAuctionStoredItem(args.storedItemCode);

  if (parsedItem.inventoryItem) {
    return {
      playerId: args.playerId,
      slotKey: parsedItem.inventoryItem.category || "inventory",
      itemCode: parsedItem.inventoryItem.itemCode,
      quantity: 1,
      itemData: parsedItem.inventoryItem
    };
  }

  return {
    playerId: args.playerId,
    slotKey: parsedItem.viewData.category || "misc",
    itemCode: args.storedItemCode,
    quantity: 1
  };
}
