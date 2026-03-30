import { z } from "zod";

import { playerClassSchema } from "../../core/index.js";

export const createCombatSessionBodySchema = z.object({
  mode: z.enum(["pve"]),
  enemyPackId: z.string().default("starter-pack")
});
export type CreateCombatSessionBody = z.infer<typeof createCombatSessionBodySchema>;

export const createCombatSessionResponseSchema = z.object({
  sessionId: z.string(),
  state: z.enum(["created", "active"]),
  turnTimerSeconds: z.number().int().min(1)
});
export type CreateCombatSessionResponse = z.infer<typeof createCombatSessionResponseSchema>;

export const combatActionBodySchema = z.object({
  sessionId: z.string(),
  actionType: z.enum(["basic_attack", "skill"]),
  targetId: z.string().optional(),
  skillId: z.string().optional()
});
export type CombatActionBody = z.infer<typeof combatActionBodySchema>;

export const combatActionResponseSchema = z.object({
  accepted: z.boolean(),
  actionId: z.string()
});
export type CombatActionResponse = z.infer<typeof combatActionResponseSchema>;

export const contractLevelBandSchema = z.enum(["under_level", "on_level", "over_level"]);
export type ContractLevelBand = z.infer<typeof contractLevelBandSchema>;

export const contractEfficiencyTierSchema = z.enum(["low_cost", "standard_cost", "high_cost"]);
export type ContractEfficiencyTier = z.infer<typeof contractEfficiencyTierSchema>;

export const contractBoardSlotStateSchema = z.enum(["available", "traveling", "ready_to_claim", "replenishing"]);
export type ContractBoardSlotState = z.infer<typeof contractBoardSlotStateSchema>;

export const contractRewardPreviewSchema = z.object({
  experienceMin: z.number().int().min(0),
  experienceMax: z.number().int().min(0),
  ducatsMin: z.number().int().min(0),
  ducatsMax: z.number().int().min(0),
  itemDropChanceBps: z.number().int().min(0).max(10000),
  staminaCost: z.number().int().min(0),
  efficiencyTier: contractEfficiencyTierSchema
});
export type ContractRewardPreview = z.infer<typeof contractRewardPreviewSchema>;

export const contractBoardSlotViewSchema = z.object({
  slotId: z.number().int().min(1),
  state: contractBoardSlotStateSchema,
  levelBand: contractLevelBandSchema.nullable(),
  familyId: z.string().nullable(),
  familyName: z.string().nullable(),
  contractName: z.string().nullable(),
  locationName: z.string().nullable(),
  encounterLevel: z.number().int().min(1).nullable(),
  enemyCount: z.number().int().min(1).nullable(),
  expiresAt: z.string().nullable(),
  replenishAt: z.string().nullable(),
  startedRunId: z.string().nullable(),
  rewardsPreview: contractRewardPreviewSchema.nullable()
});
export type ContractBoardSlotView = z.infer<typeof contractBoardSlotViewSchema>;

export const CONTRACT_SLOT_COUNT = 6;
export const MAX_CONTRACT_SLOT_COUNT = 8;

export const contractBoardResponseSchema = z.object({
  serverTime: z.string(),
  slots: z.array(contractBoardSlotViewSchema).min(1).max(MAX_CONTRACT_SLOT_COUNT)
});
export type ContractBoardResponse = z.infer<typeof contractBoardResponseSchema>;

export const combatActorSideSchema = z.enum(["player", "enemy"]);
export type CombatActorSide = z.infer<typeof combatActorSideSchema>;

export const combatDamageKindSchema = z.enum(["melee", "ranged", "spell"]);
export type CombatDamageKind = z.infer<typeof combatDamageKindSchema>;

export const COMBAT_MITIGATION_FLOOR_BPS = 500;
export const COMBAT_MITIGATION_MAX_BPS = 7500;
export const COMBAT_MITIGATION_SCALE_MULTIPLIER = 1.5;
export const PVE_LEVEL_DELTA_THRESHOLD = 4;
export const PVE_LEVEL_DELTA_MODIFIER_BPS = 1000;

