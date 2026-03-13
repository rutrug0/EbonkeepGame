import { describe, expect, it } from "vitest";

import {
  getItemTemplate,
  getStarterTemplateIdsForClass,
  parseStoredInventoryItem,
  rollInventoryItem
} from "../../src/modules/inventory/item-service.js";

describe("item service weapon bonuses", () => {
  it("does not add hidden stat bonuses to newly rolled starter weapons", () => {
    const [, starterWeaponTemplateId] = getStarterTemplateIdsForClass("juggernaut");
    const weapon = rollInventoryItem({
      playerId: "player_1",
      templateId: starterWeaponTemplateId,
      rarity: "common",
      deterministic: true,
      deterministicCode: "starter_weapon",
      itemLevel: 1
    });

    expect(weapon.archetype.majorCategory).toBe("weapon");
    expect(weapon.statBonuses).toEqual({});
    expect(weapon.damageRoll).toBeDefined();
  });

  it("does not add hidden stat bonuses to newly rolled starter armor", () => {
    const [starterArmorTemplateId] = getStarterTemplateIdsForClass("juggernaut");
    const armor = rollInventoryItem({
      playerId: "player_1",
      templateId: starterArmorTemplateId,
      rarity: "common",
      deterministic: true,
      deterministicCode: "starter_armor",
      itemLevel: 1
    });

    expect(armor.archetype.majorCategory).toBe("armor");
    expect(armor.statBonuses.strength).toBeUndefined();
    expect(armor.statBonuses.vitality).toBeUndefined();
    expect(armor.statBonuses.armor).toBeUndefined();
    expect(armor.statBonuses.maxHitpoints).toBeUndefined();
    expect(armor.statBonuses.physicalDefense).toBeGreaterThan(0);
  });

  it("strips legacy hidden weapon bonuses and keeps only explicit modifiers", () => {
    const parsed = parseStoredInventoryItem({
      id: "weapon_1",
      itemCode: "starter_weapon",
      itemData: {
        itemName: "Test Sword",
        rarity: "rare",
        category: "Weapon",
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
          strength: 2,
          accuracy: 1,
          damage: 3
        },
        damageRoll: {
          minRollRange: [2, 3],
          rolledMin: 2,
          rolledMax: 4,
          maxRollRange: [5, 6],
          averageDamage: 3
        },
        affix: {
          kind: "affix",
          tier: "T2",
          name: "of Slaying",
          statKey: "damage",
          value: 3,
          unit: "flat"
        },
        description: "Used by tests."
      }
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.statBonuses).toEqual({ damage: 3 });
  });

  it("strips legacy hidden armor bonuses and keeps defense plus explicit modifiers", () => {
    const parsed = parseStoredInventoryItem({
      id: "armor_1",
      itemCode: "starter_armor",
      itemData: {
        itemName: "Test Cuirass",
        rarity: "rare",
        category: "Armor",
        equipable: true,
        levelRequirement: 1,
        allowedSlotIds: ["upperArmor"],
        baseLevel: 1,
        power: 42,
        archetype: {
          majorCategory: "armor",
          armorArchetype: "heavy"
        },
        statBonuses: {
          strength: 1,
          vitality: 1,
          armor: 2,
          maxHitpoints: 6,
          physicalDefense: 4
        },
        prefix: {
          kind: "prefix",
          tier: "T2",
          name: "Stout",
          statKey: "vitality",
          value: 3,
          unit: "flat"
        },
        description: "Used by tests."
      }
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.statBonuses.strength).toBeUndefined();
    expect(parsed?.statBonuses.armor).toBeUndefined();
    expect(parsed?.statBonuses.maxHitpoints).toBeUndefined();
    expect(parsed?.statBonuses.vitality).toBe(3);
    expect(parsed?.statBonuses.physicalDefense).toBeGreaterThan(0);
  });

  it("gives later weapon templates a higher baseline power at their native level", () => {
    const earlyTemplate = getItemTemplate("warrior_plainsteel_longsword");
    const lateTemplate = getItemTemplate("warrior_silvermark_longblade");
    const earlyWeapon = rollInventoryItem({
      playerId: "player_1",
      templateId: earlyTemplate.id,
      rarity: "common",
      deterministic: true,
      deterministicCode: "early_weapon",
      itemLevel: earlyTemplate.baseLevel
    });
    const lateWeapon = rollInventoryItem({
      playerId: "player_1",
      templateId: lateTemplate.id,
      rarity: "common",
      deterministic: true,
      deterministicCode: "late_weapon",
      itemLevel: lateTemplate.baseLevel
    });

    expect(lateTemplate.baseLevel).toBeGreaterThan(earlyTemplate.baseLevel);
    expect(lateWeapon.power).toBeGreaterThan(earlyWeapon.power);
  });

  it("gives later armor templates a higher baseline power at their native level", () => {
    const earlyTemplate = getItemTemplate("warrior_service_helm");
    const lateTemplate = getItemTemplate("warrior_silvermark_sabatons");
    const earlyArmor = rollInventoryItem({
      playerId: "player_1",
      templateId: earlyTemplate.id,
      rarity: "common",
      deterministic: true,
      deterministicCode: "early_armor",
      itemLevel: earlyTemplate.baseLevel
    });
    const lateArmor = rollInventoryItem({
      playerId: "player_1",
      templateId: lateTemplate.id,
      rarity: "common",
      deterministic: true,
      deterministicCode: "late_armor",
      itemLevel: lateTemplate.baseLevel
    });

    expect(lateTemplate.baseLevel).toBeGreaterThan(earlyTemplate.baseLevel);
    expect(lateArmor.power).toBeGreaterThan(earlyArmor.power);
  });
});
