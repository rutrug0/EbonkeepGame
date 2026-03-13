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
        damage: 8,
        accuracy: 6,
        critChance: 125
      },
      damageRoll: {
        minRollRange: [10, 12],
        rolledMin: 11,
        rolledMax: 13,
        maxRollRange: [12, 14],
        averageDamage: 12
      },
      description: "Used by tests."
    };

    const snapshot = buildPlayerStatSnapshot({
      playerClass: "juggernaut",
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
    expect(snapshot.base.damage).toBe(1);
    expect(snapshot.total.damage).toBe(21);
    expect(snapshot.equipment.damage).toBe(20);
    expect(snapshot.base.accuracy).toBe(75);
    expect(snapshot.total.accuracy).toBe(81);
    expect(snapshot.base.critChance).toBe(550);
    expect(snapshot.total.critChance).toBe(675);
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