export type CombatMitigationInput = {
  rawDamage: number;
  damageKind: CombatDamageKind;
  attacker: Pick<CombatActorSnapshot, "minDamage" | "maxDamage">;
  defender: Pick<CombatActorSnapshot, "armor" | "missileResistance" | "spellShield" | "physicalDefense" | "magicDefense">;
};

export type CombatMitigationResult = {
  typedDefense: number;
  bonusDefense: number;
  effectiveDefense: number;
  attackerPower: number;
  mitigationScale: number;
  mitigationPercentBps: number;
  postMitigationDamage: number;
  minimumDamage: number;
  finalDamage: number;
};

export type PveLevelDeltaModifier = {
  damageMultiplierBps: number;
  accuracyMultiplierBps: number;
};

export function clampCombatChanceBps(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getCombatMitigationStats(args: {
  damageKind: CombatDamageKind;
  defender: Pick<CombatActorSnapshot, "armor" | "missileResistance" | "spellShield" | "physicalDefense" | "magicDefense">;
}): Pick<CombatMitigationResult, "typedDefense" | "bonusDefense" | "effectiveDefense"> {
  const typedDefense =
    args.damageKind === "melee"
      ? args.defender.armor
      : args.damageKind === "ranged"
        ? args.defender.missileResistance
        : args.defender.spellShield;
  const bonusDefense = args.damageKind === "spell" ? args.defender.magicDefense : args.defender.physicalDefense;
  const effectiveDefense = Math.max(0, typedDefense + bonusDefense);

  return {
    typedDefense: Math.max(0, typedDefense),
    bonusDefense: Math.max(0, bonusDefense),
    effectiveDefense
  };
}

export function calculateCombatAttackerPower(attacker: Pick<CombatActorSnapshot, "minDamage" | "maxDamage">): number {
  return Math.max(1, Math.round((Math.max(0, attacker.minDamage) + Math.max(0, attacker.maxDamage)) / 2));
}

export function calculateCombatMitigation(input: CombatMitigationInput): CombatMitigationResult {
  const rawDamage = Math.max(0, input.rawDamage);
  const { typedDefense, bonusDefense, effectiveDefense } = getCombatMitigationStats({
    damageKind: input.damageKind,
    defender: input.defender
  });
  const attackerPower = calculateCombatAttackerPower(input.attacker);
  const mitigationScale = Math.max(1, Math.round(attackerPower * COMBAT_MITIGATION_SCALE_MULTIPLIER));
  const rawMitigationBps =
    effectiveDefense <= 0
      ? 0
      : Math.round((effectiveDefense / (effectiveDefense + mitigationScale)) * 10_000);
  const mitigationPercentBps = clampCombatChanceBps(rawMitigationBps, 0, COMBAT_MITIGATION_MAX_BPS);
  const postMitigationDamage = Math.max(0, Math.round((rawDamage * (10_000 - mitigationPercentBps)) / 10_000));
  const minimumDamage = rawDamage > 0
    ? Math.max(1, Math.floor((rawDamage * COMBAT_MITIGATION_FLOOR_BPS) / 10_000))
    : 0;

  return {
    typedDefense,
    bonusDefense,
    effectiveDefense,
    attackerPower,
    mitigationScale,
    mitigationPercentBps,
    postMitigationDamage,
    minimumDamage,
    finalDamage: rawDamage > 0 ? Math.max(minimumDamage, postMitigationDamage) : 0
  };
}

export function getPveLevelDeltaModifier(attackerLevel: number, defenderLevel: number): PveLevelDeltaModifier {
  const levelDelta = Math.round(attackerLevel) - Math.round(defenderLevel);

  if (levelDelta >= PVE_LEVEL_DELTA_THRESHOLD) {
    return {
      accuracyMultiplierBps: 10_000 + PVE_LEVEL_DELTA_MODIFIER_BPS,
      damageMultiplierBps: 10_000 + PVE_LEVEL_DELTA_MODIFIER_BPS
    };
  }

  if (levelDelta <= -PVE_LEVEL_DELTA_THRESHOLD) {
    return {
      accuracyMultiplierBps: 10_000 - PVE_LEVEL_DELTA_MODIFIER_BPS,
      damageMultiplierBps: 10_000 - PVE_LEVEL_DELTA_MODIFIER_BPS
    };
  }

  return {
    accuracyMultiplierBps: 10_000,
    damageMultiplierBps: 10_000
  };
}

export const combatActorSnapshotSchema = z.object({
  id: z.string(),
  side: combatActorSideSchema,
  encounterOrder: z.number().int().min(0),
  name: z.string(),
  familyId: z.string().nullable().optional(),
  monsterRole: z.string().nullable().optional(),
  level: z.number().int().min(1),
  maxHp: z.number().int().min(1),
  currentHp: z.number().int().min(0),
  combatSpeed: z.number().int().min(1),
  accuracy: z.number().int().min(0),
  dodgeChance: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  extraAttackChance: z.number().int().min(0),
  armor: z.number().int().min(0),
  spellShield: z.number().int().min(0),
  missileResistance: z.number().int().min(0),
  physicalDefense: z.number().int().min(0),
  magicDefense: z.number().int().min(0),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  damageKind: combatDamageKindSchema,
  avatarPath: z.string().nullable().optional(),
  combatBackgroundPath: z.string().nullable().optional(),
  travelImagePath: z.string().nullable().optional(),
  usesSilhouetteFallback: z.boolean().optional()
});
export type CombatActorSnapshot = z.infer<typeof combatActorSnapshotSchema>;

export const combatStrikeResultSchema = z.object({
  strikeIndex: z.number().int().min(1).max(5),
  targetId: z.string(),
  hit: z.boolean(),
  crit: z.boolean(),
  rawDamage: z.number().int().min(0),
  mitigatedDamage: z.number().int().min(0),
  targetHpAfter: z.number().int().min(0),
  killed: z.boolean()
});
export type CombatStrikeResult = z.infer<typeof combatStrikeResultSchema>;

export const combatStartedEventSchema = z.object({
  type: z.literal("CombatStarted"),
  sequence: z.number().int().min(1),
  timelineTime: z.number().nonnegative(),
  actors: z.array(combatActorSnapshotSchema).min(2)
});
export type CombatStartedEvent = z.infer<typeof combatStartedEventSchema>;

export const combatTurnStartedEventSchema = z.object({
  type: z.literal("CombatTurnStarted"),
  sequence: z.number().int().min(1),
  timelineTime: z.number().nonnegative(),
  actorId: z.string(),
  targetId: z.string().nullable()
});
export type CombatTurnStartedEvent = z.infer<typeof combatTurnStartedEventSchema>;

export const combatActionResolvedEventSchema = z.object({
  type: z.literal("CombatActionResolved"),
  sequence: z.number().int().min(1),
  timelineTime: z.number().nonnegative(),
  actorId: z.string(),
  actionType: z.literal("basic_attack"),
  strikes: z.array(combatStrikeResultSchema).min(1).max(5)
});
export type CombatActionResolvedEvent = z.infer<typeof combatActionResolvedEventSchema>;

export const combatActorDefeatedEventSchema = z.object({
  type: z.literal("CombatActorDefeated"),
  sequence: z.number().int().min(1),
  timelineTime: z.number().nonnegative(),
  actorId: z.string()
});
export type CombatActorDefeatedEvent = z.infer<typeof combatActorDefeatedEventSchema>;

export const combatEndedEventSchema = z.object({
  type: z.literal("CombatEnded"),
  sequence: z.number().int().min(1),
  timelineTime: z.number().nonnegative(),
  winnerSide: combatActorSideSchema
});
export type CombatEndedEvent = z.infer<typeof combatEndedEventSchema>;

export const combatEventSchema = z.discriminatedUnion("type", [
  combatStartedEventSchema,
  combatTurnStartedEventSchema,
  combatActionResolvedEventSchema,
  combatActorDefeatedEventSchema,
  combatEndedEventSchema
]);
export type CombatEvent = z.infer<typeof combatEventSchema>;

export const contractRunStateSchema = z.enum(["traveling", "ready_to_claim", "claimed"]);
export type ContractRunState = z.infer<typeof contractRunStateSchema>;

export const startContractRunResponseSchema = z.object({
  runId: z.string(),
  slotId: z.number().int().min(1),
  state: contractRunStateSchema,
  travelEndsAt: z.string(),
  travelDurationSeconds: z.number().int().min(1)
});
export type StartContractRunResponse = z.infer<typeof startContractRunResponseSchema>;

export const contractRunSnapshotSchema = z.object({
  runId: z.string(),
  slotId: z.number().int().min(1),
  state: contractRunStateSchema,
  contractName: z.string(),
  levelBand: contractLevelBandSchema,
  familyId: z.string(),
  familyName: z.string(),
  locationName: z.string(),
  encounterLevel: z.number().int().min(1),
  travelEndsAt: z.string(),
  travelDurationSeconds: z.number().int().min(1),
  player: combatActorSnapshotSchema,
  enemies: z.array(combatActorSnapshotSchema).min(1),
  combatBackgroundPath: z.string().nullable(),
  travelImagePath: z.string().nullable()
});
export type ContractRunSnapshot = z.infer<typeof contractRunSnapshotSchema>;

export const contractLootRewardSchema = z.object({
  itemId: z.string(),
  itemCode: z.string(),
  itemName: z.string(),
  rarity: z.string()
});
export type ContractLootReward = z.infer<typeof contractLootRewardSchema>;

export const contractRewardOutcomeSchema = z.object({
  experience: z.number().int().min(0),
  ducats: z.number().int().min(0),
  item: contractLootRewardSchema.nullable()
});
export type ContractRewardOutcome = z.infer<typeof contractRewardOutcomeSchema>;

export const contractRunResultSchema = z.object({
  run: contractRunSnapshotSchema,
  winnerSide: combatActorSideSchema,
  rewards: contractRewardOutcomeSchema,
  events: z.array(combatEventSchema).min(1),
  playerState: z
    .object({
      level: z.number().int().min(1),
      experience: z.number().int().min(0),
      experienceIntoLevel: z.number().int().min(0),
      experienceToNextLevel: z.number().int().min(1),
      health: z.object({
        current: z.number().int().min(0),
        max: z.number().int().min(1),
        nextPointAt: z.string().nullable()
      }),
      stamina: z.object({
        current: z.number().int().min(0),
        max: z.number().int().min(0),
        nextPointAt: z.string().nullable()
      }),
      ducats: z.number().int().min(0)
    })
    .optional()
});
export type ContractRunResult = z.infer<typeof contractRunResultSchema>;

export const developerContractSimulationArchetypeSchema = z.enum(["active", "average", "slow"]);
export type DeveloperContractSimulationArchetype = z.infer<typeof developerContractSimulationArchetypeSchema>;

export const developerContractSimulationJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type DeveloperContractSimulationJobStatus = z.infer<typeof developerContractSimulationJobStatusSchema>;

export const developerContractSimulationBandAveragesSchema = z.object({
  under_level: z.number().min(0),
  on_level: z.number().min(0),
  over_level: z.number().min(0)
});
export type DeveloperContractSimulationBandAverages = z.infer<typeof developerContractSimulationBandAveragesSchema>;

export const developerContractSimulationBandPercentagesSchema = z.object({
  under_level: z.number().min(0).max(100),
  on_level: z.number().min(0).max(100),
  over_level: z.number().min(0).max(100)
});
export type DeveloperContractSimulationBandPercentages = z.infer<typeof developerContractSimulationBandPercentagesSchema>;

export const developerContractSimulationBandHitRateSchema = z.object({
  under_level: z.number().min(0).max(1),
  on_level: z.number().min(0).max(1),
  over_level: z.number().min(0).max(1)
});
export type DeveloperContractSimulationBandHitRate = z.infer<typeof developerContractSimulationBandHitRateSchema>;

export const runDeveloperContractSimulationBodySchema = z.object({
  playerClass: playerClassSchema,
  sampleSize: z.number().int().min(1).max(1_000).default(100),
  maxLevel: z.number().int().min(1).max(100).optional()
});
export type RunDeveloperContractSimulationBody = z.infer<typeof runDeveloperContractSimulationBodySchema>;

export const developerContractSimulationLevelSummarySchema = z.object({
  level: z.number().int().min(1).max(100),
  gearScore: z.number().int().min(0),
  completedSamples: z.number().int().min(0),
  completionRate: z.number().min(0).max(1),
  avgElapsedSecondsToClearLevel: z.number().min(0),
  avgActivePlaySecondsToClearLevel: z.number().min(0),
  avgIdleSecondsToClearLevel: z.number().min(0),
  avgStaminaWaitSecondsToClearLevel: z.number().min(0),
  avgContractAvailabilityWaitSecondsToClearLevel: z.number().min(0),
  avgFightsToClearLevel: z.number().min(0),
  avgWinsByBand: developerContractSimulationBandAveragesSchema,
  avgLossesByBand: developerContractSimulationBandAveragesSchema,
  winRateByBand: z.object({
    under_level: z.number().min(0).max(1),
    on_level: z.number().min(0).max(1),
    over_level: z.number().min(0).max(1)
  }),
  avgXpPerFight: z.number().min(0),
  avgStaminaCostPerFight: z.number().min(0),
  avgStaminaSpent: z.number().min(0),
  avgRestCount: z.number().min(0),
  avgCombatSeconds: z.number().min(0),
  avgInputOverheadSeconds: z.number().min(0),
  avgPlayerAttackRoll: z.number().min(0),
  avgPlayerHpLossPercent: z.number().min(0).max(100),
  avgPlayerActionTurnsByBand: developerContractSimulationBandAveragesSchema,
  avgEnemyActionTurnsByBand: developerContractSimulationBandAveragesSchema,
  avgPlayerStrikesByBand: developerContractSimulationBandAveragesSchema,
  avgEnemyStrikesByBand: developerContractSimulationBandAveragesSchema,
  avgPlayerHpLossPercentByBand: developerContractSimulationBandPercentagesSchema,
  avgEncounterHpToPlayerHpRatioByBand: developerContractSimulationBandAveragesSchema
});
export type DeveloperContractSimulationLevelSummary = z.infer<typeof developerContractSimulationLevelSummarySchema>;

export const developerContractSimulationArchetypeResultSchema = z.object({
  archetype: developerContractSimulationArchetypeSchema,
  benchmarkTargetBandHitRateByBand: developerContractSimulationBandHitRateSchema,
  benchmarkTurnTargetHitRateByBand: developerContractSimulationBandHitRateSchema,
  levels: z.array(developerContractSimulationLevelSummarySchema)
});
export type DeveloperContractSimulationArchetypeResult = z.infer<typeof developerContractSimulationArchetypeResultSchema>;

export const developerContractSimulationResultSchema = z.object({
  playerClass: playerClassSchema,
  sampleSize: z.number().int().min(1),
  maxLevel: z.number().int().min(1).max(100),
  archetypes: z.array(developerContractSimulationArchetypeResultSchema).length(3)
});
export type DeveloperContractSimulationResult = z.infer<typeof developerContractSimulationResultSchema>;

export const developerContractSimulationProgressSchema = z.object({
  totalSamples: z.number().int().min(1),
  completedSamples: z.number().int().min(0),
  currentArchetype: developerContractSimulationArchetypeSchema.nullable(),
  currentLevel: z.number().int().min(1).max(100).nullable(),
  currentSampleIndex: z.number().int().min(1).nullable()
});
export type DeveloperContractSimulationProgress = z.infer<typeof developerContractSimulationProgressSchema>;

export const developerContractSimulationJobSchema = z.object({
  jobId: z.string(),
  status: developerContractSimulationJobStatusSchema,
  config: z.object({
    playerClass: playerClassSchema,
    sampleSize: z.number().int().min(1),
    maxLevel: z.number().int().min(1).max(100)
  }),
  progress: developerContractSimulationProgressSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  artifactPath: z.string().nullable(),
  error: z.string().nullable(),
  result: developerContractSimulationResultSchema.nullable()
});
export type DeveloperContractSimulationJob = z.infer<typeof developerContractSimulationJobSchema>;

export const developerContractsStaticCurvePointSchema = z.object({
  level: z.number().int().min(1).max(100),
  averageTravelSeconds: z.number().min(0),
  averageReplenishSeconds: z.number().min(0),
  averageStaminaWaitSecondsForContract: z.number().min(0),
  weightedAverageStaminaWaitSecondsForContract: z.number().min(0),
  weightedAverageStaminaCostPerContract: z.number().min(0),
  averageContractAvailabilityWaitSeconds: z.number().min(0),
  averageExperiencePerContract: developerContractSimulationBandAveragesSchema,
  experienceToNextLevel: z.number().int().min(0)
});
export type DeveloperContractsStaticCurvePoint = z.infer<typeof developerContractsStaticCurvePointSchema>;

export const developerContractsStaticCurvesResponseSchema = z.object({
  levels: z.array(developerContractsStaticCurvePointSchema).min(1)
});
export type DeveloperContractsStaticCurvesResponse = z.infer<typeof developerContractsStaticCurvesResponseSchema>;

export const combatPlaybackRollStatsSchema = z.object({
  level: z.number().int().min(1),
  damageKind: combatDamageKindSchema,
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  combatSpeed: z.number().int().min(1),
  accuracy: z.number().int().min(0),
  dodgeChance: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  extraAttackChance: z.number().int().min(0),
  armor: z.number().int().min(0),
  spellShield: z.number().int().min(0),
  missileResistance: z.number().int().min(0),
  physicalDefense: z.number().int().min(0),
  magicDefense: z.number().int().min(0)
});
export type CombatPlaybackRollStats = z.infer<typeof combatPlaybackRollStatsSchema>;

export const combatPlaybackMitigationStatSchema = z.enum(["armor", "missileResistance", "spellShield"]);
export type CombatPlaybackMitigationStat = z.infer<typeof combatPlaybackMitigationStatSchema>;

export const combatPlaybackRollBreakdownActorSchema = z.object({
  name: z.string(),
  accuracy: z.number().int().min(0),
  dodgeChance: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  armor: z.number().int().min(0),
  spellShield: z.number().int().min(0),
  missileResistance: z.number().int().min(0),
  physicalDefense: z.number().int().min(0),
  magicDefense: z.number().int().min(0)
});
export type CombatPlaybackRollBreakdownActor = z.infer<typeof combatPlaybackRollBreakdownActorSchema>;

export const combatPlaybackRollBreakdownSchema = z.object({
  attacker: combatPlaybackRollBreakdownActorSchema,
  defender: combatPlaybackRollBreakdownActorSchema,
  damageKind: combatDamageKindSchema,
  hitChanceBps: z.number().int().min(0).max(10000),
  didHit: z.boolean(),
  didCrit: z.boolean(),
  baseDamageRoll: z.number().int().min(0).nullable(),
  rawDamage: z.number().int().min(0),
  mitigationStatLabel: combatPlaybackMitigationStatSchema,
  mitigationResistance: z.number().int().min(0),
  mitigationDefense: z.number().int().min(0),
  effectiveDefense: z.number().int().min(0),
  attackerPower: z.number().int().min(1),
  mitigationScale: z.number().int().min(1),
  mitigationPercentBps: z.number().int().min(0).max(10000),
  postMitigationDamage: z.number().int().min(0),
  floorPercentBps: z.number().int().min(0).max(10000),
  minimumDamage: z.number().int().min(0),
  finalDamage: z.number().int().min(0),
  targetHpBefore: z.number().int().min(0),
  targetHpAfter: z.number().int().min(0),
  killed: z.boolean()
});
export type CombatPlaybackRollBreakdown = z.infer<typeof combatPlaybackRollBreakdownSchema>;

export const combatPlaybackActorSchema = z.object({
  id: z.string(),
  side: combatActorSideSchema,
  name: z.string(),
  maxHp: z.number().int().min(1),
  power: z.number().int().min(0).optional(),
  combatStat: z.enum(["strength", "dexterity", "intelligence"]).optional(),
  rollStats: combatPlaybackRollStatsSchema.optional(),
  avatarPath: z.string().optional(),
  usesSilhouetteFallback: z.boolean().optional()
});
export type CombatPlaybackActor = z.infer<typeof combatPlaybackActorSchema>;

export const combatPlaybackEncounterSchema = z.object({
  encounterId: z.string(),
  contractInstanceId: z.string(),
  contractName: z.string(),
  contractLevel: z.number().int().min(1),
  levelBand: contractLevelBandSchema,
  locationName: z.string(),
  travelImagePath: z.string().optional(),
  combatBackgroundPath: z.string().optional(),
  travelImageMode: z.enum(["image", "silhouette"]).default("silhouette"),
  player: combatPlaybackActorSchema,
  enemies: z.array(combatPlaybackActorSchema).min(1)
});
export type CombatPlaybackEncounter = z.infer<typeof combatPlaybackEncounterSchema>;

export const combatPlaybackStartedSchema = z.object({
  type: z.literal("CombatPlaybackStarted"),
  eventId: z.string(),
  encounterId: z.string()
});
export type CombatPlaybackStarted = z.infer<typeof combatPlaybackStartedSchema>;

export const combatPlaybackActionResolvedSchema = z.object({
  type: z.literal("CombatPlaybackActionResolved"),
  eventId: z.string(),
  encounterId: z.string(),
  turnIndex: z.number().int().min(1),
  actorId: z.string(),
  targetId: z.string(),
  actionType: z.literal("basic_attack"),
  damage: z.number().int().min(0),
  targetHpAfter: z.number().int().min(0),
  attackerLungeDirection: z.enum(["left-to-right", "right-to-left"]),
  logLine: z.string(),
  rollBreakdown: combatPlaybackRollBreakdownSchema
});
export type CombatPlaybackActionResolved = z.infer<typeof combatPlaybackActionResolvedSchema>;

export const combatPlaybackEndedSchema = z.object({
  type: z.literal("CombatPlaybackEnded"),
  eventId: z.string(),
  encounterId: z.string(),
  winnerSide: combatActorSideSchema,
  summaryLine: z.string()
});
export type CombatPlaybackEnded = z.infer<typeof combatPlaybackEndedSchema>;

export const combatPlaybackEventSchema = z.discriminatedUnion("type", [
  combatPlaybackStartedSchema,
  combatPlaybackActionResolvedSchema,
  combatPlaybackEndedSchema
]);
export type CombatPlaybackEvent = z.infer<typeof combatPlaybackEventSchema>;

export const serverEventSchemas = {
  ServerTimeSync: z.object({
    type: z.literal("ServerTimeSync"),
    serverTime: z.string()
  }),
  CombatTurnStarted: z.object({
    type: z.literal("CombatTurnStarted"),
    sessionId: z.string(),
    turnIndex: z.number().int().min(0),
    deadlineTs: z.string()
  }),
  CombatActionResolved: z.object({
    type: z.literal("CombatActionResolved"),
    sessionId: z.string(),
    actorId: z.string(),
    targetId: z.string().nullable(),
    result: z.string()
  }),
  SystemStatusChanged: z.object({
    type: z.literal("SystemStatusChanged"),
    status: z.enum(["ok", "degraded"])
  })
};

export type ServerEvent =
  | z.infer<(typeof serverEventSchemas)["ServerTimeSync"]>
  | z.infer<(typeof serverEventSchemas)["CombatTurnStarted"]>
  | z.infer<(typeof serverEventSchemas)["CombatActionResolved"]>
  | z.infer<(typeof serverEventSchemas)["SystemStatusChanged"]>;
