import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  COMBAT_MITIGATION_FLOOR_BPS,
  COMBAT_MITIGATION_MAX_BPS,
  COMBAT_MITIGATION_SCALE_MULTIPLIER,
  developerContractSimulationJobSchema,
  developerContractSimulationLevelSummarySchema,
  runDeveloperContractSimulationBodySchema,
  type ContractEfficiencyTier,
  type ContractLevelBand,
  type DeveloperContractSimulationArchetype,
  type DeveloperContractSimulationBandAverages,
  type DeveloperContractSimulationBandHitRate,
  type DeveloperContractSimulationJob,
  type DeveloperContractSimulationLevelSummary,
  type DeveloperContractSimulationResult,
  type RunDeveloperContractSimulationBody
} from "@ebonkeep/shared/combat";
import { type PlayerClass } from "@ebonkeep/shared/core";
import { type EquipmentState } from "@ebonkeep/shared/inventory";
import { type PlayerState } from "@ebonkeep/shared/player";

import {
  getContractReplenishPacingRow,
  resolveContractTravelDurationSeconds,
  resolveStaminaRegenPercentPerHour
} from "../../config/activity-pacing.js";
import { rollInventoryItem } from "../inventory/item-service.js";
import { playerProgressionConfig, getExperienceToNextLevel } from "../player/progression-service.js";
import { buildPlayerStatSnapshot, computeGearScore, createEmptyEquipmentState } from "../player/state-service.js";
import {
  CONTRACT_AVAILABILITY_WINDOW,
  CONTRACT_LEVEL_BANDS,
  CONTRACT_SLOT_COUNT,
  buildEncounterDefinition,
  buildEncounterDefinitionForLevel,
  buildEncounterDefinitionForBand,
  createSeededRng,
  randomInt,
  type EncounterDefinition
} from "./data.js";
import { buildPlayerActorSnapshot, rollRewardItemSpec, simulateCombat, simulateEncounter } from "./simulator.js";
import { createExpectedPlayerState, getExpectedPlayerCombatMetrics, SIMULATION_BASE_STATS, STANDARD_SIMULATION_SLOTS } from "./balance-model.js";

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_JOBS = 10;
const MAX_FIGHTS_PER_LEVEL = 400;
const SIMULATION_ARTIFACT_DIR = resolve(process.cwd(), "artifacts", "contracts-simulations");
const DEFAULT_WIN_RATE_BY_BAND: Record<ContractLevelBand, number> = {
  under_level: 0.9,
  on_level: 0.7,
  over_level: 0.55
};
const SHARED_EFFICIENCY_TIER: ContractEfficiencyTier = "standard_cost";

type BandRecord<T> = Record<ContractLevelBand, T>;

type ArchetypePolicy = {
  archetype: DeveloperContractSimulationArchetype;
  staminaReserveRatio: number;
  resumeStaminaRatio: number;
  fightOverheadSeconds: number;
  restOverheadSeconds: number;
  preferredBands: ContractLevelBand[];
};

type BandStats = BandRecord<{ wins: number; losses: number }>;

type SimulatedBoardSlot = {
  slotIndex: number;
  state: "available" | "replenishing" | "traveling";
  encounter: EncounterDefinition | null;
  expiresAtSeconds: number | null;
  replenishAtSeconds: number | null;
  replenishCount: number;
  expireCount: number;
};

type LevelAccumulator = {
  gearScoreTotal: number;
  completedSamples: number;
  elapsedSecondsTotal: number;
  activePlaySecondsTotal: number;
  idleSecondsTotal: number;
  staminaWaitSecondsTotal: number;
  contractAvailabilityWaitSecondsTotal: number;
  fightsTotal: number;
  wins: BandRecord<number>;
  losses: BandRecord<number>;
  experienceTotal: number;
  staminaSpentTotal: number;
  restCountTotal: number;
  combatSecondsTotal: number;
  inputOverheadSecondsTotal: number;
  playerAttackRollTotal: number;
  playerAttackCountTotal: number;
  playerHpLossPercentTotal: number;
  playerHpLossCountTotal: number;
  benchmarkPlayerActionTurnTotals: BandRecord<number>;
  benchmarkPlayerActionTurnCounts: BandRecord<number>;
  benchmarkEnemyActionTurnTotals: BandRecord<number>;
  benchmarkEnemyActionTurnCounts: BandRecord<number>;
  benchmarkPlayerStrikeTotals: BandRecord<number>;
  benchmarkPlayerStrikeCounts: BandRecord<number>;
  benchmarkEnemyStrikeTotals: BandRecord<number>;
  benchmarkEnemyStrikeCounts: BandRecord<number>;
  benchmarkPlayerHpLossPercentTotals: BandRecord<number>;
  benchmarkPlayerHpLossPercentCounts: BandRecord<number>;
  benchmarkEncounterHpRatioTotals: BandRecord<number>;
  benchmarkEncounterHpRatioCounts: BandRecord<number>;
};

type JobRecord = DeveloperContractSimulationJob & {
  createdAtMs: number;
  artifactPath?: string | null;
};

type SimulationArtifactPayload = {
  artifactVersion: 6;
  generatedAt: string;
  jobId: string;
  config: DeveloperContractSimulationJob["config"];
  mitigation: {
    floorBps: number;
    maxMitigationBps: number;
    scaleMultiplier: number;
  };
  result: DeveloperContractSimulationResult;
  derived: {
    cumulativeElapsedDaysByArchetype: Record<
      DeveloperContractSimulationArchetype,
      Array<{
        level: number;
        cumulativeElapsedDays: number;
      }>
    >;
    benchmarkTargetBandHitRateByArchetype: Record<
      DeveloperContractSimulationArchetype,
      DeveloperContractSimulationBandHitRate
    >;
    benchmarkTurnTargetHitRateByArchetype: Record<
      DeveloperContractSimulationArchetype,
      DeveloperContractSimulationBandHitRate
    >;
  };
};

export type ExactDeltaSimulationAuditPoint = {
  playerLevel: number;
  encounterLevel: number;
  levelDelta: number;
  sampleSize: number;
  winRate: number;
  avgPlayerHpLossPercent: number;
  avgTotalActionRounds: number;
  avgPlayerActionTurns: number;
  avgEnemyActionTurns: number;
  avgEnemyToPlayerActionTurnRatio: number;
  avgPlayerStrikes: number;
  avgEnemyStrikes: number;
  playerMaxHp: number;
  avgTotalEnemyHp: number;
  avgEnemyHpToPlayerHpRatio: number;
  avgEnemyHitSize: number;
  expectedPlayerMetrics: {
    gearScore: number;
    ehp: number;
    dps: number;
    tempo: number;
  };
};

export type MirrorPvpSimulationAuditPoint = {
  playerLevel: number;
  sampleSize: number;
  avgResolvedActions: number;
  avgWinnerHpLossPercent: number;
  avgMitigatedHitSize: number;
  avgApproxHitsToKill: number;
  firstActorWinRate: number;
  avgPlayerMaxHp: number;
};

const BENCHMARK_HP_LOSS_TARGETS: BandRecord<{ min: number; max: number }> = {
  under_level: { min: 25, max: 35 },
  on_level: { min: 35, max: 45 },
  over_level: { min: 50, max: 60 }
};
const BENCHMARK_ACTION_TURN_TARGETS: BandRecord<{ min: number; max: number }> = {
  under_level: { min: 5, max: 8 },
  on_level: { min: 8, max: 12 },
  over_level: { min: 11, max: 16 }
};

