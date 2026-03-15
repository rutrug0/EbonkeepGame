import {
  COMBAT_MITIGATION_FLOOR_BPS,
  calculateCombatMitigation,
  clampCombatChanceBps,
  type CombatActorSnapshot,
  type CombatDamageKind,
  type CombatEvent,
  type ContractBoardSlotView,
  type ContractRunResult,
  type ContractRunSnapshot
} from "@ebonkeep/shared/combat";
import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import type {
  CombatPlaybackActionResolved,
  CombatPlaybackActor,
  CombatPlaybackEncounter,
  CombatPlaybackEvent,
  CombatPlaybackRollBreakdown,
  CombatPlaybackRollStats
} from "../combat/playback";
import {
  getEncounterTravelDescription,
  type ActiveContractEncounterState,
  type ContractDifficulty,
  type ContractOffer,
  type ContractRoll,
  type ContractSlotState
} from "./mockData";

function toRoll(difficulty: ContractDifficulty): ContractRoll {
  if (difficulty === "hard") return "high";
  if (difficulty === "medium") return "medium";
  return "low";
}

function findGeneratedAsset(prefix: string, exactKey?: string): string | undefined {
  if (exactKey) {
    const exactMatch = GENERATED_ITEM_ICON_PATHS[exactKey];
    if (exactMatch) return exactMatch;
  }
  return Object.entries(GENERATED_ITEM_ICON_PATHS).find(([key]) => key.startsWith(prefix))?.[1];
}

function getMonsterAvatarPath(familyId: string | null | undefined, monsterName: string): string | undefined {
  if (!familyId) return undefined;
  return GENERATED_ITEM_ICON_PATHS[`monster:${familyId}:${monsterName.toLowerCase()}`];
}

function inferCombatStat(actor: Pick<CombatActorSnapshot, "damageKind">): "strength" | "dexterity" | "intelligence" {
  if (actor.damageKind === "ranged") return "dexterity";
  if (actor.damageKind === "spell") return "intelligence";
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
    throw new Error("Contract playback roll breakdown requires actor roll stats.");
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
  const avatarPath = overrides?.avatarPath ?? actor.avatarPath ?? getMonsterAvatarPath(actor.familyId, actor.name);
  return {
    id: actor.id,
    side: actor.side,
    name: actor.name,
    maxHp: actor.maxHp,
    power: Math.max(1, Math.round((actor.minDamage + actor.maxDamage) / 2 + actor.maxHp / 4 + actor.combatSpeed / 3)),
    combatStat: inferCombatStat(actor),
    rollStats: toPlaybackRollStats(actor),
    avatarPath,
    usesSilhouetteFallback: overrides?.usesSilhouetteFallback ?? !avatarPath
  };
}

function toOfferFromSlot(slot: ContractBoardSlotView): ContractOffer | null {
  if (slot.state !== "available" || !slot.contractName || !slot.difficulty || !slot.expiresAt) {
    return null;
  }

  const cue = toRoll(slot.difficulty);
  const staminaCost = slot.rewardsPreview?.staminaCost ?? 0;
  const efficiencyTier = slot.rewardsPreview?.efficiencyTier ?? "standard_cost";
  return {
    instanceId: `${slot.familyId ?? "contract"}-${slot.slotId}`,
    template: {
      id: slot.familyId ?? `slot-${slot.slotId}`,
      name: slot.contractName,
      difficulty: slot.difficulty,
      experience: { low: slot.rewardsPreview?.experienceMin ?? 0, medium: slot.rewardsPreview?.experienceMin ?? 0, high: slot.rewardsPreview?.experienceMax ?? 0 },
      ducats: { low: slot.rewardsPreview?.ducatsMin ?? 0, medium: slot.rewardsPreview?.ducatsMin ?? 0, high: slot.rewardsPreview?.ducatsMax ?? 0 },
      materials: { low: 0, medium: 0, high: 0 },
      itemDrop: { low: 0, medium: 0, high: 0 },
      staminaCost: {
        low: staminaCost,
        medium: staminaCost,
        high: staminaCost
      }
    },
    efficiencyTier,
    staminaCostValue: staminaCost,
    rollCue: {
      experience: cue,
      ducats: cue,
      materials: cue,
      itemDrop: cue,
      staminaCost: cue
    },
    expiresAt: Date.parse(slot.expiresAt)
  };
}

