import { describe, expect, it } from "vitest";

import { combatActorSnapshotSchema } from "@ebonkeep/shared/combat";

import { rollInventoryItem } from "../../src/modules/inventory/item-service.js";
import { rollRewardItemSpec, simulateCombat } from "../../src/modules/contracts/simulator.js";

function actor(overrides: Partial<ReturnType<typeof combatActorSnapshotSchema.parse>>) {
  return combatActorSnapshotSchema.parse({
    id: "actor",
    side: "player",
    encounterOrder: 0,
    name: "Actor",
    level: 1,
    maxHp: 100,
    currentHp: 100,
    combatSpeed: 100,
    accuracy: 100,
    dodgeChance: 0,
    critChance: 0,
    critMultiplier: 15000,
    extraAttackChance: 0,
    armor: 0,
    spellShield: 0,
    missileResistance: 0,
    physicalDefense: 0,
    magicDefense: 0,
    minDamage: 10,
    maxDamage: 10,
    damageKind: "melee",
    ...overrides
  });
}

describe("contracts simulator", () => {
  it("is deterministic for the same seed", () => {
    const player = actor({ id: "player", side: "player", name: "Player" });
    const enemy = actor({ id: "enemy", side: "enemy", name: "Enemy", encounterOrder: 0, maxHp: 40, currentHp: 40 });

    const first = simulateCombat({
      player,
      enemies: [enemy],
      seed: "same-seed"
    });
    const second = simulateCombat({
      player,
      enemies: [enemy],
      seed: "same-seed"
    });

    expect(second).toEqual(first);
  });

  it("schedules faster actors for roughly two actions before a 99-speed actor", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      combatSpeed: 200,
      minDamage: 1,
      maxDamage: 1,
      maxHp: 50,
      currentHp: 50
    });
    const enemy = actor({
      id: "enemy",
      side: "enemy",
      name: "Enemy",
      encounterOrder: 0,
      combatSpeed: 99,
      minDamage: 1,
      maxDamage: 1,
      maxHp: 50,
      currentHp: 50
    });

    const events = simulateCombat({
      player,
      enemies: [enemy],
      seed: "speed-seed"
    });
    const actorOrder = events
      .filter((event): event is Extract<(typeof events)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved")
      .slice(0, 3)
      .map((event) => event.actorId);

    expect(actorOrder).toEqual(["player", "player", "enemy"]);
  });

  it("caps extra attack chains at five strikes and retargets after a kill", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      extraAttackChance: 10000,
      minDamage: 1,
      maxDamage: 1
    });
    const enemyOne = actor({
      id: "enemy-a",
      side: "enemy",
      name: "Enemy A",
      encounterOrder: 0,
      maxHp: 1,
      currentHp: 1
    });
    const enemyTwo = actor({
      id: "enemy-b",
      side: "enemy",
      name: "Enemy B",
      encounterOrder: 1,
      maxHp: 10,
      currentHp: 10
    });

    const events = simulateCombat({
      player,
      enemies: [enemyOne, enemyTwo],
      seed: "chain-seed"
    });
    const firstAction = events.find(
      (event): event is Extract<(typeof events)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved"
    );

    expect(firstAction).toBeTruthy();
    expect(firstAction?.strikes).toHaveLength(5);
    expect(firstAction?.strikes[0]).toMatchObject({
      targetId: "enemy-a",
      killed: true
    });
    expect(firstAction?.strikes[1]?.targetId).toBe("enemy-b");
  });

  it("always deals at least two percent of the rolled damage on a successful hit", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      minDamage: 100,
      maxDamage: 100
    });
    const enemy = actor({
      id: "enemy",
      side: "enemy",
      name: "Enemy",
      encounterOrder: 0,
      armor: 200,
      physicalDefense: 200,
      maxHp: 20,
      currentHp: 20
    });

    const events = simulateCombat({
      player,
      enemies: [enemy],
      seed: "minimum-chip-damage"
    });
    const firstAction = events.find(
      (event): event is Extract<(typeof events)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved"
    );

    expect(firstAction).toBeTruthy();
    expect(firstAction?.strikes[0]).toMatchObject({
      rawDamage: 100,
      mitigatedDamage: 2,
      targetHpAfter: 18
    });
  });

  it("uses CSV drop ranges and shared rarity logic for reward item rolls", () => {
    const item = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 80,
      difficulty: "medium",
      allowedSlotId: "weapon"
    });

    expect(item).toBeTruthy();
    expect(item?.itemLevel).toBe(80);
    expect(item?.rarity).toBe("epic");
    expect([
      "Highguard Claymore",
      "Stormvale Axe",
      "Silvermark Longblade",
      "Dornhal Greataxe"
    ]).toContain(item?.itemName);
  });

  it("allows all-class jewelry in reward item rolls", () => {
    const item = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 80,
      difficulty: "easy",
      allowedSlotId: "necklace"
    });

    expect(item).toBeTruthy();
    expect(item?.itemLevel).toBe(80);
    expect([
      "Halo Pendant",
      "Star Amulet",
      "Thorn Charm"
    ]).toContain(item?.itemName);
  });

  it("yields stronger high-level reward items than low-level reward items", () => {
    const earlySpec = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 16,
      difficulty: "medium",
      allowedSlotId: "weapon"
    });
    const lateSpec = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 80,
      difficulty: "medium",
      allowedSlotId: "weapon"
    });

    expect(earlySpec).toBeTruthy();
    expect(lateSpec).toBeTruthy();

    const earlyItem = rollInventoryItem({
      playerId: "player_1",
      templateId: earlySpec!.templateId,
      rarity: earlySpec!.rarity,
      deterministic: true,
      deterministicCode: "reward_early_weapon",
      itemLevel: earlySpec!.itemLevel
    });
    const lateItem = rollInventoryItem({
      playerId: "player_1",
      templateId: lateSpec!.templateId,
      rarity: lateSpec!.rarity,
      deterministic: true,
      deterministicCode: "reward_late_weapon",
      itemLevel: lateSpec!.itemLevel
    });

    expect(lateItem.power).toBeGreaterThan(earlyItem.power);
  });
});
