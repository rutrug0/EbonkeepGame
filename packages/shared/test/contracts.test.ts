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
    expect(getAllowedClassesForArchetype("armor", "heavy")).toEqual(["warrior"]);
    expect(getAllowedClassesForArchetype("weapon", "arcane")).toEqual(["mage"]);
    expect(getAllowedClassesForArchetype("jewelry")).toEqual(["warrior", "mage", "ranger"]);
  });

  it("checks whether an item is usable by a class", () => {
    expect(isItemUsableByClass("warrior", "weapon", "melee")).toBe(true);
    expect(isItemUsableByClass("warrior", "weapon", "arcane")).toBe(false);
    expect(isItemUsableByClass("mage", "jewelry")).toBe(true);
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
