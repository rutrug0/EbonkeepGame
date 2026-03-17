import { describe, expect, it } from "vitest";

import type { ArenaMatchResult } from "@ebonkeep/shared/arena";

import { buildArenaCombatState } from "../src/features/arena/serverPlayback";

function createArenaMatchResult(): ArenaMatchResult {
  return {
    matchId: "match_1",
    winnerSide: "player",
    ratingDelta: 16,
    profile: {
      entryId: "entry_1",
      rating: 1016,
      wins: 1,
      losses: 0,
      rank: 7,
      cooldownEndsAt: new Date(Date.now() + 60_000).toISOString()
    },
    ladder: {
      entries: [],
      currentPlayerRank: 7
    },
    recentMatches: [],
    encounter: {
      encounterId: "encounter_1",
      locationName: "Ash Court Arena",
      combatBackgroundPath: null,
      player: {
        id: "player",
        side: "player",
        encounterOrder: 0,
        name: "Warden",
        familyId: null,
        monsterRole: null,
        level: 60,
        maxHp: 120,
        currentHp: 120,
        combatSpeed: 100,
        accuracy: 110,
        dodgeChance: 200,
        critChance: 500,
        critMultiplier: 15000,
        extraAttackChance: 0,
        armor: 40,
        spellShield: 20,
        missileResistance: 15,
        physicalDefense: 20,
        magicDefense: 15,
        minDamage: 18,
        maxDamage: 22,
        damageKind: "melee",
        avatarPath: null,
        usesSilhouetteFallback: true
      },
      enemy: {
        id: "enemy",
        side: "enemy",
        encounterOrder: 0,
        name: "Storm Harrier",
        familyId: null,
        monsterRole: null,
        level: 58,
        maxHp: 90,
        currentHp: 90,
        combatSpeed: 90,
        accuracy: 105,
        dodgeChance: 150,
        critChance: 400,
        critMultiplier: 15000,
        extraAttackChance: 0,
        armor: 25,
        spellShield: 12,
        missileResistance: 12,
        physicalDefense: 14,
        magicDefense: 12,
        minDamage: 12,
        maxDamage: 16,
        damageKind: "melee",
        avatarPath: null,
        usesSilhouetteFallback: true
      }
    },
    events: [
      {
        type: "CombatActionResolved",
        sequence: 1,
        timelineTime: 0,
        actorId: "player",
        actionType: "basic_attack",
        strikes: [
          {
            strikeIndex: 0,
            targetId: "enemy",
            hit: true,
            crit: false,
            rawDamage: 20,
            mitigatedDamage: 18,
            targetHpAfter: 72,
            killed: false
          }
        ]
      },
      {
        type: "CombatEnded",
        sequence: 2,
        timelineTime: 1000,
        winnerSide: "player"
      }
    ]
  } as ArenaMatchResult;
}

describe("arena server playback", () => {
  it("maps a server arena match into replay state", () => {
    const state = buildArenaCombatState({
      result: createArenaMatchResult(),
      playerAvatarPath: "/portrait.png"
    });

    expect(state.encounter.player.avatarPath).toBe("/portrait.png");
    expect(state.timeline).toHaveLength(3);
    expect(state.timeline[1]).toMatchObject({
      type: "CombatPlaybackActionResolved",
      actorId: "player",
      targetId: "enemy",
      damage: 18
    });
    expect(state.hpByActorId.enemy).toBe(90);
  });
});
