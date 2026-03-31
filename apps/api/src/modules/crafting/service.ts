import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  CRAFTING_OUTPUT_DEFINITIONS,
  CRAFTING_RECYCLING_ITEM_CODES,
  CRAFTING_RECYCLING_SUBSTITUTIONS,
  CRAFTING_MATERIAL_BY_CODE,
  CONSUMABLE_DISTILLATION_RECIPE_BY_ID,
  ITEM_CRAFT_RECIPE_BY_ID,
  MATERIAL_COMBINE_RECIPE_BY_ID,
  craftingClaimJobResponseSchema,
  craftingInventoryResponseSchema,
  craftingJobSchema,
  craftingStartJobResponseSchema,
  type CraftingClaimJobResponse,
  type CraftingInventoryResponse,
  type CraftingJob,
  type CraftingRecipeType,
  type CraftingStartJobResponse,
  type ItemCraftRecipe,
  type MaterialCombineRecipe,
  type RecipeIngredient
} from "@ebonkeep/shared/crafting";
import { inventoryItemSchema, type InventoryItem } from "@ebonkeep/shared/inventory";

type CraftingDbClient = PrismaClient | Prisma.TransactionClient;

type InventoryRow = {
  id: string;
  itemCode: string;
  quantity: number;
  itemData: Prisma.JsonValue | null;
};

type CraftingRecipeLookup =
  | { recipeType: "combine"; recipe: MaterialCombineRecipe }
  | { recipeType: "item" | "distill"; recipe: ItemCraftRecipe };

const ACTIVE_SLOT_INDEXES = [0, 1, 2] as const;
const ARCHIVED_SLOT_INDEX_BASE = 1000;
export const CHEAT_FAST_CRAFT_DURATION_SEC = 3;
const RANDOM_CRAFTING_ICON_FILES: readonly string[] = Array.from(
  { length: 23 },
  (_, index) => `material-${(index + 1).toString().padStart(2, "0")}.png`
);

const SUBSTITUTION_CODES_BY_TARGET: Record<string, readonly string[]> = Object.freeze({
  mat_t1_metal_common: ["all_salvaged_ingot"],
  mat_t1_binding_common: ["all_binding_spool"],
  mat_t1_nature_common: ["all_distilled_slurry"]
});

export class CraftingError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "CraftingError";
  }
}

function buildCraftingJobView(job: {
  id: string;
  slotIndex: number;
  recipeId: string;
  recipeType: string;
  startedAt: Date;
  finishesAt: Date;
  claimed: boolean;
}): CraftingJob {
  return craftingJobSchema.parse({
    id: job.id,
    slotIndex: job.slotIndex,
    recipeId: job.recipeId,
    recipeType: job.recipeType,
    startedAt: job.startedAt.toISOString(),
    finishesAt: job.finishesAt.toISOString(),
    claimed: job.claimed
  });
}

function getRecipeLookup(recipeId: string, recipeType: CraftingRecipeType): CraftingRecipeLookup {
  if (recipeType === "combine") {
    const recipe = MATERIAL_COMBINE_RECIPE_BY_ID[recipeId];
    if (!recipe) {
      throw new CraftingError("RECIPE_NOT_FOUND", 404, "Crafting recipe not found.");
    }
    return { recipeType, recipe };
  }

  if (recipeType === "item") {
    const recipe = ITEM_CRAFT_RECIPE_BY_ID[recipeId];
    if (!recipe) {
      throw new CraftingError("RECIPE_NOT_FOUND", 404, "Crafting recipe not found.");
    }
    return { recipeType, recipe };
  }

  const recipe = CONSUMABLE_DISTILLATION_RECIPE_BY_ID[recipeId];
  if (!recipe) {
    throw new CraftingError("RECIPE_NOT_FOUND", 404, "Crafting recipe not found.");
  }
  return { recipeType, recipe };
}

