import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  developerContractSimulationJobSchema,
  runDeveloperContractSimulationBodySchema,
  type ContractDifficulty,
  type ContractEfficiencyTier,
  type DeveloperContractSimulationArchetype,
  type DeveloperContractSimulationDifficultyAverages,
  type DeveloperContractSimulationJob,
  type DeveloperContractSimulationLevelSummary,
  type DeveloperContractSimulationResult,
  type RunDeveloperContractSimulationBody
} from "@ebonkeep/shared/combat";
import {
  allEquipmentSlotIds,
  type EquipmentSlotId,
  type PlayerClass
} from "@ebonkeep/shared/core";
import { type EquipmentState } from "@ebonkeep/shared/inventory";
import { type PlayerState } from "@ebonkeep/shared/player";

import {
  getContractReplenishPacingRow,
  resolveContractTravelDurationSeconds,
  resolveStaminaRegenPercentPerHour
} from "../../config/activity-pacing.js";
import { playerProgressionConfig, getExperienceToNextLevel } from "../player/progression-service.js";
import {
  buildPlayerStatSnapshot,
  computeGearScore,
  createEmptyEquipmentState
} from "../player/state-service.js";
import { rollInventoryItem } from "../inventory/item-service.js";
import {
  CONTRACT_DIFFICULTY_WINDOWS,
  CONTRACT_SLOT_COUNT,
  buildEncounterDefinition,
  buildEncounterDefinitionForDifficulty,
  createSeededRng,
  randomChoice,
  randomInt,
  type EncounterDefinition
} from "./data.js";
import { rollRewardItemSpec, simulateEncounter } from "./simulator.js";

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_JOBS = 10;
const MAX_FIGHTS_PER_LEVEL = 400;
const SIMULATION_ARTIFACT_DIR = resolve(process.cwd(), "artifacts", "contracts-simulations");
const STANDARD_SIMULATION_SLOTS = allEquipmentSlotIds.filter(
  (slotId): slotId is EquipmentSlotId =>
    slotId !== "vestige1" && slotId !== "vestige2" && slotId !== "vestige3"
);
const DEFAULT_WIN_RATE_BY_DIFFICULTY: Record<ContractDifficulty, number> = {
  easy: 0.9,
  medium: 0.7,
  hard: 0.55
};
const SHARED_EFFICIENCY_TIER: ContractEfficiencyTier = "standard_cost";
const SIMULATION_BASE_STATS = {
  strength: 12,
  intelligence: 8,
  dexterity: 10,
  vitality: 12,
  initiative: 10,
  luck: 9
} as const;
type ArchetypePolicy = {
  archetype: DeveloperContractSimulationArchetype;
  staminaReserveRatio: number;
  resumeStaminaRatio: number;
  fightOverheadSeconds: number;
  restOverheadSeconds: number;
  preferredDifficulties: ContractDifficulty[];
  syntheticEquipmentDifficulty: ContractDifficulty;
};

type DifficultyStats = Record<ContractDifficulty, { wins: number; losses: number }>;

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
  wins: Record<ContractDifficulty, number>;
  losses: Record<ContractDifficulty, number>;
  experienceTotal: number;
  staminaSpentTotal: number;
  restCountTotal: number;
  combatSecondsTotal: number;
  inputOverheadSecondsTotal: number;
  playerAttackRollTotal: number;
  playerAttackCountTotal: number;
  playerHpLossPercentTotal: number;
  playerHpLossCountTotal: number;
};

type JobRecord = DeveloperContractSimulationJob & {
  createdAtMs: number;
  artifactPath?: string | null;
};

type SimulationArtifactPayload = {
  artifactVersion: 1;
  generatedAt: string;
  jobId: string;
  config: DeveloperContractSimulationJob["config"];
  result: DeveloperContractSimulationResult;
  derived: {
    cumulativeElapsedDaysByArchetype: Record<
      DeveloperContractSimulationArchetype,
      Array<{
        level: number;
        cumulativeElapsedDays: number;
      }>
    >;
  };
};

