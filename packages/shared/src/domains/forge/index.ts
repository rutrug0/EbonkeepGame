import { z } from "zod";

import { itemRaritySchema } from "../inventory/index.js";
import { playerStateSchema } from "../player/index.js";

export const FORGE_SAFE_ENCHANT_LEVEL = 3;
export const FORGE_MAX_ENCHANT_LEVEL = 10;

export const forgeEnchantTrackSchema = z.enum(["weapon", "armor", "jewelry"]);
export type ForgeEnchantTrack = z.infer<typeof forgeEnchantTrackSchema>;

export const forgeOutcomeSchema = z.enum(["success", "reset"]);
export type ForgeOutcome = z.infer<typeof forgeOutcomeSchema>;

export const forgeLandingTargetSchema = z.enum(["weapon", "enchant"]);
export type ForgeLandingTarget = z.infer<typeof forgeLandingTargetSchema>;

export const forgeEnchantBodySchema = z.object({
  weaponItemId: z.string().min(1)
});
export type ForgeEnchantBody = z.infer<typeof forgeEnchantBodySchema>;

export const forgeInstabilitySchema = z.object({
  weaponItemId: z.string(),
  weaponName: z.string(),
  sourceEnchantLevel: z.number().int().min(FORGE_SAFE_ENCHANT_LEVEL + 1).max(FORGE_MAX_ENCHANT_LEVEL),
  damagePenaltyBps: z.number().int().min(0),
  cleanseCostDucats: z.number().int().min(0),
  triggeredAt: z.string()
});
export type ForgeInstability = z.infer<typeof forgeInstabilitySchema>;

export const forgeStateSchema = z.object({
  serverTime: z.string(),
  instability: forgeInstabilitySchema.nullable()
});
export type ForgeState = z.infer<typeof forgeStateSchema>;

export const forgeAttemptResultSchema = z.object({
  outcome: forgeOutcomeSchema,
  previousEnchantLevel: z.number().int().min(0).max(FORGE_MAX_ENCHANT_LEVEL - 1),
  currentEnchantLevel: z.number().int().min(0).max(FORGE_MAX_ENCHANT_LEVEL),
  successChancePct: z.number().int().min(0).max(100),
  damageBonusBpsBefore: z.number().int().min(0),
  damageBonusBpsAfter: z.number().int().min(0),
  catalystRarity: itemRaritySchema,
  attemptCostDucats: z.number().int().min(0),
  damageBefore: z.number().min(0),
  damageAfter: z.number().min(0),
  spinTurns: z.number().int().min(2).max(10),
  landedAt: forgeLandingTargetSchema
});
export type ForgeAttemptResult = z.infer<typeof forgeAttemptResultSchema>;

export const forgeEnchantResponseSchema = z.object({
  forge: forgeStateSchema,
  playerState: playerStateSchema,
  result: forgeAttemptResultSchema
});
export type ForgeEnchantResponse = z.infer<typeof forgeEnchantResponseSchema>;

export const forgeCleanseResponseSchema = z.object({
  forge: forgeStateSchema,
  playerState: playerStateSchema,
  cleanseCostDucats: z.number().int().min(0)
});
export type ForgeCleanseResponse = z.infer<typeof forgeCleanseResponseSchema>;

const SUCCESS_CHANCE_BY_TARGET_LEVEL: Record<number, number> = {
  1: 100,
  2: 100,
  3: 100,
  4: 78,
  5: 64,
  6: 51,
  7: 39,
  8: 30,
  9: 22,
  10: 16
};

export function getForgeSuccessChancePct(targetLevel: number): number {
  return SUCCESS_CHANCE_BY_TARGET_LEVEL[Math.max(1, Math.min(FORGE_MAX_ENCHANT_LEVEL, Math.floor(targetLevel)))] ?? 0;
}

export function getForgeDamageBonusBps(level: number): number {
  const normalizedLevel = Math.max(0, Math.min(FORGE_MAX_ENCHANT_LEVEL, Math.floor(level)));
  const earlyLevels = Math.min(normalizedLevel, 4);
  const lateLevels = Math.max(0, normalizedLevel - 4);
  return (earlyLevels * 500) + (lateLevels * 700);
}

export function getForgeCatalystRarity(targetLevel: number): z.infer<typeof itemRaritySchema> {
  if (targetLevel <= 3) {
    return "common";
  }
  if (targetLevel <= 5) {
    return "uncommon";
  }
  if (targetLevel <= 7) {
    return "rare";
  }
  return "epic";
}

const FORGE_CATALYST_BASE_COSTS: Record<z.infer<typeof itemRaritySchema>, number> = {
  common: 350,
  uncommon: 900,
  rare: 1_800,
  epic: 3_200
};

export function getForgeAttemptCostDucats(targetLevel: number): number {
  const normalizedLevel = Math.max(1, Math.min(FORGE_MAX_ENCHANT_LEVEL, Math.floor(targetLevel)));
  const catalystRarity = getForgeCatalystRarity(normalizedLevel);
  return FORGE_CATALYST_BASE_COSTS[catalystRarity] + ((normalizedLevel - 1) * 250);
}

export function getForgeDamagePenaltyBps(sourceEnchantLevel: number): number {
  const normalizedLevel = Math.max(FORGE_SAFE_ENCHANT_LEVEL + 1, Math.min(FORGE_MAX_ENCHANT_LEVEL, Math.floor(sourceEnchantLevel)));
  return Math.min(2_000, 800 + ((normalizedLevel - (FORGE_SAFE_ENCHANT_LEVEL + 1)) * 200));
}

export function getForgeCleanseCostDucats(sourceEnchantLevel: number): number {
  const normalizedLevel = Math.max(FORGE_SAFE_ENCHANT_LEVEL + 1, Math.min(FORGE_MAX_ENCHANT_LEVEL, Math.floor(sourceEnchantLevel)));
  return (getForgeAttemptCostDucats(normalizedLevel) * 2) + (normalizedLevel * 400);
}
