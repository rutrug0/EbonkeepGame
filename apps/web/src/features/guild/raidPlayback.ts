import type { GuildRaidEncounter } from "@ebonkeep/shared/guild";

import {
  combatPlaybackEncounterSchema,
  combatPlaybackEventSchema,
  type CombatPlaybackActionResolved,
  type CombatPlaybackActor,
  type CombatPlaybackEncounter,
  type CombatPlaybackEnded,
  type CombatPlaybackEvent,
  type CombatPlaybackRollBreakdown,
  type CombatPlaybackRollStats
} from "../combat/playback";

export type GuildRaidPlaybackPhase = "travel" | "combat";
export type GuildRaidPlaybackResolutionState = "playing" | "summarizing" | "awaiting_return";

export type ActiveGuildRaidPlaybackState = {
  phase: GuildRaidPlaybackPhase;
  travelEndsAt: number | null;
  travelDurationMs: number;
  travelDescription: string;
  encounter: CombatPlaybackEncounter;
  timeline: CombatPlaybackEvent[];
  currentEventIndex: number;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  combatLogEventIds: string[];
  activeAction: CombatPlaybackActionResolved | null;
  impactTargetId: string | null;
  resolutionState: GuildRaidPlaybackResolutionState;
  finalSummaryLine: string | null;
  typedSummaryLine: string;
  playbackRate: 1 | 5;
  segmentPlaybackRate: 1 | 5;
  playbackProgressMs: number;
  lastPlaybackTickAtMs: number | null;
};

export const GUILD_RAID_TRAVEL_DURATION_MS = 10_000;
export const GUILD_RAID_COMBAT_START_DELAY_MS = 330;
export const GUILD_RAID_COMBAT_IMPACT_DELAY_MS = 760;
export const GUILD_RAID_COMBAT_BEAT_MS = 1_470;
export const GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
const GUILD_RAID_FAST_FORWARD_ANIMATION_RATE = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRollStats(power: number, combatStat: "strength" | "dexterity" | "intelligence"): CombatPlaybackRollStats {
  const boundedPower = Math.max(1, power);
  const minDamage = Math.max(8, Math.round(boundedPower * 0.11));
  const maxDamage = Math.max(minDamage + 4, Math.round(boundedPower * 0.17));
  const dodgeChance = combatStat === "dexterity" ? Math.round(boundedPower * 0.16) : Math.round(boundedPower * 0.08);

  return {
    level: Math.max(1, Math.round(boundedPower / 40)),
    damageKind: combatStat === "intelligence" ? "spell" : combatStat === "dexterity" ? "ranged" : "melee",
    minDamage,
    maxDamage,
    combatSpeed: 100,
    accuracy: Math.round(boundedPower * 0.21),
    dodgeChance,
    critChance: Math.round(boundedPower * 0.09),
    critMultiplier: 15_000,
    extraAttackChance: 0,
    armor: combatStat === "strength" ? Math.round(boundedPower * 0.1) : Math.round(boundedPower * 0.04),
    spellShield: combatStat === "intelligence" ? Math.round(boundedPower * 0.1) : Math.round(boundedPower * 0.04),
    missileResistance: combatStat === "dexterity" ? Math.round(boundedPower * 0.1) : Math.round(boundedPower * 0.04),
    physicalDefense: Math.round(boundedPower * 0.05),
    magicDefense: Math.round(boundedPower * 0.05)
  };
}

