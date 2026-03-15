import { describe, expect, it } from "vitest";

import { calculateCombatMitigation } from "@ebonkeep/shared/combat";

describe("combat mitigation curve", () => {
  it("maps typed and bonus defense by damage kind", () => {
    const melee = calculateCombatMitigation({
      rawDamage: 100,
      damageKind: "melee",
      attacker: { minDamage: 80, maxDamage: 120 },
      defender: {
        armor: 30,
        missileResistance: 20,
        spellShield: 10,
        physicalDefense: 15,
        magicDefense: 8
      }
    });
    const spell = calculateCombatMitigation({
      rawDamage: 100,
      damageKind: "spell",
      attacker: { minDamage: 80, maxDamage: 120 },
      defender: {
        armor: 30,
        missileResistance: 20,
        spellShield: 10,
        physicalDefense: 15,
        magicDefense: 8
      }
    });

    expect(melee.typedDefense).toBe(30);
    expect(melee.bonusDefense).toBe(15);
    expect(spell.typedDefense).toBe(10);
    expect(spell.bonusDefense).toBe(8);
  });

  it("applies a five percent floor with a minimum of one damage", () => {
    const result = calculateCombatMitigation({
      rawDamage: 9,
      damageKind: "melee",
      attacker: { minDamage: 10, maxDamage: 10 },
      defender: {
        armor: 999,
        missileResistance: 0,
        spellShield: 0,
        physicalDefense: 999,
        magicDefense: 0
      }
    });

    expect(result.minimumDamage).toBe(1);
    expect(result.finalDamage).toBeGreaterThanOrEqual(result.minimumDamage);
  });

  it("uses diminishing returns so extra defense still helps without reaching immunity", () => {
    const lowDefense = calculateCombatMitigation({
      rawDamage: 100,
      damageKind: "melee",
      attacker: { minDamage: 80, maxDamage: 120 },
      defender: {
        armor: 10,
        missileResistance: 0,
        spellShield: 0,
        physicalDefense: 5,
        magicDefense: 0
      }
    });
    const highDefense = calculateCombatMitigation({
      rawDamage: 100,
      damageKind: "melee",
      attacker: { minDamage: 80, maxDamage: 120 },
      defender: {
        armor: 200,
        missileResistance: 0,
        spellShield: 0,
        physicalDefense: 100,
        magicDefense: 0
      }
    });

    expect(highDefense.mitigationPercentBps).toBeGreaterThan(lowDefense.mitigationPercentBps);
    expect(highDefense.mitigationPercentBps).toBeLessThanOrEqual(7500);
    expect(highDefense.finalDamage).toBeGreaterThanOrEqual(highDefense.minimumDamage);
  });
});
