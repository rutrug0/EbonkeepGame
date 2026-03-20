import { z } from "zod";

import { GARDEN_PLANT_CATALOG, GARDEN_PLANT_IDS } from "./catalog.generated.js";

export const MAX_GARDEN_SLOT_COUNT = 18;
export const MIN_GARDEN_UNLOCKED_SLOT_COUNT = 7;
export const STARTER_GARDEN_SEED_QUANTITY = 999;

export const gardenPlantIdSchema = z.enum(GARDEN_PLANT_IDS);
export type GardenPlantId = z.infer<typeof gardenPlantIdSchema>;

export const gardenPlantRaritySchema = z.enum(["common", "uncommon", "rare"]);
export type GardenPlantRarity = z.infer<typeof gardenPlantRaritySchema>;

export const gardenPlotPhaseSchema = z.enum([
  "empty",
  "growing",
  "pre_bloom",
  "bloom",
  "post_bloom",
  "wilted"
]);
export type GardenPlotPhase = z.infer<typeof gardenPlotPhaseSchema>;

export const gardenInventoryKindSchema = z.enum(["seed", "ingredient"]);
export type GardenInventoryKind = z.infer<typeof gardenInventoryKindSchema>;

export const gardenPlantCatalogEntrySchema = z.object({
  plantId: gardenPlantIdSchema,
  displayName: z.string().min(1),
  rarity: gardenPlantRaritySchema,
  seedItemCode: z.string().min(1),
  ingredientItemCode: z.string().min(1),
  growthSeconds: z.number().int().positive(),
  preBloomSeconds: z.number().int().min(0),
  bloomSeconds: z.number().int().positive(),
  postBloomSeconds: z.number().int().min(0),
  baseYield: z.number().int().min(1),
  bloomYield: z.number().int().min(1),
  recipeRefs: z.array(z.string().min(1))
});
export type GardenPlantCatalogEntry = z.infer<typeof gardenPlantCatalogEntrySchema>;

export const gardenPlantCatalog = z.array(gardenPlantCatalogEntrySchema).parse(GARDEN_PLANT_CATALOG);
export const starterGardenPlantIds: readonly GardenPlantId[] = GARDEN_PLANT_IDS;

export const gardenInventoryEntrySchema = z.object({
  inventoryEntryId: z.string(),
  plantId: gardenPlantIdSchema,
  kind: gardenInventoryKindSchema,
  itemCode: z.string().min(1),
  displayName: z.string().min(1),
  rarity: gardenPlantRaritySchema,
  quantity: z.number().int().min(0)
});
export type GardenInventoryEntry = z.infer<typeof gardenInventoryEntrySchema>;

export const gardenPlotStateSchema = z.object({
  slotIndex: z.number().int().min(1).max(MAX_GARDEN_SLOT_COUNT),
  isUnlocked: z.boolean(),
  plantId: gardenPlantIdSchema.nullable(),
  phase: gardenPlotPhaseSchema,
  plantedAt: z.string().nullable(),
  growthEndsAt: z.string().nullable(),
  bloomStartsAt: z.string().nullable(),
  bloomEndsAt: z.string().nullable(),
  wiltAt: z.string().nullable(),
  nextTransitionAt: z.string().nullable(),
  harvestYield: z.number().int().min(0).nullable()
});
export type GardenPlotState = z.infer<typeof gardenPlotStateSchema>;

export const gardenStateResponseSchema = z.object({
  serverTime: z.string(),
  unlockedSlotCount: z.number().int().min(MIN_GARDEN_UNLOCKED_SLOT_COUNT).max(MAX_GARDEN_SLOT_COUNT),
  plots: z.array(gardenPlotStateSchema).length(MAX_GARDEN_SLOT_COUNT),
  inventory: z.array(gardenInventoryEntrySchema)
});
export type GardenStateResponse = z.infer<typeof gardenStateResponseSchema>;

export const plantGardenSeedBodySchema = z.object({
  plantId: gardenPlantIdSchema
});
export type PlantGardenSeedBody = z.infer<typeof plantGardenSeedBodySchema>;

export const plantGardenSeedResponseSchema = z.object({
  garden: gardenStateResponseSchema
});
export type PlantGardenSeedResponse = z.infer<typeof plantGardenSeedResponseSchema>;

export const harvestGardenPlotRewardSchema = z.object({
  plantId: gardenPlantIdSchema,
  quantity: z.number().int().min(1),
  itemCode: z.string().min(1),
  displayName: z.string().min(1)
});
export type HarvestGardenPlotReward = z.infer<typeof harvestGardenPlotRewardSchema>;

export const harvestGardenPlotResponseSchema = z.object({
  garden: gardenStateResponseSchema,
  harvested: harvestGardenPlotRewardSchema
});
export type HarvestGardenPlotResponse = z.infer<typeof harvestGardenPlotResponseSchema>;

export const clearGardenPlotResponseSchema = z.object({
  garden: gardenStateResponseSchema,
  clearedSlotIndex: z.number().int().min(1).max(MAX_GARDEN_SLOT_COUNT)
});
export type ClearGardenPlotResponse = z.infer<typeof clearGardenPlotResponseSchema>;