function getSubstituteCodes(itemCode: string): readonly string[] {
  return SUBSTITUTION_CODES_BY_TARGET[itemCode] ?? [];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function getCraftingPlaceholderIconAssetPath(itemCode: string): string {
  const randomIndex = hashString(itemCode) % RANDOM_CRAFTING_ICON_FILES.length;
  return `/assets/random_stuff_materials/${RANDOM_CRAFTING_ICON_FILES[randomIndex]}`;
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "P2002"
  );
}

function buildMaterialItem(itemCode: string, id: string): InventoryItem {
  const definition = CRAFTING_MATERIAL_BY_CODE[itemCode];
  if (!definition) {
    throw new CraftingError("RECIPE_NOT_FOUND", 404, `Unknown crafting material ${itemCode}.`);
  }

  return inventoryItemSchema.parse({
    id,
    itemCode,
    itemName: definition.displayName,
    rarity: definition.rarity,
    category: "Material",
    equipable: false,
    levelRequirement: 1,
    allowedSlotIds: [],
    baseLevel: 1,
    power: 0,
    archetype: { majorCategory: "consumable" },
    statBonuses: {},
    description: definition.description,
    iconAssetPath: getCraftingPlaceholderIconAssetPath(itemCode)
  });
}

function buildOutputItem(itemCode: string, id: string): InventoryItem {
  const definition = CRAFTING_OUTPUT_DEFINITIONS[itemCode as keyof typeof CRAFTING_OUTPUT_DEFINITIONS];
  if (!definition) {
    throw new CraftingError("RECIPE_NOT_FOUND", 404, `Unknown crafting output ${itemCode}.`);
  }

  const category =
    itemCode.startsWith("forge_catalyst")
      ? "Catalyst"
      : itemCode.startsWith("reagent_")
        ? "Reagent"
        : "Consumable";

  return inventoryItemSchema.parse({
    id,
    itemCode,
    itemName: definition.displayName,
    rarity: definition.rarity,
    category,
    equipable: false,
    levelRequirement: 1,
    allowedSlotIds: [],
    baseLevel: 1,
    power: 0,
    archetype: { majorCategory: "consumable" },
    statBonuses: {},
    description: definition.description,
    iconAssetPath: getCraftingPlaceholderIconAssetPath(itemCode)
  });
}

function groupQuantities(rows: readonly Pick<InventoryRow, "itemCode" | "quantity">[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.itemCode] = (totals[row.itemCode] ?? 0) + row.quantity;
  }
  return totals;
}

function getEffectiveIngredientQuantity(itemCode: string, totals: Record<string, number>): number {
  return (totals[itemCode] ?? 0) + getSubstituteCodes(itemCode).reduce((sum, substituteCode) => sum + (totals[substituteCode] ?? 0), 0);
}

function assertIngredientAvailability(ingredients: readonly RecipeIngredient[], totals: Record<string, number>): void {
  for (const ingredient of ingredients) {
    if (getEffectiveIngredientQuantity(ingredient.itemCode, totals) < ingredient.quantity) {
      throw new CraftingError("INSUFFICIENT_MATERIALS", 400, "Not enough crafting materials.");
    }
  }
}

async function ensureCurrencyBalance(tx: CraftingDbClient, playerId: string) {
  const balance = await tx.currencyBalance.findUnique({
    where: { playerId }
  });

  if (balance) {
    return balance;
  }

  return tx.currencyBalance.create({
    data: {
      playerId,
      ducats: 0,
      imperials: 0
    }
  });
}

async function getCraftingProfileSettings(
  tx: CraftingDbClient,
  playerId: string
): Promise<{
  level: number;
  unlimitedRefineryMaterialsEnabled: boolean;
  fastCraftTimeEnabled: boolean;
}> {
  const profile = await tx.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      level: true,
      unlimitedRefineryMaterialsEnabled: true,
      fastCraftTimeEnabled: true
    }
  });

  if (!profile) {
    throw new CraftingError("PLAYER_NOT_FOUND", 404, "Player profile not found.");
  }

  return profile;
}

