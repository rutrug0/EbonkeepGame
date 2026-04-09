import { z } from "zod";

import { combatPlaybackEncounterSchema, combatPlaybackEventSchema } from "../combat/index.js";
import { guildRaidBossDefinitionSchema, guildRaidEncounterSchema } from "../guild/index.js";
import { inventoryItemSchema } from "../inventory/index.js";

export const mailboxMessageKindSchema = z.enum(["system_reward", "direct", "guild_broadcast"]);
export type MailboxMessageKind = z.infer<typeof mailboxMessageKindSchema>;

export const mailboxMessageSourceTypeSchema = z.enum(["jobs", "contracts", "guild_raid", "auction", "player", "guild"]);
export type MailboxMessageSourceType = z.infer<typeof mailboxMessageSourceTypeSchema>;

export const mailboxCapabilitySchema = z.object({
  canSendDirect: z.boolean(),
  canSendGuild: z.boolean(),
  guildId: z.string().nullable(),
  guildName: z.string().nullable()
});
export type MailboxCapability = z.infer<typeof mailboxCapabilitySchema>;

export const mailboxRewardAttachmentSchema = z.object({
  experience: z.number().int().min(0).default(0),
  ducats: z.number().int().min(0).default(0),
  imperials: z.number().int().min(0).default(0),
  renown: z.number().int().min(0).default(0),
  items: z.array(inventoryItemSchema).default([])
});
export type MailboxRewardAttachment = z.infer<typeof mailboxRewardAttachmentSchema>;

export const mailboxInboxEntrySchema = z.object({
  messageId: z.string().min(1),
  kind: mailboxMessageKindSchema,
  sourceType: mailboxMessageSourceTypeSchema.nullable(),
  subject: z.string().min(1),
  previewText: z.string().min(1),
  senderName: z.string().nullable(),
  createdAt: z.string().datetime(),
  isRead: z.boolean(),
  hasRewards: z.boolean(),
  rewardsClaimed: z.boolean(),
  hasReplay: z.boolean()
});
export type MailboxInboxEntry = z.infer<typeof mailboxInboxEntrySchema>;

export const mailboxMessageDetailSchema = z.object({
  messageId: z.string().min(1),
  kind: mailboxMessageKindSchema,
  sourceType: mailboxMessageSourceTypeSchema.nullable(),
  subject: z.string().min(1),
  body: z.string().min(1),
  senderName: z.string().nullable(),
  senderPlayerId: z.string().nullable(),
  guildId: z.string().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
  claimedAt: z.string().datetime().nullable(),
  rewards: mailboxRewardAttachmentSchema.nullable(),
  hasReplay: z.boolean()
});
export type MailboxMessageDetail = z.infer<typeof mailboxMessageDetailSchema>;

export const mailboxInboxResponseSchema = z.object({
  entries: z.array(mailboxInboxEntrySchema),
  unreadCount: z.number().int().min(0),
  capabilities: mailboxCapabilitySchema
});
export type MailboxInboxResponse = z.infer<typeof mailboxInboxResponseSchema>;

export const mailboxUnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().min(0)
});
export type MailboxUnreadCountResponse = z.infer<typeof mailboxUnreadCountResponseSchema>;

export const sendDirectMailboxMessageBodySchema = z.object({
  recipient: z.string().trim().min(1).max(64),
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2_000)
});
export type SendDirectMailboxMessageBody = z.infer<typeof sendDirectMailboxMessageBodySchema>;

export const sendGuildMailboxMessageBodySchema = z.object({
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2_000)
});
export type SendGuildMailboxMessageBody = z.infer<typeof sendGuildMailboxMessageBodySchema>;

export const mailboxMessageMutationResponseSchema = z.object({
  message: mailboxMessageDetailSchema.nullable(),
  deletedMessageId: z.string().min(1).nullable().default(null),
  unreadCount: z.number().int().min(0)
});
export type MailboxMessageMutationResponse = z.infer<typeof mailboxMessageMutationResponseSchema>;

export const mailboxCombatReplayPayloadSchema = z.object({
  kind: z.literal("combat"),
  encounter: combatPlaybackEncounterSchema,
  timeline: z.array(combatPlaybackEventSchema)
});
export type MailboxCombatReplayPayload = z.infer<typeof mailboxCombatReplayPayloadSchema>;

export const mailboxGuildRaidReplayPayloadSchema = z.object({
  kind: z.literal("guild_raid"),
  boss: guildRaidBossDefinitionSchema,
  encounter: guildRaidEncounterSchema
});
export type MailboxGuildRaidReplayPayload = z.infer<typeof mailboxGuildRaidReplayPayloadSchema>;

export const mailboxReplayResponseSchema = z.discriminatedUnion("kind", [
  mailboxCombatReplayPayloadSchema,
  mailboxGuildRaidReplayPayloadSchema
]);
export type MailboxReplayResponse = z.infer<typeof mailboxReplayResponseSchema>;