const ARCHETYPE_POLICIES: ReadonlyArray<ArchetypePolicy> = [
  {
    archetype: "active",
    staminaReserveRatio: 0,
    resumeStaminaRatio: 0,
    fightOverheadSeconds: 5,
    restOverheadSeconds: 20,
    preferredDifficulties: ["hard", "medium", "easy"],
    syntheticEquipmentDifficulty: "hard"
  },
  {
    archetype: "average",
    staminaReserveRatio: 0.25,
    resumeStaminaRatio: 0.5,
    fightOverheadSeconds: 15,
    restOverheadSeconds: 40,
    preferredDifficulties: ["medium", "hard", "easy"],
    syntheticEquipmentDifficulty: "medium"
  },
  {
    archetype: "slow",
    staminaReserveRatio: 0.5,
    resumeStaminaRatio: 1,
    fightOverheadSeconds: 30,
    restOverheadSeconds: 60,
    preferredDifficulties: ["easy", "medium", "hard"],
    syntheticEquipmentDifficulty: "easy"
  }
];

const simulationJobs = new Map<string, JobRecord>();

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
    wins: { easy: 0, medium: 0, hard: 0 },
    losses: { easy: 0, medium: 0, hard: 0 },
    experienceTotal: 0,
    staminaSpentTotal: 0,
    restCountTotal: 0,
    combatSecondsTotal: 0,
    inputOverheadSecondsTotal: 0,
    playerAttackRollTotal: 0,
    playerAttackCountTotal: 0,
    playerHpLossPercentTotal: 0,
    playerHpLossCountTotal: 0
  };
}

function isJobTerminal(job: JobRecord): boolean {
  return job.status === "completed" || job.status === "failed";
}

function ensureJobCapacity(): void {
  const expiredCutoff = Date.now() - JOB_TTL_MS;
  for (const [jobId, job] of simulationJobs) {
    if (job.createdAtMs < expiredCutoff && isJobTerminal(job)) {
      simulationJobs.delete(jobId);
    }
  }

  if (simulationJobs.size < MAX_STORED_JOBS) {
    return;
  }

  const oldestJob = [...simulationJobs.values()]
    .filter(isJobTerminal)
    .sort((left, right) => left.createdAtMs - right.createdAtMs)[0];
  if (oldestJob) {
    simulationJobs.delete(oldestJob.jobId);
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
  difficulty: ContractDifficulty;
}): EquipmentState {
  const equipment = createEmptyEquipmentState();

  for (const slotId of STANDARD_SIMULATION_SLOTS) {
    const rewardItem = rollRewardItemSpec({
      rng: createSeededRng(`${args.seed}:${slotId}:reward-roll`),
      playerClass: args.playerClass,
      encounterLevel: args.level,
      difficulty: args.difficulty,
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
      max: maxHealth
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
      imperials: 0
    }
  };
}

function formatSeedTime(seconds: number): string {
  return seconds.toFixed(2);
}

function calculateStaminaWaitSeconds(args: {
  level: number;
  currentStamina: number;
  targetStamina: number;
  maxStamina: number;
}): number {
  const clampedTarget = Math.max(args.currentStamina, Math.min(args.maxStamina, args.targetStamina));
  const missingStamina = Math.max(0, clampedTarget - args.currentStamina);
  if (missingStamina <= 0) {
    return 0;
  }

  const regenPercentPerHour = Math.max(0, resolveStaminaRegenPercentPerHour(args.level));
  const regenPerHour = (args.maxStamina * regenPercentPerHour) / 100;
  if (regenPerHour <= 0) {
    return 0;
  }

  return missingStamina * (3600 / regenPerHour);
}

function calculateStaminaRegenForSeconds(args: {
  level: number;
  elapsedSeconds: number;
  maxStamina: number;
}): number {
  if (args.elapsedSeconds <= 0) {
    return 0;
  }

  const regenPercentPerHour = Math.max(0, resolveStaminaRegenPercentPerHour(args.level));
  const regenPerHour = (args.maxStamina * regenPercentPerHour) / 100;
  if (regenPerHour <= 0) {
    return 0;
  }

  return (regenPerHour / 3600) * args.elapsedSeconds;
}

function getFightCombatSeconds(events: ReturnType<typeof simulateEncounter>["events"]): number {
  return events[events.length - 1]?.timelineTime ?? 0;
}

function getFightPlayerHealthAfter(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
  maxHealth: number;
}): number {
  let currentHealth = args.maxHealth;
  for (const event of args.events) {
    if (event.type !== "CombatActionResolved") {
      continue;
    }
    for (const strike of event.strikes) {
      if (strike.targetId === args.playerId) {
        currentHealth = strike.targetHpAfter;
      }
    }
  }
  return Math.max(0, Math.min(args.maxHealth, currentHealth));
}