function getEffectiveCraftingTimeSec(baseCraftingTimeSec: number, fastCraftTimeEnabled: boolean): number {
  if (baseCraftingTimeSec <= 0) {
    return 0;
  }

  return fastCraftTimeEnabled ? CHEAT_FAST_CRAFT_DURATION_SEC : baseCraftingTimeSec;
}

async function getArchivedSlotIndex(tx: CraftingDbClient, playerId: string): Promise<number> {
  const archived = await tx.craftingJob.findFirst({
    where: {
      playerId,
      slotIndex: {
        gte: ARCHIVED_SLOT_INDEX_BASE
      }
    },
    orderBy: {
      slotIndex: "desc"
    },
    select: {
      slotIndex: true
    }
  });

  return Math.max(ARCHIVED_SLOT_INDEX_BASE, (archived?.slotIndex ?? (ARCHIVED_SLOT_INDEX_BASE - 1)) + 1);
}

async function loadInventoryRows(
  tx: CraftingDbClient,
  playerId: string,
  itemCodes: readonly string[]
): Promise<InventoryRow[]> {
  return tx.inventoryItem.findMany({
    where: {
      playerId,
      slotKey: "inventory",
      itemCode: { in: [...itemCodes] }
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ],
    select: {
      id: true,
      itemCode: true,
      quantity: true,
      itemData: true
    }
  });
}

async function consumeCode(
  tx: CraftingDbClient,
  rowsByCode: Map<string, InventoryRow[]>,
  itemCode: string,
  quantity: number
): Promise<number> {
  let remaining = quantity;
  const rows = rowsByCode.get(itemCode) ?? [];

  for (const row of rows) {
    if (remaining <= 0) {
      break;
    }

    const used = Math.min(row.quantity, remaining);
    const nextQuantity = row.quantity - used;

    if (nextQuantity <= 0) {
      await tx.inventoryItem.delete({ where: { id: row.id } });
    } else {
      await tx.inventoryItem.update({
        where: { id: row.id },
        data: { quantity: nextQuantity }
      });
    }

    row.quantity = nextQuantity;
    remaining -= used;
  }

  rowsByCode.set(itemCode, rows.filter((row) => row.quantity > 0));
  return remaining;
}

async function deductIngredients(
  tx: CraftingDbClient,
  rows: InventoryRow[],
  ingredients: readonly RecipeIngredient[]
): Promise<void> {
  const rowsByCode = new Map<string, InventoryRow[]>();
  for (const row of rows) {
    const existing = rowsByCode.get(row.itemCode);
    if (existing) {
      existing.push({ ...row });
    } else {
      rowsByCode.set(row.itemCode, [{ ...row }]);
    }
  }

  for (const ingredient of ingredients) {
    let remaining = await consumeCode(tx, rowsByCode, ingredient.itemCode, ingredient.quantity);

    for (const substituteCode of getSubstituteCodes(ingredient.itemCode)) {
      if (remaining <= 0) {
        break;
      }
      remaining = await consumeCode(tx, rowsByCode, substituteCode, remaining);
    }

    if (remaining > 0) {
      throw new CraftingError("INSUFFICIENT_MATERIALS", 400, "Not enough crafting materials.");
    }
  }
}

export async function grantCraftingStackableItem(
  tx: CraftingDbClient,
  playerId: string,
  itemCode: string,
  quantity: number,
  kind: "material" | "output"
): Promise<InventoryItem> {
  const buildItem = kind === "material" ? buildMaterialItem : buildOutputItem;
  const existing = await tx.inventoryItem.findFirst({
    where: {
      playerId,
      itemCode,
      slotKey: "inventory"
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ],
    select: {
      id: true
    }
  });

  if (existing) {
    const item = buildItem(itemCode, existing.id);
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: quantity },
        itemData: item
      }
    });

    return item;
  }

  const id = `itm_${randomUUID().replaceAll("-", "")}`;
  const item = buildItem(itemCode, id);

  await tx.inventoryItem.create({
    data: {
      id: item.id,
      playerId,
      itemCode: item.itemCode,
      slotKey: "inventory",
      quantity,
      itemData: item
    }
  });

  return item;
}

