import { z } from "zod";

import {
  allPlayerClasses,
  armorArchetypeSchema,
  equipmentGroupSchema,
  equipmentSlotIdSchema,
  itemMajorCategorySchema,
  playerClassSchema,
  playerStatBonusesSchema,
  playerStatKeySchema,
  type ArmorArchetype,
  type ItemMajorCategory,
  type PlayerClass,
  type WeaponArchetype,
  weaponArchetypeSchema,
  weaponFamilySchema
} from "../../core/index.js";
import { playerStateSchema } from "../player/index.js";

const vestigeIds = [
  "ashen-sovereign",
  "hollow-star",
  "silent-judgement",
  "gilded-seraph",
  "drowned-oracle",
  "emberwake",
  "veiled-matron",
  "black-meridian",
  "iron-revenant",
  "pale-dominion",
  "umbral-thorn",
  "first-light"
] as const;

export const vestigeIdSchema = z.enum(vestigeIds);
export type VestigeId = z.infer<typeof vestigeIdSchema>;

export type VestigeCatalogEntry = {
  id: VestigeId;
  name: string;
  majorCategory: "vestige";
  equipable: true;
  bonusesTbd: true;
};

export const VESTIGE_CATALOG: readonly VestigeCatalogEntry[] = [
  { id: "ashen-sovereign", name: "Vestige of the Ashen Sovereign", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "hollow-star", name: "Vestige of the Hollow Star", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "silent-judgement", name: "Vestige of Silent Judgement", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "gilded-seraph", name: "Vestige of the Gilded Seraph", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "drowned-oracle", name: "Vestige of the Drowned Oracle", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "emberwake", name: "Vestige of Emberwake", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "veiled-matron", name: "Vestige of the Veiled Matron", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "black-meridian", name: "Vestige of Black Meridian", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "iron-revenant", name: "Vestige of the Iron Revenant", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "pale-dominion", name: "Vestige of Pale Dominion", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "umbral-thorn", name: "Vestige of the Umbral Thorn", majorCategory: "vestige", equipable: true, bonusesTbd: true },
  { id: "first-light", name: "Vestige of First Light", majorCategory: "vestige", equipable: true, bonusesTbd: true }
];

export const MAX_EQUIPPED_VESTIGES = 3;

export const armorArchetypeAllowedClasses: Record<ArmorArchetype, readonly PlayerClass[]> = {
  // grouped by equipment group (weapon stat), not primary archetype
  heavy: ["juggernaut", "arbalist", "runecaster"],   // warrior equipment (STR weapon)
  light: ["sentinel", "disciple", "voidcaster"],   // ranger equipment (DEX weapon)
  robe:  ["reaver", "shade", "arcanist"]             // mage equipment (INT weapon)
};

export const weaponArchetypeAllowedClasses: Record<WeaponArchetype, readonly PlayerClass[]> = {
  melee: ["juggernaut", "sentinel", "reaver", "shade", "disciple"],
  arcane: ["runecaster", "voidcaster", "arcanist"],
  ranged: ["arbalist"]
};

export function getAllowedClassesForArchetype(
  majorCategory: ItemMajorCategory,
  archetype?: ArmorArchetype | WeaponArchetype
): readonly PlayerClass[] {
  if (majorCategory === "jewelry" || majorCategory === "vestige") {
    return allPlayerClasses;
  }
  if (majorCategory === "armor") {
    if (!archetype || !armorArchetypeSchema.safeParse(archetype).success) {
      return [];
    }
    return armorArchetypeAllowedClasses[archetype as ArmorArchetype];
  }
  if (majorCategory === "weapon") {
    if (!archetype || !weaponArchetypeSchema.safeParse(archetype).success) {
      return [];
    }
    return weaponArchetypeAllowedClasses[archetype as WeaponArchetype];
  }
  return [];
}

export function isItemUsableByClass(
  playerClass: PlayerClass,
  majorCategory: ItemMajorCategory,
  archetype?: ArmorArchetype | WeaponArchetype
): boolean {
  return getAllowedClassesForArchetype(majorCategory, archetype).includes(playerClass);
}

export type VestigeLoadoutValidation =
  | { valid: true }
  | { valid: false; reason: "max_vestiges_exceeded" | "duplicate_vestige" };

export function validateVestigeLoadout(vestigeIdsToEquip: readonly VestigeId[]): VestigeLoadoutValidation {
  if (vestigeIdsToEquip.length > MAX_EQUIPPED_VESTIGES) {
    return { valid: false, reason: "max_vestiges_exceeded" };
  }
  if (new Set(vestigeIdsToEquip).size !== vestigeIdsToEquip.length) {
    return { valid: false, reason: "duplicate_vestige" };
  }
  return { valid: true };
}

export const itemRaritySchema = z.enum(["common", "uncommon", "rare", "epic"]);
export type ItemRarity = z.infer<typeof itemRaritySchema>;

export const modifierTierSchema = z.enum(["T1", "T2", "T3"]);
export type ModifierTier = z.infer<typeof modifierTierSchema>;

