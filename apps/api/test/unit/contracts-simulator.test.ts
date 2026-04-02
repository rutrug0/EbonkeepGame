import { describe, expect, it } from "vitest";

import { combatActorSnapshotSchema, getPveLevelDeltaModifier } from "@ebonkeep/shared/combat";
import type { PlayerState } from "@ebonkeep/shared/player";

import { rollInventoryItem } from "../../src/modules/inventory/item-service.js";
import { createEmptyEquipmentState } from "../../src/modules/player/state-service.js";
import {
  buildEncounterDefinitionForBand,
  buildRewardPreview,
  getMonsterLevelCurve,
  pickEncounterMembers,
  resolveContractLevelBand,
  resolveContractLevelWindow,
  resolveEncounterLevelRange,
  resolveZoneBaseLevelForEncounterLevel,
  rollContractEncounterLevel
} from "../../src/modules/contracts/data.js";
import {
  buildPlayerActorSnapshot,
  buildMonsterActorSnapshots,
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
    threat: 5,
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
    activeConsumables: [],
    inventory: [],
    equipment: createEmptyEquipmentState(),
    currency: {
      ducats: 0,
      imperials: 0
    },
    cheatSettings: {
      invincibilityEnabled: false,
      fastTravelEnabled: false,
      fastContractReplenishEnabled: false,
      fastArenaReplenishEnabled: false,
      fastTrainTimeEnabled: false,
      fastCraftTimeEnabled: false,
      unlimitedAcademyDonationsEnabled: false,
      unlimitedForgeConsumablesEnabled: false,
      unlimitedRefineryMaterialsEnabled: false
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
      threat: 100,
      maxHp: 1,
      currentHp: 1
    });
    const enemyTwo = actor({
      id: "enemy-b",
      side: "enemy",
      name: "Enemy B",
      encounterOrder: 1,
      threat: 1,
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

  it("enforces top-3 threat targeting and ignores lower-threat candidates", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      combatSpeed: 200,
      minDamage: 1,
      maxDamage: 1,
      threat: 100
    });
    const enemies = [
      actor({ id: "enemy-1", side: "enemy", encounterOrder: 0, maxHp: 100, currentHp: 100, threat: 500 }),
      actor({ id: "enemy-2", side: "enemy", encounterOrder: 1, maxHp: 100, currentHp: 100, threat: 250 }),
      actor({ id: "enemy-3", side: "enemy", encounterOrder: 2, maxHp: 100, currentHp: 100, threat: 250 }),
      actor({ id: "enemy-4", side: "enemy", encounterOrder: 3, maxHp: 100, currentHp: 100, threat: 1 })
    ];

    const selectedTargets = new Set<string>();
    for (let index = 0; index < 150; index += 1) {
      const events = simulateCombat({
        player,
        enemies,
        seed: `threat-top3-${index}`
      });
      const firstTurn = events.find(
        (event): event is Extract<(typeof events)[number], { type: "CombatTurnStarted" }> =>
          event.type === "CombatTurnStarted" && event.actorId === "player"
      );
      if (firstTurn?.targetId) {
        selectedTargets.add(firstTurn.targetId);
      }
    }

    expect(selectedTargets.has("enemy-4")).toBe(false);
    expect(selectedTargets.has("enemy-1")).toBe(true);
    expect(selectedTargets.has("enemy-2")).toBe(true);
    expect(selectedTargets.has("enemy-3")).toBe(true);
  });

  it("weights threat targeting around 50/25/25 for a 500/250/250 threat split", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      combatSpeed: 220,
      minDamage: 1,
      maxDamage: 1,
      threat: 100
    });
    const enemies = [
      actor({ id: "enemy-1", side: "enemy", encounterOrder: 0, maxHp: 100, currentHp: 100, threat: 500 }),
      actor({ id: "enemy-2", side: "enemy", encounterOrder: 1, maxHp: 100, currentHp: 100, threat: 250 }),
      actor({ id: "enemy-3", side: "enemy", encounterOrder: 2, maxHp: 100, currentHp: 100, threat: 250 }),
      actor({ id: "enemy-4", side: "enemy", encounterOrder: 3, maxHp: 100, currentHp: 100, threat: 0 })
    ];

    const counts = {
      "enemy-1": 0,
      "enemy-2": 0,
      "enemy-3": 0,
      "enemy-4": 0
    };

    for (let index = 0; index < 300; index += 1) {
      const events = simulateCombat({
        player,
        enemies,
        seed: `threat-weighted-${index}`
      });
      const firstTurn = events.find(
        (event): event is Extract<(typeof events)[number], { type: "CombatTurnStarted" }> =>
          event.type === "CombatTurnStarted" && event.actorId === "player"
      );
      if (firstTurn?.targetId && firstTurn.targetId in counts) {
        counts[firstTurn.targetId as keyof typeof counts] += 1;
      }
    }

    expect(counts["enemy-4"]).toBe(0);
    expect(counts["enemy-1"]).toBeGreaterThan(120);
    expect(counts["enemy-1"]).toBeLessThan(180);
    expect(counts["enemy-2"]).toBeGreaterThan(45);
    expect(counts["enemy-2"]).toBeLessThan(105);
    expect(counts["enemy-3"]).toBeGreaterThan(45);
    expect(counts["enemy-3"]).toBeLessThan(105);
  });

  it("uses uniform top-pool selection when summed threat is zero", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      combatSpeed: 240,
      minDamage: 1,
      maxDamage: 1
    });
    const enemies = [
      actor({ id: "enemy-1", side: "enemy", encounterOrder: 0, maxHp: 100, currentHp: 100, threat: 0 }),
      actor({ id: "enemy-2", side: "enemy", encounterOrder: 1, maxHp: 100, currentHp: 100, threat: 0 }),
      actor({ id: "enemy-3", side: "enemy", encounterOrder: 2, maxHp: 100, currentHp: 100, threat: 0 }),
      actor({ id: "enemy-4", side: "enemy", encounterOrder: 3, maxHp: 100, currentHp: 100, threat: 0 })
    ];

    const selectedTargets = new Set<string>();
    for (let index = 0; index < 150; index += 1) {
      const events = simulateCombat({
        player,
        enemies,
        seed: `threat-zero-${index}`
      });
      const firstTurn = events.find(
        (event): event is Extract<(typeof events)[number], { type: "CombatTurnStarted" }> =>
          event.type === "CombatTurnStarted" && event.actorId === "player"
      );
      if (firstTurn?.targetId) {
        selectedTargets.add(firstTurn.targetId);
      }
    }

    expect(selectedTargets.has("enemy-4")).toBe(false);
    expect(selectedTargets.has("enemy-1")).toBe(true);
    expect(selectedTargets.has("enemy-2")).toBe(true);
    expect(selectedTargets.has("enemy-3")).toBe(true);
  });

  it("applies threat modifiers from equipped items and active consumables", () => {
    const playerState = createPlayerState();
    playerState.equipment.weapon = {
      id: "weapon_threat",
      itemCode: "weapon_threat",
      itemName: "Threat Blade",
      rarity: "common",
      category: "Weapon",
      equipable: true,
      levelRequirement: 1,
      allowedSlotIds: ["weapon"],
      equipSlotId: "weapon",
      baseLevel: 1,
      power: 1,
      archetype: {
        majorCategory: "weapon",
        weaponArchetype: "melee",
        weaponFamily: "sword"
      },
      statBonuses: { threat: 1000 },
      damageRoll: {
        minRollRange: [100, 100],
        rolledMin: 100,
        rolledMax: 140,
        maxRollRange: [140, 140],
        averageDamage: 120
      },
      description: "threat test weapon"
    };
    playerState.equipment.ringLeft = {
      id: "ring_threat",
      itemCode: "ring_threat",
      itemName: "Threat Ring",
      rarity: "common",
      category: "Ring",
      equipable: true,
      levelRequirement: 1,
      allowedSlotIds: ["ringLeft", "ringRight"],
      equipSlotId: "ringLeft",
      baseLevel: 1,
      power: 1,
      archetype: {
        majorCategory: "jewelry"
      },
      statBonuses: { threat: -500 },
      description: "threat test ring"
    };
    playerState.activeConsumables = [
      {
        id: "active-threat-elixir",
        itemCode: "consumable_wardens_challenge_elixir",
        type: "elixir",
        family: "bulwark",
        effects: [{ type: "stat_bps", target: "threat", value: 800 }],
        appliedAt: new Date("2026-04-02T00:00:00.000Z").toISOString(),
        expiresAt: null,
        remainingEncounters: null,
        originalDuration: {
          kind: "hours",
          value: 8
        }
      }
    ];

    const snapshot = buildPlayerActorSnapshot({
      playerState,
      playerName: "Threat Tester"
    });

    expect(snapshot.minDamage).toBe(100);
    expect(snapshot.maxDamage).toBe(140);
    expect(snapshot.threat).toBe(76);
  });

  it("skips the PvE level modifier when combat is simulated in neutral mode", () => {
    const player = actor({
      id: "player",
      side: "player",
      name: "Player",
      level: 10,
      combatSpeed: 200,
      accuracy: 1000,
      dodgeChance: 0,
      minDamage: 20,
      maxDamage: 20,
      maxHp: 120,
      currentHp: 120
    });
    const enemy = actor({
      id: "enemy",
      side: "enemy",
      name: "Enemy",
      encounterOrder: 0,
      level: 60,
      combatSpeed: 1,
      dodgeChance: 0,
      maxHp: 300,
      currentHp: 300
    });

    const pveEvents = simulateCombat({
      player,
      enemies: [enemy],
      seed: "level-delta-seed"
    });
    const neutralEvents = simulateCombat({
      player,
      enemies: [enemy],
      seed: "level-delta-seed",
      levelDeltaMode: "neutral"
    });

    const pveStrike = pveEvents.find(
      (event): event is Extract<(typeof pveEvents)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved"
    )?.strikes[0];
    const neutralStrike = neutralEvents.find(
      (event): event is Extract<(typeof neutralEvents)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved"
    )?.strikes[0];

    expect(pveStrike?.rawDamage).toBeLessThan(neutralStrike?.rawDamage ?? 0);
  });

  it("uses the mitigation curve and a five percent minimum-hit floor", () => {
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
    const playerAction = events.find(
      (event): event is Extract<(typeof events)[number], { type: "CombatActionResolved" }> =>
        event.type === "CombatActionResolved" && event.actorId === "player"
    );

    expect(playerAction).toBeTruthy();
    expect(playerAction?.strikes[0]).toMatchObject({
      rawDamage: 100,
      mitigatedDamage: 27,
      targetHpAfter: 0
    });
  });

  it("uses CSV drop ranges and shared rarity logic for reward item rolls", () => {
    const item = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 80,
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
      allowedSlotId: "weapon"
    });
    const lateSpec = rollRewardItemSpec({
      rng: () => 0,
      playerClass: "juggernaut",
      encounterLevel: 80,
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

  it("uses adjacent zones for under-level, on-level, and over-level contracts", () => {
    expect(resolveEncounterLevelRange(25, "under_level")).toEqual({ min: 19, max: 21 });
    expect(resolveEncounterLevelRange(25, "on_level")).toEqual({ min: 22, max: 28 });
    expect(resolveEncounterLevelRange(25, "over_level")).toEqual({ min: 29, max: 31 });
    expect(resolveZoneBaseLevelForEncounterLevel(19)).toBe(20);
    expect(resolveZoneBaseLevelForEncounterLevel(25)).toBe(24);
    expect(resolveZoneBaseLevelForEncounterLevel(31)).toBe(32);
  });

  it("does not include bosses in generated encounter members for this balance pass", () => {
    const members = Array.from({ length: 20 }, (_, index) =>
      pickEncounterMembers(() => ((index * 997) % 10_000) / 10_000, "ternfield_hobgoblins_40")
    ).flat();

    expect(members.length).toBeGreaterThan(0);
    expect(members.every((member) => member.isBoss === false)).toBe(true);
  });

  it("clamps zone bands near the bottom and top of the ladder", () => {
    expect(resolveContractLevelWindow(1)).toEqual({ min: 1, max: 7 });
    expect(resolveEncounterLevelRange(1, "under_level")).toEqual({ min: 1, max: 1 });
    expect(resolveContractLevelWindow(100)).toEqual({ min: 94, max: 100 });
    expect(resolveEncounterLevelRange(100, "over_level")).toEqual({ min: 100, max: 100 });
  });

  it("preserves requested contract bands at the level-window edges", () => {
    const underAtFloor = buildEncounterDefinitionForBand(
      () => 0,
      {
        playerId: "player_floor",
        playerLevel: 1,
        playerClass: "juggernaut"
      },
      "under_level"
    );
    const overAtCap = buildEncounterDefinitionForBand(
      () => 0,
      {
        playerId: "player_cap",
        playerLevel: 100,
        playerClass: "juggernaut"
      },
      "over_level"
    );

    expect(underAtFloor.encounterLevel).toBe(1);
    expect(underAtFloor.levelBand).toBe("under_level");
    expect(overAtCap.encounterLevel).toBe(100);
    expect(overAtCap.levelBand).toBe("over_level");
  });

  it("classifies level bands from exact encounter deltas", () => {
    expect(resolveContractLevelBand(25, 19)).toBe("under_level");
    expect(resolveContractLevelBand(25, 21)).toBe("under_level");
    expect(resolveContractLevelBand(25, 22)).toBe("on_level");
    expect(resolveContractLevelBand(25, 28)).toBe("on_level");
    expect(resolveContractLevelBand(25, 29)).toBe("over_level");
    expect(resolveContractLevelBand(25, 31)).toBe("over_level");
  });

  it("rolls centered encounter levels inside the +/- six window", () => {
    let state = 0x12345678;
    const rng = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const samples = Array.from({ length: 5000 }, () => {
      return rollContractEncounterLevel(rng, 25);
    });

    const counts = samples.reduce((accumulator, encounterLevel) => {
      accumulator[encounterLevel] = (accumulator[encounterLevel] ?? 0) + 1;
      return accumulator;
    }, {} as Record<number, number>);

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(19);
    expect(Math.max(...samples)).toBeLessThanOrEqual(31);
    expect((counts[25] ?? 0) + (counts[24] ?? 0) + (counts[26] ?? 0)).toBeGreaterThan(
      (counts[19] ?? 0) + (counts[31] ?? 0)
    );
  });

  it("applies symmetric PvE level-delta bonuses and penalties at the threshold", () => {
    expect(getPveLevelDeltaModifier(25, 21)).toEqual({
      accuracyMultiplierBps: 11_000,
      damageMultiplierBps: 11_000
    });
    expect(getPveLevelDeltaModifier(25, 22)).toEqual({
      accuracyMultiplierBps: 10_000,
      damageMultiplierBps: 10_000
    });
    expect(getPveLevelDeltaModifier(21, 25)).toEqual({
      accuracyMultiplierBps: 9_000,
      damageMultiplierBps: 9_000
    });
  });

  it("makes higher-level monsters strictly stronger on the shared level curve", () => {
    const earlyCurve = getMonsterLevelCurve(16);
    const lateCurve = getMonsterLevelCurve(40);

    expect(lateCurve.maxHp).toBeGreaterThan(earlyCurve.maxHp);
    expect(lateCurve.averageDamage).toBeGreaterThan(earlyCurve.averageDamage);
    expect(lateCurve.typedDefense).toBeGreaterThan(earlyCurve.typedDefense);
    expect(lateCurve.bonusDefense).toBeGreaterThan(earlyCurve.bonusDefense);
  });

  it("adds extra late-game monster pressure after level 80", () => {
    const levelEightyCurve = getMonsterLevelCurve(80);
    const levelNinetyCurve = getMonsterLevelCurve(90);

    expect(levelNinetyCurve.combatSpeed - levelEightyCurve.combatSpeed).toBeGreaterThanOrEqual(4);
    expect(levelNinetyCurve.averageDamage - levelEightyCurve.averageDamage).toBeGreaterThanOrEqual(30);
    expect(levelNinetyCurve.dodgeChance - levelEightyCurve.dodgeChance).toBeGreaterThanOrEqual(70);
    expect(levelNinetyCurve.critChance - levelEightyCurve.critChance).toBeGreaterThanOrEqual(40);
  });

  it("keeps fast-role monsters quicker but lighter than slow roles at the same level", () => {
    const playerState = createPlayerState();
    const encounterBase = {
      contractName: "Role Contract",
      levelBand: "on_level" as const,
      family: {
        baseLevel: 40,
        familyId: "ternfield_hobgoblins_40",
        familyName: "The Ternfield Hobgoblins III",
        locationName: "Ternfields III"
      },
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

    const fastMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        members: [
          {
            familyId: "ternfield_hobgoblins_40",
            sequence: 1,
            monsterRole: "skirmisher",
            isBoss: false,
            monsterName: "Fast Monster",
            mainStat: "dexterity",
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
        ]
      }
    })[0];
    const slowMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        members: [
          {
            familyId: "ternfield_hobgoblins_40",
            sequence: 2,
            monsterRole: "bruiser",
            isBoss: false,
            monsterName: "Slow Monster",
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
        ]
      }
    })[0];

    expect(fastMonster?.combatSpeed ?? 0).toBeGreaterThan(slowMonster?.combatSpeed ?? 0);
    expect(fastMonster?.maxDamage ?? 0).toBeLessThan(slowMonster?.maxDamage ?? 0);
    expect(fastMonster?.extraAttackChance ?? 0).toBeGreaterThan(slowMonster?.extraAttackChance ?? 0);
  });

  it("keeps multi-enemy packs from scaling total HP linearly while retaining meaningful hit size", () => {
    const playerState = createPlayerState();
    const encounterBase = {
      contractName: "Pack Contract",
      levelBand: "on_level" as const,
      family: {
        baseLevel: 40,
        familyId: "ternfield_hobgoblins_40",
        familyName: "The Ternfield Hobgoblins III",
        locationName: "Ternfields III"
      },
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

    const singleEnemy = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        members: [
          {
            familyId: "ternfield_hobgoblins_40",
            sequence: 1,
            monsterRole: "default",
            isBoss: false,
            monsterName: "Single Enemy",
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
        ]
      }
    });
    const doubleEnemy = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        members: [
          {
            familyId: "ternfield_hobgoblins_40",
            sequence: 1,
            monsterRole: "default",
            isBoss: false,
            monsterName: "Enemy A",
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
          },
          {
            familyId: "ternfield_hobgoblins_40",
            sequence: 2,
            monsterRole: "default",
            isBoss: false,
            monsterName: "Enemy B",
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
        ]
      }
    });

    const singleTotalHp = singleEnemy.reduce((sum, enemy) => sum + enemy.maxHp, 0);
    const doubleTotalHp = doubleEnemy.reduce((sum, enemy) => sum + enemy.maxHp, 0);
    const singleAverageHit = singleEnemy.reduce((sum, enemy) => sum + ((enemy.minDamage + enemy.maxDamage) / 2), 0);
    const doubleAverageHit = doubleEnemy.reduce((sum, enemy) => sum + ((enemy.minDamage + enemy.maxDamage) / 2), 0) / Math.max(1, doubleEnemy.length);

    expect(doubleTotalHp).toBeLessThan(singleTotalHp * 1.9);
    expect(doubleAverageHit).toBeGreaterThan(singleAverageHit * 0.8);
  });

  it("scales monster actor stats upward with encounter level", () => {
    const playerState = createPlayerState();
    const encounterBase = {
      contractName: "Test Contract",
      levelBand: "on_level" as const,
      family: {
        baseLevel: 40,
        familyId: "ternfield_hobgoblins_40",
        familyName: "The Ternfield Hobgoblins III",
        locationName: "Ternfields III"
      },
      members: [
        {
          familyId: "ternfield_hobgoblins_40",
          sequence: 1,
          monsterRole: "default",
          isBoss: false,
          monsterName: "Palisade Whelp III",
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

    const lowerMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        encounterLevel: 24
      }
    })[0];
    const higherMonster = buildMonsterActorSnapshots({
      playerState,
      encounter: {
        ...encounterBase,
        encounterLevel: 40
      }
    })[0];

    expect(higherMonster?.maxHp ?? 0).toBeGreaterThan(lowerMonster?.maxHp ?? 0);
    expect(higherMonster?.minDamage ?? 0).toBeGreaterThan(lowerMonster?.minDamage ?? 0);
    expect(higherMonster?.physicalDefense ?? 0).toBeGreaterThan(lowerMonster?.physicalDefense ?? 0);
  });

  it("raises reward previews with encounter level independently of level band", () => {
    const lowerPreview = buildRewardPreview(16, 20, "standard_cost");
    const higherPreview = buildRewardPreview(24, 20, "standard_cost");

    expect(higherPreview.experienceMin).toBeGreaterThan(lowerPreview.experienceMin);
    expect(higherPreview.ducatsMin).toBeGreaterThan(lowerPreview.ducatsMin);
    expect(higherPreview.itemDropChanceBps).toBeGreaterThan(lowerPreview.itemDropChanceBps);
  });
});
