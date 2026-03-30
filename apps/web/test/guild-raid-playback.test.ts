import { describe, expect, it } from "vitest";

import type { GuildRaidBossDefinition, GuildRaidEncounter } from "@ebonkeep/shared/guild";

import {
  applyGuildRaidResolvedAction,
  buildGuildRaidPlaybackState
} from "../src/features/guild/raidPlayback";

function createBoss(overrides: Partial<GuildRaidBossDefinition> = {}): GuildRaidBossDefinition {
  return {
    id: "mireglass-hydra",
    orderIndex: 1,
    zoneKey: "mirepool_bog",
    zoneName: "Mirepool Bog",
    bossName: "Mireglass Hydra",
    bossTitle: "The Drowned Crown",
    portraitAssetPath: "/assets/raid_bosses/mireglass_hydra.png",
    stageAssetPath: null,
    flavorText: "The marsh stirs before the guild arrives.",
    recommendedGuildPower: 1_850,
    bossMaxHp: 37_500,
    minParticipants: 4,
    participantCap: 50,
    summonDucatsCost: 18_000,
    summonImperialsCost: 5,
    lobbyDurationHours: 24,
    lockDurationHours: 24,
    unlockedBonus: {
      type: "contract_ducats_percent",
      value: 8,
      label: "+8% Contract Ducats",
      description: "More ducats from contracts."
    },
    ...overrides
  };
}

function createEncounter(): GuildRaidEncounter {
  const summonedAt = "2026-03-30T09:00:00.000Z";
  const lobbyEndsAt = "2026-03-31T09:00:00.000Z";
  const resolvedAt = "2026-03-30T09:10:00.000Z";

  return {
    instanceId: "raid_1",
    state: "resolved",
    boss: createBoss(),
    summonedBy: {
      playerId: "leader_1",
      playerName: "RaidLead",
      role: "leader"
    },
    summonedAt,
    lobbyEndsAt,
    lockEndsAt: null,
    joinedPower: 6_800,
    joinCount: 6,
    currentUserJoined: true,
    canJoin: false,
    canLeave: false,
    canCommenceNow: false,
    joinBlockedReason: null,
    participants: [
      { playerId: "p1", playerName: "Aela", playerClass: "sentinel", role: "leader", level: 32, power: 1200, joinedAt: summonedAt, isCurrentUser: true },
      { playerId: "p2", playerName: "Bram", playerClass: "juggernaut", role: "member", level: 31, power: 1180, joinedAt: "2026-03-30T09:00:20.000Z", isCurrentUser: false },
      { playerId: "p3", playerName: "Cira", playerClass: "arcanist", role: "member", level: 30, power: 1100, joinedAt: "2026-03-30T09:00:40.000Z", isCurrentUser: false },
      { playerId: "p4", playerName: "Doran", playerClass: "reaver", role: "officer", level: 31, power: 1120, joinedAt: "2026-03-30T09:01:00.000Z", isCurrentUser: false },
      { playerId: "p5", playerName: "Eris", playerClass: "shade", role: "member", level: 30, power: 1060, joinedAt: "2026-03-30T09:01:20.000Z", isCurrentUser: false },
      { playerId: "p6", playerName: "Fenn", playerClass: "disciple", role: "member", level: 29, power: 980, joinedAt: "2026-03-30T09:01:40.000Z", isCurrentUser: false }
    ],
    report: {
      outcome: "victory",
      summary: "The hydra sinks beneath the mire.",
      resolvedAt,
      lockEndsAt: null,
      firstClear: true,
      totalDamage: 37_500,
      bossHpMax: 37_500,
      bossHpRemaining: 0,
      ranking: [
        { playerId: "p1", playerName: "Aela", playerClass: "sentinel", role: "leader", damageDone: 7_000, damageShareBps: 1867, power: 1200 },
        { playerId: "p2", playerName: "Bram", playerClass: "juggernaut", role: "member", damageDone: 6_500, damageShareBps: 1733, power: 1180 },
        { playerId: "p3", playerName: "Cira", playerClass: "arcanist", role: "member", damageDone: 6_400, damageShareBps: 1707, power: 1100 },
        { playerId: "p4", playerName: "Doran", playerClass: "reaver", role: "officer", damageDone: 6_200, damageShareBps: 1653, power: 1120 },
        { playerId: "p5", playerName: "Eris", playerClass: "shade", role: "member", damageDone: 5_800, damageShareBps: 1547, power: 1060 },
        { playerId: "p6", playerName: "Fenn", playerClass: "disciple", role: "member", damageDone: 5_600, damageShareBps: 1493, power: 980 }
      ]
    }
  };
}

