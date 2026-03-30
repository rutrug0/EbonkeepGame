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
import { getGuildRaidScenePaths } from "./raidScenes";

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
  initialFrontlineSlots: Array<string | null>;
  frontlineSlots: Array<string | null>;
  initialReserveActorIds: string[];
  reserveActorIds: string[];
  fallenActorIds: string[];
};

export const GUILD_RAID_TRAVEL_DURATION_MS = 10_000;
export const GUILD_RAID_COMBAT_START_DELAY_MS = 330;
export const GUILD_RAID_COMBAT_IMPACT_DELAY_MS = 760;
export const GUILD_RAID_COMBAT_BEAT_MS = 1_470;
export const GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS = 30;

const FRONTLINE_SIZE = 5;
const GUILD_RAID_FAST_FORWARD_ANIMATION_RATE = 8;
const PLAYER_CLASS_STAT: Record<string, "strength" | "dexterity" | "intelligence"> = {
  juggernaut: "strength",
  sentinel: "dexterity",
  reaver: "intelligence",
  shade: "intelligence",
  arbalist: "strength",
  disciple: "dexterity",
  runecaster: "strength",
  voidcaster: "dexterity",
  arcanist: "intelligence",
  warrior: "strength",
  ranger: "dexterity",
  mage: "intelligence"
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashUnitFloat(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) | 0;
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function getJoinedAtMs(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function resolveRaidCombatStat(playerClass: string): "strength" | "dexterity" | "intelligence" {
  return PLAYER_CLASS_STAT[playerClass] ?? "strength";
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

function buildDamageChunks(totalDamage: number, seed: string): number[] {
  if (totalDamage <= 0) {
    return [];
  }

  const chunkCount = clamp(Math.ceil(totalDamage / 450), 1, 7);
  const weights = Array.from({ length: chunkCount }, (_, index) => 0.75 + hashUnitFloat(`${seed}:${index}`));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return Math.max(0, totalDamage - assigned);
    }

    const value = Math.max(1, Math.round((totalDamage * weight) / totalWeight));
    assigned += value;
    return value;
  });
}

function buildRaidAllies(encounter: GuildRaidEncounter): CombatPlaybackActor[] {
  const participants = [...encounter.participants].sort((left, right) => {
    const joinedAtDelta = getJoinedAtMs(left.joinedAt) - getJoinedAtMs(right.joinedAt);
    if (joinedAtDelta !== 0) {
      return joinedAtDelta;
    }
    return left.playerName.localeCompare(right.playerName);
  });

  if (participants.length === 0) {
    const power = Math.max(1, encounter.joinedPower);
    const maxHp = Math.max(900, Math.round(encounter.joinedPower * 0.72));
    return [
      {
        id: `raid:${encounter.instanceId}:guild`,
        side: "player",
        name: "Guild Vanguard",
        maxHp,
        power,
        combatStat: "strength",
        rollStats: buildRollStats(power, "strength"),
        usesSilhouetteFallback: true
      }
    ];
  }

  return participants.map((participant) => {
    const combatStat = resolveRaidCombatStat(participant.playerClass);
    const maxHp = clamp(280 + participant.level * 18 + participant.power * 5, 420, 2_400);
    return {
      id: `raid:${participant.playerId}`,
      side: "player" as const,
      name: participant.playerName,
      maxHp,
      power: Math.max(1, participant.power),
      combatStat,
      rollStats: buildRollStats(Math.max(1, participant.power), combatStat),
      usesSilhouetteFallback: true
    };
  });
}

function buildRaidBossActor(encounter: GuildRaidEncounter): CombatPlaybackActor {
  const bossPower = Math.max(encounter.boss.recommendedGuildPower, Math.round(encounter.boss.bossMaxHp / 8));
  return {
    id: `boss:${encounter.boss.id}`,
    side: "enemy",
    name: encounter.boss.bossName,
    maxHp: encounter.boss.bossMaxHp,
    power: bossPower,
    combatStat: "strength",
    rollStats: buildRollStats(bossPower, "strength"),
    avatarPath: encounter.boss.portraitAssetPath ?? undefined
  };
}

