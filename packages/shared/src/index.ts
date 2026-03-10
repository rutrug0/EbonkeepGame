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

const equipmentSlotIds = [
  "helmet",
  "necklace",
  "upperArmor",
  "belt",
  "ringLeft",
  "weapon",
  "pauldrons",
  "gloves",
  "lowerArmor",
  "boots",
  "ringRight",
  "vestige1",
  "vestige2",
  "vestige3"
] as const;

export const equipmentSlotIdSchema = z.enum(equipmentSlotIds);
export type EquipmentSlotId = z.infer<typeof equipmentSlotIdSchema>;
export const allEquipmentSlotIds: readonly EquipmentSlotId[] = equipmentSlotIdSchema.options;

const playerStatKeys = [
  "strength",
  "intelligence",
  "dexterity",
  "vitality",
  "initiative",
  "luck",
  "armor",
  "spellShield",
  "missileResistance",
  "maxHitpoints",
  "dodgeChance",
  "damage",
  "critChance",
  "critMultiplier",
  "accuracy",
  "extraAttackChance"
] as const;

export const playerStatKeySchema = z.enum(playerStatKeys);
export type PlayerStatKey = z.infer<typeof playerStatKeySchema>;
export const allPlayerStatKeys: readonly PlayerStatKey[] = playerStatKeySchema.options;

const coreStatKeys = [
  "strength",
  "intelligence",
  "dexterity",
  "vitality",
  "initiative",
  "luck"
] as const;

export const coreStatKeySchema = z.enum(coreStatKeys);
export type CoreStatKey = z.infer<typeof coreStatKeySchema>;
export const allCoreStatKeys: readonly CoreStatKey[] = coreStatKeySchema.options;

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
  strength: z.number().int(),
  intelligence: z.number().int(),
  dexterity: z.number().int(),
  vitality: z.number().int(),
  initiative: z.number().int(),
  luck: z.number().int()
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const playerStatBlockSchema = z.object({
  strength: z.number().int(),
  intelligence: z.number().int(),
  dexterity: z.number().int(),
  vitality: z.number().int(),
  initiative: z.number().int(),
  luck: z.number().int(),
  armor: z.number().int(),
  spellShield: z.number().int(),
  missileResistance: z.number().int(),
  maxHitpoints: z.number().int().min(0),
  dodgeChance: z.number().int().min(0),
  damage: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  accuracy: z.number().int().min(0),
  extraAttackChance: z.number().int().min(0)
});
export type PlayerStatBlock = z.infer<typeof playerStatBlockSchema>;

export const playerStatBonusesSchema = z.object({
  strength: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  dexterity: z.number().int().optional(),
  vitality: z.number().int().optional(),
  initiative: z.number().int().optional(),
  luck: z.number().int().optional(),
  armor: z.number().int().optional(),
  spellShield: z.number().int().optional(),
  missileResistance: z.number().int().optional(),
  maxHitpoints: z.number().int().optional(),
  dodgeChance: z.number().int().optional(),
  damage: z.number().int().optional(),
  critChance: z.number().int().optional(),
  critMultiplier: z.number().int().optional(),
  accuracy: z.number().int().optional(),
  extraAttackChance: z.number().int().optional()
});
export type PlayerStatBonuses = z.infer<typeof playerStatBonusesSchema>;

export const playerStatSnapshotSchema = z.object({
  base: playerStatBlockSchema,
  equipment: playerStatBlockSchema,
  total: playerStatBlockSchema
});
export type PlayerStatSnapshot = z.infer<typeof playerStatSnapshotSchema>;

export const currencyBalanceSchema = z.object({
  ducats: z.number().int().min(0),
  imperials: z.number().int().min(0)
});
export type CurrencyBalance = z.infer<typeof currencyBalanceSchema>;

export const itemRaritySchema = z.enum(["common", "uncommon", "rare", "epic"]);
export type ItemRarity = z.infer<typeof itemRaritySchema>;

export const modifierTierSchema = z.enum(["T1", "T2", "T3"]);
export type ModifierTier = z.infer<typeof modifierTierSchema>;

