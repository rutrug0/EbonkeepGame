import type { ContractEfficiencyTier } from "@ebonkeep/shared/combat";
import type { PlayerClass, PlayerStatBlock } from "@ebonkeep/shared/core";
import { classToStatTree } from "@ebonkeep/shared/core";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
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

export type { ContractEfficiencyTier } from "@ebonkeep/shared/combat";

export type ContractDifficulty = "easy" | "medium" | "hard";
export type ContractRoll = "low" | "medium" | "high";

type ContractBand = {
  low: number;
  medium: number;
  high: number;
};

type ContractTemplate = {
  id: string;
  name: string;
  difficulty: ContractDifficulty;
  experience: ContractBand;
  ducats: ContractBand;
  materials: ContractBand;
  itemDrop: ContractBand;
  staminaCost: ContractBand;
};

export type ContractOffer = {
  instanceId: string;
  template: ContractTemplate;
  efficiencyTier: ContractEfficiencyTier;
  staminaCostValue: number;
  rollCue: {
    experience: ContractRoll;
    ducats: ContractRoll;
    materials: ContractRoll;
    itemDrop: ContractRoll;
    staminaCost: ContractRoll;
  };
  expiresAt: number;
};

export type ContractSlotState = {
  slotIndex: number;
  offer: ContractOffer | null;
  replenishReadyAt: number | null;
};

export type ContractEncounterPhase = "board" | "travel" | "combat";
export type CombatEncounterResolutionState = "playing" | "summarizing" | "awaiting_return";

export type ActiveContractEncounterState = {
  slotIndex: number;
  offer: ContractOffer;
  phase: ContractEncounterPhase;
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
  resolutionState: CombatEncounterResolutionState;
  finalSummaryLine: string | null;
  typedSummaryLine: string;
  playbackRate: 1 | 5;
  segmentPlaybackRate: 1 | 5;
  playbackProgressMs: number;
  lastPlaybackTickAtMs: number | null;
};

export const CONTRACT_SLOT_COUNT = 6;
export const CONTRACT_REPLENISH_MIN_MS = 1 * 60 * 1000;
export const CONTRACT_REPLENISH_MAX_MS = 2 * 60 * 1000;
export const CONTRACT_TRAVEL_DURATION_MS = 10 * 1000;
export const COMBAT_PLAYBACK_START_DELAY_MS = 330;
export const COMBAT_PLAYBACK_IMPACT_DELAY_MS = 760;
export const COMBAT_PLAYBACK_BEAT_MS = 1470;
export const COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
export const COMBAT_FAST_FORWARD_ANIMATION_RATE = 8;

type MockAttackType = "melee" | "ranged" | "magic";

function attackTypeFromCombatStat(combatStat: "strength" | "dexterity" | "intelligence"): MockAttackType {
  if (combatStat === "dexterity") {
    return "ranged";
  }
  if (combatStat === "intelligence") {
    return "magic";
  }
  return "melee";
}

function mitigateIncomingDamage(
  rawDamage: number,
  attackType: MockAttackType,
  targetStats: Pick<PlayerStatBlock, "armor" | "missileResistance" | "spellShield" | "physicalDefense" | "magicDefense">
): number {
  if (rawDamage <= 0) {
    return 0;
  }
  const reduction =
    attackType === "melee"
      ? targetStats.armor + targetStats.physicalDefense
      : attackType === "ranged"
        ? targetStats.missileResistance + targetStats.physicalDefense
        : targetStats.spellShield + targetStats.magicDefense;

  const minimumDamage = Math.max(1, Math.floor((rawDamage * 200) / 10_000));
  return Math.max(minimumDamage, rawDamage - reduction);
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
  return (
    candidates.reduce((best, candidate) =>
      Math.abs(candidate - estimatedRoll) < Math.abs(best - estimatedRoll) ? candidate : best
    ) ?? null
  );
}

