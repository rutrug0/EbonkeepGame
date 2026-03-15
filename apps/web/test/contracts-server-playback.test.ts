import { describe, expect, it } from "vitest";

import type {
  CombatActorSnapshot,
  CombatEvent,
  ContractRunResult,
  ContractRunSnapshot
} from "@ebonkeep/shared/combat";

import {
  buildOfferFromRun,
  buildResolvedEncounterState,
  buildTravelEncounterState
} from "../src/features/contracts/serverPlayback";

function createActorSnapshot(overrides: Partial<CombatActorSnapshot>): CombatActorSnapshot {
  return {
    id: "actor_1",
    side: "enemy",
    encounterOrder: 0,
    name: "Bog Skirmisher",
    familyId: "mirepool_boglings_04",
    monsterRole: "skirmisher",
    level: 12,
    maxHp: 88,
    currentHp: 88,
    combatSpeed: 16,
    accuracy: 93,
    dodgeChance: 1125,
    critChance: 840,
    critMultiplier: 16120,
    extraAttackChance: 540,
    armor: 9,
    spellShield: 6,
    missileResistance: 13,
    physicalDefense: 7,
    magicDefense: 5,
    minDamage: 11,
    maxDamage: 17,
    damageKind: "ranged",
    avatarPath: null,
    combatBackgroundPath: null,
    travelImagePath: null,
    usesSilhouetteFallback: false,
    ...overrides
  };
}

function createRunSnapshot(): ContractRunSnapshot {
  return {
    runId: "run_1",
    slotId: 2,
    state: "traveling",
    contractName: "Bogwatch Recon Sweep",
    difficulty: "medium",
    familyId: "mirepool_boglings_04",
    familyName: "Mirepool Boglings",
    locationName: "Mirepool Grotto",
    encounterLevel: 12,
    travelEndsAt: new Date("2026-03-15T10:00:00.000Z").toISOString(),
    travelDurationSeconds: 45,
    player: createActorSnapshot({
      id: "player_1",
      side: "player",
      encounterOrder: 0,
      name: "Warden",
      familyId: null,
      monsterRole: null,
      damageKind: "melee"
    }),
    enemies: [
      createActorSnapshot({
        id: "enemy_1"
      })
    ],
    combatBackgroundPath: null,
    travelImagePath: null
  };
}

function createRunResult(args: {
  run?: ContractRunSnapshot;
  events: CombatEvent[];
  winnerSide?: "player" | "enemy";
}): ContractRunResult {
  const run = args.run ?? createRunSnapshot();

  return {
    run,
    winnerSide: args.winnerSide ?? "player",
    rewards: {
      experience: 0,
      ducats: 0,
      item: null
    },
    events: args.events
  };
}

function createCombatEvents(args: {
  run: ContractRunSnapshot;
  actorId: string;
  targetId: string;
  hit: boolean;
  crit: boolean;
  rawDamage: number;
  mitigatedDamage: number;
  targetHpAfter: number;
  killed?: boolean;
}): CombatEvent[] {
  return [
    {
      type: "CombatStarted",
      sequence: 1,
      timelineTime: 0,
      actors: [args.run.player, ...args.run.enemies]
    },
    {
      type: "CombatActionResolved",
      sequence: 2,
      timelineTime: 1,
      actorId: args.actorId,
      actionType: "basic_attack",
      strikes: [
        {
          strikeIndex: 1,
          targetId: args.targetId,
          hit: args.hit,
          crit: args.crit,
          rawDamage: args.rawDamage,
          mitigatedDamage: args.mitigatedDamage,
          targetHpAfter: args.targetHpAfter,
          killed: args.killed ?? false
        }
      ]
    },
    {
      type: "CombatEnded",
      sequence: 3,
      timelineTime: 1,
      winnerSide: "player"
    }
  ];
}

function getFirstResolvedAction(result: ContractRunResult) {
  const offer = buildOfferFromRun(result.run);
  const state = buildResolvedEncounterState({
    slotIndex: result.run.slotId,
    offer,
    result
  });
  const action = state.timeline.find((event) => event.type === "CombatPlaybackActionResolved");
  if (!action || action.type !== "CombatPlaybackActionResolved") {
    throw new Error("Expected a playback action.");
  }
  return action;
}

