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

export const combatPlaybackActorSchema = z.object({
  id: z.string(),
  side: z.enum(["player", "enemy"]),
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
  difficulty: z.enum(["easy", "medium", "hard"]),
  locationName: z.string(),
  travelImagePath: z.string().optional(),
  combatBackgroundPath: z.string().optional(),
  travelImageMode: z.enum(["image", "silhouette"]),
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
  actionType: z.enum(["basic_attack"]),
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
  winnerSide: z.enum(["player", "enemy"]),
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