function buildMockRollBreakdown(args: {
  attacker: CombatPlaybackActor;
  defender: CombatPlaybackActor;
  rawDamage: number;
  finalDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  didHit?: boolean;
  didCrit?: boolean;
  killed?: boolean;
}): CombatPlaybackRollBreakdown {
  const attacker = args.attacker.rollStats;
  const defender = args.defender.rollStats;
  if (!attacker || !defender) {
    throw new Error("Mock playback actors require roll stats.");
  }

  const mitigationStatLabel =
    attacker.damageKind === "melee"
      ? "armor"
      : attacker.damageKind === "ranged"
        ? "missileResistance"
        : "spellShield";
  const mitigationResistance =
    mitigationStatLabel === "armor"
      ? defender.armor
      : mitigationStatLabel === "missileResistance"
        ? defender.missileResistance
        : defender.spellShield;
  const mitigationDefense = attacker.damageKind === "spell" ? defender.magicDefense : defender.physicalDefense;
  const didHit = args.didHit ?? true;
  const didCrit = args.didCrit ?? false;

  return {
    attacker: {
      name: args.attacker.name,
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
      name: args.defender.name,
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
    hitChanceBps: clampInt(attacker.accuracy * 100 - defender.dodgeChance, 2500, 9750),
    didHit,
    didCrit,
    baseDamageRoll: didHit
      ? inferBaseDamageRoll({
          crit: didCrit,
          rawDamage: args.rawDamage,
          minDamage: attacker.minDamage,
          maxDamage: attacker.maxDamage,
          critMultiplier: attacker.critMultiplier
        })
      : null,
    rawDamage: didHit ? args.rawDamage : 0,
    mitigationStatLabel,
    mitigationResistance,
    mitigationDefense,
    mitigationTotal: mitigationResistance + mitigationDefense,
    minimumDamage: didHit ? Math.max(1, Math.floor((args.rawDamage * 200) / 10_000)) : 0,
    finalDamage: didHit ? args.finalDamage : 0,
    targetHpBefore: args.targetHpBefore,
    targetHpAfter: args.targetHpAfter,
    killed: args.killed ?? false
  };
}

function damageKindFromCombatStat(
  combatStat: "strength" | "dexterity" | "intelligence"
): CombatPlaybackRollStats["damageKind"] {
  if (combatStat === "dexterity") {
    return "ranged";
  }
  if (combatStat === "intelligence") {
    return "spell";
  }
  return "melee";
}

function mockEncounterLevel(difficulty: ContractDifficulty): number {
  switch (difficulty) {
    case "medium":
      return 12;
    case "hard":
      return 18;
    case "easy":
    default:
      return 6;
  }
}

function buildMockPlayerRollStats(args: {
  level: number;
  playerStats: PlayerStatBlock;
  combatStat: "strength" | "dexterity" | "intelligence";
}): CombatPlaybackRollStats {
  const averageDamage = Math.max(1, args.playerStats.damage);

  return {
    level: args.level,
    damageKind: damageKindFromCombatStat(args.combatStat),
    minDamage: Math.max(1, Math.floor(averageDamage * 0.9)),
    maxDamage: Math.max(1, Math.ceil(averageDamage * 1.1)),
    combatSpeed: Math.max(1, args.playerStats.initiative),
    accuracy: Math.max(0, args.playerStats.accuracy),
    dodgeChance: Math.max(0, args.playerStats.dodgeChance),
    critChance: Math.max(0, args.playerStats.critChance),
    critMultiplier: Math.max(0, args.playerStats.critMultiplier),
    extraAttackChance: Math.max(0, args.playerStats.extraAttackChance),
    armor: Math.max(0, args.playerStats.armor),
    spellShield: Math.max(0, args.playerStats.spellShield),
    missileResistance: Math.max(0, args.playerStats.missileResistance),
    physicalDefense: Math.max(0, args.playerStats.physicalDefense),
    magicDefense: Math.max(0, args.playerStats.magicDefense)
  };
}

function buildMockEnemyRollStats(args: {
  level: number;
  power: number;
  maxHp: number;
  combatStat: "strength" | "dexterity" | "intelligence";
}): CombatPlaybackRollStats {
  const averageDamage = Math.max(10, Math.round(args.power * 0.11));
  const mitigationBase = Math.max(2, Math.round(args.maxHp * 0.08));
  const combatSpeed =
    args.combatStat === "dexterity" ? 16 : args.combatStat === "intelligence" ? 12 : 10;

  return {
    level: args.level,
    damageKind: damageKindFromCombatStat(args.combatStat),
    minDamage: Math.max(1, Math.floor(averageDamage * 0.84)),
    maxDamage: Math.max(1, Math.ceil(averageDamage * 1.16)),
    combatSpeed,
    accuracy: Math.max(50, 74 + Math.round(args.power * 0.08)),
    dodgeChance: Math.max(150, Math.round(args.power * (args.combatStat === "dexterity" ? 1.9 : 1.15))),
    critChance: Math.max(120, Math.round(args.power * (args.combatStat === "intelligence" ? 1.55 : 1.35))),
    critMultiplier: 15_000 + Math.round(args.power * (args.combatStat === "strength" ? 11 : 8)),
    extraAttackChance: Math.max(0, Math.round(args.power * (args.combatStat === "dexterity" ? 1.45 : 0.7))),
    armor: args.combatStat === "strength" ? mitigationBase + 3 : Math.max(0, mitigationBase - 1),
    spellShield: args.combatStat === "intelligence" ? mitigationBase + 4 : Math.max(0, mitigationBase - 2),
    missileResistance: args.combatStat === "dexterity" ? mitigationBase + 3 : Math.max(0, mitigationBase - 1),
    physicalDefense: Math.max(0, Math.round(mitigationBase * 0.6)),
    magicDefense: Math.max(0, Math.round(mitigationBase * 0.55))
  };
}

const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "ashfen-trail",
    name: "Ashfen Caravan Escort",
    difficulty: "easy",
    experience: { low: 120, medium: 180, high: 260 },
    ducats: { low: 70, medium: 110, high: 170 },
    materials: { low: 2, medium: 4, high: 6 },
    itemDrop: { low: 8, medium: 14, high: 20 },
    staminaCost: { low: 8, medium: 11, high: 14 }
  },
  {
    id: "bogwatch-recon",
    name: "Bogwatch Recon Sweep",
    difficulty: "easy",
    experience: { low: 130, medium: 200, high: 280 },
    ducats: { low: 65, medium: 105, high: 165 },
    materials: { low: 3, medium: 5, high: 7 },
    itemDrop: { low: 9, medium: 15, high: 22 },
    staminaCost: { low: 9, medium: 12, high: 15 }
  },
  {
    id: "cinderhold-rats",
    name: "Cinderhold Purge Detail",
    difficulty: "medium",
    experience: { low: 200, medium: 300, high: 420 },
    ducats: { low: 120, medium: 180, high: 260 },
    materials: { low: 4, medium: 7, high: 10 },
    itemDrop: { low: 12, medium: 20, high: 29 },
    staminaCost: { low: 12, medium: 15, high: 18 }
  },
  {
    id: "spire-wardens",
    name: "Spire Warden Relief",
    difficulty: "medium",
    experience: { low: 210, medium: 320, high: 430 },
    ducats: { low: 125, medium: 190, high: 275 },
    materials: { low: 5, medium: 8, high: 11 },
    itemDrop: { low: 13, medium: 21, high: 30 },
    staminaCost: { low: 12, medium: 16, high: 19 }
  },
  {
    id: "blackbriar-break",
    name: "Blackbriar Siege Break",
    difficulty: "hard",
    experience: { low: 310, medium: 470, high: 620 },
    ducats: { low: 190, medium: 270, high: 380 },
    materials: { low: 7, medium: 11, high: 15 },
    itemDrop: { low: 18, medium: 28, high: 39 },
    staminaCost: { low: 16, medium: 19, high: 22 }
  },
  {
    id: "thornkeep-nightfall",
    name: "Thornkeep Nightfall Hunt",
    difficulty: "hard",
    experience: { low: 330, medium: 490, high: 650 },
    ducats: { low: 200, medium: 285, high: 395 },
    materials: { low: 8, medium: 12, high: 16 },
    itemDrop: { low: 19, medium: 30, high: 41 },
    staminaCost: { low: 17, medium: 20, high: 23 }
  }
];

