import { describe, expect, it } from "vitest";

import {
  getUploadedItemIconPathByIconKey,
  getUploadedItemIconPathByItemCode
} from "../src/lib/itemIcons";

describe("uploaded item icon mappings", () => {
  it("maps crafting materials to the uploaded material art", () => {
    expect(getUploadedItemIconPathByItemCode("mat_t1_metal_common")).toBe("/assets/materials/mat_iron_ore.png");
    expect(getUploadedItemIconPathByItemCode("all_tempering_draught")).toBe(
      "/assets/materials/mat_tempering_draught.png"
    );
    expect(getUploadedItemIconPathByItemCode("all_salvaged_ingot")).toBe("/assets/materials/mat_iron_ore.png");
  });

  it("maps uploaded consumables by item code and distilled aliases", () => {
    expect(getUploadedItemIconPathByItemCode("consumable_healing_potion")).toBe(
      "/assets/consumables/consumable_healing_potion.png"
    );
    expect(getUploadedItemIconPathByItemCode("consumable_graveward_elixir_d2")).toBe(
      "/assets/consumables/consumable_graveward_elixir.png"
    );
  });

  it("maps uploaded icon keys directly", () => {
    expect(getUploadedItemIconPathByIconKey("consumable_contractors_resolve")).toBe(
      "/assets/consumables/consumable_contractors_resolve.png"
    );
    expect(getUploadedItemIconPathByIconKey("consumable_contractors_resolve_d1")).toBe(
      "/assets/consumables/consumable_contractors_resolve.png"
    );
  });
});