function buildRollBreakdown(args: {
  attacker: CombatPlaybackActor;
  defender: CombatPlaybackActor;
  rawDamage: number;
  finalDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  killed?: boolean;
}): CombatPlaybackRollBreakdown {
  const attackerStats = args.attacker.rollStats ?? buildRollStats(args.attacker.power ?? 1, args.attacker.combatStat ?? "strength");
  const defenderStats = args.defender.rollStats ?? buildRollStats(args.defender.power ?? 1, args.defender.combatStat ?? "strength");
  const mitigationStatLabel =
    attackerStats.damageKind === "melee"
      ? "armor"
      : attackerStats.damageKind === "ranged"
        ? "missileResistance"
        : "spellShield";
  const mitigationResistance =
    mitigationStatLabel === "armor"
      ? defenderStats.armor
      : mitigationStatLabel === "missileResistance"
        ? defenderStats.missileResistance
        : defenderStats.spellShield;
  const mitigationDefense = attackerStats.damageKind === "spell" ? defenderStats.magicDefense : defenderStats.physicalDefense;
  const effectiveDefense = mitigationResistance + mitigationDefense;
  const mitigationPercentBps =
    args.rawDamage <= 0 ? 0 : clamp(Math.round(((args.rawDamage - args.finalDamage) / args.rawDamage) * 10_000), 0, 10_000);

  return {
    attacker: {
      name: args.attacker.name,
      accuracy: attackerStats.accuracy,
      dodgeChance: attackerStats.dodgeChance,
      critChance: attackerStats.critChance,
      critMultiplier: attackerStats.critMultiplier,
      minDamage: attackerStats.minDamage,
      maxDamage: attackerStats.maxDamage,
      armor: attackerStats.armor,
      spellShield: attackerStats.spellShield,
      missileResistance: attackerStats.missileResistance,
      physicalDefense: attackerStats.physicalDefense,
      magicDefense: attackerStats.magicDefense
    },
    defender: {
      name: args.defender.name,
      accuracy: defenderStats.accuracy,
      dodgeChance: defenderStats.dodgeChance,
      critChance: defenderStats.critChance,
      critMultiplier: defenderStats.critMultiplier,
      minDamage: defenderStats.minDamage,
      maxDamage: defenderStats.maxDamage,
      armor: defenderStats.armor,
      spellShield: defenderStats.spellShield,
      missileResistance: defenderStats.missileResistance,
      physicalDefense: defenderStats.physicalDefense,
      magicDefense: defenderStats.magicDefense
    },
    damageKind: attackerStats.damageKind,
    hitChanceBps: 9_250,
    didHit: true,
    didCrit: false,
    baseDamageRoll: args.rawDamage,
    rawDamage: args.rawDamage,
    mitigationStatLabel,
    mitigationResistance,
    mitigationDefense,
    effectiveDefense,
    attackerPower: Math.max(1, args.attacker.power ?? 1),
    mitigationScale: 100,
    mitigationPercentBps,
    postMitigationDamage: args.finalDamage,
    floorPercentBps: 0,
    minimumDamage: 0,
    finalDamage: args.finalDamage,
    targetHpBefore: args.targetHpBefore,
    targetHpAfter: args.targetHpAfter,
    killed: args.killed ?? args.targetHpAfter <= 0
  };
}

function splitScaledDamage(source: number[], totalTarget: number): number[] {
  if (totalTarget <= 0 || source.length === 0) {
    return source.map(() => 0);
  }

  const totalSource = source.reduce((sum, value) => sum + value, 0);
  if (totalSource <= 0) {
    const even = Math.floor(totalTarget / source.length);
    let remaining = totalTarget - even * source.length;
    return source.map(() => {
      const next = even + (remaining > 0 ? 1 : 0);
      remaining = Math.max(0, remaining - 1);
      return next;
    });
  }

  const scaled = source.map((value) => Math.max(0, Math.round((value / totalSource) * totalTarget)));
  const scaledTotal = scaled.reduce((sum, value) => sum + value, 0);
  const delta = totalTarget - scaledTotal;
  if (delta === 0) {
    return scaled;
  }

  const largestIndex = scaled.reduce((bestIndex, value, index, values) =>
    value > values[bestIndex]! ? index : bestIndex
  , 0);
  scaled[largestIndex] = Math.max(0, (scaled[largestIndex] ?? 0) + delta);
  return scaled;
}