const CONTRACT_AVAILABILITY_WINDOWS: Record<ContractDifficulty, { minMs: number; maxMs: number }> = {
  easy: { minMs: 35 * 60 * 1000, maxMs: 90 * 60 * 1000 },
  medium: { minMs: 25 * 60 * 1000, maxMs: 75 * 60 * 1000 },
  hard: { minMs: 20 * 60 * 1000, maxMs: 60 * 60 * 1000 }
};

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMonsterAssetPath(key: string): string | undefined {
  return GENERATED_ITEM_ICON_PATHS[key];
}

function getGeneratedStageAssetPath(prefix: string, legacyExactKey?: string): string | undefined {
  if (legacyExactKey) {
    const legacyAssetPath = GENERATED_ITEM_ICON_PATHS[legacyExactKey];
    if (legacyAssetPath) {
      return legacyAssetPath;
    }
  }

  const matchedEntry = Object.entries(GENERATED_ITEM_ICON_PATHS).find(([key]) => key.startsWith(prefix));
  return matchedEntry?.[1];
}

function getCombatStageAssetPath(familyId: string): string | undefined {
  return getGeneratedStageAssetPath(`combat_stage:${familyId}:`, `combat_stage:${familyId}`);
}

function getTravelStageAssetPath(familyId: string): string | undefined {
  return getGeneratedStageAssetPath(`travel_stage:${familyId}:default`, `travel_stage:${familyId}`);
}