export const itemModifierUnitSchema = z.enum(["flat", "basis_points"]);
export type ItemModifierUnit = z.infer<typeof itemModifierUnitSchema>;

export const itemArchetypeSchema = z.object({
  majorCategory: itemMajorCategorySchema,
  armorArchetype: armorArchetypeSchema.optional(),
  weaponArchetype: weaponArchetypeSchema.optional(),
  weaponFamily: weaponFamilySchema.optional(),
  vestigeId: vestigeIdSchema.optional()
});
export type ItemArchetype = z.infer<typeof itemArchetypeSchema>;
export const equippedItemArchetypeSchema = itemArchetypeSchema;
export type EquippedItemArchetype = ItemArchetype;

export const itemModifierSchema = z.object({
  kind: z.enum(["prefix", "affix"]),
  tier: modifierTierSchema,
  name: z.string(),
  statKey: playerStatKeySchema,
  value: z.number().int(),
  unit: itemModifierUnitSchema
});
export type ItemModifier = z.infer<typeof itemModifierSchema>;

export const weaponDamageRollSchema = z.object({
  minRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  rolledMin: z.number().int().min(0),
  rolledMax: z.number().int().min(0),
  maxRollRange: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  averageDamage: z.number().min(0)
});
export type WeaponDamageRoll = z.infer<typeof weaponDamageRollSchema>;

export const inventoryItemSchema = z.object({
  id: z.string(),
  itemCode: z.string(),
  itemName: z.string(),
  rarity: itemRaritySchema,
  category: z.string(),
  equipable: z.boolean(),
  levelRequirement: z.number().int().min(1).max(100),
  allowedSlotIds: z.array(equipmentSlotIdSchema).min(1),
  baseLevel: z.number().int().min(0).max(100).optional(),
  power: z.number().int().min(0),
  archetype: itemArchetypeSchema,
  statBonuses: playerStatBonusesSchema.default({}),
  damageRoll: weaponDamageRollSchema.optional(),
  prefix: itemModifierSchema.optional(),
  affix: itemModifierSchema.optional(),
  description: z.string()
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export const equippedItemSchema = inventoryItemSchema;
export type EquippedItem = InventoryItem;

export const equipmentStateSchema = z.object({
  helmet: inventoryItemSchema.nullable(),
  necklace: inventoryItemSchema.nullable(),
  upperArmor: inventoryItemSchema.nullable(),
  belt: inventoryItemSchema.nullable(),
  ringLeft: inventoryItemSchema.nullable(),
  weapon: inventoryItemSchema.nullable(),
  pauldrons: inventoryItemSchema.nullable(),
  gloves: inventoryItemSchema.nullable(),
  lowerArmor: inventoryItemSchema.nullable(),
  boots: inventoryItemSchema.nullable(),
  ringRight: inventoryItemSchema.nullable(),
  vestige1: inventoryItemSchema.nullable(),
  vestige2: inventoryItemSchema.nullable(),
  vestige3: inventoryItemSchema.nullable()
});
export type EquipmentState = z.infer<typeof equipmentStateSchema>;

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
  statSnapshot: playerStatSnapshotSchema,
  inventory: z.array(inventoryItemSchema),
  equipment: equipmentStateSchema,
  currency: currencyBalanceSchema
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

export const inventoryMoveBodySchema = z.object({
  itemId: z.string(),
  fromSlot: z.string(),
  toSlot: z.string()
});
export type InventoryMoveBody = z.infer<typeof inventoryMoveBodySchema>;

export const inventoryMoveResponseSchema = z.object({
  moved: z.boolean(),
  itemId: z.string(),
  playerState: playerStateSchema
});
export type InventoryMoveResponse = z.infer<typeof inventoryMoveResponseSchema>;

export const merchantOfferSchema = z.object({
  offerId: z.string(),
  offerIndex: z.number().int().min(0),
  item: inventoryItemSchema,
  buyPriceDucats: z.number().int().min(0),
  sold: z.boolean(),
  refreshAt: z.string()
});
export type MerchantOffer = z.infer<typeof merchantOfferSchema>;

export const merchantStateSchema = z.object({
  offers: z.array(merchantOfferSchema),
  sellPrices: z.record(z.string(), z.number().int().min(0)),
  nextRefreshAt: z.string(),
  currency: currencyBalanceSchema
});
export type MerchantState = z.infer<typeof merchantStateSchema>;

export const merchantBuyBodySchema = z.object({
  offerId: z.string()
});
export type MerchantBuyBody = z.infer<typeof merchantBuyBodySchema>;

export const merchantSellBodySchema = z.object({
  itemId: z.string(),
  fromSlot: z.string()
});
export type MerchantSellBody = z.infer<typeof merchantSellBodySchema>;

export const merchantRestockBodySchema = z.object({}).default({});
export type MerchantRestockBody = z.infer<typeof merchantRestockBodySchema>;

export const merchantTransactionResponseSchema = z.object({
  playerState: playerStateSchema,
  merchantState: merchantStateSchema
});
export type MerchantTransactionResponse = z.infer<typeof merchantTransactionResponseSchema>;

export const merchantStateResponseSchema = merchantStateSchema;
export type MerchantStateResponse = z.infer<typeof merchantStateResponseSchema>;

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

// PayPal Transaction schemas
export const imperialBundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  imperials: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().default("USD")
});
export type ImperialBundle = z.infer<typeof imperialBundleSchema>;

