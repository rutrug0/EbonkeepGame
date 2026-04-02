import { describe, expect, it } from "vitest";

import {
  baseConsumableCatalog,
  consumableCatalog,
  consumableRecipes,
  getBaseConsumableDefinition,
  getConsumableDefinition
} from "../src/domains/consumables/index.js";
import { gardenPlantCatalog } from "../src/domains/garden/index.js";

describe("consumables catalog", () => {
  it("publishes only the canonical potion, tonic, and elixir base lines", () => {
    expect(baseConsumableCatalog.map((entry) => entry.consumableId)).toEqual([
      "healing_potion",
      "second_wind_potion",
      "wardens_tonic",
      "hunters_tonic",
      "emberwake_tonic",
      "berserkers_tonic",
      "bulwark_tonic",
      "wardwash_tonic",
      "hexcleanse_tonic",
      "ravagers_tonic",
      "sunspike_elixir",
      "graveward_elixir",
      "wardens_challenge_elixir",
      "shadowveil_elixir",
      "deadeye_elixir",
      "travelers_elixir",
      "contractors_resolve_elixir",
      "chroniclers_elixir",
      "warcallers_elixir"
    ]);
  });

  it("provides base, d1, and d2 entries for every consumable line", () => {
    for (const baseEntry of baseConsumableCatalog) {
      expect(getConsumableDefinition(`consumable_${baseEntry.consumableId}`)?.distillTier).toBe("base");
      expect(getConsumableDefinition(`consumable_${baseEntry.consumableId}_d1`)?.distillTier).toBe("d1");
      expect(getConsumableDefinition(`consumable_${baseEntry.consumableId}_d2`)?.distillTier).toBe("d2");
    }

    expect(consumableCatalog).toHaveLength(baseConsumableCatalog.length * 3);
  });

  it("keeps craft recipes on two garden ingredients plus one reagent", () => {
    const gardenIngredientCodes = new Set(gardenPlantCatalog.map((entry) => entry.ingredientItemCode));

    for (const recipe of consumableRecipes.filter((entry) => entry.recipeKind === "craft")) {
      expect(recipe.outputTier).toBe("base");
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.ingredients.filter((ingredient) => gardenIngredientCodes.has(ingredient.itemCode))).toHaveLength(2);
      expect(
        recipe.ingredients.filter((ingredient) => ingredient.itemCode.startsWith("reagent_"))
      ).toHaveLength(1);
    }
  });

  it("keeps distillation exact-item and two-step only", () => {
    for (const baseEntry of baseConsumableCatalog) {
      const d1Recipe = consumableRecipes.find((recipe) => recipe.recipeId === `distill_consumable_${baseEntry.consumableId}_d1`);
      const d2Recipe = consumableRecipes.find((recipe) => recipe.recipeId === `distill_consumable_${baseEntry.consumableId}_d2`);

      expect(d1Recipe?.ingredients).toEqual([{ itemCode: `consumable_${baseEntry.consumableId}`, quantity: 3 }]);
      expect(d2Recipe?.ingredients).toEqual([{ itemCode: `consumable_${baseEntry.consumableId}_d1`, quantity: 3 }]);
      expect(d1Recipe?.ducatCost).toBe(0);
      expect(d2Recipe?.ducatCost).toBe(0);
    }
  });

  it("only upgrades potion potency across distillation tiers", () => {
    expect(getConsumableDefinition("consumable_healing_potion")?.effects).toEqual([
      { type: "restore_health_pct_max", value: 5 }
    ]);
    expect(getConsumableDefinition("consumable_healing_potion_d1")?.effects).toEqual([
      { type: "restore_health_pct_max", value: 15 }
    ]);
    expect(getConsumableDefinition("consumable_healing_potion_d2")?.effects).toEqual([
      { type: "restore_health_pct_max", value: 50 }
    ]);

    expect(getConsumableDefinition("consumable_second_wind_potion")?.effects).toEqual([
      { type: "restore_stamina_pct_max", value: 5 }
    ]);
    expect(getConsumableDefinition("consumable_second_wind_potion_d1")?.effects).toEqual([
      { type: "restore_stamina_pct_max", value: 15 }
    ]);
    expect(getConsumableDefinition("consumable_second_wind_potion_d2")?.effects).toEqual([
      { type: "restore_stamina_pct_max", value: 50 }
    ]);

    expect(getConsumableDefinition("consumable_wardens_tonic_d1")?.effects).toEqual(
      getConsumableDefinition("consumable_wardens_tonic")?.effects
    );
    expect(getConsumableDefinition("consumable_sunspike_elixir_d2")?.effects).toEqual(
      getConsumableDefinition("consumable_sunspike_elixir")?.effects
    );
  });

  it("keeps garden recipe refs aligned to canonical base consumable names", () => {
    const baseDisplayNames = new Set(baseConsumableCatalog.map((entry) => entry.displayName));

    for (const plant of gardenPlantCatalog) {
      for (const recipeRef of plant.recipeRefs) {
        expect(baseDisplayNames.has(recipeRef)).toBe(true);
      }
    }
  });

  it("does not expose retired names as canonical display names", () => {
    const displayNames = new Set(baseConsumableCatalog.map((entry) => entry.displayName));

    expect(displayNames.has("Vigorous Restorative")).toBe(false);
    expect(displayNames.has("Hexcleanse Phial")).toBe(false);
    expect(displayNames.has("Contractor's Resolve")).toBe(false);
    expect(displayNames.has("Soulbound Draught")).toBe(false);
    expect(getBaseConsumableDefinition("healing_potion")?.legacyReplaces).toContain("Vigorous Restorative");
  });
});
