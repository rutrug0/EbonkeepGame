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
  minDamage: z.number().int().min(0),
  maxDamage: z.number().int().min(0),
  affixSummary: z.string(),
  affixes: z.array(devWeaponAffixSchema),
  flavorText: z.string()
});
export type DevWeapon = z.infer<typeof devWeaponSchema>;

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
  devWeapons: z.array(devWeaponSchema).optional()
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