export const IMPERIAL_BUNDLES: readonly ImperialBundle[] = [
  { id: "bundle_100", name: "100 Imperials", imperials: 100, price: 5.00, currency: "USD" },
  { id: "bundle_400", name: "330 Imperials", imperials: 330, price: 15.00, currency: "USD" },
  { id: "bundle_900", name: "700 Imperials", imperials: 700, price: 30.00, currency: "USD" },
  { id: "bundle_3000", name: "2,100 Imperials", imperials: 2100, price: 90.00, currency: "USD" },
  { id: "bundle_12000", name: "7,000 Imperials", imperials: 7000, price: 300.00, currency: "USD" }
] as const;

export const createPaymentBodySchema = z.object({
  bundleId: z.string()
});
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;

export const createPaymentResponseSchema = z.object({
  orderId: z.string(),
  approvalUrl: z.string().optional()
});
export type CreatePaymentResponse = z.infer<typeof createPaymentResponseSchema>;

export const capturePaymentBodySchema = z.object({
  orderId: z.string()
});
export type CapturePaymentBody = z.infer<typeof capturePaymentBodySchema>;

export const capturePaymentResponseSchema = z.object({
  success: z.boolean(),
  transactionId: z.string(),
  imperials: z.number().int().positive(),
  message: z.string().optional()
});
export type CapturePaymentResponse = z.infer<typeof capturePaymentResponseSchema>;

export const transactionStatusSchema = z.enum(["pending", "completed", "failed", "cancelled"]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  provider: z.string(),
  providerOrderId: z.string(),
  status: transactionStatusSchema,
  amount: z.string(),
  currency: z.string(),
  imperials: z.number().int(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
});
export type Transaction = z.infer<typeof transactionSchema>;

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

// Leaderboard schemas
export const leaderboardTypeSchema = z.enum(["power", "level"]);
export type LeaderboardType = z.infer<typeof leaderboardTypeSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  playerId: z.string(),
  username: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  value: z.number().int().min(0) // The ranked value (either level or gearScore)
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  leaderboardType: leaderboardTypeSchema,
  entries: z.array(leaderboardEntrySchema),
  totalPlayers: z.number().int().min(0),
  currentPlayerRank: z.number().int().min(0).nullable() // null if player not in rankings
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

// ========================================
// Guild System Schemas
// ========================================

// Guild roles
export const guildRoleSchema = z.enum(["leader", "officer", "member"]);
export type GuildRole = z.infer<typeof guildRoleSchema>;

// Guild invite status
export const guildInviteStatusSchema = z.enum(["pending", "accepted", "declined", "expired"]);
export type GuildInviteStatus = z.infer<typeof guildInviteStatusSchema>;

// Guild activity action types
export const guildActivityTypeSchema = z.enum([
  "created",
  "joined",
  "left",
  "kicked",
  "promoted",
  "demoted",
  "transferred_leadership",
  "disbanded",
  "crest_changed",
  "description_changed",
  "recruiting_toggled"
]);
export type GuildActivityType = z.infer<typeof guildActivityTypeSchema>;

