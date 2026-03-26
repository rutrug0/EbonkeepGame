import { z } from "zod";

import { inventoryItemSchema } from "../inventory/index.js";

export const craftingTierSchema = z.enum(["t1", "t2", "t3", "t4"]);
export type CraftingTier = z.infer<typeof craftingTierSchema>;

export const craftingAffinitySchema = z.enum(["metal", "nature", "leather", "arcane", "shadow", "binding"]);
export type CraftingAffinity = z.infer<typeof craftingAffinitySchema>;

export const craftingRaritySchema = z.enum(["common", "uncommon", "rare", "epic"]);
export type CraftingRarity = z.infer<typeof craftingRaritySchema>;

export const craftingRecipeTypeSchema = z.enum(["combine", "item", "distill"]);
export type CraftingRecipeType = z.infer<typeof craftingRecipeTypeSchema>;

export const craftingItemRecipeCategorySchema = z.enum([
  "catalyst",
  "reagent",
  "tempering",
  "raid_consumable",
  "distillation"
]);
export type CraftingItemRecipeCategory = z.infer<typeof craftingItemRecipeCategorySchema>;

export const craftingMaterialSchema = z.object({
  itemCode: z.string(),
  displayName: z.string(),
  tier: craftingTierSchema,
  affinity: craftingAffinitySchema,
  rarity: craftingRaritySchema,
  iconKey: z.string(),
  description: z.string()
});
export type CraftingMaterial = z.infer<typeof craftingMaterialSchema>;