function buildInitialFrontlineSlots(allies: readonly CombatPlaybackActor[]): Array<string | null> {
  const frontlineSlots: Array<string | null> = allies.slice(0, FRONTLINE_SIZE).map((ally) => ally.id);
  while (frontlineSlots.length < FRONTLINE_SIZE) {
    frontlineSlots.push(null);
  }
  return frontlineSlots;
}

function buildInitialHpByActorId(encounter: CombatPlaybackEncounter): Record<string, number> {
  const allies = encounter.allies ?? [encounter.player];
  return {
    ...Object.fromEntries(allies.map((ally) => [ally.id, ally.maxHp] as const)),
    ...Object.fromEntries(encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const))
  };
}

function buildRaidTimeline(args: {
  encounter: GuildRaidEncounter;
  allies: readonly CombatPlaybackActor[];
  bossActor: CombatPlaybackActor;
  initialFrontlineSlots: Array<string | null>;
  initialReserveActorIds: string[];
}): CombatPlaybackEvent[] {
  const report = args.encounter.report;
  if (!report || args.allies.length === 0) {
    return combatPlaybackEventSchema.array().parse([
      {
        type: "CombatPlaybackStarted",
        eventId: `${args.encounter.instanceId}-start`,
        encounterId: args.encounter.instanceId
      },
      {
        type: "CombatPlaybackEnded",
        eventId: `${args.encounter.instanceId}-end`,
        encounterId: args.encounter.instanceId,
        winnerSide: "enemy",
        summaryLine: args.encounter.boss.flavorText
      }
    ]);
  }

  const alliesById = new Map(
    args.allies.map((ally) => [
      ally.id,
      {
        actor: ally,
        currentHp: ally.maxHp
      }
    ])
  );
  const actorIdByPlayerId = new Map(
    args.encounter.participants.map((participant) => [participant.playerId, `raid:${participant.playerId}`] as const)
  );
  const frontlineSlots = [...args.initialFrontlineSlots];
  const reserveActorIds = [...args.initialReserveActorIds];
  const rankingByPlayerId = new Map(report.ranking.map((entry) => [entry.playerId, entry] as const));
  const pendingDamage = new Map(
    args.allies.map((ally) => {
      const playerId = ally.id.replace(/^raid:/, "");
      const damageDone = rankingByPlayerId.get(playerId)?.damageDone ?? 0;
      return [ally.id, buildDamageChunks(damageDone, `${report.resolvedAt}:${ally.id}`)] as const;
    })
  );
  const timeline: CombatPlaybackEvent[] = [
    {
      type: "CombatPlaybackStarted",
      eventId: `${args.encounter.instanceId}-start`,
      encounterId: args.encounter.instanceId
    }
  ];

  let turnIndex = 1;
  let allyTurnsSinceBossAttack = 0;
  let bossAttackCount = 0;
  let frontlineCursor = 0;
  let bossHp = args.bossActor.maxHp;

  function getAliveFrontlineIndexes(): number[] {
    return frontlineSlots
      .map((allyId, index) => ({ allyId, index }))
      .filter((entry) => {
        if (!entry.allyId) {
          return false;
        }
        return (alliesById.get(entry.allyId)?.currentHp ?? 0) > 0;
      })
      .map((entry) => entry.index);
  }

  function pickNextAttackerId(): string | null {
    for (let attempts = 0; attempts < FRONTLINE_SIZE; attempts += 1) {
      const slotIndex = (frontlineCursor + attempts) % FRONTLINE_SIZE;
      const allyId = frontlineSlots[slotIndex];
      if (!allyId) {
        continue;
      }

      const allyState = alliesById.get(allyId);
      const nextChunk = pendingDamage.get(allyId)?.[0] ?? 0;
      if (allyState && allyState.currentHp > 0 && nextChunk > 0) {
        frontlineCursor = (slotIndex + 1) % FRONTLINE_SIZE;
        return allyId;
      }
    }

    return null;
  }

  for (let step = 0; step < 280; step += 1) {
    const attackerId = pickNextAttackerId();
    if (!attackerId) {
      break;
    }

    const attackerState = alliesById.get(attackerId);
    const chunks = pendingDamage.get(attackerId) ?? [];
    const damage = chunks.shift() ?? 0;
    pendingDamage.set(attackerId, chunks);

    if (!attackerState || damage <= 0) {
      continue;
    }

    const bossHpBefore = bossHp;
    bossHp = Math.max(report.bossHpRemaining, bossHp - damage);
    timeline.push({
      type: "CombatPlaybackActionResolved",
      eventId: `${args.encounter.instanceId}-raid-${turnIndex}`,
      encounterId: args.encounter.instanceId,
      turnIndex,
      actorId: attackerId,
      targetId: args.bossActor.id,
      actionType: "basic_attack",
      damage,
      targetHpAfter: bossHp,
      attackerLungeDirection: "left-to-right",
      logLine: `${attackerState.actor.name} hits ${args.bossActor.name} for ${damage} damage.`,
      rollBreakdown: buildRollBreakdown({
        attacker: attackerState.actor,
        defender: args.bossActor,
        rawDamage: damage,
        finalDamage: damage,
        targetHpBefore: bossHpBefore,
        targetHpAfter: bossHp,
        killed: bossHp <= 0
      })
    });
    turnIndex += 1;
    allyTurnsSinceBossAttack += 1;

    if (bossHp <= report.bossHpRemaining) {
      break;
    }

    if (allyTurnsSinceBossAttack < FRONTLINE_SIZE) {
      continue;
    }
    allyTurnsSinceBossAttack = 0;

    const aliveFrontlineIndexes = getAliveFrontlineIndexes();
    if (aliveFrontlineIndexes.length === 0) {
      break;
    }

    const targetIndex = aliveFrontlineIndexes[bossAttackCount % aliveFrontlineIndexes.length] ?? aliveFrontlineIndexes[0] ?? 0;
    bossAttackCount += 1;
    const targetId = frontlineSlots[targetIndex];
    if (!targetId) {
      continue;
    }

    const targetState = alliesById.get(targetId);
    if (!targetState) {
      continue;
    }

    const hpBefore = targetState.currentHp;
    const hitRoll = 0.3 + hashUnitFloat(`${report.resolvedAt}:${targetId}:${bossAttackCount}`) * 0.2;
    const hitDamage = Math.max(
      60,
      Math.round(targetState.actor.maxHp * hitRoll * (report.outcome === "defeat" ? 1.18 : 0.94))
    );
    targetState.currentHp = Math.max(0, targetState.currentHp - hitDamage);
    timeline.push({
      type: "CombatPlaybackActionResolved",
      eventId: `${args.encounter.instanceId}-boss-${turnIndex}`,
      encounterId: args.encounter.instanceId,
      turnIndex,
      actorId: args.bossActor.id,
      targetId,
      actionType: "basic_attack",
      damage: hitDamage,
      targetHpAfter: targetState.currentHp,
      attackerLungeDirection: "right-to-left",
      logLine: `${args.bossActor.name} crashes into ${targetState.actor.name} for ${hitDamage} damage.`,
      rollBreakdown: buildRollBreakdown({
        attacker: args.bossActor,
        defender: targetState.actor,
        rawDamage: hitDamage,
        finalDamage: hitDamage,
        targetHpBefore: hpBefore,
        targetHpAfter: targetState.currentHp,
        killed: targetState.currentHp <= 0
      })
    });
    turnIndex += 1;

    if (targetState.currentHp > 0) {
      continue;
    }

    const replacementId = reserveActorIds.shift() ?? null;
    frontlineSlots[targetIndex] = replacementId;

    if (replacementId) {
      const replacementPlayerId = replacementId.replace(/^raid:/, "");
      const replacementDamage = rankingByPlayerId.get(replacementPlayerId)?.damageDone ?? 0;
      const replacementActorId = actorIdByPlayerId.get(replacementPlayerId) ?? replacementId;
      if ((pendingDamage.get(replacementActorId)?.length ?? 0) === 0 && replacementDamage > 0) {
        pendingDamage.set(
          replacementActorId,
          buildDamageChunks(replacementDamage, `${report.resolvedAt}:${replacementActorId}`)
        );
      }
    }
  }

  timeline.push({
    type: "CombatPlaybackEnded",
    eventId: `${args.encounter.instanceId}-end`,
    encounterId: args.encounter.instanceId,
    winnerSide: report.outcome === "victory" ? "player" : "enemy",
    summaryLine: report.summary
  });

  return combatPlaybackEventSchema.array().parse(timeline);
}

