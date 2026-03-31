import { z } from "zod";

import { playerStatKeySchema } from "../../core/index.js";
import { GENERATED_CONSUMABLE_CATALOG, GENERATED_CONSUMABLE_RECIPES } from "./catalog.generated.js";

export const consumableTypeSchema = z.enum(["potion", "tonic", "elixir"]);
export type ConsumableType = z.infer<typeof consumableTypeSchema>;

export const consumableFamilySchema = z.enum([
  "recovery",
  "stamina",
  "defense",
  "precision",
  "offense",
  "frenzy",
  "bulwark",
  "warding",
  "cleansing",
  "momentum",
  "travel",
  "wealth",
  "experience"
]);
export type ConsumableFamily = z.infer<typeof consumableFamilySchema>;

export const consumableRaritySchema = z.enum(["common", "uncommon", "rare", "epic"]);
export type ConsumableRarity = z.infer<typeof consumableRaritySchema>;

export const consumableUnlockBandSchema = z.enum(["easy", "medium", "hard"]);
export type ConsumableUnlockBand = z.infer<typeof consumableUnlockBandSchema>;

export const consumableDurationKindSchema = z.enum(["instant", "encounters", "hours"]);
export type ConsumableDurationKind = z.infer<typeof consumableDurationKindSchema>;

export const consumableDistillTierSchema = z.enum(["base", "d1", "d2"]);
export type ConsumableDistillTier = z.infer<typeof consumableDistillTierSchema>;

export const consumableCraftingTierSchema = z.enum(["t1", "t2", "t3"]);
export type ConsumableCraftingTier = z.infer<typeof consumableCraftingTierSchema>;

export const consumableEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("restore_health_pct_max"),
    value: z.number().int().positive()
  }),
  z.object({
    type: z.literal("restore_stamina_pct_max"),
    value: z.number().int().positive()
  }),
  z.object({
    type: z.literal("stat_flat"),
    target: playerStatKeySchema,
    value: z.number().int()
  }),
  z.object({
    type: z.literal("stat_bps"),
    target: playerStatKeySchema,
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_xp_percent"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_ducats_percent"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_replenish_percent"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_stamina_cost_percent"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_travel_duration_percent"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("contract_item_drop_bps"),
    value: z.number().int()
  }),
  z.object({
    type: z.literal("clear_affliction"),
    target: z.string().min(1),
    value: z.number().int().positive()
  }),
  z.object({
    type: z.literal("affliction_resist_bps"),
    value: z.number().int()
  })
]);
export type ConsumableEffect = z.infer<typeof consumableEffectSchema>;

export const consumableCatalogEntrySchema = z.object({
  consumableId: z.string().min(1),
  itemCode: z.string().min(1),
  displayName: z.string().min(1),
  type: consumableTypeSchema,
  family: consumableFamilySchema,
  rarity: consumableRaritySchema,
  unlockBand: consumableUnlockBandSchema,
  craftingTier: consumableCraftingTierSchema,
  durationKind: consumableDurationKindSchema,
  durationValue: z.number().int().min(0),
  distillGroup: z.string().min(1),
  distillTier: consumableDistillTierSchema,
  legacyReplaces: z.array(z.string().min(1)),
  iconKey: z.string().min(1),
  description: z.string().min(1),
  effects: z.array(consumableEffectSchema)
});
export type ConsumableCatalogEntry = z.infer<typeof consumableCatalogEntrySchema>;

export const consumableRecipeIngredientSchema = z.object({
  itemCode: z.string().min(1),
  quantity: z.number().int().positive()
});
export type ConsumableRecipeIngredient = z.infer<typeof consumableRecipeIngredientSchema>;

export const consumableRecipeKindSchema = z.enum(["craft", "distill"]);
export type ConsumableRecipeKind = z.infer<typeof consumableRecipeKindSchema>;

export const consumableRecipeSchema = z.object({
  recipeId: z.string().min(1),
  recipeKind: consumableRecipeKindSchema,
  outputConsumableId: z.string().min(1),
  outputTier: consumableDistillTierSchema,
  outputItemCode: z.string().min(1),
  outputRarity: consumableRaritySchema,
  outputCraftingTier: consumableCraftingTierSchema,
  ducatCost: z.number().int().nonnegative(),
  craftingTimeSec: z.number().int().nonnegative(),
  requiredLevel: z.number().int().nonnegative(),
  ingredients: z.array(consumableRecipeIngredientSchema).min(1).max(3)
});
export type ConsumableRecipe = z.infer<typeof consumableRecipeSchema>;

export const consumableCatalog = consumableCatalogEntrySchema.array().parse(GENERATED_CONSUMABLE_CATALOG);
export const consumableRecipes = consumableRecipeSchema.array().parse(GENERATED_CONSUMABLE_RECIPES);

export const consumableCatalogByItemCode = Object.freeze(
  Object.fromEntries(consumableCatalog.map((entry) => [entry.itemCode, entry])) as Record<string, ConsumableCatalogEntry>
);

export const baseConsumableCatalog = Object.freeze(
  consumableCatalog.filter((entry) => entry.distillTier === "base")
);

export const baseConsumableCatalogById = Object.freeze(
  Object.fromEntries(baseConsumableCatalog.map((entry) => [entry.consumableId, entry])) as Record<string, ConsumableCatalogEntry>
);

export const consumableRecipesById = Object.freeze(
  Object.fromEntries(consumableRecipes.map((recipe) => [recipe.recipeId, recipe])) as Record<string, ConsumableRecipe>
);

export function getConsumableDefinition(itemCode: string): ConsumableCatalogEntry | null {
  return consumableCatalogByItemCode[itemCode] ?? null;
}

export function getBaseConsumableDefinition(consumableId: string): ConsumableCatalogEntry | null {
  return baseConsumableCatalogById[consumableId] ?? null;
}