export const recipeIngredientSchema = z.object({
  itemCode: z.string(),
  quantity: z.number().int().positive()
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const materialCombineRecipeSchema = z.object({
  recipeId: z.string(),
  outputItemCode: z.string(),
  outputQuantity: z.number().int().positive().default(1),
  ingredients: z.array(recipeIngredientSchema).min(1).max(5),
  ducatCost: z.number().int().nonnegative(),
  craftingTimeSec: z.number().int().nonnegative()
});
export type MaterialCombineRecipe = z.infer<typeof materialCombineRecipeSchema>;

export const itemCraftRecipeSchema = z.object({
  recipeId: z.string(),
  category: craftingItemRecipeCategorySchema,
  outputItemType: z.string(),
  outputRarity: craftingRaritySchema,
  outputTier: craftingTierSchema,
  ilvlMin: z.number().int(),
  ilvlMax: z.number().int(),
  ingredients: z.array(recipeIngredientSchema).min(1).max(6),
  ducatCost: z.number().int().nonnegative(),
  craftingTimeSec: z.number().int().nonnegative(),
  requiredPlayerLevel: z.number().int().nonnegative().default(1)
});
export type ItemCraftRecipe = z.infer<typeof itemCraftRecipeSchema>;

export const craftingJobSchema = z.object({
  id: z.string(),
  slotIndex: z.number().int().min(0).max(2),
  recipeId: z.string(),
  recipeType: craftingRecipeTypeSchema,
  startedAt: z.string().datetime(),
  finishesAt: z.string().datetime(),
  claimed: z.boolean()
});
export type CraftingJob = z.infer<typeof craftingJobSchema>;

export const craftingStartJobRequestSchema = z.object({
  recipeId: z.string(),
  recipeType: craftingRecipeTypeSchema,
  slotIndex: z.number().int().min(0).max(2)
});
export type CraftingStartJobRequest = z.infer<typeof craftingStartJobRequestSchema>;

export const craftingClaimJobRequestSchema = z.object({
  jobId: z.string()
});
export type CraftingClaimJobRequest = z.infer<typeof craftingClaimJobRequestSchema>;

export const craftingCombineRequestSchema = craftingStartJobRequestSchema.omit({
  recipeType: true
});
export type CraftingCombineRequest = z.infer<typeof craftingCombineRequestSchema>;

export const craftingItemCraftRequestSchema = craftingStartJobRequestSchema.omit({
  recipeType: true
});
export type CraftingItemCraftRequest = z.infer<typeof craftingItemCraftRequestSchema>;

export const craftingMaterialInventoryEntrySchema = z.object({
  itemCode: z.string(),
  quantity: z.number().int()
});
export type CraftingMaterialInventoryEntry = z.infer<typeof craftingMaterialInventoryEntrySchema>;

export const craftingInventoryResponseSchema = z.object({
  materials: z.array(craftingMaterialInventoryEntrySchema),
  activeJobs: z.array(craftingJobSchema)
});
export type CraftingInventoryResponse = z.infer<typeof craftingInventoryResponseSchema>;

export const craftingStartJobResponseSchema = z.object({
  success: z.literal(true),
  job: craftingJobSchema,
  instant: z.boolean(),
  granted: z.object({ itemCode: z.string(), quantity: z.number().int().positive() }).optional(),
  consumed: z.array(recipeIngredientSchema),
  ducatsSpent: z.number().int()
});
export type CraftingStartJobResponse = z.infer<typeof craftingStartJobResponseSchema>;

export const craftingClaimJobResponseSchema = z.object({
  success: z.literal(true),
  item: inventoryItemSchema.optional(),
  material: z.object({ itemCode: z.string(), quantity: z.number().int().positive() }).optional()
});
export type CraftingClaimJobResponse = z.infer<typeof craftingClaimJobResponseSchema>;

export const CRAFTING_SLOT_COUNT = 3;
export const CRAFTING_JOB_SLOT_INDEXES = [0, 1, 2] as const;
export const CRAFTING_RECYCLING_ITEM_CODES = [
  "all_salvaged_ingot",
  "all_binding_spool",
  "all_distilled_slurry"
] as const;

export const CRAFTING_RECYCLING_SUBSTITUTIONS = {
  all_salvaged_ingot: { itemCode: "mat_t1_metal_common", quantity: 1 },
  all_binding_spool: { itemCode: "mat_t1_binding_common", quantity: 1 },
  all_distilled_slurry: { itemCode: "mat_t1_nature_common", quantity: 1 }
} as const;

type MaterialNameTable = Record<CraftingTier, Record<CraftingRarity, Record<CraftingAffinity, string>>>;

const MATERIAL_NAME_TABLE: MaterialNameTable = {
  t1: {
    common: {
      metal: "Iron Sand",
      nature: "Verdant Sap",
      leather: "Hide Scraps",
      arcane: "Runic Dust",
      shadow: "Grave Ash",
      binding: "Amber Resin"
    },
    uncommon: {
      metal: "Tempered Alloy",
      nature: "Distilled Essence",
      leather: "Cured Hide",
      arcane: "Etched Core",
      shadow: "Grave Tincture",
      binding: "Bonded Resin"
    },
    rare: {
      metal: "Sunsteel Ingot",
      nature: "Sovereign Extract",
      leather: "Shadowhide",
      arcane: "Warden Sigil",
      shadow: "Umbral Powder",
      binding: "Sealant Flux"
    },
    epic: {
      metal: "Crownsteel Matrix",
      nature: "Astral Quintessence",
      leather: "Nightveil Weave",
      arcane: "Eternal Cipher",
      shadow: "Voidheart Ash",
      binding: "Primal Amalgam"
    }
  },
  t2: {
    common: {
      metal: "Steelite Grit",
      nature: "Ember Sap",
      leather: "Scale Strips",
      arcane: "Cipher Dust",
      shadow: "Pyre Ash",
      binding: "Jade Resin"
    },
    uncommon: {
      metal: "Hardened Alloy",
      nature: "Refined Concentrate",
      leather: "Cured Scales",
      arcane: "Sealed Core",
      shadow: "Pyre Tincture",
      binding: "Jade Bond"
    },
    rare: {
      metal: "Embersteel Ingot",
      nature: "Virulent Extract",
      leather: "Duskscale Weave",
      arcane: "Arcane Seal",
      shadow: "Smoldering Powder",
      binding: "Temper Flux"
    },
    epic: {
      metal: "Embersteel Matrix",
      nature: "Cinderbloom Quintessence",
      leather: "Shadowscale Weave",
      arcane: "Cipher Lattice",
      shadow: "Pyrewrath Ash",
      binding: "Bound Amalgam"
    }
  },
  t3: {
    common: {
      metal: "Aethersteel Powder",
      nature: "Moonpetal Sap",
      leather: "Wraith Membrane",
      arcane: "Aether Dust",
      shadow: "Abyssal Ash",
      binding: "Obsidian Resin"
    },
    uncommon: {
      metal: "Aetherforged Alloy",
      nature: "Moon Concentrate",
      leather: "Tanned Membrane",
      arcane: "Void Core",
      shadow: "Abyssal Tincture",
      binding: "Obsidian Bond"
    },
    rare: {
      metal: "Moonglass Ingot",
      nature: "Celestial Extract",
      leather: "Wraithweave",
      arcane: "Runic Seal",
      shadow: "Voidsmoke Powder",
      binding: "Astral Flux"
    },
    epic: {
      metal: "Starforged Matrix",
      nature: "Celestial Quintessence",
      leather: "Voidweave",
      arcane: "Starbound Cipher",
      shadow: "Abyssal Wraith Ash",
      binding: "Aether Amalgam"
    }
  },
  t4: {
    common: {
      metal: "Crownmetal Shard",
      nature: "Astral Sap",
      leather: "Voidskin Scraps",
      arcane: "Singularity Dust",
      shadow: "Voidfire Ash",
      binding: "Soulbond Resin"
    },
    uncommon: {
      metal: "Crownforged Alloy",
      nature: "Astral Concentrate",
      leather: "Bound Voidskin",
      arcane: "Cipher Matrix Core",
      shadow: "Voidfire Tincture",
      binding: "Soul Bond"
    },
    rare: {
      metal: "Crownsteel Ingot",
      nature: "Emperor's Extract",
      leather: "Soulveil Weave",
      arcane: "Sovereign Cipher",
      shadow: "Voidheart Powder",
      binding: "Crown Flux"
    },
    epic: {
      metal: "Sovereign Matrix",
      nature: "Eternal Quintessence",
      leather: "Soulweave",
      arcane: "Absolute Cipher",
      shadow: "Voidlord's Ash",
      binding: "Primordial Amalgam"
    }
  }
} as const;

const MATERIAL_ICON_KEY_TABLE: Record<CraftingAffinity, Record<CraftingRarity, string>> = {
  metal: {
    common: "mat_iron_ore",
    uncommon: "mat_steel_ingot",
    rare: "mat_copper_plate",
    epic: "mat_crownsteel_matrix"
  },
  nature: {
    common: "mat_dried_herbs",
    uncommon: "mat_distilled_essence",
    rare: "mat_sovereign_extract",
    epic: "mat_astral_quintessence"
  },
  leather: {
    common: "mat_leather_scrap",
    uncommon: "mat_cured_hide",
    rare: "mat_shadowhide",
    epic: "mat_nightveil_weave"
  },
  arcane: {
    common: "mat_alum_crystal",
    uncommon: "mat_etched_core",
    rare: "mat_river_pearl",
    epic: "mat_eternal_cipher"
  },
  shadow: {
    common: "mat_bone_ash",
    uncommon: "mat_bone_fragment",
    rare: "mat_charcoal",
    epic: "mat_voidheart_ash"
  },
  binding: {
    common: "mat_pitch_resin",
    uncommon: "mat_beeswax",
    rare: "mat_quench_stone",
    epic: "mat_primal_amalgam"
  }
} as const;

const MATERIAL_AFFINITY_DESCRIPTION: Record<CraftingAffinity, string> = {
  metal: "Refined metal stock used for catalysts, forge work, and tier promotion.",
  nature: "Botanical essence used for restorative brews and survival preparations.",
  leather: "Treated hide and membrane stock used in layered compounds and reagents.",
  arcane: "Runic and crystalline matter used for catalysts and advanced formulas.",
  shadow: "Funereal ash and tinctures used in cleansing, dark reagents, and elite brews.",
  binding: "Universal bonding stock required by nearly every upgrade recipe."
};

export const CRAFTING_OUTPUT_DEFINITIONS = {
  forge_catalyst_common: {
    displayName: "Forge Catalyst",
    description: "A common forge catalyst prepared from arcane dust.",
    iconKey: "mat_alum_crystal",
    tier: "t1",
    rarity: "common"
  },
  forge_catalyst_uncommon: {
    displayName: "Forge Catalyst",
    description: "An uncommon forge catalyst prepared from etched cores and resin.",
    iconKey: "mat_etched_core",
    tier: "t1",
    rarity: "uncommon"
  },
  forge_catalyst_rare: {
    displayName: "Forge Catalyst",
    description: "A rare forge catalyst prepared from arcane seals and bonded flux.",
    iconKey: "mat_river_pearl",
    tier: "t1",
    rarity: "rare"
  },
  forge_catalyst_epic: {
    displayName: "Forge Catalyst",
    description: "An epic forge catalyst prepared from the highest arcane stock.",
    iconKey: "mat_eternal_cipher",
    tier: "t1",
    rarity: "epic"
  },
  forge_catalyst_t2_common: {
    displayName: "Forge Catalyst",
    description: "A common forge catalyst prepared from ember-era arcane dust.",
    iconKey: "mat_alum_crystal",
    tier: "t2",
    rarity: "common"
  },
  forge_catalyst_t2_uncommon: {
    displayName: "Forge Catalyst",
    description: "An uncommon forge catalyst prepared from sealed cores and jade resin.",
    iconKey: "mat_etched_core",
    tier: "t2",
    rarity: "uncommon"
  },
  forge_catalyst_t2_rare: {
    displayName: "Forge Catalyst",
    description: "A rare forge catalyst prepared from arcane seals and jade bond.",
    iconKey: "mat_river_pearl",
    tier: "t2",
    rarity: "rare"
  },
  forge_catalyst_t2_epic: {
    displayName: "Forge Catalyst",
    description: "An epic forge catalyst prepared from cipher lattices.",
    iconKey: "mat_eternal_cipher",
    tier: "t2",
    rarity: "epic"
  },
  forge_catalyst_t3_common: {
    displayName: "Forge Catalyst",
    description: "A common forge catalyst prepared from aether dust.",
    iconKey: "mat_alum_crystal",
    tier: "t3",
    rarity: "common"
  },
  forge_catalyst_t3_uncommon: {
    displayName: "Forge Catalyst",
    description: "An uncommon forge catalyst prepared from void cores and obsidian resin.",
    iconKey: "mat_etched_core",
    tier: "t3",
    rarity: "uncommon"
  },
  forge_catalyst_t3_rare: {
    displayName: "Forge Catalyst",
    description: "A rare forge catalyst prepared from runic seals and obsidian bond.",
    iconKey: "mat_river_pearl",
    tier: "t3",
    rarity: "rare"
  },
  forge_catalyst_t3_epic: {
    displayName: "Forge Catalyst",
    description: "An epic forge catalyst prepared from starbound cipher stock.",
    iconKey: "mat_eternal_cipher",
    tier: "t3",
    rarity: "epic"
  },
  forge_catalyst_t4_common: {
    displayName: "Forge Catalyst",
    description: "A common forge catalyst prepared from singularity dust.",
    iconKey: "mat_alum_crystal",
    tier: "t4",
    rarity: "common"
  },
  forge_catalyst_t4_uncommon: {
    displayName: "Forge Catalyst",
    description: "An uncommon forge catalyst prepared from cipher matrix cores and soulbond resin.",
    iconKey: "mat_etched_core",
    tier: "t4",
    rarity: "uncommon"
  },
  forge_catalyst_t4_rare: {
    displayName: "Forge Catalyst",
    description: "A rare forge catalyst prepared from sovereign ciphers and soul bond.",
    iconKey: "mat_river_pearl",
    tier: "t4",
    rarity: "rare"
  },
  forge_catalyst_t4_epic: {
    displayName: "Forge Catalyst",
    description: "An epic forge catalyst prepared from absolute ciphers.",
    iconKey: "mat_eternal_cipher",
    tier: "t4",
    rarity: "epic"
  },
  reagent_binder_salts: {
    displayName: "Binder Salts",
    description: "A steady refinery reagent used in foundational formulas.",
    iconKey: "mat_pitch_resin",
    tier: "t1",
    rarity: "common"
  },
  reagent_ward_resin: {
    displayName: "Ward Resin",
    description: "A stable compound used in restorative and prep brews.",
    iconKey: "mat_beeswax",
    tier: "t1",
    rarity: "uncommon"
  },
  reagent_black_ichor: {
    displayName: "Black Ichor",
    description: "A dark reagent used in cleansing and affliction formulas.",
    iconKey: "mat_charcoal",
    tier: "t2",
    rarity: "uncommon"
  },
  reagent_aether_catalyst: {
    displayName: "Aether Catalyst",
    description: "A rare catalyst used in premium distillations and preparations.",
    iconKey: "mat_river_pearl",
    tier: "t3",
    rarity: "rare"
  },
  all_tempering_draught: {
    displayName: "Tempering Draught",
    description: "A forge repair draught that clears weapon instability.",
    iconKey: "mat_tempering_draught",
    tier: "t1",
    rarity: "uncommon"
  },
  consumable_vigorous_restorative: {
    displayName: "Vigorous Restorative",
    description: "A potent clan preparation draught for recovery-heavy pushes.",
    iconKey: "consumable_vigorous_restorative",
    tier: "t3",
    rarity: "uncommon"
  },
  consumable_sunspike_elixir: {
    displayName: "Sunspike Elixir",
    description: "A high-energy offensive elixir prepared for raid damage windows.",
    iconKey: "consumable_sunspike_elixir",
    tier: "t3",
    rarity: "uncommon"
  },
  consumable_graveward_elixir: {
    displayName: "Graveward Elixir",
    description: "A costly clan brew for survival and attrition-focused encounters.",
    iconKey: "consumable_graveward_elixir",
    tier: "t3",
    rarity: "uncommon"
  },
  consumable_hexcleanse_phial: {
    displayName: "Hexcleanse Phial",
    description: "A concentrated cleansing phial for severe affliction control.",
    iconKey: "consumable_hexcleanse_phial",
    tier: "t3",
    rarity: "uncommon"
  },
  consumable_contractors_resolve: {
    displayName: "Contractor's Resolve",
    description: "An endgame efficiency tonic stockpiled for coordinated pushes.",
    iconKey: "consumable_contractors_resolve",
    tier: "t4",
    rarity: "rare"
  },
  consumable_soulbound_draught: {
    displayName: "Soulbound Draught",
    description: "A sovereign-grade draught reserved for the hardest clan preparations.",
    iconKey: "consumable_soulbound_draught",
    tier: "t4",
    rarity: "rare"
  },
  consumable_vigorous_restorative_d1: {
    displayName: "Vigorous Restorative (Distilled I)",
    description: "A first distillation of Vigorous Restorative.",
    iconKey: "consumable_vigorous_restorative_d1",
    tier: "t3",
    rarity: "rare"
  },
  consumable_sunspike_elixir_d1: {
    displayName: "Sunspike Elixir (Distilled I)",
    description: "A first distillation of Sunspike Elixir.",
    iconKey: "consumable_sunspike_elixir_d1",
    tier: "t3",
    rarity: "rare"
  },
  consumable_graveward_elixir_d1: {
    displayName: "Graveward Elixir (Distilled I)",
    description: "A first distillation of Graveward Elixir.",
    iconKey: "consumable_graveward_elixir_d1",
    tier: "t3",
    rarity: "rare"
  },
  consumable_hexcleanse_phial_d1: {
    displayName: "Hexcleanse Phial (Distilled I)",
    description: "A first distillation of Hexcleanse Phial.",
    iconKey: "consumable_hexcleanse_phial_d1",
    tier: "t3",
    rarity: "rare"
  },
  consumable_contractors_resolve_d1: {
    displayName: "Contractor's Resolve (Distilled I)",
    description: "A first distillation of Contractor's Resolve.",
    iconKey: "consumable_contractors_resolve_d1",
    tier: "t4",
    rarity: "rare"
  },
  consumable_soulbound_draught_d1: {
    displayName: "Soulbound Draught (Distilled I)",
    description: "A first distillation of Soulbound Draught.",
    iconKey: "consumable_soulbound_draught_d1",
    tier: "t4",
    rarity: "rare"
  },
  consumable_vigorous_restorative_d2: {
    displayName: "Vigorous Restorative (Distilled II)",
    description: "The second distillation of Vigorous Restorative.",
    iconKey: "consumable_vigorous_restorative_d2",
    tier: "t3",
    rarity: "epic"
  },
  consumable_sunspike_elixir_d2: {
    displayName: "Sunspike Elixir (Distilled II)",
    description: "The second distillation of Sunspike Elixir.",
    iconKey: "consumable_sunspike_elixir_d2",
    tier: "t3",
    rarity: "epic"
  },
  consumable_graveward_elixir_d2: {
    displayName: "Graveward Elixir (Distilled II)",
    description: "The second distillation of Graveward Elixir.",
    iconKey: "consumable_graveward_elixir_d2",
    tier: "t3",
    rarity: "epic"
  },
  consumable_hexcleanse_phial_d2: {
    displayName: "Hexcleanse Phial (Distilled II)",
    description: "The second distillation of Hexcleanse Phial.",
    iconKey: "consumable_hexcleanse_phial_d2",
    tier: "t3",
    rarity: "epic"
  },
  consumable_contractors_resolve_d2: {
    displayName: "Contractor's Resolve (Distilled II)",
    description: "The second distillation of Contractor's Resolve.",
    iconKey: "consumable_contractors_resolve_d2",
    tier: "t4",
    rarity: "epic"
  },
  consumable_soulbound_draught_d2: {
    displayName: "Soulbound Draught (Distilled II)",
    description: "The second distillation of Soulbound Draught.",
    iconKey: "consumable_soulbound_draught_d2",
    tier: "t4",
    rarity: "epic"
  }
} as const;

export type CraftingOutputItemCode = keyof typeof CRAFTING_OUTPUT_DEFINITIONS;

export const CRAFTING_TIERS = craftingTierSchema.options;
export const CRAFTING_AFFINITIES = craftingAffinitySchema.options;
export const CRAFTING_RARITIES = craftingRaritySchema.options;

function getMaterialItemCode(tier: CraftingTier, affinity: CraftingAffinity, rarity: CraftingRarity): string {
  return `mat_${tier}_${affinity}_${rarity}`;
}

function hours(value: number): number {
  return value * 60 * 60;
}

function minutes(value: number): number {
  return value * 60;
}

const UNCOMMON_TO_RARE_TIME_BY_TIER: Record<CraftingTier, number> = {
  t1: minutes(30),
  t2: minutes(60),
  t3: minutes(90),
  t4: minutes(120)
};

const RARE_TO_EPIC_TIME_BY_TIER: Record<CraftingTier, number> = {
  t1: hours(2),
  t2: hours(4),
  t3: hours(6),
  t4: hours(8)
};

const UNCOMMON_TO_RARE_COST_BY_TIER: Record<CraftingTier, number> = {
  t1: 200,
  t2: 400,
  t3: 800,
  t4: 1600
};

const RARE_TO_EPIC_COST_BY_TIER: Record<CraftingTier, number> = {
  t1: 800,
  t2: 1600,
  t3: 3200,
  t4: 6400
};

const CRAFTING_MATERIALS_RAW = CRAFTING_TIERS.flatMap((tier) =>
  CRAFTING_RARITIES.flatMap((rarity) =>
    CRAFTING_AFFINITIES.map((affinity) => ({
      itemCode: getMaterialItemCode(tier, affinity, rarity),
      displayName: MATERIAL_NAME_TABLE[tier][rarity][affinity],
      tier,
      affinity,
      rarity,
      iconKey: MATERIAL_ICON_KEY_TABLE[affinity][rarity],
      description: MATERIAL_AFFINITY_DESCRIPTION[affinity]
    }))
  )
);

export const CRAFTING_MATERIALS = craftingMaterialSchema.array().parse(CRAFTING_MATERIALS_RAW);

export const CRAFTING_MATERIAL_BY_CODE = Object.freeze(
  Object.fromEntries(CRAFTING_MATERIALS.map((material) => [material.itemCode, material])) as Record<string, CraftingMaterial>
);

type CombineIngredientRule =
  | { kind: "same_plus_binding"; affinity: CraftingAffinity }
  | { kind: "arcane" }
  | { kind: "nature_shadow" }
  | { kind: "binding_common" };

const COMMON_TO_UNCOMMON_RULES: readonly CombineIngredientRule[] = [
  { kind: "same_plus_binding", affinity: "metal" },
  { kind: "same_plus_binding", affinity: "nature" },
  { kind: "same_plus_binding", affinity: "leather" },
  { kind: "arcane" },
  { kind: "nature_shadow" },
  { kind: "binding_common" }
] as const;

function buildCommonToUncommonRecipe(tier: CraftingTier, rule: CombineIngredientRule): MaterialCombineRecipe {
  if (rule.kind === "same_plus_binding") {
    return materialCombineRecipeSchema.parse({
      recipeId: `combine_${tier}_${rule.affinity}_common_to_uncommon`,
      outputItemCode: getMaterialItemCode(tier, rule.affinity, "uncommon"),
      outputQuantity: 1,
      ingredients: [
        { itemCode: getMaterialItemCode(tier, rule.affinity, "common"), quantity: 2 },
        { itemCode: getMaterialItemCode(tier, "binding", "common"), quantity: 1 }
      ],
      ducatCost: 0,
      craftingTimeSec: 0
    });
  }

  if (rule.kind === "arcane") {
    return materialCombineRecipeSchema.parse({
      recipeId: `combine_${tier}_arcane_common_to_uncommon`,
      outputItemCode: getMaterialItemCode(tier, "arcane", "uncommon"),
      outputQuantity: 1,
      ingredients: [
        { itemCode: getMaterialItemCode(tier, "metal", "common"), quantity: 1 },
        { itemCode: getMaterialItemCode(tier, "arcane", "common"), quantity: 1 },
        { itemCode: getMaterialItemCode(tier, "binding", "common"), quantity: 1 }
      ],
      ducatCost: 0,
      craftingTimeSec: 0
    });
  }

  if (rule.kind === "nature_shadow") {
    return materialCombineRecipeSchema.parse({
      recipeId: `combine_${tier}_shadow_common_to_uncommon`,
      outputItemCode: getMaterialItemCode(tier, "shadow", "uncommon"),
      outputQuantity: 1,
      ingredients: [
        { itemCode: getMaterialItemCode(tier, "shadow", "common"), quantity: 1 },
        { itemCode: getMaterialItemCode(tier, "nature", "common"), quantity: 1 },
        { itemCode: getMaterialItemCode(tier, "binding", "common"), quantity: 1 }
      ],
      ducatCost: 0,
      craftingTimeSec: 0
    });
  }

  return materialCombineRecipeSchema.parse({
    recipeId: `combine_${tier}_binding_common_to_uncommon`,
    outputItemCode: getMaterialItemCode(tier, "binding", "uncommon"),
    outputQuantity: 1,
    ingredients: [{ itemCode: getMaterialItemCode(tier, "binding", "common"), quantity: 3 }],
    ducatCost: 0,
    craftingTimeSec: 0
  });
}

const PROMOTION_INGREDIENTS: Record<CraftingAffinity, readonly [CraftingAffinity, number, CraftingAffinity, number]> = {
  metal: ["metal", 2, "arcane", 1],
  nature: ["nature", 2, "shadow", 1],
  leather: ["leather", 2, "shadow", 1],
  arcane: ["arcane", 2, "nature", 1],
  shadow: ["shadow", 2, "arcane", 1],
  binding: ["binding", 2, "metal", 1]
};

function buildPromotionRecipe(args: {
  tier: CraftingTier;
  outputRarity: Extract<CraftingRarity, "rare" | "epic">;
}): MaterialCombineRecipe[] {
  const inputRarity = args.outputRarity === "rare" ? "uncommon" : "rare";
  const ducatCost =
    args.outputRarity === "rare"
      ? UNCOMMON_TO_RARE_COST_BY_TIER[args.tier]
      : RARE_TO_EPIC_COST_BY_TIER[args.tier];
  const craftingTimeSec =
    args.outputRarity === "rare"
      ? UNCOMMON_TO_RARE_TIME_BY_TIER[args.tier]
      : RARE_TO_EPIC_TIME_BY_TIER[args.tier];

  return CRAFTING_AFFINITIES.map((affinity) => {
    const [primaryAffinity, primaryQuantity, secondaryAffinity, secondaryQuantity] = PROMOTION_INGREDIENTS[affinity];
    return materialCombineRecipeSchema.parse({
      recipeId: `combine_${args.tier}_${affinity}_${inputRarity}_to_${args.outputRarity}`,
      outputItemCode: getMaterialItemCode(args.tier, affinity, args.outputRarity),
      outputQuantity: 1,
      ingredients: [
        {
          itemCode: getMaterialItemCode(args.tier, primaryAffinity, inputRarity),
          quantity: primaryQuantity
        },
        {
          itemCode: getMaterialItemCode(args.tier, secondaryAffinity, inputRarity),
          quantity: secondaryQuantity
        }
      ],
      ducatCost,
      craftingTimeSec
    });
  });
}

export const MATERIAL_COMBINE_RECIPES = materialCombineRecipeSchema.array().parse([
  ...CRAFTING_TIERS.flatMap((tier) => COMMON_TO_UNCOMMON_RULES.map((rule) => buildCommonToUncommonRecipe(tier, rule))),
  ...CRAFTING_TIERS.flatMap((tier) => buildPromotionRecipe({ tier, outputRarity: "rare" })),
  ...CRAFTING_TIERS.flatMap((tier) => buildPromotionRecipe({ tier, outputRarity: "epic" }))
]);

function catalystCode(tier: CraftingTier, rarity: CraftingRarity): CraftingOutputItemCode {
  if (tier === "t1") {
    return `forge_catalyst_${rarity}` as CraftingOutputItemCode;
  }
  return `forge_catalyst_${tier}_${rarity}` as CraftingOutputItemCode;
}

function buildCatalystRecipesForTier(tier: CraftingTier): ItemCraftRecipe[] {
  return [
    itemCraftRecipeSchema.parse({
      recipeId: `craft_${catalystCode(tier, "common")}`,
      category: "catalyst",
      outputItemType: catalystCode(tier, "common"),
      outputRarity: "common",
      outputTier: tier,
      ilvlMin: 0,
      ilvlMax: 0,
      ingredients: [{ itemCode: getMaterialItemCode(tier, "arcane", "common"), quantity: 3 }],
      ducatCost: 0,
      craftingTimeSec: 0,
      requiredPlayerLevel: 1
    }),
    itemCraftRecipeSchema.parse({
      recipeId: `craft_${catalystCode(tier, "uncommon")}`,
      category: "catalyst",
      outputItemType: catalystCode(tier, "uncommon"),
      outputRarity: "uncommon",
      outputTier: tier,
      ilvlMin: 0,
      ilvlMax: 0,
      ingredients: [
        { itemCode: getMaterialItemCode(tier, "arcane", "uncommon"), quantity: 2 },
        { itemCode: getMaterialItemCode(tier, "binding", "common"), quantity: 1 }
      ],
      ducatCost: 0,
      craftingTimeSec: 0,
      requiredPlayerLevel: 1
    }),
    itemCraftRecipeSchema.parse({
      recipeId: `craft_${catalystCode(tier, "rare")}`,
      category: "catalyst",
      outputItemType: catalystCode(tier, "rare"),
      outputRarity: "rare",
      outputTier: tier,
      ilvlMin: 0,
      ilvlMax: 0,
      ingredients: [
        { itemCode: getMaterialItemCode(tier, "arcane", "rare"), quantity: 1 },
        { itemCode: getMaterialItemCode(tier, "binding", "uncommon"), quantity: 1 }
      ],
      ducatCost: 0,
      craftingTimeSec: 0,
      requiredPlayerLevel: 1
    }),
    itemCraftRecipeSchema.parse({
      recipeId: `craft_${catalystCode(tier, "epic")}`,
      category: "catalyst",
      outputItemType: catalystCode(tier, "epic"),
      outputRarity: "epic",
      outputTier: tier,
      ilvlMin: 0,
      ilvlMax: 0,
      ingredients: [{ itemCode: getMaterialItemCode(tier, "arcane", "epic"), quantity: 1 }],
      ducatCost: 0,
      craftingTimeSec: 0,
      requiredPlayerLevel: 1
    })
  ];
}

export const ITEM_CRAFT_RECIPES = itemCraftRecipeSchema.array().parse([
  ...CRAFTING_TIERS.flatMap((tier) => buildCatalystRecipesForTier(tier)),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_reagent_binder_salts",
    category: "reagent",
    outputItemType: "reagent_binder_salts",
    outputRarity: "common",
    outputTier: "t1",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "mat_t1_binding_common", quantity: 2 }],
    ducatCost: 0,
    craftingTimeSec: 0,
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_reagent_ward_resin",
    category: "reagent",
    outputItemType: "reagent_ward_resin",
    outputRarity: "uncommon",
    outputTier: "t1",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t1_shadow_uncommon", quantity: 1 },
      { itemCode: "mat_t1_nature_common", quantity: 1 }
    ],
    ducatCost: 0,
    craftingTimeSec: 0,
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_reagent_black_ichor",
    category: "reagent",
    outputItemType: "reagent_black_ichor",
    outputRarity: "uncommon",
    outputTier: "t2",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "mat_t2_shadow_uncommon", quantity: 2 }],
    ducatCost: 0,
    craftingTimeSec: 0,
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_reagent_aether_catalyst",
    category: "reagent",
    outputItemType: "reagent_aether_catalyst",
    outputRarity: "rare",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "mat_t3_arcane_uncommon", quantity: 2 }],
    ducatCost: 0,
    craftingTimeSec: 0,
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_all_tempering_draught",
    category: "tempering",
    outputItemType: "all_tempering_draught",
    outputRarity: "uncommon",
    outputTier: "t1",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t1_shadow_rare", quantity: 1 },
      { itemCode: "mat_t1_binding_uncommon", quantity: 2 }
    ],
    ducatCost: 500,
    craftingTimeSec: hours(1),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_vigorous_restorative",
    category: "raid_consumable",
    outputItemType: "consumable_vigorous_restorative",
    outputRarity: "uncommon",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t3_nature_rare", quantity: 2 },
      { itemCode: "mat_t3_shadow_rare", quantity: 1 },
      { itemCode: "mat_t3_binding_uncommon", quantity: 2 }
    ],
    ducatCost: 2000,
    craftingTimeSec: hours(4),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_sunspike_elixir",
    category: "raid_consumable",
    outputItemType: "consumable_sunspike_elixir",
    outputRarity: "uncommon",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t3_arcane_rare", quantity: 2 },
      { itemCode: "mat_t3_nature_rare", quantity: 1 },
      { itemCode: "mat_t3_binding_uncommon", quantity: 2 }
    ],
    ducatCost: 2000,
    craftingTimeSec: hours(4),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_graveward_elixir",
    category: "raid_consumable",
    outputItemType: "consumable_graveward_elixir",
    outputRarity: "uncommon",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t3_shadow_rare", quantity: 1 },
      { itemCode: "mat_t3_nature_rare", quantity: 2 },
      { itemCode: "mat_t3_binding_rare", quantity: 1 }
    ],
    ducatCost: 3200,
    craftingTimeSec: hours(6),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_hexcleanse_phial",
    category: "raid_consumable",
    outputItemType: "consumable_hexcleanse_phial",
    outputRarity: "uncommon",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t3_shadow_rare", quantity: 2 },
      { itemCode: "mat_t3_binding_rare", quantity: 1 }
    ],
    ducatCost: 2400,
    craftingTimeSec: hours(4),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_contractors_resolve",
    category: "raid_consumable",
    outputItemType: "consumable_contractors_resolve",
    outputRarity: "rare",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t4_nature_rare", quantity: 2 },
      { itemCode: "mat_t4_arcane_rare", quantity: 1 },
      { itemCode: "mat_t4_binding_uncommon", quantity: 2 }
    ],
    ducatCost: 4000,
    craftingTimeSec: hours(6),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "craft_consumable_soulbound_draught",
    category: "raid_consumable",
    outputItemType: "consumable_soulbound_draught",
    outputRarity: "rare",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [
      { itemCode: "mat_t4_shadow_epic", quantity: 1 },
      { itemCode: "mat_t4_binding_rare", quantity: 1 }
    ],
    ducatCost: 6400,
    craftingTimeSec: hours(8),
    requiredPlayerLevel: 1
  })
]);

