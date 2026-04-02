import { z } from "zod";

import {
  currencyBalanceSchema,
  playerClassSchema,
  playerStatSnapshotSchema,
  statBlockSchema,
  supportedLocaleSchema
} from "../../core/index.js";
import {
  consumableDurationKindSchema,
  consumableEffectSchema,
  consumableFamilySchema,
  consumableTypeSchema
} from "../consumables/index.js";
import { equipmentStateSchema, inventoryItemSchema } from "../inventory/index.js";

export const PASSIVE_HEALTH_REGEN_PERCENT_PER_MINUTE = 1;

export const activeConsumableSchema = z.object({
  id: z.string(),
  itemCode: z.string().min(1),
  type: consumableTypeSchema,
  family: consumableFamilySchema,
  effects: z.array(consumableEffectSchema),
  appliedAt: z.string(),
  expiresAt: z.string().nullable(),
  remainingEncounters: z.number().int().min(0).nullable(),
  originalDuration: z.object({
    kind: consumableDurationKindSchema,
    value: z.number().int().min(0)
  })
});
export type ActiveConsumable = z.infer<typeof activeConsumableSchema>;

export const playerCheatSettingsSchema = z.object({
  fastTravelEnabled: z.boolean().default(false),
  fastContractReplenishEnabled: z.boolean().default(false),
  fastArenaReplenishEnabled: z.boolean().default(false),
  invincibilityEnabled: z.boolean().default(false),
  fastTrainTimeEnabled: z.boolean().default(false),
  fastCraftTimeEnabled: z.boolean().default(false),
  unlimitedAcademyDonationsEnabled: z.boolean().default(false),
  unlimitedForgeConsumablesEnabled: z.boolean().default(false),
  unlimitedRefineryMaterialsEnabled: z.boolean().default(false)
});
export type PlayerCheatSettings = z.infer<typeof playerCheatSettingsSchema>;

export const playerStateSchema = z.object({
  playerId: z.string(),
  accountId: z.string(),
  class: playerClassSchema,
  portraitId: z.string(),
  backgroundId: z.string(),
  preferredLocale: supportedLocaleSchema.default("en"),
  level: z.number().int().min(1),
  experience: z.number().int().min(0),
  experienceIntoLevel: z.number().int().min(0),
  experienceToNextLevel: z.number().int().min(1),
  gearScore: z.number().int().min(0),
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
  stats: statBlockSchema,
  statSnapshot: playerStatSnapshotSchema,
  activeConsumables: z.array(activeConsumableSchema).default([]),
  inventory: z.array(z.lazy(() => inventoryItemSchema)),
  equipment: z.lazy(() => equipmentStateSchema),
  currency: currencyBalanceSchema,
  cheatSettings: playerCheatSettingsSchema
});
export type PlayerState = z.infer<typeof playerStateSchema>;

export const playerRestResponseSchema = z.object({
  playerState: playerStateSchema,
  costDucats: z.number().int().min(0)
});
export type PlayerRestResponse = z.infer<typeof playerRestResponseSchema>;

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

export const updatePortraitBodySchema = z.object({
  portraitId: z.string().min(1).optional(),
  backgroundId: z.string().min(1).optional()
});
export type UpdatePortraitBody = z.infer<typeof updatePortraitBodySchema>;

export const updatePlayerCheatSettingsBodySchema = playerCheatSettingsSchema;
export type UpdatePlayerCheatSettingsBody = z.infer<typeof updatePlayerCheatSettingsBodySchema>;

export const playerCheatActionResponseSchema = z.object({
  playerState: playerStateSchema
});
export type PlayerCheatActionResponse = z.infer<typeof playerCheatActionResponseSchema>;

export const playerCheatLevelUpBodySchema = z.object({
  targetLevel: z.number().int().min(2).max(100)
});
export type PlayerCheatLevelUpBody = z.infer<typeof playerCheatLevelUpBodySchema>;

export const playerCheatGenerateEquipmentBodySchema = z.object({
  rarity: z.enum(["common", "uncommon", "rare", "epic"])
});
export type PlayerCheatGenerateEquipmentBody = z.infer<typeof playerCheatGenerateEquipmentBodySchema>;

export const playerCheatGenerateEquipmentResponseSchema = z.object({
  playerState: playerStateSchema,
  generatedItems: z.array(z.lazy(() => inventoryItemSchema))
});
export type PlayerCheatGenerateEquipmentResponse = z.infer<typeof playerCheatGenerateEquipmentResponseSchema>;

export const playerCheatGrantCurrencyResponseSchema = z.object({
  playerState: playerStateSchema,
  ducatsGranted: z.number().int().min(0),
  imperialsGranted: z.number().int().min(0)
});
export type PlayerCheatGrantCurrencyResponse = z.infer<typeof playerCheatGrantCurrencyResponseSchema>;

export const playerCheatGuildRaidSquadResponseSchema = z.object({
  playerState: playerStateSchema,
  createdMembers: z.number().int().min(0),
  joinedRaiders: z.number().int().min(0),
  guildMemberCount: z.number().int().min(0),
  raidJoinCount: z.number().int().min(0)
});
export type PlayerCheatGuildRaidSquadResponse = z.infer<typeof playerCheatGuildRaidSquadResponseSchema>;

export const playerCheatGuildRaidResetResponseSchema = z.object({
  playerState: playerStateSchema,
  removedInstances: z.number().int().min(0)
});
export type PlayerCheatGuildRaidResetResponse = z.infer<typeof playerCheatGuildRaidResetResponseSchema>;

export const publicPlayerProfileSchema = z.object({
  playerId: z.string(),
  username: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  guildId: z.string().nullable(),
  equipment: z.lazy(() => equipmentStateSchema),
  statSnapshot: playerStatSnapshotSchema
});
export type PublicPlayerProfile = z.infer<typeof publicPlayerProfileSchema>;

export const renownStateSchema = z.object({
  unlockedNodeIds: z.array(z.string()),
  renownBalance: z.number().int().min(0)
});
export type RenownState = z.infer<typeof renownStateSchema>;

export const renownUnlockBodySchema = z.object({
  nodeId: z.string().min(1)
});
export type RenownUnlockBody = z.infer<typeof renownUnlockBodySchema>;