export function getEncounterTravelDescription(difficulty: ContractDifficulty): string {
  switch (difficulty) {
    case "easy":
      return "Torch smoke drifts through cramped goblin tunnels ahead. The hollow is close, noisy, and badly kept.";
    case "medium":
      return "Cold mirewater gathers around reed roots and black pools. Something in the hollow is already listening.";
    case "hard":
      return "Bright grass, white tents, and wagon tracks spread ahead. The land looks good until the camp comes into focus.";
    default:
      return "The path ahead tightens toward the contract target.";
  }
}

function getEncounterPreset(difficulty: ContractDifficulty): {
  familyId: string;
  locationName: string;
  enemyId: string;
  enemyName: string;
  enemyMaxHp: number;
  enemyPower: number;
  enemyCombatStat: "strength" | "dexterity" | "intelligence";
  travelImagePath?: string;
  combatBackgroundPath?: string;
  travelImageMode: "image" | "silhouette";
  avatarPath?: string;
  usesSilhouetteFallback?: boolean;
} {
  switch (difficulty) {
    case "easy": {
      const easyTravelImagePath =
        getTravelStageAssetPath("snagtooth_hollow_00") ??
        getMonsterAssetPath("monster:snagtooth_hollow_00:snagtooth boss");
      return {
        familyId: "snagtooth_hollow_00",
        locationName: "Snagtooth Hollow",
        enemyId: "enemy-snagtooth-boss",
        enemyName: "Snagtooth Boss",
        enemyMaxHp: 72,
        enemyPower: 84,
        enemyCombatStat: "strength",
        travelImagePath: easyTravelImagePath,
        combatBackgroundPath: getCombatStageAssetPath("snagtooth_hollow_00"),
        travelImageMode: easyTravelImagePath ? "image" : "silhouette",
        avatarPath: getMonsterAssetPath("monster:snagtooth_hollow_00:snagtooth boss")
      };
    }
    case "medium": {
      const mediumTravelImagePath =
        getTravelStageAssetPath("mirepool_boglings_04") ??
        getMonsterAssetPath("monster:mirepool_boglings_04:the mire croaker");
      return {
        familyId: "mirepool_boglings_04",
        locationName: "Mirepool Grotto",
        enemyId: "enemy-mire-croaker",
        enemyName: "The Mire Croaker",
        enemyMaxHp: 88,
        enemyPower: 112,
        enemyCombatStat: "dexterity",
        travelImagePath: mediumTravelImagePath,
        combatBackgroundPath: getCombatStageAssetPath("mirepool_boglings_04"),
        travelImageMode: mediumTravelImagePath ? "image" : "silhouette",
        avatarPath: getMonsterAssetPath("monster:mirepool_boglings_04:the mire croaker")
      };
    }
    case "hard": {
      const hardTravelImagePath = getTravelStageAssetPath("ternfield_hobgoblins_08");
      return {
        familyId: "ternfield_hobgoblins_08",
        locationName: "Ternfields",
        enemyId: "enemy-camp-reeve",
        enemyName: "The Camp Reeve",
        enemyMaxHp: 102,
        enemyPower: 136,
        enemyCombatStat: "intelligence",
        travelImagePath: hardTravelImagePath,
        combatBackgroundPath: getCombatStageAssetPath("ternfield_hobgoblins_08"),
        travelImageMode: hardTravelImagePath ? "image" : "silhouette",
        avatarPath: getMonsterAssetPath("monster:ternfield_hobgoblins_08:the camp reeve"),
        usesSilhouetteFallback: !hardTravelImagePath
      };
    }
    default:
      return {
        familyId: "unknown_reach",
        locationName: "Unknown Reach",
        enemyId: "enemy-unknown",
        enemyName: "Unknown Enemy",
        enemyMaxHp: 80,
        enemyPower: 100,
        enemyCombatStat: "strength",
        travelImageMode: "silhouette",
        usesSilhouetteFallback: true
      };
  }
}

