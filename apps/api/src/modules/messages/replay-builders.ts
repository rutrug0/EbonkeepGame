import {
  COMBAT_MITIGATION_FLOOR_BPS,
  calculateCombatMitigation,
  clampCombatChanceBps,
  type CombatActorSnapshot,
  type CombatDamageKind,
  type CombatEvent,
  type CombatPlaybackActor,
  type CombatPlaybackEncounter,
  type CombatPlaybackEvent,
  type CombatPlaybackRollBreakdown,
  type CombatPlaybackRollStats,
  type ContractRunSnapshot
} from "@ebonkeep/shared/combat";
import { guildRaidEncounterSchema, type GuildRaidBossDefinition, type GuildRaidEncounter } from "@ebonkeep/shared/guild";
import {
  mailboxCombatReplayPayloadSchema,
  mailboxGuildRaidReplayPayloadSchema,
  type MailboxCombatReplayPayload,
  type MailboxGuildRaidReplayPayload
} from "@ebonkeep/shared/messages";

function inferCombatStat(actor: Pick<CombatActorSnapshot, "damageKind">): "strength" | "dexterity" | "intelligence" {
  if (actor.damageKind === "ranged") return "dexterity";
  if (actor.damageKind === "spell") return "intelligence";
  return "strength";
}

function toPlaybackRollStats(actor: CombatActorSnapshot): CombatPlaybackRollStats {
  return {
    level: actor.level,
    damageKind: actor.damageKind as CombatDamageKind,
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
    magicDefense: actor.magicDefense,
    threat: actor.threat
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - estimatedRoll) < Math.abs(best - estimatedRoll) ? candidate : best
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
    throw new Error("Playback roll breakdown requires actor roll stats.");
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
  const avatarPath = overrides?.avatarPath ?? actor.avatarPath ?? undefined;
  return {
    id: actor.id,
    side: actor.side,
    name: actor.name,
    maxHp: actor.maxHp,
    power: Math.max(1, Math.round((actor.minDamage + actor.maxDamage) / 2 + actor.maxHp / 4 + actor.combatSpeed / 3)),
    threat: actor.threat,
    combatStat: inferCombatStat(actor),
    rollStats: toPlaybackRollStats(actor),
    avatarPath,
    usesSilhouetteFallback: overrides?.usesSilhouetteFallback ?? !avatarPath
  };
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

function buildEncounter(run: ContractRunSnapshot): CombatPlaybackEncounter {
  return {
    encounterId: `${run.runId}-encounter`,
    contractInstanceId: run.runId,
    contractName: run.contractName,
    contractLevel: run.encounterLevel,
    levelBand: run.levelBand,
    familyId: run.familyId,
    locationName: run.locationName,
    travelImagePath: run.travelImagePath ?? undefined,
    combatBackgroundPath: run.combatBackgroundPath ?? undefined,
    travelImageMode: run.travelImagePath ? "image" : "silhouette",
    player: toPlaybackActor(run.player),
    enemies: run.enemies.map((enemy) => toPlaybackActor(enemy))
  };
}

function buildPlaybackTimeline(run: ContractRunSnapshot, events: CombatEvent[]): CombatPlaybackEvent[] {
  const actorById = new Map<string, CombatPlaybackActor>([
    [run.player.id, toPlaybackActor(run.player)],
    ...run.enemies.map((enemy) => [enemy.id, toPlaybackActor(enemy)] as const)
  ]);
  const timeline: CombatPlaybackEvent[] = [{
    type: "CombatPlaybackStarted",
    eventId: `${run.runId}-start`,
    encounterId: `${run.runId}-encounter`
  }];
  let turnIndex = 1;
  let winnerSide: "player" | "enemy" = "enemy";
  const currentHpByActorId = new Map<string, number>([
    [run.player.id, run.player.currentHp],
    ...run.enemies.map((enemy) => [enemy.id, enemy.currentHp] as const)
  ]);

  for (const event of events) {
    if (event.type === "CombatEnded") {
      winnerSide = event.winnerSide;
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
      timeline.push({
        type: "CombatPlaybackActionResolved",
        eventId: `${run.runId}-${event.sequence}-${strike.strikeIndex}`,
        encounterId: `${run.runId}-encounter`,
        turnIndex: turnIndex++,
        actorId: event.actorId,
        targetId: strike.targetId,
        actionType: "basic_attack",
        damage: strike.mitigatedDamage,
        targetHpAfter: strike.targetHpAfter,
        attackerLungeDirection: actor.side === "player" ? "left-to-right" : "right-to-left",
        logLine: buildActionLogLine({ actor, target, strike }),
        rollBreakdown: buildRollBreakdown({ actor, target, targetHpBefore, strike })
      });
      currentHpByActorId.set(strike.targetId, strike.targetHpAfter);
    }
  }

  const finalEnemyName = run.enemies[0]?.name ?? "the enemy";
  timeline.push({
    type: "CombatPlaybackEnded",
    eventId: `${run.runId}-end`,
    encounterId: `${run.runId}-encounter`,
    winnerSide,
    summaryLine:
      winnerSide === "player"
        ? `${run.contractName} is complete. ${finalEnemyName} has been driven off.`
        : `${run.contractName} failed. ${finalEnemyName} held the field.`
  });

  return timeline;
}

export function buildContractMailboxReplay(args: {
  run: ContractRunSnapshot;
  events: CombatEvent[];
}): MailboxCombatReplayPayload {
  return mailboxCombatReplayPayloadSchema.parse({
    kind: "combat",
    encounter: buildEncounter(args.run),
    timeline: buildPlaybackTimeline(args.run, args.events)
  });
}

export function buildGuildRaidMailboxReplay(args: {
  boss: GuildRaidBossDefinition;
  encounter: GuildRaidEncounter;
}): MailboxGuildRaidReplayPayload {
  return mailboxGuildRaidReplayPayloadSchema.parse({
    kind: "guild_raid",
    boss: args.boss,
    encounter: guildRaidEncounterSchema.parse(args.encounter)
  });
}
