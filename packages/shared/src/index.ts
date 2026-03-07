import { z } from "zod";

export const playerClassSchema = z.enum(["warrior", "mage", "ranger"]);
export type PlayerClass = z.infer<typeof playerClassSchema>;
export const allPlayerClasses: readonly PlayerClass[] = playerClassSchema.options;

export const itemMajorCategorySchema = z.enum(["armor", "weapon", "jewelry", "vestige"]);
export type ItemMajorCategory = z.infer<typeof itemMajorCategorySchema>;

export const armorArchetypeSchema = z.enum(["heavy", "light", "robe"]);
export type ArmorArchetype = z.infer<typeof armorArchetypeSchema>;

export const weaponArchetypeSchema = z.enum(["melee", "arcane", "ranged"]);
export type WeaponArchetype = z.infer<typeof weaponArchetypeSchema>;

export const weaponFamilySchema = z.enum(["sword", "axe", "wand", "staff", "sling", "bow"]);
export type WeaponFamily = z.infer<typeof weaponFamilySchema>;

export const supportedLocaleSchema = z.enum(["en", "es-419", "pt-BR", "ru", "fil", "zh-CN", "ko"]);
export type SupportedLocale = z.infer<typeof supportedLocaleSchema>;

const vestigeIds = [
  "ashen-sovereign",
  "hollow-star",
  "silent-judgement",
  "gilded-seraph",
  "drowned-oracle",
  "emberwake",
  "veiled-matron",
  "black-meridian",
  "iron-revenant",
  "pale-dominion",
  "umbral-thorn",
  "first-light"
] as const;

export const vestigeIdSchema = z.enum(vestigeIds);
export type VestigeId = z.infer<typeof vestigeIdSchema>;

export type VestigeCatalogEntry = {
  id: VestigeId;
  name: string;
  majorCategory: "vestige";
  equipable: true;
  bonusesTbd: true;
};

export const VESTIGE_CATALOG: readonly VestigeCatalogEntry[] = [
  {
    id: "ashen-sovereign",
    name: "Vestige of the Ashen Sovereign",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "hollow-star",
    name: "Vestige of the Hollow Star",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "silent-judgement",
    name: "Vestige of Silent Judgement",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "gilded-seraph",
    name: "Vestige of the Gilded Seraph",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "drowned-oracle",
    name: "Vestige of the Drowned Oracle",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "emberwake",
    name: "Vestige of Emberwake",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "veiled-matron",
    name: "Vestige of the Veiled Matron",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "black-meridian",
    name: "Vestige of Black Meridian",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "iron-revenant",
    name: "Vestige of the Iron Revenant",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "pale-dominion",
    name: "Vestige of Pale Dominion",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "umbral-thorn",
    name: "Vestige of the Umbral Thorn",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  },
  {
    id: "first-light",
    name: "Vestige of First Light",
    majorCategory: "vestige",
    equipable: true,
    bonusesTbd: true
  }
];

export const MAX_EQUIPPED_VESTIGES = 3;

export const armorArchetypeAllowedClasses: Record<ArmorArchetype, readonly PlayerClass[]> = {
  heavy: ["warrior"],
  light: ["ranger"],
  robe: ["mage"]
};

export const weaponArchetypeAllowedClasses: Record<WeaponArchetype, readonly PlayerClass[]> = {
  melee: ["warrior"],
  arcane: ["mage"],
  ranged: ["ranger"]
};

export function getAllowedClassesForArchetype(
  majorCategory: ItemMajorCategory,
  archetype?: ArmorArchetype | WeaponArchetype
): readonly PlayerClass[] {
  if (majorCategory === "jewelry" || majorCategory === "vestige") {
    return allPlayerClasses;
  }
  if (majorCategory === "armor") {
    if (!archetype || !armorArchetypeSchema.safeParse(archetype).success) {
      return [];
    }
    return armorArchetypeAllowedClasses[archetype as ArmorArchetype];
  }
  if (majorCategory === "weapon") {
    if (!archetype || !weaponArchetypeSchema.safeParse(archetype).success) {
      return [];
    }
    return weaponArchetypeAllowedClasses[archetype as WeaponArchetype];
  }
  return [];
}

