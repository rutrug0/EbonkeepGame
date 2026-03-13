import { z } from "zod";

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

export const contractDifficultySchema = z.enum(["easy", "medium", "hard"]);
export type ContractDifficulty = z.infer<typeof contractDifficultySchema>;

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
  difficulty: contractDifficultySchema.nullable(),
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

export const contractBoardResponseSchema = z.object({
  serverTime: z.string(),
  slots: z.array(contractBoardSlotViewSchema).length(6)
});
export type ContractBoardResponse = z.infer<typeof contractBoardResponseSchema>;

export const combatActorSideSchema = z.enum(["player", "enemy"]);
export type CombatActorSide = z.infer<typeof combatActorSideSchema>;

export const combatDamageKindSchema = z.enum(["melee", "ranged", "spell"]);
export type CombatDamageKind = z.infer<typeof combatDamageKindSchema>;

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
  difficulty: contractDifficultySchema,
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
        max: z.number().int().min(1)
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

export const combatPlaybackActorSchema = z.object({
  id: z.string(),
  side: combatActorSideSchema,
  name: z.string(),
  maxHp: z.number().int().min(1),
  power: z.number().int().min(0).optional(),
  combatStat: z.enum(["strength", "dexterity", "intelligence"]).optional(),
  avatarPath: z.string().optional(),
  usesSilhouetteFallback: z.boolean().optional()
});
export type CombatPlaybackActor = z.infer<typeof combatPlaybackActorSchema>;

export const combatPlaybackEncounterSchema = z.object({
  encounterId: z.string(),
  contractInstanceId: z.string(),
  contractName: z.string(),
  difficulty: contractDifficultySchema,
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
  logLine: z.string()
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