function buildRaidTimeline(args: {
  encounter: GuildRaidEncounter;
  guildActor: CombatPlaybackActor;
  bossActor: CombatPlaybackActor;
  guildName: string;
}): CombatPlaybackEvent[] {
  const { encounter, guildActor, bossActor, guildName } = args;
  const report = encounter.report;
  if (!report) {
    return combatPlaybackEventSchema.array().parse([
      {
        type: "CombatPlaybackStarted",
        eventId: `${encounter.instanceId}-start`,
        encounterId: encounter.instanceId
      },
      {
        type: "CombatPlaybackEnded",
        eventId: `${encounter.instanceId}-end`,
        encounterId: encounter.instanceId,
        winnerSide: "enemy",
        summaryLine: encounter.boss.flavorText
      }
    ]);
  }

  const bossDamageTarget = Math.max(0, report.bossHpMax - report.bossHpRemaining);
  const rankedRaiders = report.ranking.filter((entry) => entry.damageDone > 0);
  const scaledRaiderDamage = splitScaledDamage(
    rankedRaiders.map((entry) => entry.damageDone),
    bossDamageTarget
  );
  const raidStrikes = rankedRaiders.map((entry, index) => ({
    raiderName: entry.playerName,
    damage: scaledRaiderDamage[index] ?? 0
  })).filter((entry) => entry.damage > 0);
  const bossTurnCount = Math.max(raidStrikes.length - 1, 1);
  const guildHpLoss =
    report.outcome === "victory"
      ? Math.max(0, Math.round(guildActor.maxHp * 0.62))
      : guildActor.maxHp;
  const bossHits = splitScaledDamage(Array.from({ length: bossTurnCount }, (_, index) => bossTurnCount - index), guildHpLoss)
    .filter((damage) => damage > 0);

  const timeline: CombatPlaybackEvent[] = [
    {
      type: "CombatPlaybackStarted",
      eventId: `${encounter.instanceId}-start`,
      encounterId: encounter.instanceId
    }
  ];

  let turnIndex = 1;
  let bossHp = bossActor.maxHp;
  let guildHp = guildActor.maxHp;
  let bossHitIndex = 0;

  raidStrikes.forEach((strike, index) => {
    const bossHpBefore = bossHp;
    bossHp = Math.max(report.bossHpRemaining, bossHp - strike.damage);
    timeline.push({
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.instanceId}-raid-${turnIndex}`,
      encounterId: encounter.instanceId,
      turnIndex,
      actorId: guildActor.id,
      targetId: bossActor.id,
      actionType: "basic_attack",
      damage: strike.damage,
      targetHpAfter: bossHp,
      attackerLungeDirection: "left-to-right",
      logLine: `${strike.raiderName} hits ${bossActor.name} for ${strike.damage} damage.`,
      rollBreakdown: buildRollBreakdown({
        attacker: guildActor,
        defender: bossActor,
        rawDamage: strike.damage,
        finalDamage: strike.damage,
        targetHpBefore: bossHpBefore,
        targetHpAfter: bossHp,
        killed: bossHp <= 0
      })
    });
    turnIndex += 1;

    if (bossHp <= report.bossHpRemaining || bossHitIndex >= bossHits.length) {
      return;
    }

    const guildHpBefore = guildHp;
    const bossDamage = bossHits[bossHitIndex] ?? 0;
    bossHitIndex += 1;
    guildHp = Math.max(report.outcome === "victory" ? Math.max(1, guildActor.maxHp - guildHpLoss) : 0, guildHp - bossDamage);
    timeline.push({
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.instanceId}-boss-${turnIndex}`,
      encounterId: encounter.instanceId,
      turnIndex,
      actorId: bossActor.id,
      targetId: guildActor.id,
      actionType: "basic_attack",
      damage: bossDamage,
      targetHpAfter: guildHp,
      attackerLungeDirection: "right-to-left",
      logLine: `${bossActor.name} crashes into ${guildName} for ${bossDamage} damage.`,
      rollBreakdown: buildRollBreakdown({
        attacker: bossActor,
        defender: guildActor,
        rawDamage: bossDamage,
        finalDamage: bossDamage,
        targetHpBefore: guildHpBefore,
        targetHpAfter: guildHp,
        killed: guildHp <= 0
      })
    });
    turnIndex += 1;
  });

  timeline.push({
    type: "CombatPlaybackEnded",
    eventId: `${encounter.instanceId}-end`,
    encounterId: encounter.instanceId,
    winnerSide: report.outcome === "victory" ? "player" : "enemy",
    summaryLine: report.summary
  });

  return combatPlaybackEventSchema.array().parse(timeline);
}

