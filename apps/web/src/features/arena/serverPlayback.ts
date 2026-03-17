import {
  COMBAT_MITIGATION_FLOOR_BPS,
  calculateCombatMitigation,
  clampCombatChanceBps,
  type CombatActorSnapshot,
  type CombatDamageKind,
  type CombatEvent
} from "@ebonkeep/shared/combat";
import type { ArenaEncounter, ArenaMatchResult } from "@ebonkeep/shared/arena";

import {
  combatPlaybackEncounterSchema,
  combatPlaybackEventSchema,
  type CombatPlaybackActionResolved,
  type CombatPlaybackActor,
  type CombatPlaybackEncounter,
  type CombatPlaybackEvent,
  type CombatPlaybackRollBreakdown,
  type CombatPlaybackRollStats
} from "../combat/playback";
import type { ActiveArenaEncounterState } from "./playback";

function inferCombatStat(actor: Pick<CombatActorSnapshot, "damageKind">): "strength" | "dexterity" | "intelligence" {
  if (actor.damageKind === "ranged") {
    return "dexterity";
  }
  if (actor.damageKind === "spell") {
    return "intelligence";
  }
  return "strength";
}

function toPlaybackDamageKind(damageKind: CombatDamageKind): CombatPlaybackRollStats["damageKind"] {
  return damageKind;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPlaybackRollStats(actor: CombatActorSnapshot): CombatPlaybackRollStats {
  return {
    level: actor.level,
    damageKind: toPlaybackDamageKind(actor.damageKind),
    minDamage: actor.minDamage,
    maxDamage: actor.maxDamage,
    combatSpeed: actor.combatSpeed,
    accuracy: actor.accuracy,
    dodgeChance: actor.dodgeChance,
    critChance: actor.critChance,
    critMultiplier: actor.critMultiplier,
    extraAttackChance: actor.extraAttackChance,
    armor: actor.armor,
    spellShield: actor.spellShield,
    missileResistance: actor.missileResistance,
    physicalDefense: actor.physicalDefense,
    magicDefense: actor.magicDefense
  };
}

function inferBaseDamageRoll(args: {
  crit: boolean;
  rawDamage: number;
  minDamage: number;
  maxDamage: number;
  critMultiplier: number;
}): number | null {
  if (args.rawDamage <= 0) {
    return null;
  }
  if (!args.crit) {
    return clampInt(args.rawDamage, args.minDamage, args.maxDamage);
  }

  const candidates: number[] = [];
  for (let damageRoll = args.minDamage; damageRoll <= args.maxDamage; damageRoll += 1) {
    if (Math.round((damageRoll * args.critMultiplier) / 10_000) === args.rawDamage) {
      candidates.push(damageRoll);
    }
  }

  if (candidates.length === 0) {
    return clampInt(Math.round((args.rawDamage * 10_000) / args.critMultiplier), args.minDamage, args.maxDamage);
  }

  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  const estimatedRoll = (args.rawDamage * 10_000) / args.critMultiplier;
  return (
    candidates.reduce((best, candidate) =>
      Math.abs(candidate - estimatedRoll) < Math.abs(best - estimatedRoll) ? candidate : best
    ) ?? null
  );
}

function buildRollBreakdown(args: {
  actor: CombatPlaybackActor;
  target: CombatPlaybackActor;
  targetHpBefore: number;
  strike: Extract<CombatEvent, { type: "CombatActionResolved" }>["strikes"][number];
}): CombatPlaybackRollBreakdown {
  const attacker = args.actor.rollStats;
  const defender = args.target.rollStats;

  if (!attacker || !defender) {
    throw new Error("Arena playback roll breakdown requires actor roll stats.");
  }

  const mitigationStatLabel =
    attacker.damageKind === "melee"
      ? "armor"
      : attacker.damageKind === "ranged"
        ? "missileResistance"
        : "spellShield";
  const mitigation = calculateCombatMitigation({
    rawDamage: args.strike.rawDamage,
    damageKind: attacker.damageKind,
    attacker,
    defender
  });

  return {
    attacker: {
      name: args.actor.name,
      accuracy: attacker.accuracy,
      dodgeChance: attacker.dodgeChance,
      critChance: attacker.critChance,
      critMultiplier: attacker.critMultiplier,
      minDamage: attacker.minDamage,
      maxDamage: attacker.maxDamage,
      armor: attacker.armor,
      spellShield: attacker.spellShield,
      missileResistance: attacker.missileResistance,
      physicalDefense: attacker.physicalDefense,
      magicDefense: attacker.magicDefense
    },
    defender: {
      name: args.target.name,
      accuracy: defender.accuracy,
      dodgeChance: defender.dodgeChance,
      critChance: defender.critChance,
      critMultiplier: defender.critMultiplier,
      minDamage: defender.minDamage,
      maxDamage: defender.maxDamage,
      armor: defender.armor,
      spellShield: defender.spellShield,
      missileResistance: defender.missileResistance,
      physicalDefense: defender.physicalDefense,
      magicDefense: defender.magicDefense
    },
    damageKind: attacker.damageKind,
    hitChanceBps: clampCombatChanceBps(attacker.accuracy * 100 - defender.dodgeChance, 2500, 9750),
    didHit: args.strike.hit,
    didCrit: args.strike.crit,
    baseDamageRoll: args.strike.hit
      ? inferBaseDamageRoll({
          crit: args.strike.crit,
          rawDamage: args.strike.rawDamage,
          minDamage: attacker.minDamage,
          maxDamage: attacker.maxDamage,
          critMultiplier: attacker.critMultiplier
        })
      : null,
    rawDamage: args.strike.rawDamage,
    mitigationStatLabel,
    mitigationResistance: mitigation.typedDefense,
    mitigationDefense: mitigation.bonusDefense,
    effectiveDefense: mitigation.effectiveDefense,
    attackerPower: mitigation.attackerPower,
    mitigationScale: mitigation.mitigationScale,
    mitigationPercentBps: mitigation.mitigationPercentBps,
    postMitigationDamage: mitigation.postMitigationDamage,
    floorPercentBps: COMBAT_MITIGATION_FLOOR_BPS,
    minimumDamage: args.strike.hit ? mitigation.minimumDamage : 0,
    finalDamage: args.strike.mitigatedDamage,
    targetHpBefore: args.targetHpBefore,
    targetHpAfter: args.strike.targetHpAfter,
    killed: args.strike.killed
  };
}

function toPlaybackActor(
  actor: CombatActorSnapshot,
  overrides?: Partial<CombatPlaybackActor>
): CombatPlaybackActor {
  return {
    id: actor.id,
    side: actor.side,
    name: actor.name,
    maxHp: actor.maxHp,
    power: Math.max(1, Math.round((actor.minDamage + actor.maxDamage) / 2 + actor.maxHp / 4 + actor.combatSpeed / 3)),
    combatStat: inferCombatStat(actor),
    rollStats: toPlaybackRollStats(actor),
    avatarPath: overrides?.avatarPath ?? actor.avatarPath ?? undefined,
    usesSilhouetteFallback: overrides?.usesSilhouetteFallback ?? !(overrides?.avatarPath ?? actor.avatarPath)
  };
}

function buildArenaPlaybackEncounter(args: {
  encounter: ArenaEncounter;
  matchId: string;
  playerAvatarPath?: string;
}): CombatPlaybackEncounter {
  return combatPlaybackEncounterSchema.parse({
    encounterId: args.encounter.encounterId,
    contractInstanceId: args.matchId,
    contractName: "Arena Duel",
    contractLevel: Math.max(args.encounter.player.level, args.encounter.enemy.level),
    levelBand: "on_level",
    locationName: args.encounter.locationName,
    combatBackgroundPath: args.encounter.combatBackgroundPath ?? undefined,
    travelImageMode: "silhouette",
    player: toPlaybackActor(args.encounter.player, {
      avatarPath: args.playerAvatarPath,
      usesSilhouetteFallback: !args.playerAvatarPath
    }),
    enemies: [
      toPlaybackActor({
        ...args.encounter.enemy,
        side: "enemy"
      })
    ]
  });
}

function buildActionLogLine(args: {
  actor: CombatPlaybackActor;
  target: CombatPlaybackActor;
  strike: Extract<CombatEvent, { type: "CombatActionResolved" }>["strikes"][number];
}): string {
  if (!args.strike.hit) {
    return `${args.actor.name} misses ${args.target.name}.`;
  }
  if (args.strike.crit) {
    return `${args.actor.name} critically hits ${args.target.name} for ${args.strike.mitigatedDamage} damage.`;
  }
  if (args.strike.killed) {
    return `${args.actor.name} finishes ${args.target.name} for ${args.strike.mitigatedDamage} damage.`;
  }
  return `${args.actor.name} hits ${args.target.name} for ${args.strike.mitigatedDamage} damage.`;
}

function buildPlaybackTimeline(args: {
  matchId: string;
  encounter: CombatPlaybackEncounter;
  events: CombatEvent[];
}): CombatPlaybackEvent[] {
  const actorById = new Map<string, CombatPlaybackActor>([
    [args.encounter.player.id, args.encounter.player],
    ...args.encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const timeline: CombatPlaybackEvent[] = [
    combatPlaybackEventSchema.parse({
      type: "CombatPlaybackStarted",
      eventId: `${args.matchId}-start`,
      encounterId: args.encounter.encounterId
    })
  ];
  let winnerSide: "player" | "enemy" = "enemy";
  let turnIndex = 1;
  const currentHpByActorId = new Map<string, number>([
    [args.encounter.player.id, args.encounter.player.maxHp],
    ...args.encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const)
  ]);

  for (const event of args.events) {
    if (event.type === "CombatEnded") {
      winnerSide = event.winnerSide;
      continue;
    }

    if (event.type !== "CombatActionResolved") {
      continue;
    }

    for (const strike of event.strikes) {
      const actor = actorById.get(event.actorId);
      const target = actorById.get(strike.targetId);
      const targetHpBefore = currentHpByActorId.get(strike.targetId);

      if (!actor || !target || typeof targetHpBefore !== "number") {
        continue;
      }

      timeline.push(
        combatPlaybackEventSchema.parse({
          type: "CombatPlaybackActionResolved",
          eventId: `${args.matchId}-${event.sequence}-${strike.strikeIndex}`,
          encounterId: args.encounter.encounterId,
          turnIndex: turnIndex++,
          actorId: event.actorId,
          targetId: strike.targetId,
          actionType: "basic_attack",
          damage: strike.mitigatedDamage,
          targetHpAfter: strike.targetHpAfter,
          attackerLungeDirection: actor.side === "player" ? "left-to-right" : "right-to-left",
          logLine: buildActionLogLine({ actor, target, strike }),
          rollBreakdown: buildRollBreakdown({ actor, target, targetHpBefore, strike })
        })
      );

      currentHpByActorId.set(strike.targetId, strike.targetHpAfter);
    }
  }

  const opponentName = args.encounter.enemies[0]?.name ?? "the opponent";
  timeline.push(
    combatPlaybackEventSchema.parse({
      type: "CombatPlaybackEnded",
      eventId: `${args.matchId}-end`,
      encounterId: args.encounter.encounterId,
      winnerSide,
      summaryLine:
        winnerSide === "player"
          ? `Arena duel won. ${opponentName} has been defeated.`
          : `Arena duel lost. ${opponentName} held the field.`
    })
  );

  return timeline;
}

function initialHpByActorId(encounter: CombatPlaybackEncounter): Record<string, number> {
  return {
    [encounter.player.id]: encounter.player.maxHp,
    ...Object.fromEntries(encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const))
  };
}

export function buildArenaCombatState(args: {
  result: ArenaMatchResult;
  playerAvatarPath?: string;
}): ActiveArenaEncounterState {
  const encounter = buildArenaPlaybackEncounter({
    encounter: args.result.encounter,
    matchId: args.result.matchId,
    playerAvatarPath: args.playerAvatarPath
  });

  return {
    encounter,
    timeline: buildPlaybackTimeline({
      matchId: args.result.matchId,
      encounter,
      events: args.result.events
    }),
    currentEventIndex: 0,
    hpByActorId: initialHpByActorId(encounter),
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

export function asArenaPlaybackAction(event: CombatPlaybackEvent | null): CombatPlaybackActionResolved | null {
  return event?.type === "CombatPlaybackActionResolved" ? event : null;
}