export const POTION_DISTILLATION_RECIPES = itemCraftRecipeSchema.array().parse([
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_vigorous_restorative_d1",
    category: "distillation",
    outputItemType: "consumable_vigorous_restorative_d1",
    outputRarity: "rare",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_vigorous_restorative", quantity: 3 }],
    ducatCost: 400,
    craftingTimeSec: minutes(30),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_sunspike_elixir_d1",
    category: "distillation",
    outputItemType: "consumable_sunspike_elixir_d1",
    outputRarity: "rare",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_sunspike_elixir", quantity: 3 }],
    ducatCost: 400,
    craftingTimeSec: minutes(30),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_graveward_elixir_d1",
    category: "distillation",
    outputItemType: "consumable_graveward_elixir_d1",
    outputRarity: "rare",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_graveward_elixir", quantity: 3 }],
    ducatCost: 600,
    craftingTimeSec: minutes(30),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_hexcleanse_phial_d1",
    category: "distillation",
    outputItemType: "consumable_hexcleanse_phial_d1",
    outputRarity: "rare",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_hexcleanse_phial", quantity: 3 }],
    ducatCost: 480,
    craftingTimeSec: minutes(30),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_vigorous_restorative_d2",
    category: "distillation",
    outputItemType: "consumable_vigorous_restorative_d2",
    outputRarity: "epic",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_vigorous_restorative_d1", quantity: 3 }],
    ducatCost: 1200,
    craftingTimeSec: minutes(90),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_sunspike_elixir_d2",
    category: "distillation",
    outputItemType: "consumable_sunspike_elixir_d2",
    outputRarity: "epic",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_sunspike_elixir_d1", quantity: 3 }],
    ducatCost: 1200,
    craftingTimeSec: minutes(90),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_graveward_elixir_d2",
    category: "distillation",
    outputItemType: "consumable_graveward_elixir_d2",
    outputRarity: "epic",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_graveward_elixir_d1", quantity: 3 }],
    ducatCost: 1800,
    craftingTimeSec: minutes(90),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_hexcleanse_phial_d2",
    category: "distillation",
    outputItemType: "consumable_hexcleanse_phial_d2",
    outputRarity: "epic",
    outputTier: "t3",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_hexcleanse_phial_d1", quantity: 3 }],
    ducatCost: 1440,
    craftingTimeSec: minutes(90),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_contractors_resolve_d1",
    category: "distillation",
    outputItemType: "consumable_contractors_resolve_d1",
    outputRarity: "rare",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_contractors_resolve", quantity: 3 }],
    ducatCost: 800,
    craftingTimeSec: minutes(60),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_soulbound_draught_d1",
    category: "distillation",
    outputItemType: "consumable_soulbound_draught_d1",
    outputRarity: "rare",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_soulbound_draught", quantity: 3 }],
    ducatCost: 1280,
    craftingTimeSec: minutes(60),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_contractors_resolve_d2",
    category: "distillation",
    outputItemType: "consumable_contractors_resolve_d2",
    outputRarity: "epic",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_contractors_resolve_d1", quantity: 3 }],
    ducatCost: 2400,
    craftingTimeSec: minutes(180),
    requiredPlayerLevel: 1
  }),
  itemCraftRecipeSchema.parse({
    recipeId: "distill_consumable_soulbound_draught_d2",
    category: "distillation",
    outputItemType: "consumable_soulbound_draught_d2",
    outputRarity: "epic",
    outputTier: "t4",
    ilvlMin: 0,
    ilvlMax: 0,
    ingredients: [{ itemCode: "consumable_soulbound_draught_d1", quantity: 3 }],
    ducatCost: 3840,
    craftingTimeSec: minutes(180),
    requiredPlayerLevel: 1
  })
]);