export function buildMockCombatEncounterState(args: {
  offer: ContractOffer;
  slotIndex: number;
  playerName: string;
  playerClass: PlayerClass;
  playerPower: number;
  playerStats: PlayerStatBlock;
  playerAvatarPath?: string | null;
  nowMs: number;
}): ActiveContractEncounterState {
  const { offer, slotIndex, playerName, playerClass, playerPower, playerStats, playerAvatarPath, nowMs } = args;
  const preset = getEncounterPreset(offer.template.difficulty);
  const playerMaxHp = 100;
  const encounterLevel = mockEncounterLevel(offer.template.difficulty);
  const playerCombatStat: "strength" | "dexterity" | "intelligence" = classToStatTree(playerClass);
  const playerActor = {
    id: "player-warden",
    side: "player" as const,
    name: playerName,
    maxHp: playerMaxHp,
    power: playerPower,
    combatStat: playerCombatStat,
    rollStats: buildMockPlayerRollStats({
      level: encounterLevel,
      playerStats,
      combatStat: playerCombatStat
    }),
    avatarPath: playerAvatarPath ?? undefined
  };
  const enemyActor = {
    id: preset.enemyId,
    side: "enemy" as const,
    name: preset.enemyName,
    maxHp: preset.enemyMaxHp,
    power: preset.enemyPower,
    combatStat: preset.enemyCombatStat,
    rollStats: buildMockEnemyRollStats({
      level: encounterLevel,
      power: preset.enemyPower,
      maxHp: preset.enemyMaxHp,
      combatStat: preset.enemyCombatStat
    }),
    avatarPath: preset.avatarPath,
    usesSilhouetteFallback: preset.usesSilhouetteFallback
  };
  const encounter = combatPlaybackEncounterSchema.parse({
    encounterId: `${offer.instanceId}-encounter`,
    contractInstanceId: offer.instanceId,
    contractName: offer.template.name,
    difficulty: offer.template.difficulty,
    locationName: preset.locationName,
    travelImagePath: preset.travelImagePath,
    combatBackgroundPath: preset.combatBackgroundPath,
    travelImageMode: preset.travelImageMode,
    player: playerActor,
    enemies: [enemyActor]
  });
  const playerOpeningDamage = 18;
  const enemyOpeningRawDamage = Math.max(10, Math.round(enemyActor.power * 0.12));
  const enemyOpeningDamage = mitigateIncomingDamage(
    enemyOpeningRawDamage,
    attackTypeFromCombatStat(enemyActor.combatStat),
    playerStats
  );
  const playerFollowupDamage = 17;
  const enemyFollowupRawDamage = Math.max(9, Math.round(enemyActor.power * 0.1));
  const enemyFollowupDamage = mitigateIncomingDamage(
    enemyFollowupRawDamage,
    attackTypeFromCombatStat(enemyActor.combatStat),
    playerStats
  );
  const playerFinisherDamage = Math.max(0, enemyActor.maxHp - 35);
  const timeline = combatPlaybackEventSchema.array().parse([
    {
      type: "CombatPlaybackStarted",
      eventId: `${encounter.encounterId}-start`,
      encounterId: encounter.encounterId
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-1`,
      encounterId: encounter.encounterId,
      turnIndex: 1,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: playerOpeningDamage,
      targetHpAfter: Math.max(0, enemyActor.maxHp - playerOpeningDamage),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} strikes ${enemyActor.name} for ${playerOpeningDamage} damage.`,
      rollBreakdown: buildMockRollBreakdown({
        attacker: playerActor,
        defender: enemyActor,
        rawDamage: playerOpeningDamage,
        finalDamage: playerOpeningDamage,
        targetHpBefore: enemyActor.maxHp,
        targetHpAfter: Math.max(0, enemyActor.maxHp - playerOpeningDamage)
      })
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-2`,
      encounterId: encounter.encounterId,
      turnIndex: 2,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: enemyOpeningDamage,
      targetHpAfter: Math.max(
        0,
        playerActor.maxHp - enemyOpeningDamage
      ),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} clips ${playerActor.name} for ${enemyOpeningDamage} damage.`,
      rollBreakdown: buildMockRollBreakdown({
        attacker: enemyActor,
        defender: playerActor,
        rawDamage: enemyOpeningRawDamage,
        finalDamage: enemyOpeningDamage,
        targetHpBefore: playerActor.maxHp,
        targetHpAfter: Math.max(0, playerActor.maxHp - enemyOpeningDamage)
      })
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-3`,
      encounterId: encounter.encounterId,
      turnIndex: 3,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: playerFollowupDamage,
      targetHpAfter: Math.max(0, enemyActor.maxHp - 35),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} presses forward and deals ${playerFollowupDamage} damage to ${enemyActor.name}.`,
      rollBreakdown: buildMockRollBreakdown({
        attacker: playerActor,
        defender: enemyActor,
        rawDamage: playerFollowupDamage,
        finalDamage: playerFollowupDamage,
        targetHpBefore: enemyActor.maxHp - playerOpeningDamage,
        targetHpAfter: Math.max(0, enemyActor.maxHp - 35)
      })
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-4`,
      encounterId: encounter.encounterId,
      turnIndex: 4,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: enemyFollowupDamage,
      targetHpAfter: Math.max(
        0,
        playerActor.maxHp - enemyOpeningDamage - enemyFollowupDamage
      ),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} catches ${playerActor.name} for ${enemyFollowupDamage} damage.`,
      rollBreakdown: buildMockRollBreakdown({
        attacker: enemyActor,
        defender: playerActor,
        rawDamage: enemyFollowupRawDamage,
        finalDamage: enemyFollowupDamage,
        targetHpBefore: playerActor.maxHp - enemyOpeningDamage,
        targetHpAfter: Math.max(0, playerActor.maxHp - enemyOpeningDamage - enemyFollowupDamage)
      })
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-5`,
      encounterId: encounter.encounterId,
      turnIndex: 5,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: playerFinisherDamage,
      targetHpAfter: 0,
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} finishes ${enemyActor.name} with a final blow.`,
      rollBreakdown: buildMockRollBreakdown({
        attacker: playerActor,
        defender: enemyActor,
        rawDamage: playerFinisherDamage,
        finalDamage: playerFinisherDamage,
        targetHpBefore: enemyActor.maxHp - 35,
        targetHpAfter: 0,
        killed: true
      })
    },
    {
      type: "CombatPlaybackEnded",
      eventId: `${encounter.encounterId}-end`,
      encounterId: encounter.encounterId,
      winnerSide: "player",
      summaryLine: `${offer.template.name} is complete. ${enemyActor.name} has been driven off.`
    }
  ]);

  return {
    slotIndex,
    offer,
    phase: "travel",
    travelEndsAt: nowMs + CONTRACT_TRAVEL_DURATION_MS,
    travelDurationMs: CONTRACT_TRAVEL_DURATION_MS,
    encounter,
    travelDescription: getEncounterTravelDescription(offer.template.difficulty),
    timeline,
    currentEventIndex: 0,
    hpByActorId: {
      [playerActor.id]: playerActor.maxHp,
      [enemyActor.id]: enemyActor.maxHp
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

export function resetCombatEncounterPlayback(previousEncounter: ActiveContractEncounterState): ActiveContractEncounterState {
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

export function getEncounterPlaybackProgress(
  encounter: ActiveContractEncounterState,
  nowMs: number = Date.now()
): number {
  if (encounter.lastPlaybackTickAtMs === null) {
    return encounter.playbackProgressMs;
  }
  return encounter.playbackProgressMs + Math.max(0, nowMs - encounter.lastPlaybackTickAtMs) * encounter.segmentPlaybackRate;
}

export function snapshotEncounterPlayback(
  encounter: ActiveContractEncounterState,
  nowMs: number = Date.now()
): ActiveContractEncounterState {
  return {
    ...encounter,
    playbackProgressMs: getEncounterPlaybackProgress(encounter, nowMs),
    lastPlaybackTickAtMs: nowMs
  };
}

export function getEncounterAnimationRate(encounter: ActiveContractEncounterState): number {
  if (encounter.segmentPlaybackRate === 5) {
    return COMBAT_FAST_FORWARD_ANIMATION_RATE;
  }
  return encounter.segmentPlaybackRate;
}

export function getEncounterPlaybackThresholdMs(baseMs: number, encounter: ActiveContractEncounterState): number {
  return (baseMs * encounter.segmentPlaybackRate) / getEncounterAnimationRate(encounter);
}

export function randomContractRoll(): ContractRoll {
  const roll = randomInRange(1, 3);
  if (roll === 1) {
    return "low";
  }
  if (roll === 2) {
    return "medium";
  }
  return "high";
}

export function createContractOffer(nowMs: number): ContractOffer {
  const template = CONTRACT_TEMPLATES[randomInRange(0, CONTRACT_TEMPLATES.length - 1)];
  const availabilityWindow = CONTRACT_AVAILABILITY_WINDOWS[template.difficulty];
  const durationMs = randomInRange(availabilityWindow.minMs, availabilityWindow.maxMs);
  return {
    instanceId: `${template.id}-${nowMs}-${randomInRange(1000, 9999)}`,
    template,
    efficiencyTier: "standard_cost",
    staminaCostValue: template.staminaCost.medium,
    rollCue: {
      experience: randomContractRoll(),
      ducats: randomContractRoll(),
      materials: randomContractRoll(),
      itemDrop: randomContractRoll(),
      staminaCost: randomContractRoll()
    },
    expiresAt: nowMs + durationMs
  };
}

export function createContractSlots(nowMs: number): ContractSlotState[] {
  return Array.from({ length: CONTRACT_SLOT_COUNT }, (_, index) => ({
    slotIndex: index + 1,
    offer: createContractOffer(nowMs),
    replenishReadyAt: null
  }));
}