function getFightPlayerAttackMetrics(args: {
  playerId: string;
  events: ReturnType<typeof simulateEncounter>["events"];
}): {
  totalRawDamage: number;
  landedStrikes: number;
} {
  let totalRawDamage = 0;
  let landedStrikes = 0;

  for (const event of args.events) {
    if (event.type !== "CombatActionResolved" || event.actorId !== args.playerId) {
      continue;
    }

    for (const strike of event.strikes) {
      if (!strike.hit) {
        continue;
      }
      totalRawDamage += strike.rawDamage;
      landedStrikes += 1;
    }
  }

  return {
    totalRawDamage,
    landedStrikes
  };
}

function getObservedWinRate(difficulty: ContractDifficulty, stats: DifficultyStats): number {
  const attempts = stats[difficulty].wins + stats[difficulty].losses;
  if (attempts === 0) {
    return DEFAULT_WIN_RATE_BY_DIFFICULTY[difficulty];
  }
  return stats[difficulty].wins / attempts;
}

function getPreferredDifficultiesForPolicy(policy: ArchetypePolicy, stats: DifficultyStats): ContractDifficulty[] {
  const uniqueDifficulties = policy.preferredDifficulties.filter(
    (difficulty, index, list) => list.indexOf(difficulty) === index
  );
  const explorationOrder: ContractDifficulty[] = ["easy", "medium", "hard"];
  const unattempted = explorationOrder.filter(
    (difficulty) => uniqueDifficulties.includes(difficulty) && stats[difficulty].wins + stats[difficulty].losses === 0
  );
  if (unattempted.length > 0) {
    return unattempted;
  }

  const attempted = uniqueDifficulties.filter((difficulty) => !unattempted.includes(difficulty));

  attempted.sort((left, right) => {
    const leftIndex = policy.preferredDifficulties.indexOf(left);
    const rightIndex = policy.preferredDifficulties.indexOf(right);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return getObservedWinRate(right, stats) - getObservedWinRate(left, stats);
  });

  return [...unattempted, ...attempted];
}

function simulateMissingDifficultyBenchmarks(args: {
  policy: ArchetypePolicy;
  playerClass: PlayerClass;
  playerState: PlayerState;
  level: number;
  sampleIndex: number;
  stats: DifficultyStats;
  accumulator: LevelAccumulator;
}): void {
  for (const difficulty of args.policy.preferredDifficulties) {
    if (args.stats[difficulty].wins + args.stats[difficulty].losses > 0) {
      continue;
    }

    const rng = createSeededRng(
      `${args.policy.archetype}:${args.playerClass}:benchmark:${args.sampleIndex}:${args.level}:${difficulty}`
    );
    const encounter = buildEncounterDefinitionForDifficulty(
      rng,
      {
        playerId: `sim_${args.playerClass}_${args.sampleIndex}`,
        playerLevel: args.level,
        playerClass: args.playerClass
      },
      difficulty
    );
    const simulation = simulateEncounter({
      encounter,
      playerState: args.playerState,
      playerName: "Warden",
      runId: `${args.policy.archetype}:${args.playerClass}:benchmark-fight:${args.sampleIndex}:${args.level}:${difficulty}`
    });

    if (simulation.winnerSide === "player") {
      args.stats[difficulty].wins += 1;
      args.accumulator.wins[difficulty] += 1;
      continue;
    }

    args.stats[difficulty].losses += 1;
    args.accumulator.losses[difficulty] += 1;
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

function buildAvailabilityExpirySeconds(rng: () => number, difficulty: ContractDifficulty, nowSeconds: number): number {
  const window = CONTRACT_DIFFICULTY_WINDOWS[difficulty];
  return nowSeconds + randomInt(rng, Math.round(window.minMs / 1000), Math.round(window.maxMs / 1000));
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
      slot.expiresAtSeconds = buildAvailabilityExpirySeconds(availabilityRng, encounter.difficulty, args.nowSeconds);
      slot.replenishAtSeconds = null;
    }
  }
}