const ARCHETYPE_POLICIES: ReadonlyArray<ArchetypePolicy> = [
  {
    archetype: "active",
    staminaReserveRatio: 0,
    resumeStaminaRatio: 0,
    fightOverheadSeconds: 5,
    restOverheadSeconds: 20,
    preferredBands: ["over_level", "on_level", "under_level"]
  },
  {
    archetype: "average",
    staminaReserveRatio: 0.25,
    resumeStaminaRatio: 0.5,
    fightOverheadSeconds: 15,
    restOverheadSeconds: 40,
    preferredBands: ["on_level", "over_level", "under_level"]
  },
  {
    archetype: "slow",
    staminaReserveRatio: 0.5,
    resumeStaminaRatio: 1,
    fightOverheadSeconds: 30,
    restOverheadSeconds: 60,
    preferredBands: ["under_level", "on_level", "over_level"]
  }
];

const simulationJobs = new Map<string, JobRecord>();

function createBandRecord<T>(factory: () => T): BandRecord<T> {
  return {
    under_level: factory(),
    on_level: factory(),
    over_level: factory()
  };
}

function createNumberBandRecord(): BandRecord<number> {
  return createBandRecord(() => 0);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function createLevelAccumulator(): LevelAccumulator {
  return {
    gearScoreTotal: 0,
    completedSamples: 0,
    elapsedSecondsTotal: 0,
    activePlaySecondsTotal: 0,
    idleSecondsTotal: 0,
    staminaWaitSecondsTotal: 0,
    contractAvailabilityWaitSecondsTotal: 0,
    fightsTotal: 0,
    wins: createNumberBandRecord(),
    losses: createNumberBandRecord(),
    experienceTotal: 0,
    staminaSpentTotal: 0,
    restCountTotal: 0,
    combatSecondsTotal: 0,
    inputOverheadSecondsTotal: 0,
    playerAttackRollTotal: 0,
    playerAttackCountTotal: 0,
    playerHpLossPercentTotal: 0,
    playerHpLossCountTotal: 0,
    benchmarkPlayerActionTurnTotals: createNumberBandRecord(),
    benchmarkPlayerActionTurnCounts: createNumberBandRecord(),
    benchmarkEnemyActionTurnTotals: createNumberBandRecord(),
    benchmarkEnemyActionTurnCounts: createNumberBandRecord(),
    benchmarkPlayerStrikeTotals: createNumberBandRecord(),
    benchmarkPlayerStrikeCounts: createNumberBandRecord(),
    benchmarkEnemyStrikeTotals: createNumberBandRecord(),
    benchmarkEnemyStrikeCounts: createNumberBandRecord(),
    benchmarkPlayerHpLossPercentTotals: createNumberBandRecord(),
    benchmarkPlayerHpLossPercentCounts: createNumberBandRecord(),
    benchmarkEncounterHpRatioTotals: createNumberBandRecord(),
    benchmarkEncounterHpRatioCounts: createNumberBandRecord()
  };
}

function createZeroBandHitRate(): DeveloperContractSimulationBandHitRate {
  return {
    under_level: 0,
    on_level: 0,
    over_level: 0
  };
}

function createBandStats(): BandStats {
  return createBandRecord(() => ({ wins: 0, losses: 0 }));
}

function isWithinTargetBand(levelBand: ContractLevelBand, value: number): boolean {
  const band = BENCHMARK_HP_LOSS_TARGETS[levelBand];
  return value >= band.min && value <= band.max;
}

function isWithinActionTurnTargetBand(levelBand: ContractLevelBand, value: number): boolean {
  const band = BENCHMARK_ACTION_TURN_TARGETS[levelBand];
  return value >= band.min && value <= band.max;
}

function formatSeedTime(seconds: number): string {
  return seconds.toFixed(3);
}

function isJobTerminal(job: Pick<JobRecord, "status">): boolean {
  return job.status === "completed" || job.status === "failed";
}

function evictExpiredJobs(nowMs = Date.now()): void {
  for (const [jobId, job] of simulationJobs) {
    if (!isJobTerminal(job)) {
      continue;
    }
    if (nowMs - job.createdAtMs > JOB_TTL_MS) {
      simulationJobs.delete(jobId);
    }
  }

  if (simulationJobs.size < MAX_STORED_JOBS) {
    return;
  }

  const oldestTerminalJob = [...simulationJobs.values()]
    .filter(isJobTerminal)
    .sort((left, right) => left.createdAtMs - right.createdAtMs)[0];

  if (oldestTerminalJob) {
    simulationJobs.delete(oldestTerminalJob.jobId);
  }
}

function withScopedMathRandom<T>(rng: () => number, callback: () => T): T {
  const originalRandom = Math.random;
  Math.random = rng;

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function buildSyntheticEquipment(args: {
  playerClass: PlayerClass;
  level: number;
  seed: string;
}): EquipmentState {
  const equipment = createEmptyEquipmentState();

  for (const slotId of STANDARD_SIMULATION_SLOTS) {
    const rewardItem = rollRewardItemSpec({
      rng: createSeededRng(`${args.seed}:${slotId}:reward-roll`),
      playerClass: args.playerClass,
      encounterLevel: args.level,
      allowedSlotId: slotId
    });
    if (!rewardItem) {
      continue;
    }

    const itemSeed = `${args.seed}:${slotId}:${rewardItem.templateId}:${rewardItem.rarity}:${rewardItem.itemLevel}`;
    const item = withScopedMathRandom(createSeededRng(itemSeed), () =>
      rollInventoryItem({
        playerId: `sim_${args.playerClass}`,
        templateId: rewardItem.templateId,
        rarity: rewardItem.rarity,
        explicitId: `itm_sim_${args.playerClass}_${slotId}_${args.level}`,
        itemLevel: rewardItem.itemLevel
      })
    );
    equipment[slotId] = item;
  }

  return equipment;
}

function createSyntheticPlayerState(args: {
  playerClass: PlayerClass;
  level: number;
  equipment: EquipmentState;
}): PlayerState {
  const statSnapshot = buildPlayerStatSnapshot({
    playerClass: args.playerClass,
    level: args.level,
    baseStats: { ...SIMULATION_BASE_STATS },
    equipment: args.equipment
  });
  const gearScore = computeGearScore(args.equipment);
  const maxHealth = Math.max(1, statSnapshot.total.maxHitpoints);

  return {
    playerId: `sim_player_${args.playerClass}_${args.level}`,
    accountId: `sim_account_${args.playerClass}`,
    class: args.playerClass,
    portraitId: "str_01",
    backgroundId: "bg_01",
    preferredLocale: "en",
    level: args.level,
    experience: 0,
    experienceIntoLevel: 0,
    experienceToNextLevel: getExperienceToNextLevel(args.level),
    gearScore,
    health: {
      current: maxHealth,
      max: maxHealth,
      nextPointAt: null
    },
    stamina: {
      current: 120,
      max: 120,
      nextPointAt: null
    },
    stats: {
      strength: statSnapshot.total.strength,
      intelligence: statSnapshot.total.intelligence,
      dexterity: statSnapshot.total.dexterity,
      vitality: statSnapshot.total.vitality,
      initiative: statSnapshot.total.initiative,
      luck: statSnapshot.total.luck
    },
    statSnapshot,
    inventory: [],
    equipment: args.equipment,
    currency: {
      ducats: 0,
      imperials: 0,
      renown: 0
    },
      cheatSettings: {
        fastTravelEnabled: false,
        fastContractReplenishEnabled: false,
        fastArenaReplenishEnabled: false,
        invincibilityEnabled: false,
        fastTrainTimeEnabled: false,
        unlimitedAcademyDonationsEnabled: false,
        unlimitedForgeConsumablesEnabled: false,
        unlimitedRefineryMaterialsEnabled: false
      }
  };
}

function getFightCombatSeconds(events: ReturnType<typeof simulateEncounter>["events"]): number {
  return events.length * 2.5;
}

function getFightPlayerAttackMetrics(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
}): { totalRawDamage: number; landedStrikes: number } {
  let totalRawDamage = 0;
  let landedStrikes = 0;

  for (const event of args.events) {
    if (event.type !== "CombatActionResolved" || event.actorId !== args.playerId) {
      continue;
    }
    for (const strike of event.strikes) {
      if (strike.hit) {
        totalRawDamage += strike.rawDamage;
        landedStrikes += 1;
      }
    }
  }

  return { totalRawDamage, landedStrikes };
}

function getFightActionMetrics(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
}): {
  playerActionTurns: number;
  enemyActionTurns: number;
  playerStrikes: number;
  enemyStrikes: number;
} {
  let playerActionTurns = 0;
  let enemyActionTurns = 0;
  let playerStrikes = 0;
  let enemyStrikes = 0;

  for (const event of args.events) {
    if (event.type !== "CombatActionResolved") {
      continue;
    }
    if (event.actorId === args.playerId) {
      playerActionTurns += 1;
      playerStrikes += event.strikes.length;
    } else {
      enemyActionTurns += 1;
      enemyStrikes += event.strikes.length;
    }
  }

  return { playerActionTurns, enemyActionTurns, playerStrikes, enemyStrikes };
}

