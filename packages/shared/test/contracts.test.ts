import { describe, expect, it } from "vitest";

import {
  leaderboardTypeSchema as compatibilityLeaderboardTypeSchema,
  getAllowedClassesForArchetype,
  isItemUsableByClass,
  validateVestigeLoadout
} from "../src/index.js";
import { leaderboardTypeSchema } from "../src/domains/leaderboard/index.js";
import { supportedLocaleSchema } from "../src/core/index.js";

describe("shared contracts", () => {
  it("maps archetypes to allowed classes", () => {
    // armor archetypes grouped by equipment group (weapon stat)
    expect(getAllowedClassesForArchetype("armor", "heavy")).toEqual(["juggernaut", "arbalist", "runecaster"]);
    expect(getAllowedClassesForArchetype("weapon", "arcane")).toEqual(["runecaster", "chronomancer", "arcanist"]);
    expect(getAllowedClassesForArchetype("jewelry")).toEqual([
      "juggernaut", "sentinel", "reaver",
      "shade", "arbalist", "disciple",
      "runecaster", "chronomancer", "arcanist"
    ]);
  });

  it("checks whether an item is usable by a class", () => {
    expect(isItemUsableByClass("juggernaut", "weapon", "melee")).toBe(true);
    expect(isItemUsableByClass("juggernaut", "weapon", "arcane")).toBe(false);
    expect(isItemUsableByClass("arcanist", "jewelry")).toBe(true);
  });

  it("validates vestige loadout size and duplicates", () => {
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light"])).toEqual({ valid: true });
    expect(validateVestigeLoadout(["ashen-sovereign", "ashen-sovereign"])).toEqual({
      valid: false,
      reason: "duplicate_vestige"
    });
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light", "hollow-star"])).toEqual({
      valid: false,
      reason: "max_vestiges_exceeded"
    });
  });

  it("exposes domain entrypoints directly", () => {
    expect(supportedLocaleSchema.options).toContain("en");
    expect(leaderboardTypeSchema.options).toEqual(["power", "level"]);
  });

  it("keeps the root barrel as a compatibility re-export", () => {
    expect(compatibilityLeaderboardTypeSchema).toBe(leaderboardTypeSchema);
  });
});