function pickAvailableBoardSlot(args: {
  policy: ArchetypePolicy;
  stats: DifficultyStats;
  slots: SimulatedBoardSlot[];
  staminaCurrent: number;
  maxStamina: number;
}): SimulatedBoardSlot | null {
  const preferredDifficulties = getPreferredDifficultiesForPolicy(args.policy, args.stats);
  const reserveStamina = Math.floor(args.maxStamina * args.policy.staminaReserveRatio);

  const pickCandidate = (enforceReserve: boolean) => {
    for (const difficulty of preferredDifficulties) {
      const candidates = args.slots
        .filter((slot) =>
          slot.state === "available" &&
          slot.encounter !== null &&
          slot.encounter.difficulty === difficulty &&
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

function averageDifficultyValues(values: Record<ContractDifficulty, number>, divisor: number): DeveloperContractSimulationDifficultyAverages {
  return {
    easy: roundToTwo(values.easy / divisor),
    medium: roundToTwo(values.medium / divisor),
    hard: roundToTwo(values.hard / divisor)
  };
}

function buildLevelSummary(args: {
  level: number;
  sampleSize: number;
  accumulator: LevelAccumulator;
}): DeveloperContractSimulationLevelSummary {
  const totalEasyAttempts = args.accumulator.wins.easy + args.accumulator.losses.easy;
  const totalMediumAttempts = args.accumulator.wins.medium + args.accumulator.losses.medium;
  const totalHardAttempts = args.accumulator.wins.hard + args.accumulator.losses.hard;

  return {
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
    avgWinsByDifficulty: averageDifficultyValues(args.accumulator.wins, Math.max(1, args.accumulator.completedSamples)),
    avgLossesByDifficulty: averageDifficultyValues(args.accumulator.losses, Math.max(1, args.accumulator.completedSamples)),
    winRateByDifficulty: {
      easy: totalEasyAttempts > 0 ? roundToTwo(args.accumulator.wins.easy / totalEasyAttempts) : 0,
      medium: totalMediumAttempts > 0 ? roundToTwo(args.accumulator.wins.medium / totalMediumAttempts) : 0,
      hard: totalHardAttempts > 0 ? roundToTwo(args.accumulator.wins.hard / totalHardAttempts) : 0
    },
    avgXpPerFight: args.accumulator.fightsTotal > 0 ? roundToTwo(args.accumulator.experienceTotal / args.accumulator.fightsTotal) : 0,
    avgStaminaSpent: roundToTwo(args.accumulator.staminaSpentTotal / Math.max(1, args.accumulator.completedSamples)),
    avgRestCount: roundToTwo(args.accumulator.restCountTotal / Math.max(1, args.accumulator.completedSamples)),
    avgCombatSeconds: roundToTwo(args.accumulator.combatSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgInputOverheadSeconds: roundToTwo(args.accumulator.inputOverheadSecondsTotal / Math.max(1, args.accumulator.completedSamples)),
    avgPlayerAttackRoll: args.accumulator.playerAttackCountTotal > 0
      ? roundToTwo(args.accumulator.playerAttackRollTotal / args.accumulator.playerAttackCountTotal)
      : 0,
    avgPlayerHpLossPercent: args.accumulator.playerHpLossCountTotal > 0
      ? roundToTwo(args.accumulator.playerHpLossPercentTotal / args.accumulator.playerHpLossCountTotal)
      : 0
  };
}

function buildSimulationArtifactPayload(args: {
  jobId: string;
  config: DeveloperContractSimulationJob["config"];
  result: DeveloperContractSimulationResult;
}): SimulationArtifactPayload {
  const cumulativeElapsedDaysByArchetype = Object.fromEntries(
    args.result.archetypes.map((archetypeResult) => {
      let cumulativeElapsedSeconds = 0;
      return [
        archetypeResult.archetype,
        archetypeResult.levels.map((level) => {
          cumulativeElapsedSeconds += level.avgElapsedSecondsToClearLevel;
          return {
            level: level.level,
            cumulativeElapsedDays: roundToTwo(cumulativeElapsedSeconds / 86_400)
          };
        })
      ];
    })
  ) as SimulationArtifactPayload["derived"]["cumulativeElapsedDaysByArchetype"];

  return {
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    jobId: args.jobId,
    config: args.config,
    result: args.result,
    derived: {
      cumulativeElapsedDaysByArchetype
    }
  };
}

async function writeSimulationArtifact(args: {
  jobId: string;
  config: DeveloperContractSimulationJob["config"];
  result: DeveloperContractSimulationResult;
}): Promise<string> {
  await mkdir(SIMULATION_ARTIFACT_DIR, { recursive: true });
  const filePath = resolve(SIMULATION_ARTIFACT_DIR, `contracts-simulation-${args.jobId}.json`);
  const payload = buildSimulationArtifactPayload(args);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function runSimulationJob(jobId: string): Promise<void> {
  const job = simulationJobs.get(jobId);
  if (!job) {
    return;
  }

  try {
    job.status = "running";
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: job.config.playerClass,
        sampleSize: job.config.sampleSize,
        maxLevel: job.config.maxLevel
      },
      onProgress: (progress) => {
        const current = simulationJobs.get(jobId);
        if (!current) {
          return;
        }
        current.progress = progress;
      }
    });
    const current = simulationJobs.get(jobId);
    if (!current) {
      return;
    }
    current.status = "completed";
    current.finishedAt = new Date().toISOString();
    current.progress = {
      totalSamples: current.config.sampleSize * ARCHETYPE_POLICIES.length,
      completedSamples: current.config.sampleSize * ARCHETYPE_POLICIES.length,
      currentArchetype: null,
      currentLevel: null,
      currentSampleIndex: null
    };
    current.result = result;
    current.artifactPath = await writeSimulationArtifact({
      jobId,
      config: current.config,
      result
    });
  } catch (error) {
    const current = simulationJobs.get(jobId);
    if (!current) {
      return;
    }
    current.status = "failed";
    current.finishedAt = new Date().toISOString();
    current.error = error instanceof Error ? error.message : "Simulation failed.";
  }
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

        const gearSeed = `${body.playerClass}:gear:${sampleIndex}:${level}`;
        const equipment = buildSyntheticEquipment({
          playerClass: body.playerClass,
          level,
          seed: gearSeed,
          difficulty: policy.syntheticEquipmentDifficulty
        });
        const playerState = createSyntheticPlayerState({
          playerClass: body.playerClass,
          level,
          equipment
        });
        const accumulator = levelAccumulators.get(targetLevel) ?? createLevelAccumulator();
        const observedDifficultyStats: DifficultyStats = {
          easy: { wins: 0, losses: 0 },
          medium: { wins: 0, losses: 0 },
          hard: { wins: 0, losses: 0 }
        };
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

          const staminaRegen = calculateStaminaRegenForSeconds({
            level,
            elapsedSeconds: seconds,
            maxStamina: playerState.stamina.max
          });
          staminaCurrent = Math.min(playerState.stamina.max, staminaCurrent + staminaRegen);
          worldTimeSeconds += seconds;
          elapsedSeconds += seconds;

          if (kind === "active") {
            activePlaySeconds += seconds;
          } else {
            idleSeconds += seconds;
          }
        };

        while (experienceIntoLevel < playerState.experienceToNextLevel && fights < MAX_FIGHTS_PER_LEVEL) {
          refreshSimulatedBoardState({
            slots: boardSlots,
            nowSeconds: worldTimeSeconds,
            playerClass: body.playerClass,
            level,
            sampleIndex,
            policy
          });

          if (currentHealth <= 0) {
            restCount += 1;
            currentHealth = playerState.health.max;
            advanceWorldTime(policy.restOverheadSeconds, "active");
            refreshSimulatedBoardState({
              slots: boardSlots,
              nowSeconds: worldTimeSeconds,
              playerClass: body.playerClass,
              level,
              sampleIndex,
              policy
            });
          }

          const selectedSlot = pickAvailableBoardSlot({
            policy,
            stats: observedDifficultyStats,
            slots: boardSlots,
            staminaCurrent,
            maxStamina: playerState.stamina.max
          });

          if (!selectedSlot || !selectedSlot.encounter) {
            const preferredDifficulties = getPreferredDifficultiesForPolicy(policy, observedDifficultyStats);
            const availablePreferredSlots = boardSlots.filter((slot) =>
              slot.state === "available" &&
              slot.encounter !== null &&
              preferredDifficulties.includes(slot.encounter.difficulty)
            );
            const requiredStamina = availablePreferredSlots.reduce<number | null>((lowest, slot) => {
              const nextRequired = slot.encounter!.rewardPreview.staminaCost;
              return lowest === null ? nextRequired : Math.min(lowest, nextRequired);
            }, null);
            const nextBoardChangeSeconds = getSecondsUntilNextBoardChange(boardSlots, worldTimeSeconds);
            const staminaWaitSeconds = requiredStamina === null
              ? Number.POSITIVE_INFINITY
              : calculateStaminaWaitSeconds({
                  level,
                  currentStamina: staminaCurrent,
                  targetStamina: Math.max(requiredStamina, Math.ceil(playerState.stamina.max * policy.resumeStaminaRatio)),
                  maxStamina: playerState.stamina.max
                });
            const waitSeconds = Math.min(nextBoardChangeSeconds, staminaWaitSeconds);

            if (!Number.isFinite(waitSeconds) || waitSeconds <= 0) {
              break;
            }

            const boardHasPreferredContract = availablePreferredSlots.length > 0;
            const hasEnoughStaminaForPreferredContract = boardHasPreferredContract &&
              requiredStamina !== null &&
              staminaCurrent >= requiredStamina;

            if (boardHasPreferredContract && !hasEnoughStaminaForPreferredContract && staminaWaitSeconds <= nextBoardChangeSeconds) {
              staminaWaitSecondsTotal += waitSeconds;
            } else if (!boardHasPreferredContract && nextBoardChangeSeconds <= staminaWaitSeconds) {
              contractAvailabilityWaitSecondsTotal += waitSeconds;
            } else if (!boardHasPreferredContract && Number.isFinite(nextBoardChangeSeconds)) {
              contractAvailabilityWaitSecondsTotal += waitSeconds;
            } else if (boardHasPreferredContract && !hasEnoughStaminaForPreferredContract) {
              staminaWaitSecondsTotal += waitSeconds;
            }

            advanceWorldTime(waitSeconds, "idle");
            continue;
          }

          const encounter = selectedSlot.encounter;
          staminaCurrent = Math.max(0, staminaCurrent - encounter.rewardPreview.staminaCost);
          staminaSpent += encounter.rewardPreview.staminaCost;
          selectedSlot.state = "traveling";
          selectedSlot.encounter = null;
          selectedSlot.expiresAtSeconds = null;
          selectedSlot.replenishAtSeconds = null;

          const travelSeconds = resolveContractTravelDurationSeconds(level, encounter.rewardPreview.efficiencyTier);
          advanceWorldTime(travelSeconds, "idle");
          refreshSimulatedBoardState({
            slots: boardSlots,
            nowSeconds: worldTimeSeconds,
            playerClass: body.playerClass,
            level,
            sampleIndex,
            policy
          });

          const fightState: PlayerState = {
            ...playerState,
            health: {
              current: currentHealth,
              max: playerState.health.max
            },
            stamina: {
              current: staminaCurrent,
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
          const fightHpLossPercent = ((playerState.health.max - currentHealth) / playerState.health.max) * 100;
          playerAttackRollTotal += playerAttackMetrics.totalRawDamage;
          playerAttackCountTotal += playerAttackMetrics.landedStrikes;
          playerHpLossPercentTotal += fightHpLossPercent;
          playerHpLossCountTotal += 1;

          const replenishRng = createSeededRng(
            `${policy.archetype}:${body.playerClass}:board:${sampleIndex}:${level}:slot:${selectedSlot.slotIndex}:claim:${selectedSlot.replenishCount}:${formatSeedTime(worldTimeSeconds)}`
          );
          selectedSlot.state = "replenishing";
          selectedSlot.replenishAtSeconds = buildReplenishAtSeconds(replenishRng, worldTimeSeconds, level);
          refreshSimulatedBoardState({
            slots: boardSlots,
            nowSeconds: worldTimeSeconds,
            playerClass: body.playerClass,
            level,
            sampleIndex,
            policy
          });

          if (won) {
            observedDifficultyStats[encounter.difficulty].wins += 1;
            experienceIntoLevel += simulation.rewards.experience;
            accumulator.wins[encounter.difficulty] += 1;
            accumulator.experienceTotal += simulation.rewards.experience;
          } else {
            observedDifficultyStats[encounter.difficulty].losses += 1;
            accumulator.losses[encounter.difficulty] += 1;
          }
        }

        accumulator.gearScoreTotal += playerState.gearScore;
        simulateMissingDifficultyBenchmarks({
          policy,
          playerClass: body.playerClass,
          playerState,
          level,
          sampleIndex,
          stats: observedDifficultyStats,
          accumulator
        });
        const completedLevel = experienceIntoLevel >= playerState.experienceToNextLevel;
        if (completedLevel) {
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

        await yieldToEventLoop();
      }

      completedSamples += 1;
      args.onProgress?.({
        totalSamples,
        completedSamples,
        currentArchetype: policy.archetype,
        currentLevel: maxLevel,
        currentSampleIndex: sampleIndex + 1
      });
    }

    archetypeResults.push({
      archetype: policy.archetype,
      levels: Array.from(levelAccumulators.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([level, accumulator]) => buildLevelSummary({
          level,
          sampleSize,
          accumulator
        }))
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
  ensureJobCapacity();

  const parsed = runDeveloperContractSimulationBodySchema.parse(body);
  const maxLevel = Math.min(parsed.maxLevel ?? playerProgressionConfig.maxLevel, playerProgressionConfig.maxLevel);
  const jobId = `ctrsim_${randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const record = developerContractSimulationJobSchema.parse({
    jobId,
    status: "queued",
    config: {
      playerClass: parsed.playerClass,
      sampleSize: parsed.sampleSize,
      maxLevel
    },
    progress: {
      totalSamples: parsed.sampleSize * ARCHETYPE_POLICIES.length,
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
  });

  simulationJobs.set(jobId, {
    ...record,
    createdAtMs: Date.now()
  });

  void runSimulationJob(jobId);
  return record;
}

export function getDeveloperContractSimulationJob(jobId: string): DeveloperContractSimulationJob | null {
  const job = simulationJobs.get(jobId);
  if (!job) {
    return null;
  }

  return developerContractSimulationJobSchema.parse(job);
}

export function resetDeveloperContractSimulationJobsForTests(): void {
  simulationJobs.clear();
}
