import { z } from "zod";

import { playerClassSchema } from "../../core/index.js";
import { guildSchema } from "../guild/index.js";

export const leaderboardTypeSchema = z.enum(["power", "level"]);
export type LeaderboardType = z.infer<typeof leaderboardTypeSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  playerId: z.string(),
  username: z.string(),
  class: playerClassSchema,
  level: z.number().int().min(1),
  gearScore: z.number().int().min(0),
  value: z.number().int().min(0),
  guildId: z.string().nullable().optional().default(null),
  guildTag: z.string().nullable().optional().default(null),
  guildName: z.string().nullable().optional().default(null)
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.object({
  leaderboardType: leaderboardTypeSchema,
  entries: z.array(leaderboardEntrySchema),
  totalPlayers: z.number().int().min(0),
  currentPlayerRank: z.number().int().min(0).nullable()
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export const guildLeaderboardTypeSchema = z.enum(["power", "memberCount", "level"]);
export type GuildLeaderboardType = z.infer<typeof guildLeaderboardTypeSchema>;

export const guildLeaderboardQuerySchema = z.object({
  sortBy: guildLeaderboardTypeSchema.default("power"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildLeaderboardQuery = z.infer<typeof guildLeaderboardQuerySchema>;
export type GuildLeaderboardSort = "power" | "memberCount" | "level";

export const guildLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  guild: guildSchema,
  memberCount: z.number().int(),
  value: z.number().int()
});
export type GuildLeaderboardEntry = z.infer<typeof guildLeaderboardEntrySchema>;

export const guildLeaderboardResponseSchema = z.object({
  leaderboardType: guildLeaderboardTypeSchema,
  guilds: z.array(guildLeaderboardEntrySchema),
  totalGuilds: z.number().int()
});
export type GuildLeaderboardResponse = z.infer<typeof guildLeaderboardResponseSchema>;
