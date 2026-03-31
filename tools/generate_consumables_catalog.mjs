import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const catalogCsvPath = path.join(repoRoot, "docs", "data", "consumables_catalog_v2.csv");
const recipesCsvPath = path.join(repoRoot, "docs", "data", "consumable_recipes_v2.csv");
const gardenCsvPath = path.join(repoRoot, "docs", "data", "garden_plants_v1.csv");
const outputPath = path.join(repoRoot, "packages", "shared", "src", "domains", "consumables", "catalog.generated.ts");

const UNLOCK_BAND_TO_CRAFTING_TIER = {
  easy: "t1",
  medium: "t2",
  hard: "t3"
};

const TYPE_FAMILY_RULES = {
  potion: new Set(["recovery", "stamina"]),
  tonic: new Set(["defense", "precision", "offense", "frenzy", "bulwark", "warding", "cleansing", "momentum"]),
  elixir: new Set(["offense", "precision", "frenzy", "bulwark", "travel", "wealth", "experience"])
};

const VALID_REAGENT_CODES = new Set([
  "reagent_binder_salts",
  "reagent_ward_resin",
  "reagent_black_ichor",
  "reagent_aether_catalyst"
]);

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function readRows(csvPath) {
  const source = readFileSync(csvPath, "utf8").trim();
  const lines = source.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function buildConsumableItemCode(consumableId, distillTier = "base") {
  return distillTier === "base"
    ? `consumable_${consumableId}`
    : `consumable_${consumableId}_${distillTier}`;
}

function buildConsumableDisplayName(displayName, distillTier) {
  if (distillTier === "base") {
    return displayName;
  }

  return `${distillTier === "d1" ? "Potent" : "Mythic"} ${displayName}`;
}

function buildConsumableDescription(row, distillTier) {
  if (distillTier === "base") {
    return row.description;
  }

  return `${distillTier === "d1" ? "Potent" : "Mythic"} refinement of ${row.display_name}.`;
}

function nextRarity(rarity) {
  if (rarity === "common") return "uncommon";
  if (rarity === "uncommon") return "rare";
  return "epic";
}

function getRarityForTier(baseRarity, distillTier) {
  if (distillTier === "base") {
    return baseRarity;
  }

  if (distillTier === "d1") {
    return nextRarity(baseRarity);
  }

  return nextRarity(nextRarity(baseRarity));
}

function parseLegacyReplaces(value) {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEffect(row, slotIndex) {
  const type = row[`effect_${slotIndex}_type`];
  if (!type) {
    return null;
  }

  const target = row[`effect_${slotIndex}_target`] || undefined;
  const rawValue = row[`effect_${slotIndex}_value`];
  const rawD1Value = row[`effect_${slotIndex}_d1_value`];
  const rawD2Value = row[`effect_${slotIndex}_d2_value`];
  const extra = row[`effect_${slotIndex}_extra`] || undefined;

  return {
    type,
    ...(target ? { target } : {}),
    ...(rawValue ? { baseValue: Number.parseInt(rawValue, 10) } : {}),
    ...(rawD1Value ? { d1Value: Number.parseInt(rawD1Value, 10) } : {}),
    ...(rawD2Value ? { d2Value: Number.parseInt(rawD2Value, 10) } : {}),
    ...(extra ? { extra } : {})
  };
}

function buildEffectForTier(effect, distillTier) {
  const value =
    distillTier === "d1"
      ? effect.d1Value ?? effect.baseValue
      : distillTier === "d2"
        ? effect.d2Value ?? effect.baseValue
        : effect.baseValue;

  return {
    type: effect.type,
    ...(effect.target ? { target: effect.target } : {}),
    ...(typeof value === "number" ? { value } : {})
  };
}

function buildCatalogEntries(rows) {
  const seenConsumableIds = new Set();

  const baseRows = rows.map((row) => {
    if (seenConsumableIds.has(row.consumable_id)) {
      throw new Error(`Duplicate consumable_id: ${row.consumable_id}`);
    }
    seenConsumableIds.add(row.consumable_id);

    if (!TYPE_FAMILY_RULES[row.type]?.has(row.family)) {
      throw new Error(`Consumable ${row.consumable_id} has invalid type/family pair: ${row.type}/${row.family}`);
    }

    return {
      consumableId: row.consumable_id,
      itemCode: buildConsumableItemCode(row.consumable_id),
      displayName: row.display_name,
      type: row.type,
      family: row.family,
      rarity: row.rarity,
      unlockBand: row.unlock_band,
      craftingTier: UNLOCK_BAND_TO_CRAFTING_TIER[row.unlock_band],
      durationKind: row.duration_kind,
      durationValue: Number.parseInt(row.duration_value || "0", 10),
      distillGroup: row.distill_group,
      distillTier: "base",
      legacyReplaces: parseLegacyReplaces(row.legacy_replaces),
      iconKey: row.icon_key,
      description: row.description,
      effects: [1, 2, 3]
        .map((slotIndex) => parseEffect(row, slotIndex))
        .filter(Boolean)
    };
  });

  const distilledRows = baseRows.flatMap((row) =>
    ["d1", "d2"].map((distillTier) => ({
      ...row,
      itemCode: buildConsumableItemCode(row.consumableId, distillTier),
      displayName: buildConsumableDisplayName(row.displayName, distillTier),
      rarity: getRarityForTier(row.rarity, distillTier),
      distillTier,
      description: buildConsumableDescription(
        {
          display_name: row.displayName,
          description: row.description
        },
        distillTier
      ),
      effects: row.effects.map((effect) => buildEffectForTier(effect, distillTier))
    }))
  );

  return [
    ...baseRows.map((row) => ({
      ...row,
      effects: row.effects.map((effect) => buildEffectForTier(effect, "base"))
    })),
    ...distilledRows
  ];
}

function buildRecipes(rows, catalogEntries, gardenIngredientCodes) {
  const baseCatalogById = Object.fromEntries(
    catalogEntries
      .filter((entry) => entry.distillTier === "base")
      .map((entry) => [entry.consumableId, entry])
  );
  const seenRecipeIds = new Set();

  return rows.map((row) => {
    if (seenRecipeIds.has(row.recipe_id)) {
      throw new Error(`Duplicate recipe_id: ${row.recipe_id}`);
    }
    seenRecipeIds.add(row.recipe_id);

    const baseEntry = baseCatalogById[row.output_consumable_id];
    if (!baseEntry) {
      throw new Error(`Recipe ${row.recipe_id} references unknown consumable ${row.output_consumable_id}`);
    }

    const outputTier = row.output_tier || "base";
    const outputItemCode = buildConsumableItemCode(row.output_consumable_id, outputTier);

    const ingredients = [1, 2, 3]
      .map((slotIndex) => {
        const itemCode = row[`ingredient_${slotIndex}_code`];
        const quantity = row[`ingredient_${slotIndex}_qty`];

        if (!itemCode) {
          return null;
        }

        return {
          itemCode,
          quantity: Number.parseInt(quantity, 10)
        };
      })
      .filter(Boolean);

    if (row.recipe_kind === "craft" && outputTier !== "base") {
      throw new Error(`Craft recipe ${row.recipe_id} must target output_tier=base`);
    }

    if (row.recipe_kind === "craft") {
      if (ingredients.length !== 3) {
        throw new Error(`Craft recipe ${row.recipe_id} must use exactly 3 ingredients`);
      }

      const gardenIngredients = ingredients.filter((ingredient) => gardenIngredientCodes.has(ingredient.itemCode));
      const reagentIngredients = ingredients.filter((ingredient) => VALID_REAGENT_CODES.has(ingredient.itemCode));

      if (gardenIngredients.length !== 2 || reagentIngredients.length !== 1) {
        throw new Error(`Craft recipe ${row.recipe_id} must use 2 garden ingredients and 1 reagent`);
      }
    }

    if (row.recipe_kind === "distill") {
      if (outputTier === "base") {
        throw new Error(`Distill recipe ${row.recipe_id} must target output_tier d1 or d2`);
      }

      const expectedIngredientCode =
        outputTier === "d1"
          ? buildConsumableItemCode(row.output_consumable_id, "base")
          : buildConsumableItemCode(row.output_consumable_id, "d1");

      if (ingredients.length !== 1 || ingredients[0].itemCode !== expectedIngredientCode || ingredients[0].quantity !== 3) {
        throw new Error(`Distill recipe ${row.recipe_id} must consume 3x ${expectedIngredientCode}`);
      }
    }

    return {
      recipeId: row.recipe_id,
      recipeKind: row.recipe_kind,
      outputConsumableId: row.output_consumable_id,
      outputTier,
      outputItemCode,
      outputRarity: catalogEntries.find((entry) => entry.itemCode === outputItemCode)?.rarity,
      outputCraftingTier: baseEntry.craftingTier,
      ducatCost: Number.parseInt(row.ducat_cost, 10),
      craftingTimeSec: Number.parseInt(row.crafting_time_sec, 10),
      requiredLevel: Number.parseInt(row.required_level, 10),
      ingredients
    };
  });
}

function buildOutput(catalogEntries, recipes) {
  return `// Auto-generated by tools/generate_consumables_catalog.mjs
// Do not edit manually.

export const GENERATED_CONSUMABLE_CATALOG = ${JSON.stringify(catalogEntries, null, 2)} as const;

export const GENERATED_CONSUMABLE_RECIPES = ${JSON.stringify(recipes, null, 2)} as const;
`;
}

const catalogRows = readRows(catalogCsvPath);
const recipeRows = readRows(recipesCsvPath);
const gardenRows = readRows(gardenCsvPath);
const gardenIngredientCodes = new Set(gardenRows.map((row) => row.ingredient_item_code));
const catalogEntries = buildCatalogEntries(catalogRows);
const recipes = buildRecipes(recipeRows, catalogEntries, gardenIngredientCodes);

for (const baseEntry of catalogEntries.filter((entry) => entry.distillTier === "base")) {
  const outputTiers = new Set(
    recipes
      .filter((recipe) => recipe.outputConsumableId === baseEntry.consumableId)
      .map((recipe) => recipe.outputTier)
  );

  if (!outputTiers.has("base") || !outputTiers.has("d1") || !outputTiers.has("d2")) {
    throw new Error(`Consumable ${baseEntry.consumableId} must define craft, d1, and d2 recipes`);
  }
}

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildOutput(catalogEntries, recipes), "utf8");

console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
