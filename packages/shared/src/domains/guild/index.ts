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
  "invited",
  "crest_changed",
  "description_changed",
  "recruiting_toggled",
  "academy_donated"
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

// ─── Academy / Guild Tech Tree ────────────────────────────────────────────────

export const academyRewardTypeSchema = z.enum([
  "stamina_regen_percent",
  "contract_ducats_percent",
  "contract_xp_percent",
  "contract_item_drop_bps",
  "contract_replenish_percent",
  "contract_slot_count_flat",
  "rest_cost_percent",
  "max_members_flat",
  "arena_offer_count_flat",
  "arena_cooldown_percent",
  "arena_rating_win_flat",
  "arena_rating_loss_reduction_flat",
  "strength_flat",
  "armor_flat",
  "physical_defense_flat",
  "intelligence_flat",
  "spell_shield_flat",
  "magic_defense_flat",
  "dexterity_flat",
  "accuracy_flat",
  "dodge_chance_bps"
]);
export type AcademyRewardType = z.infer<typeof academyRewardTypeSchema>;

export const academyRewardSchema = z.object({
  type: academyRewardTypeSchema,
  value: z.number(),
  description: z.string()
});
export type AcademyReward = z.infer<typeof academyRewardSchema>;

export const academyActiveEffectSchema = academyRewardSchema;
export type AcademyActiveEffect = z.infer<typeof academyActiveEffectSchema>;

export const academyNodePrerequisiteSchema = z.object({
  nodeId: z.string(),
  minLevel: z.number().int().min(1)
});
export type AcademyNodePrerequisite = z.infer<typeof academyNodePrerequisiteSchema>;

export const academyNodeLevelConfigSchema = z.object({
  level: z.number().int().min(1),
  ducatCost: z.number().int().min(1),
  rewards: z.array(academyRewardSchema)
});
export type AcademyNodeLevelConfig = z.infer<typeof academyNodeLevelConfigSchema>;

export const academyNodeConfigSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  label: z.string(),
  description: z.string(),
  iconKey: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  prerequisites: z.array(academyNodePrerequisiteSchema),
  maxLevel: z.number().int().min(1),
  levels: z.array(academyNodeLevelConfigSchema),
  hiddenUntilUnlocked: z.boolean(),
  completionReward: academyRewardSchema.optional()
});
export type AcademyNodeConfig = z.infer<typeof academyNodeConfigSchema>;

export const academyBranchConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  iconKey: z.string(),
  color: z.string(),
  completionReward: academyRewardSchema.optional()
});
export type AcademyBranchConfig = z.infer<typeof academyBranchConfigSchema>;

export const academyTreeConfigSchema = z.object({
  version: z.number().int(),
  centerNodeId: z.string(),
  branches: z.array(academyBranchConfigSchema),
  nodes: z.array(academyNodeConfigSchema)
});
export type AcademyTreeConfig = z.infer<typeof academyTreeConfigSchema>;

// ── Runtime state ──

export const academyNodeStatusSchema = z.enum(["locked", "available", "in_progress", "completed", "maxed"]);
export type AcademyNodeStatus = z.infer<typeof academyNodeStatusSchema>;

export const academyNodeStateSchema = z.object({
  nodeId: z.string(),
  currentLevel: z.number().int(),
  ducatsInvested: z.number().int(),
  ducatsToNextLevel: z.number().int().nullable(),
  status: academyNodeStatusSchema
});
export type AcademyNodeState = z.infer<typeof academyNodeStateSchema>;

export const academyTreeStateSchema = z.object({
  guildId: z.string(),
  config: academyTreeConfigSchema,
  nodes: z.record(z.string(), academyNodeStateSchema),
  totalDonated: z.number().int(),
  activeEffects: z.array(academyActiveEffectSchema),
  chargesState: z.object({
    charges: z.number().int().min(0).max(20),
    maxCharges: z.literal(20),
    nextChargeAt: z.string().datetime().nullable(),
    secondsUntilNext: z.number().int().nullable(),
    ducatsPerCharge: z.number().int()
  })
});
export type AcademyTreeState = z.infer<typeof academyTreeStateSchema>;

export const academyDonationChargesStateSchema = z.object({
  charges: z.number().int().min(0).max(20),
  maxCharges: z.literal(20),
  nextChargeAt: z.string().datetime().nullable(),
  secondsUntilNext: z.number().int().nullable(),
  ducatsPerCharge: z.number().int()
});
export type AcademyDonationChargesState = z.infer<typeof academyDonationChargesStateSchema>;

