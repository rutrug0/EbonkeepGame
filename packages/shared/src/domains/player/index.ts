import { z } from "zod";

import {
  currencyBalanceSchema,
  playerClassSchema,
  playerStatSnapshotSchema,
  statBlockSchema,
  supportedLocaleSchema
} from "../../core/index.js";
import { equipmentStateSchema, inventoryItemSchema } from "../inventory/index.js";

export const playerStateSchema = z.object({
  playerId: z.string(),
  accountId: z.string(),
  class: playerClassSchema,
  portraitId: z.string(),
  backgroundId: z.string(),
  preferredLocale: supportedLocaleSchema.default("en"),
  level: z.number().int().min(1),
  experience: z.number().int().min(0),
  experienceToNextLevel: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  stamina: z.object({
    current: z.number().int().min(0),
    max: z.number().int().min(0),
    nextPointAt: z.string().nullable()
  }),
  stats: statBlockSchema,
  statSnapshot: playerStatSnapshotSchema,
  inventory: z.array(z.lazy(() => inventoryItemSchema)),
  equipment: z.lazy(() => equipmentStateSchema),
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

export const updatePortraitBodySchema = z.object({
  portraitId: z.string().min(1).optional(),
  backgroundId: z.string().min(1).optional()
});
export type UpdatePortraitBody = z.infer<typeof updatePortraitBodySchema>;

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