function getFightPlayerHealthAfter(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
  maxHealth: number;
}): number {
  return getFightActorHealthAfter({
    actorId: args.playerId,
    events: args.events,
    maxHealth: args.maxHealth
  });
}

function getFightActorHealthAfter(args: {
  actorId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
  maxHealth: number;
}): number {
  let currentHp = args.maxHealth;

  for (const event of args.events) {
    if (event.type !== "CombatActionResolved") {
      continue;
    }
    for (const strike of event.strikes) {
      if (strike.targetId === args.actorId) {
        currentHp = strike.targetHpAfter;
      }
    }
  }

  return Math.max(0, Math.min(args.maxHealth, currentHp));
}

function getCombatEndedEvent(
  events: ReturnType<typeof simulateEncounter>["events"]
): Extract<ReturnType<typeof simulateEncounter>["events"][number], { type: "CombatEnded" }> | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "CombatEnded") {
      return event;
    }
  }
  return null;
}

function getFightPlayerHpLossPercent(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
  maxHealth: number;
}): number {
  const healthAfter = getFightPlayerHealthAfter(args);
  if (args.maxHealth <= 0) {
    return 0;
  }
  return roundToTwo(((args.maxHealth - healthAfter) / args.maxHealth) * 100);
}

function calculateStaminaRegenForSeconds(args: {
  level: number;
  staminaCurrent: number;
  staminaMax: number;
  elapsedSeconds: number;
}): number {
  if (args.elapsedSeconds <= 0 || args.staminaCurrent >= args.staminaMax) {
    return args.staminaCurrent;
  }

  const regenPercentPerHour = Math.max(0, resolveStaminaRegenPercentPerHour(args.level));
  const regenPerSecond = ((args.staminaMax * regenPercentPerHour) / 100) / 3600;
  return Math.min(args.staminaMax, args.staminaCurrent + (regenPerSecond * args.elapsedSeconds));
}

function getObservedWinRate(levelBand: ContractLevelBand, stats: BandStats): number {
  const attempts = stats[levelBand].wins + stats[levelBand].losses;
  if (attempts === 0) {
    return DEFAULT_WIN_RATE_BY_BAND[levelBand];
  }
  return stats[levelBand].wins / attempts;
}

function getPreferredBandsForPolicy(policy: ArchetypePolicy, stats: BandStats): ContractLevelBand[] {
  const uniqueBands = policy.preferredBands.filter((levelBand, index, list) => list.indexOf(levelBand) === index);
  const explorationOrder: ContractLevelBand[] = ["under_level", "on_level", "over_level"];
  const unattempted = explorationOrder.filter(
    (levelBand) => uniqueBands.includes(levelBand) && stats[levelBand].wins + stats[levelBand].losses === 0
  );
  const attempted = uniqueBands.filter((levelBand) => !unattempted.includes(levelBand));

  attempted.sort((left, right) => {
    const leftIndex = policy.preferredBands.indexOf(left);
    const rightIndex = policy.preferredBands.indexOf(right);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return getObservedWinRate(right, stats) - getObservedWinRate(left, stats);
  });

  return [...unattempted, ...attempted];
}

function simulateBenchmarkBandMetrics(args: {
  policy: ArchetypePolicy;
  playerClass: PlayerClass;
  playerState: PlayerState;
  level: number;
  sampleIndex: number;
  stats: BandStats;
  accumulator: LevelAccumulator;
}): void {
  for (const levelBand of CONTRACT_LEVEL_BANDS) {
    const rng = createSeededRng(
      `${args.policy.archetype}:${args.playerClass}:benchmark:${args.sampleIndex}:${args.level}:${levelBand}`
    );
    const encounter = buildEncounterDefinitionForBand(
      rng,
      {
        playerId: `sim_${args.playerClass}_${args.sampleIndex}`,
        playerLevel: args.level,
        playerClass: args.playerClass
      },
      levelBand
    );
    const simulation = simulateEncounter({
      encounter,
      playerState: args.playerState,
      playerName: "Warden",
      runId: `${args.policy.archetype}:${args.playerClass}:benchmark-fight:${args.sampleIndex}:${args.level}:${levelBand}`
    });
    const benchmarkHpLossPercent = getFightPlayerHpLossPercent({
      playerId: simulation.player.id,
      events: simulation.events,
      maxHealth: args.playerState.health.max
    });
    const benchmarkActionMetrics = getFightActionMetrics({
      playerId: simulation.player.id,
      events: simulation.events
    });
    const benchmarkEncounterHpRatio = simulation.player.maxHp > 0
      ? simulation.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0) / simulation.player.maxHp
      : 0;

    args.accumulator.benchmarkPlayerActionTurnTotals[levelBand] += benchmarkActionMetrics.playerActionTurns;
    args.accumulator.benchmarkPlayerActionTurnCounts[levelBand] += 1;
    args.accumulator.benchmarkEnemyActionTurnTotals[levelBand] += benchmarkActionMetrics.enemyActionTurns;
    args.accumulator.benchmarkEnemyActionTurnCounts[levelBand] += 1;
    args.accumulator.benchmarkPlayerStrikeTotals[levelBand] += benchmarkActionMetrics.playerStrikes;
    args.accumulator.benchmarkPlayerStrikeCounts[levelBand] += 1;
    args.accumulator.benchmarkEnemyStrikeTotals[levelBand] += benchmarkActionMetrics.enemyStrikes;
    args.accumulator.benchmarkEnemyStrikeCounts[levelBand] += 1;
    args.accumulator.benchmarkPlayerHpLossPercentTotals[levelBand] += benchmarkHpLossPercent;
    args.accumulator.benchmarkPlayerHpLossPercentCounts[levelBand] += 1;
    args.accumulator.benchmarkEncounterHpRatioTotals[levelBand] += benchmarkEncounterHpRatio;
    args.accumulator.benchmarkEncounterHpRatioCounts[levelBand] += 1;

    if (args.stats[levelBand].wins + args.stats[levelBand].losses > 0) {
      continue;
    }

    if (simulation.winnerSide === "player") {
      args.stats[levelBand].wins += 1;
    } else {
      args.stats[levelBand].losses += 1;
    }
  }
}

