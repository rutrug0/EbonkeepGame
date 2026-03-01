import { z } from "zod";

export const playerClassSchema = z.enum(["warrior", "wizard", "archer"]);
export type PlayerClass = z.infer<typeof playerClassSchema>;

export const statBlockSchema = z.object({
  strength: z.number(),
  intelligence: z.number(),
  dexterity: z.number(),
  vitality: z.number(),
  initiative: z.number(),
  luck: z.number()
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const devMeleeWeaponAffixSchema = z.object({
  source: z.enum(["prefix", "suffix"]),
  name: z.string(),
  tier: z.enum(["T1", "T2", "T3"]),
  stat: z.string(),
  value: z.number(),
  unit: z.enum(["flat", "basis_points"])
});
export type DevMeleeWeaponAffix = z.infer<typeof devMeleeWeaponAffixSchema>;

export const devMeleeWeaponSchema = z.object({
  displayName: z.string(),
  displayLine: z.string(),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]),
  level: z.number().int().min(1).max(100),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  affixSummary: z.string(),
  affixes: z.array(devMeleeWeaponAffixSchema)
});
export type DevMeleeWeapon = z.infer<typeof devMeleeWeaponSchema>;

export const playerStateSchema = z.object({
  playerId: z.string(),
  accountId: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  stats: statBlockSchema,
  currency: z.object({
    ducats: z.number().int().min(0),
    imperials: z.number().int().min(0)
  }),
  devMeleeWeapons: z.array(devMeleeWeaponSchema).optional()
});
export type PlayerState = z.infer<typeof playerStateSchema>;

export const devGuestLoginResponseSchema = z.object({
  accessToken: z.string(),
  playerId: z.string(),
  accountId: z.string()
});
export type DevGuestLoginResponse = z.infer<typeof devGuestLoginResponseSchema>;

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

export const inventoryMoveBodySchema = z.object({
  itemId: z.string(),
  fromSlot: z.string(),
  toSlot: z.string()
});
export type InventoryMoveBody = z.infer<typeof inventoryMoveBodySchema>;

export const inventoryMoveResponseSchema = z.object({
  moved: z.boolean(),
  itemId: z.string()
});
export type InventoryMoveResponse = z.infer<typeof inventoryMoveResponseSchema>;

export const startJobBodySchema = z.object({
  jobType: z.enum(["short", "medium", "long"])
});
export type StartJobBody = z.infer<typeof startJobBodySchema>;

export const startJobResponseSchema = z.object({
  jobRunId: z.string(),
  completeAt: z.string()
});
export type StartJobResponse = z.infer<typeof startJobResponseSchema>;

export const shopPurchaseBodySchema = z.object({
  offerId: z.string(),
  quantity: z.number().int().min(1).max(99).default(1)
});
export type ShopPurchaseBody = z.infer<typeof shopPurchaseBodySchema>;

export const shopPurchaseResponseSchema = z.object({
  purchased: z.boolean(),
  offerId: z.string()
});
export type ShopPurchaseResponse = z.infer<typeof shopPurchaseResponseSchema>;

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

export const mainStatToFlatDamageRatio = 0.1;