export const donateToNodeRequestSchema = z.object({
  nodeId: z.string().min(1),
  chargesSpent: z.number().int().min(1).max(20)
});
export type DonateToNodeRequest = z.infer<typeof donateToNodeRequestSchema>;

export const donateToNodeResponseSchema = z.object({
  nodeId: z.string(),
  newLevel: z.number().int(),
  ducatsInvested: z.number().int(),
  ducatsToNextLevel: z.number().int().nullable(),
  status: academyNodeStatusSchema,
  levelsGained: z.number().int(),
  remainingDucats: z.number().int(),
  chargesState: academyDonationChargesStateSchema
});
export type DonateToNodeResponse = z.infer<typeof donateToNodeResponseSchema>;

export const academyDonationEntrySchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  nodeId: z.string(),
  amount: z.number().int(),
  donatedAt: z.string()
});
export type AcademyDonationEntry = z.infer<typeof academyDonationEntrySchema>;

export const academyDonationHistoryResponseSchema = z.object({
  donations: z.array(academyDonationEntrySchema),
  total: z.number().int()
});
export type AcademyDonationHistoryResponse = z.infer<typeof academyDonationHistoryResponseSchema>;

export const academyMemberContributionSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  totalDonated: z.number().int()
});
export type AcademyMemberContribution = z.infer<typeof academyMemberContributionSchema>;

export const academyMemberContributionsResponseSchema = z.object({
  contributions: z.array(academyMemberContributionSchema)
});
export type AcademyMemberContributionsResponse = z.infer<typeof academyMemberContributionsResponseSchema>;

// Raid Bosses

export const guildRaidEffectTypeSchema = z.enum([
  "stamina_regen_percent",
  "contract_ducats_percent",
  "contract_xp_percent",
  "contract_item_drop_bps",
  "contract_replenish_percent",
  "rest_cost_percent",
  "strength_flat",
  "armor_flat",
  "physical_defense_flat",
  "intelligence_flat",
  "spell_shield_flat",
  "magic_defense_flat",
  "dexterity_flat",
  "accuracy_flat",
  "dodge_chance_bps"
]);
export type GuildRaidEffectType = z.infer<typeof guildRaidEffectTypeSchema>;

export const guildRaidBonusSchema = z.object({
  type: guildRaidEffectTypeSchema,
  value: z.number(),
  label: z.string(),
  description: z.string()
});
export type GuildRaidBonus = z.infer<typeof guildRaidBonusSchema>;

export const guildRaidBossDefinitionSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int().min(0),
  zoneKey: z.string(),
  zoneName: z.string(),
  bossName: z.string(),
  bossTitle: z.string(),
  flavorText: z.string(),
  portraitAssetPath: z.string().nullable().optional(),
  stageAssetPath: z.string().nullable().optional(),
  recommendedGuildPower: z.number().int().min(0),
  bossMaxHp: z.number().int().min(1),
  minParticipants: z.number().int().min(1),
  participantCap: z.number().int().min(1),
  summonDucatsCost: z.number().int().min(0),
  summonImperialsCost: z.number().int().min(0),
  lobbyDurationHours: z.number().int().min(1),
  lockDurationHours: z.number().int().min(1),
  unlockedBonus: guildRaidBonusSchema
});
export type GuildRaidBossDefinition = z.infer<typeof guildRaidBossDefinitionSchema>;

export const guildRaidProgressionEntrySchema = z.object({
  bossId: z.string(),
  orderIndex: z.number().int().min(0),
  zoneName: z.string(),
  bossName: z.string(),
  status: z.enum(["cleared", "current", "upcoming"]),
  clearedAt: z.string().datetime().nullable(),
  unlockedBonus: guildRaidBonusSchema
});
export type GuildRaidProgressionEntry = z.infer<typeof guildRaidProgressionEntrySchema>;

export const guildRaidParticipantSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  playerClass: playerClassSchema,
  role: guildRoleSchema,
  level: z.number().int().min(1),
  power: z.number().int().min(0),
  joinedAt: z.string().datetime(),
  isCurrentUser: z.boolean()
});
export type GuildRaidParticipant = z.infer<typeof guildRaidParticipantSchema>;