function createInitialBoardSlots(): SimulatedBoardSlot[] {
  return Array.from({ length: CONTRACT_SLOT_COUNT }, (_, index) => ({
    slotIndex: index + 1,
    state: "replenishing" as const,
    encounter: null,
    expiresAtSeconds: null,
    replenishAtSeconds: 0,
    replenishCount: 0,
    expireCount: 0
  }));
}

function buildSimulatedBoardEncounter(args: {
  playerClass: PlayerClass;
  playerLevel: number;
  sampleIndex: number;
  policy: ArchetypePolicy;
  slotIndex: number;
  replenishCount: number;
  replenishAtSeconds: number;
}): EncounterDefinition {
  const rng = createSeededRng(
    `${args.policy.archetype}:${args.playerClass}:board:${args.sampleIndex}:${args.playerLevel}:slot:${args.slotIndex}:replenish:${args.replenishCount}:${formatSeedTime(args.replenishAtSeconds)}`
  );

  return buildEncounterDefinition(
    rng,
    {
      playerId: `sim_${args.playerClass}_${args.sampleIndex}`,
      playerLevel: args.playerLevel,
      playerClass: args.playerClass
    },
    args.slotIndex
  );
}

function buildAvailabilityExpirySeconds(rng: () => number, nowSeconds: number): number {
  return nowSeconds + randomInt(
    rng,
    Math.round(CONTRACT_AVAILABILITY_WINDOW.minMs / 1000),
    Math.round(CONTRACT_AVAILABILITY_WINDOW.maxMs / 1000)
  );
}

function buildReplenishAtSeconds(rng: () => number, nowSeconds: number, level: number): number {
  const pacing = getContractReplenishPacingRow(level);
  return nowSeconds + randomInt(rng, pacing.replenishMinSeconds, pacing.replenishMaxSeconds);
}

function refreshSimulatedBoardState(args: {
  slots: SimulatedBoardSlot[];
  nowSeconds: number;
  playerClass: PlayerClass;
  level: number;
  sampleIndex: number;
  policy: ArchetypePolicy;
}): void {
  for (const slot of args.slots) {
    if (slot.state === "traveling") {
      continue;
    }

    if (slot.state === "available" && slot.expiresAtSeconds !== null && slot.expiresAtSeconds <= args.nowSeconds) {
      const expireRng = createSeededRng(
        `${args.policy.archetype}:${args.playerClass}:board:${args.sampleIndex}:${args.level}:slot:${slot.slotIndex}:expire:${slot.expireCount}:${formatSeedTime(slot.expiresAtSeconds)}`
      );
      slot.expireCount += 1;
      slot.state = "replenishing";
      slot.encounter = null;
      slot.expiresAtSeconds = null;
      slot.replenishAtSeconds = buildReplenishAtSeconds(expireRng, args.nowSeconds, args.level);
      continue;
    }

    if (slot.state === "replenishing" && slot.replenishAtSeconds !== null && slot.replenishAtSeconds <= args.nowSeconds) {
      const encounter = buildSimulatedBoardEncounter({
        playerClass: args.playerClass,
        playerLevel: args.level,
        sampleIndex: args.sampleIndex,
        policy: args.policy,
        slotIndex: slot.slotIndex,
        replenishCount: slot.replenishCount,
        replenishAtSeconds: slot.replenishAtSeconds
      });
      const availabilityRng = createSeededRng(
        `${args.policy.archetype}:${args.playerClass}:board:${args.sampleIndex}:${args.level}:slot:${slot.slotIndex}:available:${slot.replenishCount}:${formatSeedTime(args.nowSeconds)}`
      );
      slot.replenishCount += 1;
      slot.state = "available";
      slot.encounter = encounter;
      slot.expiresAtSeconds = buildAvailabilityExpirySeconds(availabilityRng, args.nowSeconds);
      slot.replenishAtSeconds = null;
    }
  }
}

function pickAvailableBoardSlot(args: {
  policy: ArchetypePolicy;
  stats: BandStats;
  slots: SimulatedBoardSlot[];
  staminaCurrent: number;
  maxStamina: number;
}): SimulatedBoardSlot | null {
  const preferredBands = getPreferredBandsForPolicy(args.policy, args.stats);
  const reserveStamina = Math.floor(args.maxStamina * args.policy.staminaReserveRatio);

  const pickCandidate = (enforceReserve: boolean) => {
    for (const levelBand of preferredBands) {
      const candidates = args.slots
        .filter((slot) =>
          slot.state === "available" &&
          slot.encounter !== null &&
          slot.encounter.levelBand === levelBand &&
          args.staminaCurrent >= slot.encounter.rewardPreview.staminaCost &&
          (!enforceReserve || args.staminaCurrent - slot.encounter.rewardPreview.staminaCost >= reserveStamina)
        )
        .sort((left, right) => {
          const leftExpiry = left.expiresAtSeconds ?? Number.POSITIVE_INFINITY;
          const rightExpiry = right.expiresAtSeconds ?? Number.POSITIVE_INFINITY;
          if (leftExpiry !== rightExpiry) {
            return leftExpiry - rightExpiry;
          }

          const rewardDelta = (right.encounter?.rewardPreview.experienceMax ?? 0) - (left.encounter?.rewardPreview.experienceMax ?? 0);
          if (rewardDelta !== 0) {
            return rewardDelta;
          }

          return left.slotIndex - right.slotIndex;
        });

      if (candidates[0]) {
        return candidates[0];
      }
    }

    return null;
  };

  return pickCandidate(true) ?? pickCandidate(false);
}

function getSecondsUntilNextBoardChange(slots: SimulatedBoardSlot[], nowSeconds: number): number {
  let nextChangeAt = Number.POSITIVE_INFINITY;

  for (const slot of slots) {
    const candidate =
      slot.state === "available" ? slot.expiresAtSeconds :
      slot.state === "replenishing" ? slot.replenishAtSeconds :
      null;

    if (candidate !== null && candidate > nowSeconds) {
      nextChangeAt = Math.min(nextChangeAt, candidate);
    }
  }

  return Number.isFinite(nextChangeAt) ? Math.max(0, nextChangeAt - nowSeconds) : Number.POSITIVE_INFINITY;
}

function averageBandValues(values: BandRecord<number>, divisor: number): DeveloperContractSimulationBandAverages {
  return {
    under_level: roundToTwo(values.under_level / divisor),
    on_level: roundToTwo(values.on_level / divisor),
    over_level: roundToTwo(values.over_level / divisor)
  };
}

function averageBandValuesByCounts(
  totals: BandRecord<number>,
  counts: BandRecord<number>
): DeveloperContractSimulationBandAverages {
  return {
    under_level: counts.under_level > 0 ? roundToTwo(totals.under_level / counts.under_level) : 0,
    on_level: counts.on_level > 0 ? roundToTwo(totals.on_level / counts.on_level) : 0,
    over_level: counts.over_level > 0 ? roundToTwo(totals.over_level / counts.over_level) : 0
  };
}

function averageBandPercentages(
  totals: BandRecord<number>,
  counts: BandRecord<number>
): DeveloperContractSimulationLevelSummary["avgPlayerHpLossPercentByBand"] {
  return {
    under_level: counts.under_level > 0 ? roundToTwo(totals.under_level / counts.under_level) : 0,
    on_level: counts.on_level > 0 ? roundToTwo(totals.on_level / counts.on_level) : 0,
    over_level: counts.over_level > 0 ? roundToTwo(totals.over_level / counts.over_level) : 0
  };
}