describe("contracts server playback", () => {
  it("preserves monster roll stats from the contract snapshot", () => {
    const run = createRunSnapshot();
    const offer = buildOfferFromRun(run);

    const state = buildTravelEncounterState({
      slotIndex: run.slotId,
      offer,
      run
    });

    expect(state.encounter.enemies[0]?.rollStats).toEqual({
      level: run.enemies[0].level,
      damageKind: run.enemies[0].damageKind,
      minDamage: run.enemies[0].minDamage,
      maxDamage: run.enemies[0].maxDamage,
      combatSpeed: run.enemies[0].combatSpeed,
      accuracy: run.enemies[0].accuracy,
      dodgeChance: run.enemies[0].dodgeChance,
      critChance: run.enemies[0].critChance,
      critMultiplier: run.enemies[0].critMultiplier,
      extraAttackChance: run.enemies[0].extraAttackChance,
      armor: run.enemies[0].armor,
      spellShield: run.enemies[0].spellShield,
      missileResistance: run.enemies[0].missileResistance,
      physicalDefense: run.enemies[0].physicalDefense,
      magicDefense: run.enemies[0].magicDefense
    });
  });

  it("derives hit chance and mitigation details for a normal hit", () => {
    const run = createRunSnapshot();
    const action = getFirstResolvedAction(
      createRunResult({
        run,
        events: createCombatEvents({
          run,
          actorId: run.player.id,
          targetId: run.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 20,
          mitigatedDamage: 4,
          targetHpAfter: 84
        })
      })
    );

    expect(action.rollBreakdown.hitChanceBps).toBe(8175);
    expect(action.rollBreakdown.mitigationStatLabel).toBe("armor");
    expect(action.rollBreakdown.mitigationResistance).toBe(run.enemies[0]!.armor);
    expect(action.rollBreakdown.mitigationDefense).toBe(run.enemies[0]!.physicalDefense);
    expect(action.rollBreakdown.mitigationTotal).toBe(run.enemies[0]!.armor + run.enemies[0]!.physicalDefense);
    expect(action.rollBreakdown.finalDamage).toBe(4);
  });

  it("keeps crit raw damage and final damage in the derived breakdown", () => {
    const run = createRunSnapshot();
    const action = getFirstResolvedAction(
      createRunResult({
        run,
        events: createCombatEvents({
          run,
          actorId: run.player.id,
          targetId: run.enemies[0]!.id,
          hit: true,
          crit: true,
          rawDamage: 29,
          mitigatedDamage: 13,
          targetHpAfter: 75
        })
      })
    );

    expect(action.rollBreakdown.didCrit).toBe(true);
    expect(action.rollBreakdown.rawDamage).toBe(29);
    expect(action.rollBreakdown.finalDamage).toBe(13);
    expect(action.rollBreakdown.baseDamageRoll).not.toBeNull();
  });

  it("keeps miss breakdown rows usable with zero damage values", () => {
    const run = createRunSnapshot();
    const action = getFirstResolvedAction(
      createRunResult({
        run,
        events: createCombatEvents({
          run,
          actorId: run.player.id,
          targetId: run.enemies[0]!.id,
          hit: false,
          crit: false,
          rawDamage: 0,
          mitigatedDamage: 0,
          targetHpAfter: run.enemies[0]!.maxHp
        })
      })
    );

    expect(action.rollBreakdown.didHit).toBe(false);
    expect(action.rollBreakdown.baseDamageRoll).toBeNull();
    expect(action.rollBreakdown.rawDamage).toBe(0);
    expect(action.rollBreakdown.finalDamage).toBe(0);
    expect(action.rollBreakdown.targetHpAfter).toBe(run.enemies[0]!.maxHp);
  });

  it("selects armor, missile resistance, or spell shield based on the damage kind", () => {
    const meleeRun = createRunSnapshot();
    const rangedRun = createRunSnapshot();
    rangedRun.player.damageKind = "ranged";
    const spellRun = createRunSnapshot();
    spellRun.player.damageKind = "spell";

    const meleeAction = getFirstResolvedAction(
      createRunResult({
        run: meleeRun,
        events: createCombatEvents({
          run: meleeRun,
          actorId: meleeRun.player.id,
          targetId: meleeRun.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 20,
          mitigatedDamage: 4,
          targetHpAfter: 84
        })
      })
    );
    const rangedAction = getFirstResolvedAction(
      createRunResult({
        run: rangedRun,
        events: createCombatEvents({
          run: rangedRun,
          actorId: rangedRun.player.id,
          targetId: rangedRun.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 20,
          mitigatedDamage: 1,
          targetHpAfter: 87
        })
      })
    );
    const spellAction = getFirstResolvedAction(
      createRunResult({
        run: spellRun,
        events: createCombatEvents({
          run: spellRun,
          actorId: spellRun.player.id,
          targetId: spellRun.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 20,
          mitigatedDamage: 9,
          targetHpAfter: 79
        })
      })
    );

    expect(meleeAction.rollBreakdown.mitigationStatLabel).toBe("armor");
    expect(rangedAction.rollBreakdown.mitigationStatLabel).toBe("missileResistance");
    expect(spellAction.rollBreakdown.mitigationStatLabel).toBe("spellShield");
    expect(spellAction.rollBreakdown.mitigationDefense).toBe(spellRun.enemies[0]!.magicDefense);
  });

  it("includes the minimum-damage floor when reduction exceeds raw damage", () => {
    const run = createRunSnapshot();
    run.enemies[0] = createActorSnapshot({
      id: "enemy_1",
      armor: 18,
      physicalDefense: 14
    });

    const action = getFirstResolvedAction(
      createRunResult({
        run,
        events: createCombatEvents({
          run,
          actorId: run.player.id,
          targetId: run.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 9,
          mitigatedDamage: 1,
          targetHpAfter: 87
        })
      })
    );

    expect(action.rollBreakdown.minimumDamage).toBe(1);
    expect(action.rollBreakdown.mitigationTotal).toBe(32);
    expect(action.rollBreakdown.finalDamage).toBe(1);
  });

  it("tracks the target HP before an overkill strike instead of inferring it from final damage", () => {
    const run = createRunSnapshot();
    run.enemies[0] = createActorSnapshot({
      id: "enemy_1",
      currentHp: 5,
      maxHp: 88
    });

    const action = getFirstResolvedAction(
      createRunResult({
        run,
        events: createCombatEvents({
          run,
          actorId: run.player.id,
          targetId: run.enemies[0]!.id,
          hit: true,
          crit: false,
          rawDamage: 20,
          mitigatedDamage: 20,
          targetHpAfter: 0,
          killed: true
        })
      })
    );

    expect(action.rollBreakdown.targetHpBefore).toBe(5);
    expect(action.rollBreakdown.targetHpAfter).toBe(0);
    expect(action.rollBreakdown.finalDamage).toBe(20);
  });
});
