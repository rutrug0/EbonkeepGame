import { describe, expect, it } from "vitest";

import {
  buildPlayerStatSnapshot,
  computeGearScore,
  createEmptyEquipmentState
} from "../../src/modules/player/state-service.js";

describe("player state service", () => {
  it("builds a stat snapshot with equipment bonuses applied", () => {
    const equipment = createEmptyEquipmentState();
    equipment.weapon = {
      id: "weapon_1",
      itemCode: "test_blade",
      itemName: "Test Blade",
      rarity: "rare",
      category: "weapon",
      equipable: true,
      levelRequirement: 1,
      allowedSlotIds: ["weapon"],
      baseLevel: 1,
      power: 42,
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "melee",
        weaponFamily: "sword"
      },
      statBonuses: {
        strength: 4,
        damage: 8
      },
      description: "Used by tests."
    };

    const snapshot = buildPlayerStatSnapshot({
      playerClass: "warrior",
      baseStats: {
        strength: 10,
        intelligence: 8,
        dexterity: 7,
        vitality: 9,
        initiative: 6,
        luck: 5
      },
      equipment
    });

    expect(snapshot.total.strength).toBe(14);
    expect(snapshot.total.damage).toBeGreaterThan(snapshot.base.damage);
    expect(snapshot.equipment.damage).toBeGreaterThan(0);
  });

  it("computes gear score from equipped item power", () => {
    const equipment = createEmptyEquipmentState();
    equipment.weapon = {
      id: "weapon_1",
      itemCode: "test_blade",
      itemName: "Test Blade",
      rarity: "rare",
      category: "weapon",
      equipable: true,
      levelRequirement: 1,
      allowedSlotIds: ["weapon"],
      baseLevel: 1,
      power: 42,
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "melee",
        weaponFamily: "sword"
      },
      statBonuses: {},
      description: "Used by tests."
    };

    expect(computeGearScore(equipment)).toBe(42);
  });
});