function buildBenchmarkTargetBandHitRate(
  levels: DeveloperContractSimulationLevelSummary[]
): DeveloperContractSimulationBandHitRate {
  if (levels.length === 0) {
    return createZeroBandHitRate();
  }

  const hits = createNumberBandRecord();
  for (const level of levels) {
    for (const levelBand of CONTRACT_LEVEL_BANDS) {
      if (isWithinTargetBand(levelBand, level.avgPlayerHpLossPercentByBand[levelBand])) {
        hits[levelBand] += 1;
      }
    }
  }

  return {
    under_level: roundToTwo(hits.under_level / levels.length),
    on_level: roundToTwo(hits.on_level / levels.length),
    over_level: roundToTwo(hits.over_level / levels.length)
  };
}

function buildBenchmarkTurnTargetHitRate(
  levels: DeveloperContractSimulationLevelSummary[]
): DeveloperContractSimulationBandHitRate {
  if (levels.length === 0) {
    return createZeroBandHitRate();
  }

  const hits = createNumberBandRecord();
  for (const level of levels) {
    for (const levelBand of CONTRACT_LEVEL_BANDS) {
      if (
        isWithinActionTurnTargetBand(levelBand, level.avgPlayerActionTurnsByBand[levelBand]) &&
        isWithinActionTurnTargetBand(levelBand, level.avgEnemyActionTurnsByBand[levelBand])
      ) {
        hits[levelBand] += 1;
      }
    }
  }

  return {
    under_level: roundToTwo(hits.under_level / levels.length),
    on_level: roundToTwo(hits.on_level / levels.length),
    over_level: roundToTwo(hits.over_level / levels.length)
  };
}