// Guild crest configuration
export const guildCrestSchema = z.object({
  bgShape: z.string(),
  bgColor: z.string(),
  bgPattern: z.string().nullable().optional(),
  fgSymbol: z.string(),
  fgColor: z.string(),
  frame: z.string().nullable().optional()
});
export type GuildCrest = z.infer<typeof guildCrestSchema>;

// Guild core schema
export const guildSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string(),
  leaderId: z.string(),
  maxMembers: z.number().int(),
  isRecruiting: z.boolean(),
  totalPower: z.number().int(),
  level: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  crestBgShape: z.string(),
  crestBgColor: z.string(),
  crestBgPattern: z.string().nullable(),
  crestFgSymbol: z.string(),
  crestFgColor: z.string(),
  crestFrame: z.string().nullable(),
  memberCount: z.number().int().optional() // Computed field for list views
});
export type Guild = z.infer<typeof guildSchema>;

// Guild member schema
export const guildMemberSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  playerId: z.string(),
  role: guildRoleSchema,
  joinedAt: z.string().datetime(),
  contributedPower: z.number().int()
});
export type GuildMember = z.infer<typeof guildMemberSchema>;

// Guild invite schema
export const guildInviteSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  inviterId: z.string(),
  inviteeId: z.string(),
  message: z.string().nullable(),
  status: guildInviteStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable()
});
export type GuildInvite = z.infer<typeof guildInviteSchema>;

// Guild activity schema
export const guildActivitySchema = z.object({
  id: z.string(),
  guildId: z.string(),
  actorId: z.string().nullable(),
  actionType: guildActivityTypeSchema,
  targetId: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  timestamp: z.string().datetime()
});
export type GuildActivity = z.infer<typeof guildActivitySchema>;

// API Request/Response schemas

// Create guild
export const createGuildRequestSchema = z.object({
  name: z.string().min(3).max(32),
  tag: z.string().min(2).max(6),
  description: z.string().max(500).optional(),
  crestConfig: guildCrestSchema
});
export type CreateGuildRequest = z.infer<typeof createGuildRequestSchema>;

export const createGuildResponseSchema = z.object({
  guild: guildSchema,
  membership: guildMemberSchema
});
export type CreateGuildResponse = z.infer<typeof createGuildResponseSchema>;

// Update guild
export const updateGuildRequestSchema = z.object({
  description: z.string().max(500).optional(),
  crestConfig: guildCrestSchema.optional(),
  isRecruiting: z.boolean().optional()
});
export type UpdateGuildRequest = z.infer<typeof updateGuildRequestSchema>;