function getInventoryQueryCodesForRecipe(ingredients: readonly RecipeIngredient[]): string[] {
  const codes = new Set<string>();
  for (const ingredient of ingredients) {
    codes.add(ingredient.itemCode);
    for (const substituteCode of getSubstituteCodes(ingredient.itemCode)) {
      codes.add(substituteCode);
    }
  }
  return [...codes];
}

export async function getCraftingInventory(
  prisma: PrismaClient,
  playerId: string
): Promise<CraftingInventoryResponse> {
  const [rows, activeJobs] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        playerId,
        slotKey: "inventory",
        OR: [
          { itemCode: { startsWith: "mat_" } },
          { itemCode: { in: [...CRAFTING_RECYCLING_ITEM_CODES] } }
        ]
      },
      select: {
        itemCode: true,
        quantity: true
      }
    }),
    prisma.craftingJob.findMany({
      where: {
        playerId,
        claimed: false,
        slotIndex: { in: [...ACTIVE_SLOT_INDEXES] }
      },
      orderBy: {
        slotIndex: "asc"
      }
    })
  ]);

  const totals = groupQuantities(rows);

  return craftingInventoryResponseSchema.parse({
    materials: Object.entries(totals)
      .map(([itemCode, quantity]) => ({ itemCode, quantity }))
      .sort((left, right) => left.itemCode.localeCompare(right.itemCode)),
    activeJobs: activeJobs.map((job) => buildCraftingJobView(job))
  });
}

export async function startCraftingJob(
  prisma: PrismaClient,
  playerId: string,
  recipeId: string,
  recipeType: CraftingRecipeType,
  slotIndex: number
): Promise<CraftingStartJobResponse> {
  if (!ACTIVE_SLOT_INDEXES.includes(slotIndex as (typeof ACTIVE_SLOT_INDEXES)[number])) {
    throw new CraftingError("INVALID_SLOT", 400, "Invalid crafting slot.");
  }

  const lookup = getRecipeLookup(recipeId, recipeType);
  const recipe = lookup.recipe;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const [activeCount, occupiedSlot, currency] = await Promise.all([
      tx.craftingJob.count({
        where: {
          playerId,
          claimed: false,
          slotIndex: { in: [...ACTIVE_SLOT_INDEXES] }
        }
      }),
      tx.craftingJob.findFirst({
        where: {
          playerId,
          claimed: false,
          slotIndex
        },
        select: { id: true }
      }),
      ensureCurrencyBalance(tx, playerId)
    ]);
    const {
      level: playerLevel,
      unlimitedRefineryMaterialsEnabled,
      fastCraftTimeEnabled
    } = await getCraftingProfileSettings(tx, playerId);
    const effectiveCraftingTimeSec = getEffectiveCraftingTimeSec(recipe.craftingTimeSec, fastCraftTimeEnabled);

    if (effectiveCraftingTimeSec > 0) {
      if (activeCount >= ACTIVE_SLOT_INDEXES.length) {
        throw new CraftingError("CRAFTING_SLOTS_FULL", 409, "All crafting slots are currently busy.");
      }
      if (occupiedSlot) {
        throw new CraftingError("INVALID_SLOT", 409, "That crafting slot is already occupied.");
      }
    }
    if (currency.ducats < recipe.ducatCost) {
      throw new CraftingError("INSUFFICIENT_DUCATS", 400, "Not enough ducats for that craft.");
    }
    if ("requiredPlayerLevel" in recipe && playerLevel < recipe.requiredPlayerLevel) {
      throw new CraftingError("LEVEL_TOO_LOW", 403, "Player level is too low for that craft.");
    }

    const inventoryRows = await loadInventoryRows(tx, playerId, getInventoryQueryCodesForRecipe(recipe.ingredients));
    const totals = groupQuantities(inventoryRows);
    if (!unlimitedRefineryMaterialsEnabled) {
      assertIngredientAvailability(recipe.ingredients, totals);
    }

    if (!unlimitedRefineryMaterialsEnabled) {
      await deductIngredients(tx, inventoryRows, recipe.ingredients);
    }

    if (recipe.ducatCost > 0) {
      await tx.currencyBalance.update({
        where: { playerId },
        data: { ducats: { decrement: recipe.ducatCost } }
      });
    }

    if (effectiveCraftingTimeSec === 0) {
      if (lookup.recipeType === "combine") {
        const combineRecipe = lookup.recipe;
        await grantCraftingStackableItem(
          tx,
          playerId,
          combineRecipe.outputItemCode,
          combineRecipe.outputQuantity,
          "material"
        );

        return craftingStartJobResponseSchema.parse({
          success: true,
          job: {
            id: `instant_${recipeId}_${now.getTime()}`,
            slotIndex,
            recipeId,
            recipeType,
            startedAt: now.toISOString(),
            finishesAt: now.toISOString(),
          claimed: true
        },
        instant: true,
        granted: {
          itemCode: combineRecipe.outputItemCode,
          quantity: combineRecipe.outputQuantity
        },
          consumed: combineRecipe.ingredients,
          ducatsSpent: combineRecipe.ducatCost
        });
      }

      const itemRecipe = lookup.recipe;
      await grantCraftingStackableItem(tx, playerId, itemRecipe.outputItemType, 1, "output");

      return craftingStartJobResponseSchema.parse({
        success: true,
        job: {
          id: `instant_${recipeId}_${now.getTime()}`,
          slotIndex,
          recipeId,
          recipeType,
          startedAt: now.toISOString(),
          finishesAt: now.toISOString(),
          claimed: true
        },
        instant: true,
        granted: {
          itemCode: itemRecipe.outputItemType,
          quantity: 1
        },
        consumed: itemRecipe.ingredients,
        ducatsSpent: itemRecipe.ducatCost
      });
    }

    const finishesAt = new Date(now.getTime() + (effectiveCraftingTimeSec * 1000));
    let job;
    try {
      job = await tx.craftingJob.create({
        data: {
          playerId,
          slotIndex,
          recipeId,
          recipeType,
          finishesAt
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CraftingError("INVALID_SLOT", 409, "That crafting slot is already occupied.");
      }
      throw error;
    }

    return craftingStartJobResponseSchema.parse({
      success: true,
      job: buildCraftingJobView(job),
      instant: false,
      consumed: recipe.ingredients,
      ducatsSpent: recipe.ducatCost
    });
  });
}

