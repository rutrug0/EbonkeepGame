import { describe, expect, it } from "vitest";

import type { CombatActorSnapshot, ContractRunSnapshot } from "@ebonkeep/shared/combat";

import { buildOfferFromRun, buildTravelEncounterState } from "../src/features/contracts/serverPlayback";

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
});