function buildLevelSummary(args: {
  level: number;
  sampleSize: number;
  accumulator: LevelAccumulator;
}): DeveloperContractSimulationLevelSummary {
  const totalUnderAttempts = args.accumulator.wins.under_level + args.accumulator.losses.under_level;
  const totalOnAttempts = args.accumulator.wins.on_level + args.accumulator.losses.on_level;
  const totalOverAttempts = args.accumulator.wins.over_level + args.accumulator.losses.over_level;

  return developerContractSimulationLevelSummarySchema.parse({
    level: args.level,
    gearScore: Math.round(args.accumulator.gearScoreTotal / args.sampleSize),
    completedSamples: args.accumulator.completedSamples,
    completionRate: roundToTwo(args.accumulator.completedSamples / args.sampleSize),
    avgElapsedSecondsToClearLevel: roundToTwo(args.accumulator.elapsedSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgActivePlaySecondsToClearLevel: roundToTwo(args.accumulator.activePlaySecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgIdleSecondsToClearLevel: roundToTwo(args.accumulator.idleSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgStaminaWaitSecondsToClearLevel: roundToTwo(args.accumulator.staminaWaitSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgContractAvailabilityWaitSecondsToClearLevel: roundToTwo(
      args.accumulator.contractAvailabilityWaitSecondsTotal / Math.max(1, args.accumulator.completedSamples)
    ),
    avgFightsToClearLevel: roundToTwo(args.accumulator.fightsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgWinsByBand: averageBandValues(args.accumulator.wins, Math.max(1, args.accumulator.completedSamples)),
    avgLossesByBand: averageBandValues(args.accumulator.losses, Math.max(1, args.accumulator.completedSamples)),
    winRateByBand: {
      under_level: totalUnderAttempts > 0 ? roundToTwo(args.accumulator.wins.under_level / totalUnderAttempts) : 0,
      on_level: totalOnAttempts > 0 ? roundToTwo(args.accumulator.wins.on_level / totalOnAttempts) : 0,
      over_level: totalOverAttempts > 0 ? roundToTwo(args.accumulator.wins.over_level / totalOverAttempts) : 0
    },
    avgXpPerFight: args.accumulator.fightsTotal > 0 ? roundToTwo(args.accumulator.experienceTotal / args.accumulator.fightsTotal) : 0,
    avgStaminaCostPerFight: args.accumulator.fightsTotal > 0 ? roundToTwo(args.accumulator.staminaSpentTotal / args.accumulator.fightsTotal) : 0,
    avgStaminaSpent: roundToTwo(args.accumulator.staminaSpentTotal / Math.max(1, args.accumulator.completedSamples)),
    avgRestCount: roundToTwo(args.accumulator.restCountTotal / Math.max(1, args.accumulator.completedSamples)),
    avgCombatSeconds: roundToTwo(args.accumulator.combatSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgInputOverheadSeconds: roundToTwo(args.accumulator.inputOverheadSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgPlayerAttackRoll: args.accumulator.playerAttackCountTotal > 0
      ? roundToTwo(args.accumulator.playerAttackRollTotal / args.accumulator.playerAttackCountTotal)
      : 0,
    avgPlayerHpLossPercent: args.accumulator.playerHpLossCountTotal > 0
      ? roundToTwo(args.accumulator.playerHpLossPercentTotal / args.accumulator.playerHpLossCountTotal)
      : 0,
    avgPlayerActionTurnsByBand: averageBandValuesByCounts(
      args.accumulator.benchmarkPlayerActionTurnTotals,
      args.accumulator.benchmarkPlayerActionTurnCounts
    ),
    avgEnemyActionTurnsByBand: averageBandValuesByCounts(
      args.accumulator.benchmarkEnemyActionTurnTotals,
      args.accumulator.benchmarkEnemyActionTurnCounts
    ),
    avgPlayerStrikesByBand: averageBandValuesByCounts(
      args.accumulator.benchmarkPlayerStrikeTotals,
      args.accumulator.benchmarkPlayerStrikeCounts
    ),
    avgEnemyStrikesByBand: averageBandValuesByCounts(
      args.accumulator.benchmarkEnemyStrikeTotals,
      args.accumulator.benchmarkEnemyStrikeCounts
    ),
    avgPlayerHpLossPercentByBand: averageBandPercentages(
      args.accumulator.benchmarkPlayerHpLossPercentTotals,
      args.accumulator.benchmarkPlayerHpLossPercentCounts
    ),
    avgEncounterHpToPlayerHpRatioByBand: averageBandValuesByCounts(
      args.accumulator.benchmarkEncounterHpRatioTotals,
      args.accumulator.benchmarkEncounterHpRatioCounts
    )
  });
}

function buildCumulativeElapsedDaysByArchetype(result: DeveloperContractSimulationResult) {
  return Object.fromEntries(result.archetypes.map((archetypeResult) => {
    let cumulativeElapsedSeconds = 0;
    return [
      archetypeResult.archetype,
      archetypeResult.levels.map((level) => {
        cumulativeElapsedSeconds += level.avgElapsedSecondsToClearLevel;
        return {
          level: level.level,
          cumulativeElapsedDays: roundToTwo(cumulativeElapsedSeconds / 86400)
        };
      })
    ];
  })) as SimulationArtifactPayload["derived"]["cumulativeElapsedDaysByArchetype"];
}

async function writeSimulationArtifact(args: {
  jobId: string;
  config: DeveloperContractSimulationJob["config"];
  result: DeveloperContractSimulationResult;
}): Promise<string> {
  await mkdir(SIMULATION_ARTIFACT_DIR, { recursive: true });
  const payload: SimulationArtifactPayload = {
    artifactVersion: 6,
    generatedAt: new Date().toISOString(),
    jobId: args.jobId,
    config: args.config,
    mitigation: {
      floorBps: COMBAT_MITIGATION_FLOOR_BPS,
      maxMitigationBps: COMBAT_MITIGATION_MAX_BPS,
      scaleMultiplier: COMBAT_MITIGATION_SCALE_MULTIPLIER
    },
    result: args.result,
    derived: {
      cumulativeElapsedDaysByArchetype: buildCumulativeElapsedDaysByArchetype(args.result),
      benchmarkTargetBandHitRateByArchetype: Object.fromEntries(
        args.result.archetypes.map((entry) => [entry.archetype, entry.benchmarkTargetBandHitRateByBand])
      ) as SimulationArtifactPayload["derived"]["benchmarkTargetBandHitRateByArchetype"],
      benchmarkTurnTargetHitRateByArchetype: Object.fromEntries(
        args.result.archetypes.map((entry) => [entry.archetype, entry.benchmarkTurnTargetHitRateByBand])
      ) as SimulationArtifactPayload["derived"]["benchmarkTurnTargetHitRateByArchetype"]
    }
  };
  const filePath = resolve(SIMULATION_ARTIFACT_DIR, `contracts-simulation-${args.jobId}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

async function runSimulationJob(jobId: string): Promise<void> {
  try {
    const current = simulationJobs.get(jobId);
    if (!current) {
      return;
    }
    current.status = "running";
    const result = await simulateDeveloperContractProgression({
      body: current.config,
      onProgress: (progress) => {
        const next = simulationJobs.get(jobId);
        if (!next) {
          return;
        }
        next.progress = progress;
      }
    });
    const latest = simulationJobs.get(jobId);
    if (!latest) {
      return;
    }
    latest.status = "completed";
    latest.finishedAt = new Date().toISOString();
    latest.progress = {
      totalSamples: latest.config.sampleSize * ARCHETYPE_POLICIES.length,
      completedSamples: latest.config.sampleSize * ARCHETYPE_POLICIES.length,
      currentArchetype: null,
      currentLevel: null,
      currentSampleIndex: null
    };
    latest.result = result;
    latest.artifactPath = await writeSimulationArtifact({
      jobId,
      config: latest.config,
      result
    });
  } catch (error) {
    const latest = simulationJobs.get(jobId);
    if (!latest) {
      return;
    }
    latest.status = "failed";
    latest.finishedAt = new Date().toISOString();
    latest.error = error instanceof Error ? error.message : "Simulation failed.";
  }
}

export async function runDeveloperContractSimulationToArtifact(body: RunDeveloperContractSimulationBody): Promise<{
  artifactPath: string;
  config: DeveloperContractSimulationJob["config"];
  jobId: string;
  result: DeveloperContractSimulationResult;
}> {
  const parsed = runDeveloperContractSimulationBodySchema.parse(body);
  const result = await simulateDeveloperContractProgression({ body: parsed });
  const jobId = `ctrsim_${randomUUID().replaceAll("-", "")}`;
  const config = {
    playerClass: parsed.playerClass,
    sampleSize: parsed.sampleSize,
    maxLevel: Math.min(parsed.maxLevel ?? playerProgressionConfig.maxLevel, playerProgressionConfig.maxLevel)
  };
  const artifactPath = await writeSimulationArtifact({ jobId, config, result });
  return { artifactPath, config, jobId, result };
}

export function runExactDeltaSimulationAudit(args: {
  playerClass: PlayerClass;
  playerLevel: number;
  sampleSize: number;
  minDelta?: number;
  maxDelta?: number;
}): ExactDeltaSimulationAuditPoint[] {
  const minDelta = args.minDelta ?? -6;
  const maxDelta = args.maxDelta ?? 6;
  const playerState = createExpectedPlayerState({
    playerClass: args.playerClass,
    level: args.playerLevel
  });
  const expectedMetrics = getExpectedPlayerCombatMetrics({
    playerClass: args.playerClass,
    level: args.playerLevel
  });
  const audit: ExactDeltaSimulationAuditPoint[] = [];

  for (let levelDelta = minDelta; levelDelta <= maxDelta; levelDelta += 1) {
    const encounterLevel = Math.max(1, Math.min(100, args.playerLevel + levelDelta));
    let wins = 0;
    let totalHpLossPercent = 0;
    let totalActionRounds = 0;
    let totalPlayerActionTurns = 0;
    let totalEnemyActionTurns = 0;
    let totalPlayerStrikes = 0;
    let totalEnemyStrikes = 0;
    let totalEnemyHp = 0;
    let totalEnemyHitSize = 0;

    for (let sampleIndex = 0; sampleIndex < args.sampleSize; sampleIndex += 1) {
      const encounter = buildEncounterDefinitionForLevel(
        createSeededRng(`audit:${args.playerClass}:${args.playerLevel}:${encounterLevel}:${sampleIndex}`),
        {
          playerId: playerState.playerId,
          playerLevel: args.playerLevel,
          playerClass: args.playerClass
        },
        encounterLevel
      );
      const simulation = simulateEncounter({
        playerState,
        playerName: "Simulator",
        encounter,
        runId: `audit:${args.playerClass}:${args.playerLevel}:${encounterLevel}:${sampleIndex}`
      });
      const actionMetrics = getFightActionMetrics({
        playerId: simulation.player.id,
        events: simulation.events
      });
      const hpAfter = getFightPlayerHealthAfter({
        playerId: simulation.player.id,
        events: simulation.events,
        maxHealth: playerState.health.max
      });
      totalHpLossPercent += ((playerState.health.max - hpAfter) / Math.max(1, playerState.health.max)) * 100;
      totalActionRounds += actionMetrics.playerActionTurns + actionMetrics.enemyActionTurns;
      totalPlayerActionTurns += actionMetrics.playerActionTurns;
      totalEnemyActionTurns += actionMetrics.enemyActionTurns;
      totalPlayerStrikes += actionMetrics.playerStrikes;
      totalEnemyStrikes += actionMetrics.enemyStrikes;
      totalEnemyHp += simulation.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0);
      totalEnemyHitSize += simulation.enemies.reduce((sum, enemy) => sum + ((enemy.minDamage + enemy.maxDamage) / 2), 0) / Math.max(1, simulation.enemies.length);
      if (simulation.winnerSide === "player") {
        wins += 1;
      }
    }

    const averagePlayerActionTurns = totalPlayerActionTurns / Math.max(1, args.sampleSize);
    const averageEnemyActionTurns = totalEnemyActionTurns / Math.max(1, args.sampleSize);
    const averageEnemyHp = totalEnemyHp / Math.max(1, args.sampleSize);

    audit.push({
      playerLevel: args.playerLevel,
      encounterLevel,
      levelDelta,
      sampleSize: args.sampleSize,
      winRate: roundToTwo(wins / Math.max(1, args.sampleSize)),
      avgPlayerHpLossPercent: roundToTwo(totalHpLossPercent / Math.max(1, args.sampleSize)),
      avgTotalActionRounds: roundToTwo(totalActionRounds / Math.max(1, args.sampleSize)),
      avgPlayerActionTurns: roundToTwo(averagePlayerActionTurns),
      avgEnemyActionTurns: roundToTwo(averageEnemyActionTurns),
      avgEnemyToPlayerActionTurnRatio: roundToTwo(averageEnemyActionTurns / Math.max(1, averagePlayerActionTurns)),
      avgPlayerStrikes: roundToTwo(totalPlayerStrikes / Math.max(1, args.sampleSize)),
      avgEnemyStrikes: roundToTwo(totalEnemyStrikes / Math.max(1, args.sampleSize)),
      playerMaxHp: playerState.health.max,
      avgTotalEnemyHp: roundToTwo(averageEnemyHp),
      avgEnemyHpToPlayerHpRatio: roundToTwo(averageEnemyHp / Math.max(1, playerState.health.max)),
      avgEnemyHitSize: roundToTwo(totalEnemyHitSize / Math.max(1, args.sampleSize)),
      expectedPlayerMetrics: {
        gearScore: expectedMetrics.gearScore,
        ehp: roundToTwo(expectedMetrics.ehp),
        dps: roundToTwo(expectedMetrics.dps),
        tempo: roundToTwo(expectedMetrics.tempo)
      }
    });
  }

  return audit;
}

export function runMirrorPvpSimulationAudit(args: {
  playerClass: PlayerClass;
  playerLevel: number;
  sampleSize: number;
}): MirrorPvpSimulationAuditPoint {
  const playerState = createExpectedPlayerState({
    playerClass: args.playerClass,
    level: args.playerLevel
  });
  const playerActor = buildPlayerActorSnapshot({
    playerState,
    playerName: "Mirror Player"
  });
  const enemyActor = {
    ...playerActor,
    id: `enemy:${playerState.playerId}`,
    side: "enemy" as const,
    encounterOrder: 0,
    name: "Mirror Enemy"
  };
  let totalResolvedActions = 0;
  let totalWinnerHpLossPercent = 0;
  let totalMitigatedDamage = 0;
  let landedStrikeCount = 0;
  let firstActorWins = 0;

  for (let sampleIndex = 0; sampleIndex < args.sampleSize; sampleIndex += 1) {
    const events = simulateCombat({
      player: playerActor,
      enemies: [enemyActor],
      seed: `mirror-pvp:${args.playerClass}:${args.playerLevel}:${sampleIndex}`
    });
    const resolvedActions = events.filter(
      (event): event is Extract<(typeof events)[number], { type: "CombatActionResolved" }> => event.type === "CombatActionResolved"
    );
    const combatEnded = getCombatEndedEvent(events);
    if (!combatEnded) {
      continue;
    }

    totalResolvedActions += resolvedActions.length;
    for (const action of resolvedActions) {
      for (const strike of action.strikes) {
        if (!strike.hit) {
          continue;
        }
        totalMitigatedDamage += strike.mitigatedDamage;
        landedStrikeCount += 1;
      }
    }

    const winnerActorId = combatEnded.winnerSide === "player" ? playerActor.id : enemyActor.id;
    const winnerHealthAfter = getFightActorHealthAfter({
      actorId: winnerActorId,
      events,
      maxHealth: playerState.health.max
    });
    totalWinnerHpLossPercent += ((playerState.health.max - winnerHealthAfter) / Math.max(1, playerState.health.max)) * 100;

    const firstResolvedActorId = resolvedActions[0]?.actorId;
    if (
      (firstResolvedActorId === playerActor.id && combatEnded.winnerSide === "player") ||
      (firstResolvedActorId === enemyActor.id && combatEnded.winnerSide === "enemy")
    ) {
      firstActorWins += 1;
    }
  }

  const averageMitigatedHitSize = totalMitigatedDamage / Math.max(1, landedStrikeCount);

  return {
    playerLevel: args.playerLevel,
    sampleSize: args.sampleSize,
    avgResolvedActions: roundToTwo(totalResolvedActions / Math.max(1, args.sampleSize)),
    avgWinnerHpLossPercent: roundToTwo(totalWinnerHpLossPercent / Math.max(1, args.sampleSize)),
    avgMitigatedHitSize: roundToTwo(averageMitigatedHitSize),
    avgApproxHitsToKill: roundToTwo(playerState.health.max / Math.max(1, averageMitigatedHitSize)),
    firstActorWinRate: roundToTwo(firstActorWins / Math.max(1, args.sampleSize)),
    avgPlayerMaxHp: playerState.health.max
  };
}

export async function simulateDeveloperContractProgression(args: {
  body: RunDeveloperContractSimulationBody;
  onProgress?: (job: DeveloperContractSimulationJob["progress"]) => void;
}): Promise<DeveloperContractSimulationResult> {
  const body = runDeveloperContractSimulationBodySchema.parse(args.body);
  const maxLevel = Math.min(body.maxLevel ?? playerProgressionConfig.maxLevel, playerProgressionConfig.maxLevel);
  const sampleSize = body.sampleSize;
  const archetypeResults: DeveloperContractSimulationResult["archetypes"] = [];
  const totalSamples = ARCHETYPE_POLICIES.length * sampleSize;
  let completedSamples = 0;

  for (const policy of ARCHETYPE_POLICIES) {
    const levelAccumulators = new Map<number, LevelAccumulator>();
    for (let targetLevel = 2; targetLevel <= maxLevel; targetLevel += 1) {
      levelAccumulators.set(targetLevel, createLevelAccumulator());
    }

    for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex += 1) {
      for (let level = 1; level < maxLevel; level += 1) {
        const targetLevel = level + 1;
        args.onProgress?.({
          totalSamples,
          completedSamples,
          currentArchetype: policy.archetype,
          currentLevel: targetLevel,
          currentSampleIndex: sampleIndex + 1
        });

        const playerState = createExpectedPlayerState({
          playerClass: body.playerClass,
          level
        });
        const accumulator = levelAccumulators.get(targetLevel) ?? createLevelAccumulator();
        const observedBandStats = createBandStats();
        let activePlaySeconds = 0;
        let elapsedSeconds = 0;
        let idleSeconds = 0;
        let staminaWaitSecondsTotal = 0;
        let contractAvailabilityWaitSecondsTotal = 0;
        let fights = 0;
        let experienceIntoLevel = 0;
        let staminaCurrent = playerState.stamina.max;
        let currentHealth = playerState.health.max;
        let worldTimeSeconds = 0;
        let combatSeconds = 0;
        let inputOverheadSeconds = 0;
        let restCount = 0;
        let staminaSpent = 0;
        let playerAttackRollTotal = 0;
        let playerAttackCountTotal = 0;
        let playerHpLossPercentTotal = 0;
        let playerHpLossCountTotal = 0;
        const boardSlots = createInitialBoardSlots();

        const advanceWorldTime = (seconds: number, kind: "active" | "idle") => {
          if (seconds <= 0) {
            return;
          }
          staminaCurrent = calculateStaminaRegenForSeconds({
            level,
            staminaCurrent,
            staminaMax: playerState.stamina.max,
            elapsedSeconds: seconds
          });
          worldTimeSeconds += seconds;
          elapsedSeconds += seconds;
          if (kind === "active") {
            activePlaySeconds += seconds;
          } else {
            idleSeconds += seconds;
          }
        };

        accumulator.gearScoreTotal += playerState.gearScore;
        simulateBenchmarkBandMetrics({
          policy,
          playerClass: body.playerClass,
          playerState,
          level,
          sampleIndex,
          stats: observedBandStats,
          accumulator
        });

        while (experienceIntoLevel < playerState.experienceToNextLevel && fights < MAX_FIGHTS_PER_LEVEL) {
          refreshSimulatedBoardState({
            slots: boardSlots,
            nowSeconds: worldTimeSeconds,
            playerClass: body.playerClass,
            level,
            sampleIndex,
            policy
          });

          if (currentHealth <= Math.round(playerState.health.max * 0.35)) {
            restCount += 1;
            currentHealth = playerState.health.max;
            advanceWorldTime(policy.restOverheadSeconds, "idle");
            continue;
          }

          const selectedSlot = pickAvailableBoardSlot({
            policy,
            stats: observedBandStats,
            slots: boardSlots,
            staminaCurrent,
            maxStamina: playerState.stamina.max
          });

          if (!selectedSlot || !selectedSlot.encounter) {
            const nextBoardChangeSeconds = getSecondsUntilNextBoardChange(boardSlots, worldTimeSeconds);
            const availableCosts = boardSlots
              .filter((slot) => slot.state === "available" && slot.encounter !== null)
              .map((slot) => slot.encounter!.rewardPreview.staminaCost)
              .sort((left, right) => left - right);
            const cheapestAvailableCost = availableCosts[0];
            const regenPerSecond = Math.max(0.0001, ((playerState.stamina.max * resolveStaminaRegenPercentPerHour(level)) / 100) / 3600);
            const secondsToStamina = typeof cheapestAvailableCost === "number" && staminaCurrent < cheapestAvailableCost
              ? (cheapestAvailableCost - staminaCurrent) / regenPerSecond
              : Number.POSITIVE_INFINITY;
            const waitSeconds = Math.max(1, Math.ceil(Math.min(nextBoardChangeSeconds, secondsToStamina)));
            advanceWorldTime(waitSeconds, "idle");
            if (Number.isFinite(secondsToStamina) && secondsToStamina <= nextBoardChangeSeconds) {
              staminaWaitSecondsTotal += waitSeconds;
            } else {
              contractAvailabilityWaitSecondsTotal += waitSeconds;
            }
            continue;
          }

          staminaCurrent = Math.max(0, staminaCurrent - selectedSlot.encounter.rewardPreview.staminaCost);
          staminaSpent += selectedSlot.encounter.rewardPreview.staminaCost;
          selectedSlot.state = "traveling";
          const encounter = selectedSlot.encounter;
          selectedSlot.encounter = null;
          selectedSlot.expiresAtSeconds = null;
          selectedSlot.replenishAtSeconds = null;

          advanceWorldTime(resolveContractTravelDurationSeconds(level, SHARED_EFFICIENCY_TIER), "idle");

          const fightState: PlayerState = {
            ...playerState,
            health: {
              current: currentHealth,
              max: playerState.health.max,
              nextPointAt: null
            },
            stamina: {
              current: Math.floor(staminaCurrent),
              max: playerState.stamina.max,
              nextPointAt: null
            }
          };

          const simulation = simulateEncounter({
            playerState: fightState,
            playerName: "Simulator",
            encounter,
            runId: `${policy.archetype}:${body.playerClass}:run:${sampleIndex}:${level}:${fights}`
          });
          const won = simulation.winnerSide === "player";
          const fightCombatSeconds = getFightCombatSeconds(simulation.events);
          const playerAttackMetrics = getFightPlayerAttackMetrics({
            playerId: simulation.player.id,
            events: simulation.events
          });

          fights += 1;
          combatSeconds += fightCombatSeconds;
          inputOverheadSeconds += policy.fightOverheadSeconds;
          advanceWorldTime(fightCombatSeconds + policy.fightOverheadSeconds, "active");
          currentHealth = getFightPlayerHealthAfter({
            playerId: simulation.player.id,
            events: simulation.events,
            maxHealth: playerState.health.max
          });
          const fightHpLossPercent = getFightPlayerHpLossPercent({
            playerId: simulation.player.id,
            events: simulation.events,
            maxHealth: playerState.health.max
          });
          playerAttackRollTotal += playerAttackMetrics.totalRawDamage;
          playerAttackCountTotal += playerAttackMetrics.landedStrikes;
          playerHpLossPercentTotal += fightHpLossPercent;
          playerHpLossCountTotal += 1;

          const replenishRng = createSeededRng(
            `${policy.archetype}:${body.playerClass}:board:${sampleIndex}:${level}:slot:${selectedSlot.slotIndex}:claim:${selectedSlot.replenishCount}:${formatSeedTime(worldTimeSeconds)}`
          );
          selectedSlot.state = "replenishing";
          selectedSlot.replenishAtSeconds = buildReplenishAtSeconds(replenishRng, worldTimeSeconds, level);

          if (won) {
            observedBandStats[encounter.levelBand].wins += 1;
            experienceIntoLevel += simulation.rewards.experience;
            accumulator.wins[encounter.levelBand] += 1;
            accumulator.experienceTotal += simulation.rewards.experience;
          } else {
            observedBandStats[encounter.levelBand].losses += 1;
            accumulator.losses[encounter.levelBand] += 1;
          }
        }

        if (experienceIntoLevel >= playerState.experienceToNextLevel) {
          accumulator.completedSamples += 1;
          accumulator.elapsedSecondsTotal += elapsedSeconds;
          accumulator.activePlaySecondsTotal += activePlaySeconds;
          accumulator.idleSecondsTotal += idleSeconds;
          accumulator.staminaWaitSecondsTotal += staminaWaitSecondsTotal;
          accumulator.contractAvailabilityWaitSecondsTotal += contractAvailabilityWaitSecondsTotal;
          accumulator.fightsTotal += fights;
          accumulator.staminaSpentTotal += staminaSpent;
          accumulator.restCountTotal += restCount;
          accumulator.combatSecondsTotal += combatSeconds;
          accumulator.inputOverheadSecondsTotal += inputOverheadSeconds;
          accumulator.playerAttackRollTotal += playerAttackRollTotal;
          accumulator.playerAttackCountTotal += playerAttackCountTotal;
          accumulator.playerHpLossPercentTotal += playerHpLossPercentTotal;
          accumulator.playerHpLossCountTotal += playerHpLossCountTotal;
        }

        levelAccumulators.set(targetLevel, accumulator);
      }

      completedSamples += 1;
    }

    const levels = Array.from(levelAccumulators.entries())
      .map(([level, accumulator]) => buildLevelSummary({ level, sampleSize, accumulator }))
      .filter((level) => level.level <= maxLevel);

    archetypeResults.push({
      archetype: policy.archetype,
      benchmarkTargetBandHitRateByBand: buildBenchmarkTargetBandHitRate(levels),
      benchmarkTurnTargetHitRateByBand: buildBenchmarkTurnTargetHitRate(levels),
      levels
    });
  }

  return {
    playerClass: body.playerClass,
    sampleSize,
    maxLevel,
    archetypes: archetypeResults
  };
}

export function createDeveloperContractSimulationJob(body: RunDeveloperContractSimulationBody): DeveloperContractSimulationJob {
  const parsed = runDeveloperContractSimulationBodySchema.parse(body);
  evictExpiredJobs();

  const jobId = `ctrsim_${randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const config = {
    playerClass: parsed.playerClass,
    sampleSize: parsed.sampleSize,
    maxLevel: Math.min(parsed.maxLevel ?? playerProgressionConfig.maxLevel, playerProgressionConfig.maxLevel)
  };
  const job = developerContractSimulationJobSchema.parse({
    jobId,
    status: "queued",
    config,
    progress: {
      totalSamples: config.sampleSize * ARCHETYPE_POLICIES.length,
      completedSamples: 0,
      currentArchetype: null,
      currentLevel: null,
      currentSampleIndex: null
    },
    startedAt: now,
    finishedAt: null,
    artifactPath: null,
    error: null,
    result: null
  }) as JobRecord;
  job.createdAtMs = Date.now();

  simulationJobs.set(jobId, job);
  setTimeout(() => {
    void runSimulationJob(jobId);
  }, 0);
  return job;
}

export function getDeveloperContractSimulationJob(jobId: string): DeveloperContractSimulationJob | null {
  evictExpiredJobs();
  return simulationJobs.get(jobId) ?? null;
}

export function resetDeveloperContractSimulationJobsForTests(): void {
  simulationJobs.clear();
}