// Guild search
export const guildSearchQuerySchema = z.object({
  name: z.string().optional(),
  tag: z.string().optional(),
  minMembers: z.coerce.number().int().min(0).optional(),
  maxMembers: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildSearchQuery = z.infer<typeof guildSearchQuerySchema>;
// Alias for API compatibility
export const searchGuildsQuerySchema = guildSearchQuerySchema;
export type SearchGuildsQuery = GuildSearchQuery;

export const guildSearchResponseSchema = z.object({
  guilds: z.array(guildSchema.extend({
    memberCount: z.number().int()
  })),
  total: z.number().int()
});
export type GuildSearchResponse = z.infer<typeof guildSearchResponseSchema>;

// Guild details response
export const guildDetailsResponseSchema = z.object({
  guild: guildSchema,
  memberCount: z.number().int(),
  currentUserMembership: guildMemberSchema.nullable()
});
export type GuildDetailsResponse = z.infer<typeof guildDetailsResponseSchema>;

// Send invite
export const sendGuildInviteRequestSchema = z.object({
  inviteeId: z.string(),
  message: z.string().max(200).optional()
});
export type SendGuildInviteRequest = z.infer<typeof sendGuildInviteRequestSchema>;

// Get members
export const guildMembersQuerySchema = z.object({
  role: guildRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildMembersQuery = z.infer<typeof guildMembersQuerySchema>;

export const guildMemberWithPlayerSchema = guildMemberSchema.extend({
  player: z.object({
    id: z.string(),
    class: playerClassSchema,
    level: z.number().int(),
    gearScore: z.number().int(),
    account: z.object({
      username: z.string().nullable()
    })
  })
});
export type GuildMemberWithPlayer = z.infer<typeof guildMemberWithPlayerSchema>;

export const guildMembersResponseSchema = z.object({
  members: z.array(guildMemberWithPlayerSchema),
  total: z.number().int()
});
export type GuildMembersResponse = z.infer<typeof guildMembersResponseSchema>;

// Update member role
export const updateMemberRoleRequestSchema = z.object({
  role: z.enum(["officer", "member"]) // Can't promote to leader via this endpoint
});
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

// Transfer leadership
export const transferLeadershipRequestSchema = z.object({
  newLeaderId: z.string()
});
export type TransferLeadershipRequest = z.infer<typeof transferLeadershipRequestSchema>;

// Get invites
export const getInvitesQuerySchema = z.object({
  status: z.enum(["pending", "all"]).default("pending")
});
export type GetInvitesQuery = z.infer<typeof getInvitesQuerySchema>;

export const guildInviteWithDetailsSchema = guildInviteSchema.extend({
  guild: guildSchema,
  inviter: z.object({
    id: z.string(),
    account: z.object({
      username: z.string().nullable()
    })
  })
});
export type GuildInviteWithDetails = z.infer<typeof guildInviteWithDetailsSchema>;

export const getInvitesResponseSchema = z.object({
  invites: z.array(guildInviteWithDetailsSchema)
});
export type GetInvitesResponse = z.infer<typeof getInvitesResponseSchema>;

// Guild activity
export const guildActivityQuerySchema = z.object({
  actionType: guildActivityTypeSchema.optional(),
  actorId: z.string().optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildActivityQuery = z.infer<typeof guildActivityQuerySchema>;

export const guildActivityWithDetailsSchema = guildActivitySchema.extend({
  actor: z.object({
    id: z.string(),
    account: z.object({
      username: z.string().nullable()
    })
  }).nullable(),
  target: z.object({
    id: z.string(),
    account: z.object({
      username: z.string().nullable()
    })
  }).nullable()
});
export type GuildActivityWithDetails = z.infer<typeof guildActivityWithDetailsSchema>;

export const guildActivityResponseSchema = z.object({
  activities: z.array(guildActivityWithDetailsSchema),
  total: z.number().int()
});
export type GuildActivityResponse = z.infer<typeof guildActivityResponseSchema>;

// Guild leaderboard
export const guildLeaderboardTypeSchema = z.enum(["power", "memberCount", "level"]);
export type GuildLeaderboardType = z.infer<typeof guildLeaderboardTypeSchema>;

export const guildLeaderboardQuerySchema = z.object({
  sortBy: guildLeaderboardTypeSchema.default("power"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildLeaderboardQuery = z.infer<typeof guildLeaderboardQuerySchema>;
// Alias for service layer
export type GuildLeaderboardSort = "power" | "memberCount" | "level";

export const guildLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  guild: guildSchema,
  memberCount: z.number().int(),
  value: z.number().int() // The ranked value
});
export type GuildLeaderboardEntry = z.infer<typeof guildLeaderboardEntrySchema>;

export const guildLeaderboardResponseSchema = z.object({
  leaderboardType: guildLeaderboardTypeSchema,
  guilds: z.array(guildLeaderboardEntrySchema),
  totalGuilds: z.number().int()
});
export type GuildLeaderboardResponse = z.infer<typeof guildLeaderboardResponseSchema>;

// ========================================
// Guild Crest Color Palette
// ========================================

export const GUILD_CREST_COLORS = {
  // Background colors (7 colors)
  crimson: "#8B0000",
  forest: "#0B4D1B",
  sapphire: "#0F4C81",
  obsidian: "#1A1A1A",
  ivory: "#FFFFF0",
  gold: "#D4AF37",
  iron: "#4A4A4A",

  // Foreground colors (5 colors)
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  white: "#FFFFFF",
  black: "#000000",
  amber: "#FFBF00"
} as const;

export type GuildCrestColor = keyof typeof GUILD_CREST_COLORS;

