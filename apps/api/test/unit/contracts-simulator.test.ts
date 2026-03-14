import { describe, expect, it } from "vitest";

import { combatActorSnapshotSchema } from "@ebonkeep/shared/combat";
import type { PlayerState } from "@ebonkeep/shared/player";

import { rollInventoryItem } from "../../src/modules/inventory/item-service.js";
import { createEmptyEquipmentState } from "../../src/modules/player/state-service.js";
import { getMonsterCombatTuning, toFloat } from "../../src/modules/contracts/data.js";
import {
  buildMonsterActorSnapshots,
  buildPlayerActorSnapshot,
  rollRewardItemSpec,
  simulateCombat
} from "../../src/modules/contracts/simulator.js";

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

function createPlayerState(): PlayerState {
  return {
    playerId: "player_1",
    accountId: "account_1",
    class: "juggernaut",
    portraitId: "str_01",
    backgroundId: "bg_01",
    preferredLocale: "en",
    level: 40,
    experience: 0,
    experienceIntoLevel: 0,
    experienceToNextLevel: 1000,
    gearScore: 200,
    health: {
      current: 600,
      max: 600
    },
    stamina: {
      current: 120,
      max: 120,
      nextPointAt: null
    },
    stats: {
      strength: 25,
      intelligence: 10,
      dexterity: 14,
      vitality: 20,
      initiative: 18,
      luck: 12
    },
    statSnapshot: {
      total: {
        strength: 25,
        intelligence: 10,
        dexterity: 14,
        vitality: 20,
        initiative: 110,
        luck: 12,
        damage: 120,
        maxHitpoints: 600,
        armor: 20,
        spellShield: 16,
        missileResistance: 14,
        physicalDefense: 18,
        magicDefense: 15,
        accuracy: 105,
        dodgeChance: 600,
        critChance: 900,
        critMultiplier: 16500,
        extraAttackChance: 250
      }
    } as PlayerState["statSnapshot"],
    inventory: [],
    equipment: createEmptyEquipmentState(),
    currency: {
      ducats: 0,
      imperials: 0
    }
  };
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

  it("applies monster tuning multipliers without changing player snapshot generation", () => {
    const playerState = createPlayerState();
    const encounterBase = {
      contractName: "Test Contract",
      family: {
        baseLevel: 40,
        familyId: "temporary_zone_40",
        familyName: "Temporary Zone 40",
        locationName: "Test Reach"
      },
      members: [
        {
          familyId: "temporary_zone_40",
          sequence: 1,
          monsterRole: "default",
          isBoss: false,
          monsterName: "Temporary Monster 40",
          mainStat: "strength",
          damageKind: "melee",
          healthBias: "medium",
          damageBias: "medium",
          armorBias: "medium",
          spellShieldBias: "medium",
          missileResistBias: "medium",
          initiativeBias: "medium",
          accuracyBias: "medium",
          critBias: "medium",
          evasionBias: "medium"
        }
      ],
      encounterLevel: 40,
      rewardPreview: {
        experienceMin: 100,
        experienceMax: 100,
        ducatsMin: 50,
        ducatsMax: 50,
        itemDropChanceBps: 0,
        staminaCost: 8,
        efficiencyTier: "standard_cost" as const
      }
    };

    const easyPlayer = buildPlayerActorSnapshot({
      playerState,
      playerName: "Warden"
    });
    const hardPlayer = buildPlayerActorSnapshot({
      playerState,
      playerName: "Warden"
    });
    const easyMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        difficulty: "easy" as const
      }
    })[0];
    const hardMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        difficulty: "hard" as const
      }
    })[0];

    expect(easyPlayer).toEqual(hardPlayer);
    const easyTuning = getMonsterCombatTuning(40, "easy");
    const hardTuning = getMonsterCombatTuning(40, "hard");

    expect(easyTuning.hpMultiplier).toBeCloseTo(1, 2);
    expect(easyTuning.damageMultiplier).toBeGreaterThan(0.9);
    expect(easyTuning.defenseMultiplier).toBeCloseTo(1, 2);
    expect(hardTuning.hpMultiplier).toBeGreaterThan(easyTuning.hpMultiplier);
    expect(hardTuning.damageMultiplier).toBeGreaterThan(0);
    expect(hardTuning.defenseMultiplier).toBeGreaterThan(easyTuning.defenseMultiplier);
    expect(hardMonster?.maxHp ?? 0).toBeGreaterThan(easyMonster?.maxHp ?? 0);
    expect(hardMonster?.physicalDefense ?? 0).toBeGreaterThan(easyMonster?.physicalDefense ?? 0);
  });

  it("preserves zero-valued monster tuning multipliers while still defaulting missing values", () => {
    expect(toFloat("0", 1)).toBe(0);
    expect(toFloat("0.0", 1)).toBe(0);
    expect(toFloat(undefined, 1)).toBe(1);
    expect(toFloat("not-a-number", 1)).toBe(1);
  });
});