export const MATERIAL_COMBINE_RECIPE_BY_ID = Object.freeze(
  Object.fromEntries(MATERIAL_COMBINE_RECIPES.map((recipe) => [recipe.recipeId, recipe])) as Record<string, MaterialCombineRecipe>
);

export const ITEM_CRAFT_RECIPE_BY_ID = Object.freeze(
  Object.fromEntries(ITEM_CRAFT_RECIPES.map((recipe) => [recipe.recipeId, recipe])) as Record<string, ItemCraftRecipe>
);

export const POTION_DISTILLATION_RECIPE_BY_ID = Object.freeze(
  Object.fromEntries(POTION_DISTILLATION_RECIPES.map((recipe) => [recipe.recipeId, recipe])) as Record<string, ItemCraftRecipe>
);

export function getCraftingTierForLevel(level: number): CraftingTier {
  if (level >= 76) {
    return "t4";
  }
  if (level >= 51) {
    return "t3";
  }
  if (level >= 26) {
    return "t2";
  }
  return "t1";
}

export function getCraftingMaterialDefinition(itemCode: string): CraftingMaterial | null {
  return CRAFTING_MATERIAL_BY_CODE[itemCode] ?? null;
}

export function getCraftingOutputDefinition(itemCode: string) {
  return CRAFTING_OUTPUT_DEFINITIONS[itemCode as CraftingOutputItemCode] ?? null;
}