export const updateGardenUnlockedSlotsBodySchema = z.object({
  unlockedSlotCount: z.number().int().min(MIN_GARDEN_UNLOCKED_SLOT_COUNT).max(MAX_GARDEN_SLOT_COUNT)
});
export type UpdateGardenUnlockedSlotsBody = z.infer<typeof updateGardenUnlockedSlotsBodySchema>;

export const updateGardenUnlockedSlotsResponseSchema = z.object({
  garden: gardenStateResponseSchema
});
export type UpdateGardenUnlockedSlotsResponse = z.infer<typeof updateGardenUnlockedSlotsResponseSchema>;

export const gardenPlotTimingSchema = z.object({
  plantedAt: z.string(),
  growthEndsAt: z.string(),
  bloomStartsAt: z.string(),
  bloomEndsAt: z.string(),
  wiltAt: z.string()
});
export type GardenPlotTiming = z.infer<typeof gardenPlotTimingSchema>;

export const gardenPlantCatalogById = Object.freeze(
  Object.fromEntries(gardenPlantCatalog.map((entry) => [entry.plantId, entry])) as Record<
    GardenPlantId,
    GardenPlantCatalogEntry
  >
);

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getGardenPlantDefinition(plantId: GardenPlantId): GardenPlantCatalogEntry {
  return gardenPlantCatalogById[plantId];
}

export function normalizeGardenUnlockedSlotCount(unlockedSlotCount: number): number {
  return Math.max(
    MIN_GARDEN_UNLOCKED_SLOT_COUNT,
    Math.min(MAX_GARDEN_SLOT_COUNT, Math.floor(unlockedSlotCount))
  );
}

export function buildGardenPlotTiming(
  plantId: GardenPlantId,
  plantedAtInput: Date | string
): GardenPlotTiming {
  const definition = getGardenPlantDefinition(plantId);
  const plantedAt = toDate(plantedAtInput);

  if (!plantedAt) {
    throw new Error(`Invalid plantedAt value for ${plantId}.`);
  }

  const growthEndsAt = new Date(plantedAt.getTime() + (definition.growthSeconds * 1_000));
  const bloomStartsAt = new Date(growthEndsAt.getTime() + (definition.preBloomSeconds * 1_000));
  const bloomEndsAt = new Date(bloomStartsAt.getTime() + (definition.bloomSeconds * 1_000));
  const wiltAt = new Date(bloomEndsAt.getTime() + (definition.postBloomSeconds * 1_000));

  return gardenPlotTimingSchema.parse({
    plantedAt: plantedAt.toISOString(),
    growthEndsAt: growthEndsAt.toISOString(),
    bloomStartsAt: bloomStartsAt.toISOString(),
    bloomEndsAt: bloomEndsAt.toISOString(),
    wiltAt: wiltAt.toISOString()
  });
}

export function resolveGardenPlotPhase(args: {
  plantId: GardenPlantId | null;
  growthEndsAt?: Date | string | null;
  bloomStartsAt?: Date | string | null;
  bloomEndsAt?: Date | string | null;
  wiltAt?: Date | string | null;
  now?: Date | string;
}): GardenPlotPhase {
  if (!args.plantId) {
    return "empty";
  }

  const now = toDate(args.now ?? new Date());
  const growthEndsAt = toDate(args.growthEndsAt);
  const bloomStartsAt = toDate(args.bloomStartsAt);
  const bloomEndsAt = toDate(args.bloomEndsAt);
  const wiltAt = toDate(args.wiltAt);

  if (!now || !growthEndsAt || !bloomStartsAt || !bloomEndsAt || !wiltAt) {
    return "empty";
  }

  if (now < growthEndsAt) {
    return "growing";
  }
  if (now < bloomStartsAt) {
    return "pre_bloom";
  }
  if (now < bloomEndsAt) {
    return "bloom";
  }
  if (now < wiltAt) {
    return "post_bloom";
  }
  return "wilted";
}

export function getGardenPlotNextTransitionAt(args: {
  phase: GardenPlotPhase;
  growthEndsAt?: Date | string | null;
  bloomStartsAt?: Date | string | null;
  bloomEndsAt?: Date | string | null;
  wiltAt?: Date | string | null;
}): string | null {
  switch (args.phase) {
    case "growing":
      return toDate(args.growthEndsAt)?.toISOString() ?? null;
    case "pre_bloom":
      return toDate(args.bloomStartsAt)?.toISOString() ?? null;
    case "bloom":
      return toDate(args.bloomEndsAt)?.toISOString() ?? null;
    case "post_bloom":
      return toDate(args.wiltAt)?.toISOString() ?? null;
    default:
      return null;
  }
}

export function resolveGardenHarvestYield(args: {
  plantId: GardenPlantId | null;
  phase: GardenPlotPhase;
}): number | null {
  if (!args.plantId) {
    return null;
  }

  const definition = getGardenPlantDefinition(args.plantId);

  if (args.phase === "bloom") {
    return definition.bloomYield;
  }
  if (args.phase === "pre_bloom" || args.phase === "post_bloom") {
    return definition.baseYield;
  }
  if (args.phase === "wilted") {
    return 0;
  }

  return null;
}