export function buildGuildRaidPlaybackState(args: {
  encounter: GuildRaidEncounter;
  guildName: string;
  nowMs?: number;
}): ActiveGuildRaidPlaybackState {
  const nowMs = args.nowMs ?? Date.now();
  const guildActor = {
    id: `guild:${args.encounter.instanceId}`,
    side: "player",
    name: args.guildName,
    maxHp: Math.max(1_050, Math.round(args.encounter.joinedPower * 0.9) + args.encounter.joinCount * 110),
    power: Math.max(1, args.encounter.joinedPower),
    combatStat: "strength",
    rollStats: buildRollStats(Math.max(1, args.encounter.joinedPower), "strength"),
    usesSilhouetteFallback: true
  } satisfies CombatPlaybackActor;
  const bossPower = Math.max(args.encounter.boss.recommendedGuildPower, Math.round(args.encounter.boss.bossMaxHp / 8));
  const bossActor = {
    id: `boss:${args.encounter.boss.id}`,
    side: "enemy",
    name: args.encounter.boss.bossName,
    maxHp: args.encounter.boss.bossMaxHp,
    power: bossPower,
    combatStat: "strength",
    rollStats: buildRollStats(bossPower, "strength"),
    avatarPath: args.encounter.boss.portraitAssetPath ?? undefined
  } satisfies CombatPlaybackActor;
  const encounter = combatPlaybackEncounterSchema.parse({
    encounterId: args.encounter.instanceId,
    contractInstanceId: args.encounter.instanceId,
    contractName: args.encounter.boss.bossName,
    contractLevel: args.encounter.boss.orderIndex + 1,
    levelBand: "over_level",
    locationName: args.encounter.boss.zoneName,
    travelImagePath: args.encounter.boss.portraitAssetPath ?? undefined,
    combatBackgroundPath: undefined,
    travelImageMode: args.encounter.boss.portraitAssetPath ? "image" : "silhouette",
    player: guildActor,
    enemies: [bossActor]
  });
  const timeline = buildRaidTimeline({
    encounter: args.encounter,
    guildActor,
    bossActor,
    guildName: args.guildName
  });

  return {
    phase: "travel",
    travelEndsAt: nowMs + GUILD_RAID_TRAVEL_DURATION_MS,
    travelDurationMs: GUILD_RAID_TRAVEL_DURATION_MS,
    travelDescription: args.encounter.boss.flavorText,
    encounter,
    timeline,
    currentEventIndex: 0,
    hpByActorId: {
      [guildActor.id]: guildActor.maxHp,
      [bossActor.id]: bossActor.maxHp
    },
    combatLogEntries: [],
    combatLogEventIds: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackRate: 1,
    segmentPlaybackRate: 1,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

export function resetGuildRaidPlayback(previousEncounter: ActiveGuildRaidPlaybackState): ActiveGuildRaidPlaybackState {
  return {
    ...previousEncounter,
    phase: "combat",
    travelEndsAt: null,
    currentEventIndex: 0,
    hpByActorId: {
      [previousEncounter.encounter.player.id]: previousEncounter.encounter.player.maxHp,
      ...Object.fromEntries(
        previousEncounter.encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const)
      )
    },
    combatLogEntries: [],
    combatLogEventIds: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackRate: previousEncounter.playbackRate,
    segmentPlaybackRate: previousEncounter.playbackRate,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

export function skipToEndGuildRaidPlayback(encounter: ActiveGuildRaidPlaybackState): ActiveGuildRaidPlaybackState {
  const updatedHp = { ...encounter.hpByActorId };
  const newLogEntries = [...encounter.combatLogEntries];
  const newLogEventIds = [...encounter.combatLogEventIds];
  const appliedEventIds = new Set(encounter.combatLogEventIds);

  for (const event of encounter.timeline) {
    if (event.type === "CombatPlaybackActionResolved" && !appliedEventIds.has(event.eventId)) {
      updatedHp[event.targetId] = event.targetHpAfter;
      newLogEntries.push(event.logLine);
      newLogEventIds.push(event.eventId);
      appliedEventIds.add(event.eventId);
    }
  }

  const endedEvent = encounter.timeline.find(
    (event): event is CombatPlaybackEnded => event.type === "CombatPlaybackEnded"
  );
  const summaryLine = endedEvent?.summaryLine ?? "";

  return {
    ...encounter,
    currentEventIndex: encounter.timeline.length,
    hpByActorId: updatedHp,
    combatLogEntries: newLogEntries,
    combatLogEventIds: newLogEventIds,
    activeAction: null,
    impactTargetId: null,
    resolutionState: "awaiting_return",
    finalSummaryLine: summaryLine,
    typedSummaryLine: summaryLine,
    playbackProgressMs: 0,
    lastPlaybackTickAtMs: null
  };
}

export function getGuildRaidPlaybackProgress(
  encounter: ActiveGuildRaidPlaybackState,
  nowMs: number = Date.now()
): number {
  if (encounter.lastPlaybackTickAtMs === null) {
    return encounter.playbackProgressMs;
  }
  return encounter.playbackProgressMs + Math.max(0, nowMs - encounter.lastPlaybackTickAtMs) * encounter.segmentPlaybackRate;
}

export function snapshotGuildRaidPlayback(
  encounter: ActiveGuildRaidPlaybackState,
  nowMs: number = Date.now()
): ActiveGuildRaidPlaybackState {
  return {
    ...encounter,
    playbackProgressMs: getGuildRaidPlaybackProgress(encounter, nowMs),
    lastPlaybackTickAtMs: nowMs
  };
}

export function getGuildRaidEncounterAnimationRate(encounter: ActiveGuildRaidPlaybackState): number {
  if (encounter.segmentPlaybackRate === 5) {
    return GUILD_RAID_FAST_FORWARD_ANIMATION_RATE;
  }
  return encounter.segmentPlaybackRate;
}

export function getGuildRaidPlaybackThresholdMs(baseMs: number, encounter: ActiveGuildRaidPlaybackState): number {
  return (baseMs * encounter.segmentPlaybackRate) / getGuildRaidEncounterAnimationRate(encounter);
}