describe("guild raid playback", () => {
  it("builds raid playback with mapped backgrounds and a five-player frontline", () => {
    const state = buildGuildRaidPlaybackState({
      encounter: createEncounter(),
      guildName: "Tidebreakers",
      nowMs: Date.parse("2026-03-30T09:00:00.000Z")
    });

    expect(state.encounter.travelImagePath).toBe(
      "/assets/items/generated/travel_stage/mirepool_boglings_04/travel_stage_default_p.jpg"
    );
    expect(state.encounter.travelFocusImagePath).toBe("/assets/raid_bosses/mireglass_hydra.png");
    expect(state.encounter.combatBackgroundPath).toBe(
      "/assets/items/generated/combat_stage/mirepool_boglings_04/combat_stage_mirepool_mud_shelf_p.jpg"
    );
    expect(state.encounter.allies).toHaveLength(6);
    expect(state.frontlineSlots.filter(Boolean)).toHaveLength(5);
    expect(state.reserveActorIds).toEqual(["raid:p6"]);
  });

  it("runs five player actions before the boss takes a turn", () => {
    const state = buildGuildRaidPlaybackState({
      encounter: createEncounter(),
      guildName: "Tidebreakers",
      nowMs: Date.parse("2026-03-30T09:00:00.000Z")
    });

    const actionEvents = state.timeline.filter(
      (event): event is Extract<typeof state.timeline[number], { type: "CombatPlaybackActionResolved" }> =>
        event.type === "CombatPlaybackActionResolved"
    );

    expect(actionEvents.slice(0, 5).every((event) => event.actorId.startsWith("raid:"))).toBe(true);
    expect(actionEvents[5]?.actorId).toBe(state.encounter.enemies[0]?.id);
  });

  it("promotes the next reserve when a frontline raider falls", () => {
    const state = buildGuildRaidPlaybackState({
      encounter: createEncounter(),
      guildName: "Tidebreakers",
      nowMs: Date.parse("2026-03-30T09:00:00.000Z")
    });
    const firstFrontliner = state.frontlineSlots[0];
    if (!firstFrontliner) {
      throw new Error("Expected an initial frontline raider.");
    }
    const defeated = applyGuildRaidResolvedAction(state, {
      ...(state.timeline.find((event) => event.type === "CombatPlaybackActionResolved" && event.actorId.startsWith("boss:")) ?? state.timeline[1]!),
      type: "CombatPlaybackActionResolved",
      eventId: "raid-test-boss-hit",
      encounterId: state.encounter.encounterId,
      turnIndex: 99,
      actorId: state.encounter.enemies[0]!.id,
      targetId: firstFrontliner,
      actionType: "basic_attack",
      damage: state.hpByActorId[firstFrontliner] ?? 0,
      targetHpAfter: 0,
      attackerLungeDirection: "right-to-left",
      logLine: `${state.encounter.enemies[0]!.name} crushes the frontline.`,
      rollBreakdown: (state.timeline.find((event) => event.type === "CombatPlaybackActionResolved") as Extract<typeof state.timeline[number], { type: "CombatPlaybackActionResolved" }>).rollBreakdown
    });

    expect(defeated.frontlineSlots[0]).toBe("raid:p6");
    expect(defeated.reserveActorIds).toHaveLength(0);
    expect(defeated.fallenActorIds).toContain(firstFrontliner);
    expect(defeated.combatLogEntries.at(-1)).toContain("steps in");
  });
});