function buildRaidActorMap(encounter: CombatPlaybackEncounter): Map<string, CombatPlaybackActor> {
  const allies = encounter.allies ?? [encounter.player];
  return new Map([
    ...allies.map((ally) => [ally.id, ally] as const),
    ...encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
}

export function applyGuildRaidResolvedAction(
  previousEncounter: ActiveGuildRaidPlaybackState,
  action: CombatPlaybackActionResolved
): ActiveGuildRaidPlaybackState {
  const snapshot = snapshotGuildRaidPlayback(previousEncounter);
  const actorById = buildRaidActorMap(snapshot.encounter);
  const nextCombatLogEntries = snapshot.combatLogEventIds.includes(action.eventId)
    ? snapshot.combatLogEntries
    : [...snapshot.combatLogEntries, action.logLine];
  const nextCombatLogEventIds = snapshot.combatLogEventIds.includes(action.eventId)
    ? snapshot.combatLogEventIds
    : [...snapshot.combatLogEventIds, action.eventId];
  const nextHpByActorId = {
    ...snapshot.hpByActorId,
    [action.targetId]: action.targetHpAfter
  };
  const allyIds = new Set((snapshot.encounter.allies ?? [snapshot.encounter.player]).map((ally) => ally.id));

  if (!allyIds.has(action.targetId) || action.targetHpAfter > 0) {
    return {
      ...snapshot,
      hpByActorId: nextHpByActorId,
      combatLogEntries: nextCombatLogEntries,
      combatLogEventIds: nextCombatLogEventIds,
      impactTargetId: action.targetId
    };
  }

  const frontlineIndex = snapshot.frontlineSlots.findIndex((allyId) => allyId === action.targetId);
  if (frontlineIndex < 0) {
    return {
      ...snapshot,
      hpByActorId: nextHpByActorId,
      combatLogEntries: nextCombatLogEntries,
      combatLogEventIds: nextCombatLogEventIds,
      impactTargetId: action.targetId,
      fallenActorIds: snapshot.fallenActorIds.includes(action.targetId)
        ? snapshot.fallenActorIds
        : [...snapshot.fallenActorIds, action.targetId]
    };
  }

  const nextFrontlineSlots = [...snapshot.frontlineSlots];
  const nextReserveActorIds = [...snapshot.reserveActorIds];
  const nextFallenActorIds = snapshot.fallenActorIds.includes(action.targetId)
    ? snapshot.fallenActorIds
    : [...snapshot.fallenActorIds, action.targetId];
  const replacementId = nextReserveActorIds.shift() ?? null;
  nextFrontlineSlots[frontlineIndex] = replacementId;

  const downedActor = actorById.get(action.targetId);
  const replacementActor = replacementId ? actorById.get(replacementId) ?? null : null;
  const replacementLogLine = replacementActor
    ? `${downedActor?.name ?? "A raider"} falls. ${replacementActor.name} steps in.`
    : `${downedActor?.name ?? "A raider"} falls and the line opens.`;
  const replacementLogEventId = replacementActor
    ? `raid-replace:${action.eventId}:${replacementActor.id}`
    : `raid-fall:${action.eventId}:${frontlineIndex}`;

  return {
    ...snapshot,
    hpByActorId: nextHpByActorId,
    combatLogEntries: nextCombatLogEventIds.includes(replacementLogEventId)
      ? nextCombatLogEntries
      : [...nextCombatLogEntries, replacementLogLine],
    combatLogEventIds: nextCombatLogEventIds.includes(replacementLogEventId)
      ? nextCombatLogEventIds
      : [...nextCombatLogEventIds, replacementLogEventId],
    impactTargetId: action.targetId,
    frontlineSlots: nextFrontlineSlots,
    reserveActorIds: nextReserveActorIds,
    fallenActorIds: nextFallenActorIds
  };
}

export function buildGuildRaidPlaybackState(args: {
  encounter: GuildRaidEncounter;
  guildName: string;
  nowMs?: number;
}): ActiveGuildRaidPlaybackState {
  const nowMs = args.nowMs ?? Date.now();
  const allies = buildRaidAllies(args.encounter);
  const bossActor = buildRaidBossActor(args.encounter);
  const currentUserParticipant = args.encounter.participants.find((participant) => participant.isCurrentUser);
  const primaryAlly = (currentUserParticipant
    ? allies.find((ally) => ally.id === `raid:${currentUserParticipant.playerId}`)
    : null) ?? allies[0] ?? {
    id: `raid:${args.encounter.instanceId}:guild`,
    side: "player" as const,
    name: args.guildName,
    maxHp: Math.max(900, Math.round(args.encounter.joinedPower * 0.72)),
    power: Math.max(1, args.encounter.joinedPower),
    combatStat: "strength" as const,
    rollStats: buildRollStats(Math.max(1, args.encounter.joinedPower), "strength"),
    usesSilhouetteFallback: true
  };
  const initialFrontlineSlots = buildInitialFrontlineSlots(allies);
  const initialReserveActorIds = allies.slice(FRONTLINE_SIZE).map((ally) => ally.id);
  const scenePaths = getGuildRaidScenePaths(args.encounter.boss);
  const encounter = combatPlaybackEncounterSchema.parse({
    encounterId: args.encounter.instanceId,
    contractInstanceId: args.encounter.instanceId,
    contractName: args.encounter.boss.bossName,
    contractLevel: args.encounter.boss.orderIndex + 1,
    levelBand: "over_level",
    locationName: args.encounter.boss.zoneName,
    travelImagePath: scenePaths.travelImagePath,
    travelFocusImagePath: scenePaths.travelFocusImagePath,
    combatBackgroundPath: scenePaths.combatBackgroundPath,
    travelImageMode: scenePaths.travelImagePath ? "image" : "silhouette",
    player: primaryAlly,
    allies,
    enemies: [bossActor]
  });
  const timeline = buildRaidTimeline({
    encounter: args.encounter,
    allies,
    bossActor,
    initialFrontlineSlots,
    initialReserveActorIds
  });

  return {
    phase: "travel",
    travelEndsAt: nowMs + GUILD_RAID_TRAVEL_DURATION_MS,
    travelDurationMs: GUILD_RAID_TRAVEL_DURATION_MS,
    travelDescription: args.encounter.boss.flavorText,
    encounter,
    timeline,
    currentEventIndex: 0,
    hpByActorId: buildInitialHpByActorId(encounter),
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
    lastPlaybackTickAtMs: null,
    initialFrontlineSlots: [...initialFrontlineSlots],
    frontlineSlots: [...initialFrontlineSlots],
    initialReserveActorIds: [...initialReserveActorIds],
    reserveActorIds: [...initialReserveActorIds],
    fallenActorIds: []
  };
}

export function resetGuildRaidPlayback(previousEncounter: ActiveGuildRaidPlaybackState): ActiveGuildRaidPlaybackState {
  return {
    ...previousEncounter,
    phase: "combat",
    travelEndsAt: null,
    currentEventIndex: 0,
    hpByActorId: buildInitialHpByActorId(previousEncounter.encounter),
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
    lastPlaybackTickAtMs: null,
    frontlineSlots: [...previousEncounter.initialFrontlineSlots],
    reserveActorIds: [...previousEncounter.initialReserveActorIds],
    fallenActorIds: []
  };
}

export function skipToEndGuildRaidPlayback(encounter: ActiveGuildRaidPlaybackState): ActiveGuildRaidPlaybackState {
  let nextState: ActiveGuildRaidPlaybackState = {
    ...encounter,
    hpByActorId: { ...encounter.hpByActorId },
    combatLogEntries: [...encounter.combatLogEntries],
    combatLogEventIds: [...encounter.combatLogEventIds],
    frontlineSlots: [...encounter.frontlineSlots],
    reserveActorIds: [...encounter.reserveActorIds],
    fallenActorIds: [...encounter.fallenActorIds]
  };

  for (const event of encounter.timeline) {
    if (event.type === "CombatPlaybackActionResolved" && !nextState.combatLogEventIds.includes(event.eventId)) {
      nextState = applyGuildRaidResolvedAction(nextState, event);
    }
  }

  const endedEvent = encounter.timeline.find(
    (event): event is CombatPlaybackEnded => event.type === "CombatPlaybackEnded"
  );
  const summaryLine = endedEvent?.summaryLine ?? "";

  return {
    ...nextState,
    currentEventIndex: encounter.timeline.length,
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