export const guildRaidDpsEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  playerClass: playerClassSchema,
  role: guildRoleSchema,
  damageDone: z.number().int().min(0),
  damageShareBps: z.number().int().min(0).max(10_000),
  power: z.number().int().min(0)
});
export type GuildRaidDpsEntry = z.infer<typeof guildRaidDpsEntrySchema>;

export const guildRaidReportSchema = z.object({
  outcome: z.enum(["victory", "defeat"]),
  summary: z.string(),
  resolvedAt: z.string().datetime(),
  lockEndsAt: z.string().datetime().nullable(),
  firstClear: z.boolean(),
  totalDamage: z.number().int().min(0),
  bossHpMax: z.number().int().min(1),
  bossHpRemaining: z.number().int().min(0),
  ranking: z.array(guildRaidDpsEntrySchema)
});
export type GuildRaidReport = z.infer<typeof guildRaidReportSchema>;

export const guildRaidHistoryEntrySchema = z.object({
  instanceId: z.string(),
  bossId: z.string(),
  bossName: z.string(),
  zoneName: z.string(),
  resolvedAt: z.string().datetime(),
  totalDamage: z.number().int().min(0),
  bossHpRemaining: z.number().int().min(0),
  firstClear: z.boolean(),
  unlockedBonus: guildRaidBonusSchema,
  ranking: z.array(guildRaidDpsEntrySchema)
});
export type GuildRaidHistoryEntry = z.infer<typeof guildRaidHistoryEntrySchema>;

export const guildRaidSummonerSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  role: guildRoleSchema
});
export type GuildRaidSummoner = z.infer<typeof guildRaidSummonerSchema>;

export const guildRaidEncounterSchema = z.object({
  instanceId: z.string(),
  state: z.enum(["lobby", "locked", "resolved"]),
  boss: guildRaidBossDefinitionSchema,
  summonedBy: guildRaidSummonerSchema,
  summonedAt: z.string().datetime(),
  lobbyEndsAt: z.string().datetime(),
  lockEndsAt: z.string().datetime().nullable(),
  joinedPower: z.number().int().min(0),
  joinCount: z.number().int().min(0),
  currentUserJoined: z.boolean(),
  canJoin: z.boolean(),
  canLeave: z.boolean(),
  canCommenceNow: z.boolean(),
  joinBlockedReason: z.string().nullable(),
  participants: z.array(guildRaidParticipantSchema),
  report: guildRaidReportSchema.nullable()
});
export type GuildRaidEncounter = z.infer<typeof guildRaidEncounterSchema>;

export const guildRaidSummonPreviewSchema = z.object({
  ducatsCost: z.number().int().min(0),
  imperialsCost: z.number().int().min(0),
  canSummon: z.boolean(),
  canAfford: z.boolean(),
  blockedReason: z.string().nullable()
});
export type GuildRaidSummonPreview = z.infer<typeof guildRaidSummonPreviewSchema>;

export const guildRaidStateResponseSchema = z.object({
  guildId: z.string(),
  raidLabel: z.string(),
  totalBossCount: z.number().int().min(0),
  bossesDefeatedCount: z.number().int().min(0),
  activeBoss: guildRaidBossDefinitionSchema.nullable(),
  activeEncounter: guildRaidEncounterSchema.nullable(),
  latestResolvedEncounter: guildRaidEncounterSchema.nullable(),
  latestReport: guildRaidReportSchema.nullable(),
  history: z.array(guildRaidHistoryEntrySchema),
  unlockedBonuses: z.array(guildRaidBonusSchema),
  progression: z.array(guildRaidProgressionEntrySchema),
  currentUserRole: guildRoleSchema.nullable(),
  currentUserCanSummon: z.boolean(),
  summonPreview: guildRaidSummonPreviewSchema
});
export type GuildRaidStateResponse = z.infer<typeof guildRaidStateResponseSchema>;

export const summonGuildRaidResponseSchema = guildRaidStateResponseSchema;
export type SummonGuildRaidResponse = z.infer<typeof summonGuildRaidResponseSchema>;

export const joinGuildRaidResponseSchema = guildRaidStateResponseSchema;
export type JoinGuildRaidResponse = z.infer<typeof joinGuildRaidResponseSchema>;

export const leaveGuildRaidResponseSchema = guildRaidStateResponseSchema;
export type LeaveGuildRaidResponse = z.infer<typeof leaveGuildRaidResponseSchema>;

export const commenceGuildRaidResponseSchema = guildRaidStateResponseSchema;
export type CommenceGuildRaidResponse = z.infer<typeof commenceGuildRaidResponseSchema>;