export function mapBoardSlotsToUi(slots: ContractBoardSlotView[]): ContractSlotState[] {
  return slots.map((slot) => ({
    slotIndex: slot.slotId,
    offer: toOfferFromSlot(slot),
    replenishReadyAt: slot.replenishAt ? Date.parse(slot.replenishAt) : null
  }));
}

export function buildOfferFromRun(run: ContractRunSnapshot): ContractOffer {
  const cue = toRoll(run.difficulty);
  return {
    instanceId: run.runId,
    template: {
      id: run.familyId,
      name: run.contractName,
      difficulty: run.difficulty,
      experience: { low: 0, medium: 0, high: 0 },
      ducats: { low: 0, medium: 0, high: 0 },
      materials: { low: 0, medium: 0, high: 0 },
      itemDrop: { low: 0, medium: 0, high: 0 },
      staminaCost: { low: 0, medium: 0, high: 0 }
    },
    efficiencyTier: "standard_cost",
    staminaCostValue: 0,
    rollCue: {
      experience: cue,
      ducats: cue,
      materials: cue,
      itemDrop: cue,
      staminaCost: cue
    },
    expiresAt: Number.MAX_SAFE_INTEGER
  };
}

function buildEncounter(args: {
  run: ContractRunSnapshot;
  playerAvatarPath?: string;
}): CombatPlaybackEncounter {
  const enemyBackdrop = args.run.combatBackgroundPath ?? findGeneratedAsset(`combat_stage:${args.run.familyId}:`, `combat_stage:${args.run.familyId}`);
  const travelImagePath = args.run.travelImagePath ?? findGeneratedAsset(`travel_stage:${args.run.familyId}:default`, `travel_stage:${args.run.familyId}`);
  return {
    encounterId: `${args.run.runId}-encounter`,
    contractInstanceId: args.run.runId,
    contractName: args.run.contractName,
    difficulty: args.run.difficulty,
    locationName: args.run.locationName,
    travelImagePath,
    combatBackgroundPath: enemyBackdrop,
    travelImageMode: travelImagePath ? "image" : "silhouette",
    player: toPlaybackActor(args.run.player, {
      avatarPath: args.playerAvatarPath,
      usesSilhouetteFallback: !args.playerAvatarPath
    }),
    enemies: args.run.enemies.map((enemy) => toPlaybackActor(enemy))
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
      if (!actor || !target) {
        continue;
      }
      if (typeof targetHpBefore !== "number") {
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

function initialHpByActorId(encounter: CombatPlaybackEncounter): Record<string, number> {
  return {
    [encounter.player.id]: encounter.player.maxHp,
    ...Object.fromEntries(encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp] as const))
  };
}

export function buildTravelEncounterState(args: {
  slotIndex: number;
  offer: ContractOffer;
  run: ContractRunSnapshot;
  playerAvatarPath?: string;
}): ActiveContractEncounterState {
  const encounter = buildEncounter({
    run: args.run,
    playerAvatarPath: args.playerAvatarPath
  });
  return {
    slotIndex: args.slotIndex,
    offer: args.offer,
    phase: "travel",
    travelEndsAt: Date.parse(args.run.travelEndsAt),
    travelDurationMs: args.run.travelDurationSeconds * 1000,
    travelDescription: getEncounterTravelDescription(args.run.difficulty),
    encounter,
    timeline: [],
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

export function buildResolvedEncounterState(args: {
  slotIndex: number;
  offer: ContractOffer;
  result: ContractRunResult;
  playerAvatarPath?: string;
}): ActiveContractEncounterState {
  const encounter = buildEncounter({
    run: args.result.run,
    playerAvatarPath: args.playerAvatarPath
  });
  return {
    slotIndex: args.slotIndex,
    offer: args.offer,
    phase: "combat",
    travelEndsAt: null,
    travelDurationMs: args.result.run.travelDurationSeconds * 1000,
    travelDescription: getEncounterTravelDescription(args.result.run.difficulty),
    encounter,
    timeline: buildPlaybackTimeline(args.result.run, args.result.events),
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

export function asPlaybackAction(event: CombatPlaybackEvent | null): CombatPlaybackActionResolved | null {
  return event?.type === "CombatPlaybackActionResolved" ? event : null;
}
