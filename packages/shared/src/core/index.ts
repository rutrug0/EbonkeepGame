import { z } from "zod";

export const playerClassSchema = z.enum(["warrior", "mage", "ranger"]);
export type PlayerClass = z.infer<typeof playerClassSchema>;
export const allPlayerClasses: readonly PlayerClass[] = playerClassSchema.options;

export const itemMajorCategorySchema = z.enum(["armor", "weapon", "jewelry", "vestige"]);
export type ItemMajorCategory = z.infer<typeof itemMajorCategorySchema>;

export const armorArchetypeSchema = z.enum(["heavy", "light", "robe"]);
export type ArmorArchetype = z.infer<typeof armorArchetypeSchema>;

export const weaponArchetypeSchema = z.enum(["melee", "arcane", "ranged"]);
export type WeaponArchetype = z.infer<typeof weaponArchetypeSchema>;

export const weaponFamilySchema = z.enum(["sword", "axe", "wand", "staff", "sling", "bow"]);
export type WeaponFamily = z.infer<typeof weaponFamilySchema>;

export const supportedLocaleSchema = z.enum(["en", "es-419", "pt-BR", "ru", "fil", "zh-CN", "ko"]);
export type SupportedLocale = z.infer<typeof supportedLocaleSchema>;

const equipmentSlotIds = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft",
  "weapon",
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight",
  "vestige1",
  "vestige2",
  "vestige3"
] as const;

export const equipmentSlotIdSchema = z.enum(equipmentSlotIds);
export type EquipmentSlotId = z.infer<typeof equipmentSlotIdSchema>;
export const allEquipmentSlotIds: readonly EquipmentSlotId[] = equipmentSlotIdSchema.options;

const playerStatKeys = [
  "strength",
  "intelligence",
  "dexterity",
  "vitality",
  "initiative",
  "luck",
  "armor",
  "spellShield",
  "missileResistance",
  "maxHitpoints",
  "dodgeChance",
  "damage",
  "critChance",
  "critMultiplier",
  "accuracy",
  "extraAttackChance"
] as const;

export const playerStatKeySchema = z.enum(playerStatKeys);
export type PlayerStatKey = z.infer<typeof playerStatKeySchema>;
export const allPlayerStatKeys: readonly PlayerStatKey[] = playerStatKeySchema.options;

const coreStatKeys = [
  "strength",
  "intelligence",
  "dexterity",
  "vitality",
  "initiative",
  "luck"
] as const;

export const coreStatKeySchema = z.enum(coreStatKeys);
export type CoreStatKey = z.infer<typeof coreStatKeySchema>;
export const allCoreStatKeys: readonly CoreStatKey[] = coreStatKeySchema.options;

export const statBlockSchema = z.object({
  strength: z.number().int(),
  intelligence: z.number().int(),
  dexterity: z.number().int(),
  vitality: z.number().int(),
  initiative: z.number().int(),
  luck: z.number().int()
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const playerStatBlockSchema = z.object({
  strength: z.number().int(),
  intelligence: z.number().int(),
  dexterity: z.number().int(),
  vitality: z.number().int(),
  initiative: z.number().int(),
  luck: z.number().int(),
  armor: z.number().int(),
  spellShield: z.number().int(),
  missileResistance: z.number().int(),
  maxHitpoints: z.number().int().min(0),
  dodgeChance: z.number().int().min(0),
  damage: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  accuracy: z.number().int().min(0),
  extraAttackChance: z.number().int().min(0)
});
export type PlayerStatBlock = z.infer<typeof playerStatBlockSchema>;

export const playerStatBonusesSchema = z.object({
  strength: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  dexterity: z.number().int().optional(),
  vitality: z.number().int().optional(),
  initiative: z.number().int().optional(),
  luck: z.number().int().optional(),
  armor: z.number().int().optional(),
  spellShield: z.number().int().optional(),
  missileResistance: z.number().int().optional(),
  maxHitpoints: z.number().int().optional(),
  dodgeChance: z.number().int().optional(),
  damage: z.number().int().optional(),
  critChance: z.number().int().optional(),
  critMultiplier: z.number().int().optional(),
  accuracy: z.number().int().optional(),
  extraAttackChance: z.number().int().optional()
});
export type PlayerStatBonuses = z.infer<typeof playerStatBonusesSchema>;

export const playerStatSnapshotSchema = z.object({
  base: playerStatBlockSchema,
  equipment: playerStatBlockSchema,
  total: playerStatBlockSchema
});
export type PlayerStatSnapshot = z.infer<typeof playerStatSnapshotSchema>;

export const currencyBalanceSchema = z.object({
  ducats: z.number().int().min(0),
  imperials: z.number().int().min(0)
});
export type CurrencyBalance = z.infer<typeof currencyBalanceSchema>;

export const mainStatToFlatDamageRatio = 0.1;