export const itemModifierUnitSchema = z.enum(["flat", "basis_points"]);
export type ItemModifierUnit = z.infer<typeof itemModifierUnitSchema>;

export const itemArchetypeSchema = z.object({
  majorCategory: itemMajorCategorySchema,
  armorArchetype: armorArchetypeSchema.optional(),
  weaponArchetype: weaponArchetypeSchema.optional(),
  weaponFamily: weaponFamilySchema.optional(),
  vestigeId: vestigeIdSchema.optional()
});
export type ItemArchetype = z.infer<typeof itemArchetypeSchema>;
export const equippedItemArchetypeSchema = itemArchetypeSchema;
export type EquippedItemArchetype = ItemArchetype;

export const itemModifierSchema = z.object({
  kind: z.enum(["prefix", "affix"]),
  tier: modifierTierSchema,
  name: z.string(),
  statKey: playerStatKeySchema,
  value: z.number().int(),
  unit: itemModifierUnitSchema
});
export type ItemModifier = z.infer<typeof itemModifierSchema>;

export const weaponDamageRollSchema = z.object({
  minRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  rolledMin: z.number().int().min(0),
  rolledMax: z.number().int().min(0),
  maxRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  averageDamage: z.number().min(0)
});
export type WeaponDamageRoll = z.infer<typeof weaponDamageRollSchema>;

export const itemEnchantingSchema = z.object({
  track: z.enum(["weapon", "armor", "jewelry"]),
  level: z.number().int().min(0).max(10),
  bonusScaleBps: z.number().int().min(0)
});
export type ItemEnchanting = z.infer<typeof itemEnchantingSchema>;

export const inventoryItemSchema = z.object({
  id: z.string(),
  itemCode: z.string(),
  quantity: z.number().int().positive().optional(),
  itemName: z.string(),
  rarity: itemRaritySchema,
  category: z.string(),
  equipable: z.boolean(),
  levelRequirement: z.number().int().min(1).max(100),
  allowedSlotIds: z.array(equipmentSlotIdSchema).min(0),
  baseLevel: z.number().int().min(0).max(100).optional(),
  power: z.number().int().min(0),
  archetype: itemArchetypeSchema,
  statBonuses: playerStatBonusesSchema.default({}),
  damageRoll: weaponDamageRollSchema.optional(),
  prefix: itemModifierSchema.optional(),
  affix: itemModifierSchema.optional(),
  enchanting: itemEnchantingSchema.optional(),
  description: z.string(),
  temperingFailed: z.boolean().optional(),
  damagePenaltyBps: z.number().int().min(0).optional(),
  iconAssetPath: z.string().optional()
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export const equippedItemSchema = inventoryItemSchema;
export type EquippedItem = InventoryItem;

export const equipmentStateSchema = z.object({
  helmet: inventoryItemSchema.nullable(),
  necklace: inventoryItemSchema.nullable(),
  upperArmor: inventoryItemSchema.nullable(),
  belt: inventoryItemSchema.nullable(),
  ringLeft: inventoryItemSchema.nullable(),
  weapon: inventoryItemSchema.nullable(),
  pauldrons: inventoryItemSchema.nullable(),
  gloves: inventoryItemSchema.nullable(),
  lowerArmor: inventoryItemSchema.nullable(),
  boots: inventoryItemSchema.nullable(),
  ringRight: inventoryItemSchema.nullable(),
  vestige1: inventoryItemSchema.nullable(),
  vestige2: inventoryItemSchema.nullable(),
  vestige3: inventoryItemSchema.nullable()
});
export type EquipmentState = z.infer<typeof equipmentStateSchema>;

export const devWeaponAffixSchema = z.object({
  source: z.enum(["prefix", "suffix"]),
  name: z.string(),
  tier: z.enum(["T1", "T2", "T3"]),
  stat: z.string(),
  value: z.number(),
  unit: z.enum(["flat", "basis_points"])
});
export type DevWeaponAffix = z.infer<typeof devWeaponAffixSchema>;

export const devWeaponSchema = z.object({
  displayName: z.string(),
  displayLine: z.string(),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]),
  level: z.number().int().min(1).max(100),
  baseLevel: z.number().int().min(0).max(100),
  weaponFamily: weaponArchetypeSchema,
  allowedClass: equipmentGroupSchema,
  minRollLow: z.number().int().min(0),
  minRollHigh: z.number().int().min(0),
  maxRollLow: z.number().int().min(0),
  maxRollHigh: z.number().int().min(0),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  power: z.number().int().min(0),
  affixSummary: z.string(),
  affixes: z.array(devWeaponAffixSchema),
  flavorText: z.string()
});
export type DevWeapon = z.infer<typeof devWeaponSchema>;

export const inventoryMoveBodySchema = z.object({
  itemId: z.string(),
  fromSlot: z.string(),
  toSlot: z.string()
});
export type InventoryMoveBody = z.infer<typeof inventoryMoveBodySchema>;

export const inventoryMoveResponseSchema = z.object({
  moved: z.boolean(),
  itemId: z.string(),
  playerState: z.lazy(() => playerStateSchema)
});
export type InventoryMoveResponse = z.infer<typeof inventoryMoveResponseSchema>;