export function isItemUsableByClass(
  playerClass: PlayerClass,
  majorCategory: ItemMajorCategory,
  archetype?: ArmorArchetype | WeaponArchetype
): boolean {
  return getAllowedClassesForArchetype(majorCategory, archetype).includes(playerClass);
}

export type VestigeLoadoutValidation =
  | { valid: true }
  | { valid: false; reason: "max_vestiges_exceeded" | "duplicate_vestige" };

export function validateVestigeLoadout(vestigeIdsToEquip: readonly VestigeId[]): VestigeLoadoutValidation {
  if (vestigeIdsToEquip.length > MAX_EQUIPPED_VESTIGES) {
    return { valid: false, reason: "max_vestiges_exceeded" };
  }
  if (new Set(vestigeIdsToEquip).size !== vestigeIdsToEquip.length) {
    return { valid: false, reason: "duplicate_vestige" };
  }
  return { valid: true };
}

export const statBlockSchema = z.object({
  strength: z.number(),
  intelligence: z.number(),
  dexterity: z.number(),
  vitality: z.number(),
  initiative: z.number(),
  luck: z.number()
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const devWeaponAffixSchema = z.object({
  source: z.enum(["prefix", "suffix"]),
  name: z.string(),
  tier: z.enum(["T1", "T2", "T3"]),
  stat: z.string(),
  value: z.number(),
  unit: z.enum(["flat", "basis_points"])
});
export type DevWeaponAffix = z.infer<typeof devWeaponAffixSchema>;

export const devWeaponSchema = z.object({
  displayName: z.string(),
  displayLine: z.string(),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]),
  level: z.number().int().min(1).max(100),
  baseLevel: z.number().int().min(0).max(100),
  weaponFamily: weaponArchetypeSchema,
  allowedClass: playerClassSchema,
  minRollLow: z.number().int().min(0),
  minRollHigh: z.number().int().min(0),
  maxRollLow: z.number().int().min(0),
  maxRollHigh: z.number().int().min(0),
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  power: z.number().int().min(0),
  affixSummary: z.string(),
  affixes: z.array(devWeaponAffixSchema),
  flavorText: z.string()
});
export type DevWeapon = z.infer<typeof devWeaponSchema>;

export const playerStateSchema = z.object({
  playerId: z.string(),
  accountId: z.string(),
  class: playerClassSchema,
  preferredLocale: supportedLocaleSchema.default("en"),
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  stats: statBlockSchema,
  currency: z.object({
    ducats: z.number().int().min(0),
    imperials: z.number().int().min(0)
  }),
  devWeapons: z.array(devWeaponSchema).optional()
});
export type PlayerState = z.infer<typeof playerStateSchema>;

export const devGuestLoginResponseSchema = z.object({
  accessToken: z.string(),
  playerId: z.string(),
  accountId: z.string()
});
export type DevGuestLoginResponse = z.infer<typeof devGuestLoginResponseSchema>;

export const playerPreferencesSchema = z.object({
  preferredLocale: supportedLocaleSchema
});
export type PlayerPreferences = z.infer<typeof playerPreferencesSchema>;

export const updatePlayerPreferencesBodySchema = z.object({
  preferredLocale: supportedLocaleSchema
});
export type UpdatePlayerPreferencesBody = z.infer<typeof updatePlayerPreferencesBodySchema>;

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

// Auth schemas
export const registerBodySchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
  class: playerClassSchema
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const registerResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
  playerId: z.string()
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
  playerId: z.string()
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const accountOverviewResponseSchema = z.object({
  accountId: z.string(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  provider: z.string(),
  createdAt: z.string(),
  profile: z.object({
    playerId: z.string(),
    class: playerClassSchema,
    level: z.number().int().min(1),
    gearScore: z.number().int().min(0)
  }).nullable(),
  currency: z.object({
    ducats: z.number().int().min(0),
    imperials: z.number().int().min(0)
  }).nullable()
});
export type AccountOverviewResponse = z.infer<typeof accountOverviewResponseSchema>;

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1)
});
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

export const verifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

export const forgotPasswordBodySchema = z.object({
  email: z.string().email()
});
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

export const forgotPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100)
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const resetPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

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
