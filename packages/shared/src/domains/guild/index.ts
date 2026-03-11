import { z } from "zod";

import { playerClassSchema } from "../../core/index.js";
import { DEFAULT_GUILD_CREST_ID, GUILD_CREST_CATALOG } from "../../guild-crests.js";

export * from "../../guild-crests.js";

export const guildRoleSchema = z.enum(["leader", "officer", "member"]);
export type GuildRole = z.infer<typeof guildRoleSchema>;

export const guildInviteStatusSchema = z.enum(["pending", "accepted", "declined", "expired"]);
export type GuildInviteStatus = z.infer<typeof guildInviteStatusSchema>;

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

export const guildCrestIdSchema = z.enum(
  GUILD_CREST_CATALOG.map((crest: (typeof GUILD_CREST_CATALOG)[number]) => crest.id) as [string, ...string[]]
);
export type GuildCrestId = z.infer<typeof guildCrestIdSchema>;

export const guildCrestSchema = z.object({
  bgShape: z.string(),
  bgColor: z.string(),
  bgPattern: z.string().nullable().optional(),
  fgSymbol: z.string(),
  fgColor: z.string(),
  frame: z.string().nullable().optional()
});
export type GuildCrest = z.infer<typeof guildCrestSchema>;

export const guildSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string(),
  crestId: guildCrestIdSchema.default(DEFAULT_GUILD_CREST_ID),
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
  memberCount: z.number().int().optional()
});
export type Guild = z.infer<typeof guildSchema>;

export const guildMemberSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  playerId: z.string(),
  role: guildRoleSchema,
  joinedAt: z.string().datetime(),
  contributedPower: z.number().int()
});
export type GuildMember = z.infer<typeof guildMemberSchema>;

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

export const createGuildRequestSchema = z.object({
  name: z.string().min(3).max(32),
  tag: z.string().min(2).max(6),
  description: z.string().max(500).optional(),
  crestId: guildCrestIdSchema.default(DEFAULT_GUILD_CREST_ID)
});
export type CreateGuildRequest = z.infer<typeof createGuildRequestSchema>;

export const createGuildResponseSchema = z.object({
  guild: guildSchema,
  membership: guildMemberSchema
});
export type CreateGuildResponse = z.infer<typeof createGuildResponseSchema>;

export const updateGuildRequestSchema = z.object({
  description: z.string().max(500).optional(),
  crestId: guildCrestIdSchema.optional(),
  isRecruiting: z.boolean().optional()
});
export type UpdateGuildRequest = z.infer<typeof updateGuildRequestSchema>;

export const guildSearchQuerySchema = z.object({
  name: z.string().optional(),
  tag: z.string().optional(),
  minMembers: z.coerce.number().int().min(0).optional(),
  maxMembers: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildSearchQuery = z.infer<typeof guildSearchQuerySchema>;
export const searchGuildsQuerySchema = guildSearchQuerySchema;
export type SearchGuildsQuery = GuildSearchQuery;

export const guildSearchResponseSchema = z.object({
  guilds: z.array(
    guildSchema.extend({
      memberCount: z.number().int()
    })
  ),
  total: z.number().int()
});
export type GuildSearchResponse = z.infer<typeof guildSearchResponseSchema>;

export const guildDetailsResponseSchema = z.object({
  guild: guildSchema,
  memberCount: z.number().int(),
  currentUserMembership: guildMemberSchema.nullable()
});
export type GuildDetailsResponse = z.infer<typeof guildDetailsResponseSchema>;

export const sendGuildInviteRequestSchema = z.object({
  inviteeId: z.string(),
  message: z.string().max(200).optional()
});
export type SendGuildInviteRequest = z.infer<typeof sendGuildInviteRequestSchema>;

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

export const updateMemberRoleRequestSchema = z.object({
  role: z.enum(["officer", "member"])
});
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

export const transferLeadershipRequestSchema = z.object({
  newLeaderId: z.string()
});
export type TransferLeadershipRequest = z.infer<typeof transferLeadershipRequestSchema>;

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

export const guildActivityQuerySchema = z.object({
  actionType: guildActivityTypeSchema.optional(),
  actorId: z.string().optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type GuildActivityQuery = z.infer<typeof guildActivityQuerySchema>;

export const guildActivityWithDetailsSchema = guildActivitySchema.extend({
  actor: z
    .object({
      id: z.string(),
      account: z.object({
        username: z.string().nullable()
      })
    })
    .nullable(),
  target: z
    .object({
      id: z.string(),
      account: z.object({
        username: z.string().nullable()
      })
    })
    .nullable()
});
export type GuildActivityWithDetails = z.infer<typeof guildActivityWithDetailsSchema>;

export const guildActivityResponseSchema = z.object({
  activities: z.array(guildActivityWithDetailsSchema),
  total: z.number().int()
});
export type GuildActivityResponse = z.infer<typeof guildActivityResponseSchema>;

export const GUILD_CREST_COLORS = {
  crimson: "#8B0000",
  forest: "#0B4D1B",
  sapphire: "#0F4C81",
  obsidian: "#1A1A1A",
  ivory: "#FFFFF0",
  gold: "#D4AF37",
  iron: "#4A4A4A",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  white: "#FFFFFF",
  black: "#000000",
  amber: "#FFBF00"
} as const;

export type GuildCrestColor = keyof typeof GUILD_CREST_COLORS;