export async function claimCraftingJob(
  prisma: PrismaClient,
  playerId: string,
  jobId: string
): Promise<CraftingClaimJobResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.craftingJob.findUnique({
      where: { id: jobId }
    });

    if (!job || job.playerId !== playerId) {
      throw new CraftingError("RECIPE_NOT_FOUND", 404, "Crafting job not found.");
    }
    if (job.claimed) {
      throw new CraftingError("ALREADY_CLAIMED", 409, "That crafting job has already been claimed.");
    }
    if (job.finishesAt.getTime() > now.getTime()) {
      throw new CraftingError("CRAFT_NOT_READY", 409, "That craft is not ready yet.");
    }

    const lookup = getRecipeLookup(job.recipeId, job.recipeType as CraftingRecipeType);
    const archivedSlotIndex = await getArchivedSlotIndex(tx, playerId);

    await tx.craftingJob.update({
      where: { id: job.id },
      data: {
        claimed: true,
        claimedAt: now,
        slotIndex: archivedSlotIndex
      }
    });

    if (lookup.recipeType === "combine") {
      await grantCraftingStackableItem(tx, playerId, lookup.recipe.outputItemCode, lookup.recipe.outputQuantity, "material");
      return craftingClaimJobResponseSchema.parse({
        success: true,
        material: {
          itemCode: lookup.recipe.outputItemCode,
          quantity: lookup.recipe.outputQuantity
        }
      });
    }

    const item = await grantCraftingStackableItem(tx, playerId, lookup.recipe.outputItemType, 1, "output");
    return craftingClaimJobResponseSchema.parse({
      success: true,
      item
    });
  });
}
