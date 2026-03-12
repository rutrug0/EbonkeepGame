import {
  combatPlaybackEncounterSchema,
  combatPlaybackEventSchema,
  type CombatPlaybackActionResolved,
  type CombatPlaybackEncounter,
  type CombatPlaybackEvent
} from "@ebonkeep/shared/combat";
import type { PlayerClass } from "@ebonkeep/shared/core";
import { classToStatTree } from "@ebonkeep/shared/core";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";

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
  travelDescription: string;
  encounter: CombatPlaybackEncounter;
  timeline: CombatPlaybackEvent[];
  currentEventIndex: number;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
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
export const CONTRACT_REPLENISH_MIN_MS = 60 * 60 * 1000;
export const CONTRACT_REPLENISH_MAX_MS = 120 * 60 * 1000;
export const CONTRACT_TRAVEL_DURATION_MS = 10 * 1000;
export const COMBAT_PLAYBACK_START_DELAY_MS = 330;
export const COMBAT_PLAYBACK_IMPACT_DELAY_MS = 760;
export const COMBAT_PLAYBACK_BEAT_MS = 1470;
export const COMBAT_SUMMARY_TYPE_DELAY_MS = 30;
export const COMBAT_FAST_FORWARD_ANIMATION_RATE = 8;

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
  playerAvatarPath?: string | null;
  nowMs: number;
}): ActiveContractEncounterState {
  const { offer, slotIndex, playerName, playerClass, playerPower, playerAvatarPath, nowMs } = args;
  const preset = getEncounterPreset(offer.template.difficulty);
  const playerMaxHp = 100;
  const playerCombatStat: "strength" | "dexterity" | "intelligence" = classToStatTree(playerClass);
  const playerActor = {
    id: "player-warden",
    side: "player" as const,
    name: playerName,
    maxHp: playerMaxHp,
    power: playerPower,
    combatStat: playerCombatStat,
    avatarPath: playerAvatarPath ?? undefined
  };
  const enemyActor = {
    id: preset.enemyId,
    side: "enemy" as const,
    name: preset.enemyName,
    maxHp: preset.enemyMaxHp,
    power: preset.enemyPower,
    combatStat: preset.enemyCombatStat,
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
      damage: 18,
      targetHpAfter: Math.max(0, enemyActor.maxHp - 18),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} strikes ${enemyActor.name} for 18 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-2`,
      encounterId: encounter.encounterId,
      turnIndex: 2,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: 9,
      targetHpAfter: Math.max(0, playerActor.maxHp - 9),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} clips ${playerActor.name} for 9 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-3`,
      encounterId: encounter.encounterId,
      turnIndex: 3,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: 17,
      targetHpAfter: Math.max(0, enemyActor.maxHp - 35),
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} presses forward and deals 17 damage to ${enemyActor.name}.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-4`,
      encounterId: encounter.encounterId,
      turnIndex: 4,
      actorId: enemyActor.id,
      targetId: playerActor.id,
      actionType: "basic_attack",
      damage: 8,
      targetHpAfter: Math.max(0, playerActor.maxHp - 17),
      attackerLungeDirection: "right-to-left",
      logLine: `${enemyActor.name} catches ${playerActor.name} for 8 damage.`
    },
    {
      type: "CombatPlaybackActionResolved",
      eventId: `${encounter.encounterId}-turn-5`,
      encounterId: encounter.encounterId,
      turnIndex: 5,
      actorId: playerActor.id,
      targetId: enemyActor.id,
      actionType: "basic_attack",
      damage: Math.max(0, enemyActor.maxHp - 35),
      targetHpAfter: 0,
      attackerLungeDirection: "left-to-right",
      logLine: `${playerActor.name} finishes ${enemyActor.name} with a final blow.`
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
    encounter,
    travelDescription: getEncounterTravelDescription(offer.template.difficulty),
    timeline,
    currentEventIndex: 0,
    hpByActorId: {
      [playerActor.id]: playerActor.maxHp,
      [enemyActor.id]: enemyActor.maxHp
    },
    combatLogEntries: [],
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
