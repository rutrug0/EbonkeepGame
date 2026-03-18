import { z } from "zod";

import { playerClassSchema } from "../../core/index.js";
import {
  combatActorSideSchema,
  combatActorSnapshotSchema,
  combatEventSchema
} from "../combat/index.js";

export const ARENA_STARTING_RATING = 1000;
export const ARENA_MIN_RATING = 100;
export const ARENA_ELO_K_FACTOR = 32;
export const ARENA_FIND_COOLDOWN_SECONDS = 10 * 60;
export const ARENA_OFFER_COUNT = 3;
export const MAX_ARENA_OFFER_COUNT = 5;
export const ARENA_LADDER_LIMIT = 10;
export const ARENA_RECENT_MATCH_LIMIT = 8;

export const arenaEntrySourceSchema = z.enum(["player", "mock"]);
export type ArenaEntrySource = z.infer<typeof arenaEntrySourceSchema>;

export const arenaPreviewStatsSchema = z.object({
  mainDamage: z.number().int().min(0),
  maxHitpoints: z.number().int().min(1),
  combatSpeed: z.number().int().min(1),
  armor: z.number().int().min(0)
});
export type ArenaPreviewStats = z.infer<typeof arenaPreviewStatsSchema>;

export const arenaOpponentSummarySchema = z.object({
  entryId: z.string(),
  displayName: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  rating: z.number().int().min(ARENA_MIN_RATING),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  source: arenaEntrySourceSchema,
  weaponLabel: z.string().nullable(),
  previewStats: arenaPreviewStatsSchema
});
export type ArenaOpponentSummary = z.infer<typeof arenaOpponentSummarySchema>;

export const arenaProfileSchema = z.object({
  entryId: z.string(),
  rating: z.number().int().min(ARENA_MIN_RATING),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  rank: z.number().int().min(1),
  cooldownEndsAt: z.string().nullable()
});
export type ArenaProfile = z.infer<typeof arenaProfileSchema>;

export const arenaOfferSchema = z.object({
  offerId: z.string(),
  offeredAt: z.string(),
  cooldownEndsAt: z.string(),
  opponent: arenaOpponentSummarySchema
});
export type ArenaOffer = z.infer<typeof arenaOfferSchema>;

export const arenaLadderEntrySchema = z.object({
  rank: z.number().int().min(1),
  entryId: z.string(),
  displayName: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  rating: z.number().int().min(ARENA_MIN_RATING),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  isCurrentPlayer: z.boolean(),
  source: arenaEntrySourceSchema
});
export type ArenaLadderEntry = z.infer<typeof arenaLadderEntrySchema>;

export const arenaLadderSchema = z.object({
  entries: z.array(arenaLadderEntrySchema),
  currentPlayerRank: z.number().int().min(1).nullable()
});
export type ArenaLadder = z.infer<typeof arenaLadderSchema>;

export const arenaMatchHistoryEntrySchema = z.object({
  matchId: z.string(),
  createdAt: z.string(),
  outcome: z.enum(["win", "loss"]),
  ratingDelta: z.number().int(),
  ratingAfter: z.number().int().min(ARENA_MIN_RATING),
  opponent: arenaOpponentSummarySchema
});
export type ArenaMatchHistoryEntry = z.infer<typeof arenaMatchHistoryEntrySchema>;

export const arenaEncounterSchema = z.object({
  encounterId: z.string(),
  locationName: z.string(),
  combatBackgroundPath: z.string().nullable(),
  player: combatActorSnapshotSchema,
  enemy: combatActorSnapshotSchema
});
export type ArenaEncounter = z.infer<typeof arenaEncounterSchema>;

export const arenaStateResponseSchema = z.object({
  serverTime: z.string(),
  profile: arenaProfileSchema,
  offers: z.array(arenaOfferSchema).max(MAX_ARENA_OFFER_COUNT),
  ladder: arenaLadderSchema,
  recentMatches: z.array(arenaMatchHistoryEntrySchema).max(ARENA_RECENT_MATCH_LIMIT),
  canFindOpponents: z.boolean()
});
export type ArenaStateResponse = z.infer<typeof arenaStateResponseSchema>;

export const arenaMatchResultSchema = z.object({
  matchId: z.string(),
  winnerSide: combatActorSideSchema,
  ratingDelta: z.number().int(),
  profile: arenaProfileSchema,
  ladder: arenaLadderSchema,
  recentMatches: z.array(arenaMatchHistoryEntrySchema).max(ARENA_RECENT_MATCH_LIMIT),
  encounter: arenaEncounterSchema,
  events: z.array(combatEventSchema).min(1)
});
export type ArenaMatchResult = z.infer<typeof arenaMatchResultSchema>;
