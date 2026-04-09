import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  mailboxInboxResponseSchema,
  mailboxMessageDetailSchema,
  mailboxMessageMutationResponseSchema,
  mailboxReplayResponseSchema,
  mailboxRewardAttachmentSchema,
  mailboxUnreadCountResponseSchema,
  sendDirectMailboxMessageBodySchema,
  sendGuildMailboxMessageBodySchema,
  type MailboxCapability,
  type MailboxInboxResponse,
  type MailboxMessageDetail,
  type MailboxMessageMutationResponse,
  type MailboxReplayResponse,
  type MailboxRewardAttachment,
  type MailboxUnreadCountResponse,
  type SendDirectMailboxMessageBody,
  type SendGuildMailboxMessageBody
} from "@ebonkeep/shared/messages";
import { combatEventSchema, contractRunSnapshotSchema, type ContractRunSnapshot } from "@ebonkeep/shared/combat";
import { getCraftingMaterialDefinition, getCraftingOutputDefinition } from "@ebonkeep/shared/crafting";
import { inventoryItemSchema, type InventoryItem } from "@ebonkeep/shared/inventory";

import { grantPlayerExperience } from "../player/progression-service.js";
import { buildContractMailboxReplay } from "./replay-builders.js";

type MessageDbClient = PrismaClient | Prisma.TransactionClient;

const INVENTORY_ITEM_LIMIT = 20;
const MANAGER_GUILD_ROLES = new Set(["leader", "officer"]);

type DeliveryRecord = Prisma.MessageDeliveryGetPayload<{
  include: {
    message: {
      include: {
        rewardAttachment: true;
      };
    };
  };
}>;

export class MessageError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "MessageError";
  }
}

function isGuildManagerRole(role: string | null | undefined): boolean {
  return role ? MANAGER_GUILD_ROLES.has(role) : false;
}

function buildMessagePreview(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

function buildGenericStackableItem(args: {
  itemCode: string;
  itemName: string;
  category: string;
  description: string;
  quantity: number;
  rarity?: InventoryItem["rarity"];
  iconAssetPath?: string;
}): InventoryItem {
  return inventoryItemSchema.parse({
    id: `itm_${randomUUID().replaceAll("-", "")}`,
    itemCode: args.itemCode,
    itemName: args.itemName,
    rarity: args.rarity ?? "common",
    category: args.category,
    equipable: false,
    allowedSlotIds: [],
    levelRequirement: 1,
    baseLevel: 1,
    power: 0,
    quantity: Math.max(1, Math.floor(args.quantity)),
    archetype: { majorCategory: "consumable" },
    statBonuses: {},
    description: args.description,
    iconAssetPath: args.iconAssetPath
  });
}

export function buildMailboxCraftingMaterialItem(itemCode: string, quantity: number): InventoryItem {
  const material = getCraftingMaterialDefinition(itemCode);
  if (!material) {
    throw new MessageError("INVALID_ATTACHMENT_ITEM", 500, `Unknown crafting material ${itemCode}.`);
  }
  return buildGenericStackableItem({
    itemCode,
    itemName: material.displayName,
    category: "Material",
    description: material.description,
    quantity,
    rarity: material.rarity
  });
}

export function buildMailboxCraftingOutputItem(itemCode: string, quantity: number): InventoryItem {
  const output = getCraftingOutputDefinition(itemCode);
  if (!output) {
    throw new MessageError("INVALID_ATTACHMENT_ITEM", 500, `Unknown crafting output ${itemCode}.`);
  }
  return buildGenericStackableItem({
    itemCode,
    itemName: output.displayName,
    category: "Provision",
    description: output.description,
    quantity,
    rarity: output.rarity
  });
}

export function buildMailboxJobResourceItem(args: {
  resource: "ironOre" | "charcoal" | "supplyCrates" | "seedBundles" | "herbs";
  quantity: number;
}): InventoryItem {
  const mapping = {
    ironOre: {
      itemCode: "job_iron_ore",
      itemName: "Iron Ore",
      category: "Material",
      description: "Raw ore recovered from jobs and stored for later use."
    },
    charcoal: {
      itemCode: "job_charcoal",
      itemName: "Charcoal",
      category: "Material",
      description: "Fuel stock recovered from jobs and stored for later use."
    },
    supplyCrates: {
      itemCode: "job_supply_crate",
      itemName: "Supply Crate",
      category: "Supply",
      description: "Packed provisions secured from logistics jobs."
    },
    seedBundles: {
      itemCode: "job_seed_bundle",
      itemName: "Seed Bundle",
      category: "Supply",
      description: "Seed bundles delivered through the jobs board."
    },
    herbs: {
      itemCode: "job_wild_herbs",
      itemName: "Wild Herbs",
      category: "Material",
      description: "Loose herbs gathered from jobs and ready for storage."
    }
  } as const;

  const entry = mapping[args.resource];
  return buildGenericStackableItem({
    itemCode: entry.itemCode,
    itemName: entry.itemName,
    category: entry.category,
    description: entry.description,
    quantity: args.quantity
  });
}

function parseRewardAttachment(payload: Prisma.JsonValue | null | undefined): MailboxRewardAttachment | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return mailboxRewardAttachmentSchema.parse(payload);
}

function toInputJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasClaimableRewards(rewards: MailboxRewardAttachment | null): boolean {
  if (!rewards) {
    return false;
  }

  return rewards.items.length > 0
    || rewards.ducats > 0
    || rewards.imperials > 0
    || rewards.renown > 0;
}

function toManualClaimRewards(rewards: MailboxRewardAttachment | null | undefined): MailboxRewardAttachment | null {
  if (!rewards) {
    return null;
  }

  const normalizedRewards = mailboxRewardAttachmentSchema.parse(rewards);
  const manualClaimRewards: MailboxRewardAttachment = {
    ...normalizedRewards,
    experience: 0
  };

  return hasClaimableRewards(manualClaimRewards) ? manualClaimRewards : null;
}

function detailFromDelivery(delivery: DeliveryRecord): MailboxMessageDetail {
  return mailboxMessageDetailSchema.parse({
    messageId: delivery.messageId,
    kind: delivery.message.kind,
    sourceType: delivery.message.sourceType,
    subject: delivery.message.subject,
    body: delivery.message.body,
    senderName: delivery.message.senderName,
    senderPlayerId: delivery.message.senderPlayerId,
    guildId: delivery.message.guildId,
    createdAt: delivery.message.createdAt.toISOString(),
    readAt: delivery.readAt?.toISOString() ?? null,
    claimedAt: delivery.claimedAt?.toISOString() ?? null,
    rewards: parseRewardAttachment(delivery.message.rewardAttachment?.payload),
    hasReplay: Boolean(delivery.message.replayId)
  });
}

async function getUnreadCountInternal(prisma: MessageDbClient, playerId: string): Promise<number> {
  return prisma.messageDelivery.count({
    where: {
      recipientPlayerId: playerId,
      readAt: null
    }
  });
}

async function getMailboxCapabilities(prisma: MessageDbClient, playerId: string): Promise<MailboxCapability> {
  const membership = await prisma.guildMember.findFirst({
    where: { playerId },
    include: {
      guild: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return {
    canSendDirect: true,
    canSendGuild: isGuildManagerRole(membership?.role),
    guildId: membership?.guild.id ?? null,
    guildName: membership?.guild.name ?? null
  };
}

async function loadRecipientDisplayName(prisma: MessageDbClient, playerId: string): Promise<string | null> {
  const profile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    include: {
      account: {
        select: {
          username: true
        }
      }
    }
  });

  return profile?.account.username?.trim() || null;
}

async function resolvePlayerIdByUsernameOrId(prisma: MessageDbClient, recipientInput: string): Promise<string> {
  const accountByUsername = await prisma.account.findFirst({
    where: {
      username: {
        equals: recipientInput,
        mode: "insensitive"
      }
    },
    include: {
      profiles: {
        select: { id: true },
        take: 1
      }
    }
  });

  if (accountByUsername?.profiles[0]?.id) {
    return accountByUsername.profiles[0].id;
  }

  const playerById = await prisma.playerProfile.findUnique({
    where: { id: recipientInput },
    select: { id: true }
  });
  if (!playerById) {
    throw new MessageError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }
  return playerById.id;
}

async function loadDelivery(prisma: MessageDbClient, playerId: string, messageId: string): Promise<DeliveryRecord> {
  const delivery = await prisma.messageDelivery.findFirst({
    where: {
      recipientPlayerId: playerId,
      messageId
    },
    include: {
      message: {
        include: {
          rewardAttachment: true
        }
      }
    }
  });

  if (!delivery) {
    throw new MessageError("MESSAGE_NOT_FOUND", 404, "Message not found.");
  }
  return delivery;
}

async function loadContractRunSnapshotForReplay(prisma: MessageDbClient, runId: string): Promise<ContractRunSnapshot | null> {
  const run = await prisma.contractRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      slotIndex: true,
      state: true,
      contractName: true,
      difficulty: true,
      familyId: true,
      familyName: true,
      locationName: true,
      encounterLevel: true,
      travelEndsAt: true,
      travelDurationSeconds: true,
      playerSnapshot: true,
      enemySnapshots: true,
      combatBackgroundPath: true,
      travelImagePath: true
    }
  });

  if (!run) {
    return null;
  }

  return contractRunSnapshotSchema.parse({
    runId: run.id,
    slotId: run.slotIndex,
    state: run.state,
    contractName: run.contractName,
    levelBand: run.difficulty,
    familyId: run.familyId,
    familyName: run.familyName,
    locationName: run.locationName,
    encounterLevel: run.encounterLevel,
    travelEndsAt: run.travelEndsAt.toISOString(),
    travelDurationSeconds: run.travelDurationSeconds,
    player: run.playerSnapshot,
    enemies: run.enemySnapshots,
    combatBackgroundPath: run.combatBackgroundPath,
    travelImagePath: run.travelImagePath
  });
}

async function createReplayRecord(
  prisma: MessageDbClient,
  args: { kind: "combat" | "guild_raid"; sourceType: string; sourceRefId: string; payload: MailboxReplayResponse }
): Promise<string> {
  const existing = await prisma.combatReplayRecord.findUnique({
    where: {
      sourceType_sourceRefId_kind: {
        sourceType: args.sourceType,
        sourceRefId: args.sourceRefId,
        kind: args.kind
      }
    },
    select: { id: true }
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.combatReplayRecord.create({
    data: {
      kind: args.kind,
      sourceType: args.sourceType,
      sourceRefId: args.sourceRefId,
      payload: toInputJson(args.payload)
    },
    select: { id: true }
  });
  return created.id;
}

export async function createSystemRewardMessage(
  prisma: MessageDbClient,
  args: {
    recipients: string[];
    subject: string;
    body: string;
    sourceType: "jobs" | "contracts" | "guild_raid" | "auction";
    sourceRefId: string;
    guildId?: string | null;
    rewards?: MailboxRewardAttachment | null;
    replay?: MailboxReplayResponse | null;
  }
): Promise<string> {
  const recipientIds = [...new Set(args.recipients)];
  const parsedRewards = args.rewards ? mailboxRewardAttachmentSchema.parse(args.rewards) : null;
  const experienceGranted = parsedRewards?.experience ?? 0;
  const manualClaimRewards = toManualClaimRewards(parsedRewards);

  if (recipientIds.length === 0) {
    throw new MessageError("MESSAGE_RECIPIENTS_REQUIRED", 400, "At least one message recipient is required.");
  }

  const existing = await prisma.message.findFirst({
    where: {
      kind: "system_reward",
      sourceType: args.sourceType,
      sourceRefId: args.sourceRefId
    },
    select: { id: true }
  });
  if (existing) {
    for (const recipientPlayerId of recipientIds) {
      const existingDelivery = await prisma.messageDelivery.findUnique({
        where: {
          messageId_recipientPlayerId: {
            messageId: existing.id,
            recipientPlayerId
          }
        },
        select: { id: true }
      });

      if (existingDelivery) {
        continue;
      }

      await prisma.messageDelivery.create({
        data: {
          messageId: existing.id,
          recipientPlayerId
        }
      });

      if (experienceGranted > 0) {
        await grantPlayerExperience(prisma, recipientPlayerId, experienceGranted);
      }
    }

    return existing.id;
  }

  const replayId =
    args.replay && args.sourceRefId
      ? await createReplayRecord(prisma, {
          kind: args.replay.kind,
          sourceType: args.sourceType,
          sourceRefId: args.sourceRefId,
          payload: mailboxReplayResponseSchema.parse(args.replay)
        })
      : null;

  const message = await prisma.message.create({
    data: {
      kind: "system_reward",
      sourceType: args.sourceType,
      sourceRefId: args.sourceRefId,
      guildId: args.guildId ?? null,
      subject: args.subject,
      body: args.body,
      replayId,
      rewardAttachment: manualClaimRewards
        ? {
            create: {
              payload: toInputJson(manualClaimRewards)
            }
          }
        : undefined,
      deliveries: {
        create: recipientIds.map((recipientPlayerId) => ({
          recipientPlayerId
        }))
      }
    },
    select: { id: true }
  });

  if (experienceGranted > 0) {
    for (const recipientPlayerId of recipientIds) {
      await grantPlayerExperience(prisma, recipientPlayerId, experienceGranted);
    }
  }

  return message.id;
}

export async function listMailbox(prisma: PrismaClient, playerId: string): Promise<MailboxInboxResponse> {
  const [deliveries, unreadCount, capabilities] = await Promise.all([
    prisma.messageDelivery.findMany({
      where: {
        recipientPlayerId: playerId
      },
      include: {
        message: {
          include: {
            rewardAttachment: true
          }
        }
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    }),
    getUnreadCountInternal(prisma, playerId),
    getMailboxCapabilities(prisma, playerId)
  ]);

  return mailboxInboxResponseSchema.parse({
    entries: deliveries.map((delivery) => {
      const rewards = parseRewardAttachment(delivery.message.rewardAttachment?.payload);
      return {
        messageId: delivery.messageId,
        kind: delivery.message.kind,
        sourceType: delivery.message.sourceType,
        subject: delivery.message.subject,
        previewText: buildMessagePreview(delivery.message.body),
        senderName: delivery.message.senderName,
        createdAt: delivery.message.createdAt.toISOString(),
        isRead: delivery.readAt !== null,
        hasRewards: hasClaimableRewards(rewards),
        rewardsClaimed: delivery.claimedAt !== null,
        hasReplay: Boolean(delivery.message.replayId)
      };
    }),
    unreadCount,
    capabilities
  });
}

export async function getMailboxUnreadCount(prisma: PrismaClient, playerId: string): Promise<MailboxUnreadCountResponse> {
  return mailboxUnreadCountResponseSchema.parse({
    unreadCount: await getUnreadCountInternal(prisma, playerId)
  });
}

export async function getMailboxMessage(prisma: PrismaClient, playerId: string, messageId: string): Promise<MailboxMessageDetail> {
  return detailFromDelivery(await loadDelivery(prisma, playerId, messageId));
}

export async function markMailboxMessageRead(
  prisma: PrismaClient,
  playerId: string,
  messageId: string
): Promise<MailboxMessageMutationResponse> {
  await prisma.messageDelivery.updateMany({
    where: {
      recipientPlayerId: playerId,
      messageId,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  const [delivery, unreadCount] = await Promise.all([
    loadDelivery(prisma, playerId, messageId),
    getUnreadCountInternal(prisma, playerId)
  ]);

  return mailboxMessageMutationResponseSchema.parse({
    message: detailFromDelivery(delivery),
    deletedMessageId: null,
    unreadCount
  });
}

function isStackableItem(item: InventoryItem): boolean {
  return !item.equipable;
}

async function estimateRequiredInventorySlots(
  tx: MessageDbClient,
  playerId: string,
  items: InventoryItem[]
): Promise<number> {
  let required = 0;

  for (const item of items) {
    if (!isStackableItem(item)) {
      required += 1;
      continue;
    }

    const existing = await tx.inventoryItem.findFirst({
      where: {
        playerId,
        slotKey: "inventory",
        itemCode: item.itemCode
      },
      select: { id: true }
    });

    if (!existing) {
      required += 1;
    }
  }

  return required;
}

async function ensureInventoryCapacityForClaim(
  tx: MessageDbClient,
  playerId: string,
  items: InventoryItem[]
): Promise<void> {
  const [currentCount, requiredSlots] = await Promise.all([
    tx.inventoryItem.count({
      where: {
        playerId,
        slotKey: "inventory"
      }
    }),
    estimateRequiredInventorySlots(tx, playerId, items)
  ]);

  if (currentCount + requiredSlots > INVENTORY_ITEM_LIMIT) {
    throw new MessageError("INVENTORY_FULL", 409, "Inventory is full. Clear space before claiming message rewards.");
  }
}

async function grantMailboxInventoryItem(tx: MessageDbClient, playerId: string, item: InventoryItem): Promise<void> {
  const quantity = Math.max(1, Math.floor(item.quantity ?? 1));

  if (isStackableItem(item)) {
    const existing = await tx.inventoryItem.findFirst({
      where: {
        playerId,
        slotKey: "inventory",
        itemCode: item.itemCode
      },
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" }
      ],
      select: { id: true }
    });

    if (existing) {
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: quantity },
          itemData: toInputJson({
            ...item,
            quantity
          })
        }
      });
      return;
    }
  }

  await tx.inventoryItem.create({
    data: {
      id: item.id,
      playerId,
      itemCode: item.itemCode,
      slotKey: "inventory",
      quantity,
      itemData: toInputJson(item)
    }
  });
}

export async function claimMailboxMessageRewards(
  prisma: PrismaClient,
  playerId: string,
  messageId: string
): Promise<MailboxMessageMutationResponse> {
  let replayIdToDelete: string | null = null;

  await prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, playerId, messageId);
    const rewards = parseRewardAttachment(delivery.message.rewardAttachment?.payload);

    if (!rewards) {
      throw new MessageError("MESSAGE_HAS_NO_REWARDS", 400, "This message does not have claimable rewards.");
    }
    if (delivery.claimedAt) {
      throw new MessageError("MESSAGE_ALREADY_CLAIMED", 409, "Rewards from this message were already claimed.");
    }

    await ensureInventoryCapacityForClaim(tx, playerId, rewards.items);

    if (rewards.experience > 0) {
      await grantPlayerExperience(tx, playerId, rewards.experience);
    }
    if (rewards.ducats > 0 || rewards.imperials > 0 || rewards.renown > 0) {
      await tx.currencyBalance.upsert({
        where: { playerId },
        update: {
          ducats: { increment: rewards.ducats },
          imperials: { increment: rewards.imperials },
          renown: { increment: rewards.renown }
        },
        create: {
          playerId,
          ducats: rewards.ducats,
          imperials: rewards.imperials,
          renown: rewards.renown
        }
      });
    }

    for (const item of rewards.items) {
      await grantMailboxInventoryItem(tx, playerId, inventoryItemSchema.parse(item));
    }

    await tx.messageDelivery.delete({
      where: { id: delivery.id }
    });

    const remainingDeliveries = await tx.messageDelivery.count({
      where: {
        messageId: delivery.messageId
      }
    });

    if (remainingDeliveries === 0) {
      replayIdToDelete = delivery.message.replayId ?? null;
      await tx.message.delete({
        where: { id: delivery.messageId }
      });
    }
  });

  if (replayIdToDelete) {
    const replayUsageCount = await prisma.message.count({
      where: {
        replayId: replayIdToDelete
      }
    });

    if (replayUsageCount === 0) {
      await prisma.combatReplayRecord.deleteMany({
        where: { id: replayIdToDelete }
      });
    }
  }

  const unreadCount = await getUnreadCountInternal(prisma, playerId);

  return mailboxMessageMutationResponseSchema.parse({
    message: null,
    deletedMessageId: messageId,
    unreadCount
  });
}

export async function getMailboxReplay(
  prisma: PrismaClient,
  playerId: string,
  messageId: string
): Promise<MailboxReplayResponse> {
  const delivery = await loadDelivery(prisma, playerId, messageId);
  if (!delivery.message.replayId) {
    throw new MessageError("MESSAGE_HAS_NO_REPLAY", 404, "This message does not have a replay.");
  }

  const replay = await prisma.combatReplayRecord.findUnique({
    where: { id: delivery.message.replayId },
    select: {
      payload: true,
      sourceType: true,
      sourceRefId: true
    }
  });
  if (!replay) {
    throw new MessageError("REPLAY_NOT_FOUND", 404, "Replay not found.");
  }

  const parsedReplay = mailboxReplayResponseSchema.parse(replay.payload);

  if (parsedReplay.kind === "combat" && !parsedReplay.encounter.familyId && replay.sourceType === "contracts") {
    const [runSnapshot, runRecord] = await Promise.all([
      loadContractRunSnapshotForReplay(prisma, replay.sourceRefId),
      prisma.contractRun.findUnique({
        where: { id: replay.sourceRefId },
        select: { events: true }
      })
    ]);

    if (runSnapshot && runRecord) {
      const rebuiltReplay = buildContractMailboxReplay({
        run: runSnapshot,
        events: combatEventSchema.array().parse(runRecord.events)
      });

      await prisma.combatReplayRecord.update({
        where: { id: delivery.message.replayId },
        data: {
          payload: toInputJson(rebuiltReplay)
        }
      });

      return rebuiltReplay;
    }
  }

  return parsedReplay;
}

export async function sendDirectMailboxMessage(
  prisma: PrismaClient,
  playerId: string,
  body: SendDirectMailboxMessageBody
): Promise<MailboxMessageMutationResponse> {
  const parsed = sendDirectMailboxMessageBodySchema.parse(body);
  const [recipientPlayerId, senderName] = await Promise.all([
    resolvePlayerIdByUsernameOrId(prisma, parsed.recipient),
    loadRecipientDisplayName(prisma, playerId)
  ]);

  const message = await prisma.message.create({
    data: {
      kind: "direct",
      sourceType: "player",
      sourceRefId: `direct:${playerId}:${Date.now()}`,
      senderPlayerId: playerId,
      senderName,
      subject: parsed.subject,
      body: parsed.body,
      deliveries: {
        create: {
          recipientPlayerId
        }
      }
    },
    select: { id: true }
  });

  const [delivery, unreadCount] = await Promise.all([
    loadDelivery(prisma, recipientPlayerId, message.id),
    getUnreadCountInternal(prisma, playerId)
  ]);

  return mailboxMessageMutationResponseSchema.parse({
    message: detailFromDelivery(delivery),
    deletedMessageId: null,
    unreadCount
  });
}

export async function sendGuildMailboxMessage(
  prisma: PrismaClient,
  playerId: string,
  body: SendGuildMailboxMessageBody
): Promise<MailboxMessageMutationResponse> {
  const parsed = sendGuildMailboxMessageBodySchema.parse(body);
  const senderName = await loadRecipientDisplayName(prisma, playerId);
  const membership = await prisma.guildMember.findFirst({
    where: { playerId },
    include: {
      guild: {
        include: {
          members: {
            select: { playerId: true }
          }
        }
      }
    }
  });

  if (!membership?.guild || !isGuildManagerRole(membership.role)) {
    throw new MessageError("INSUFFICIENT_GUILD_PERMISSIONS", 403, "Only guild leaders and officers can send guild-wide messages.");
  }

  const message = await prisma.message.create({
    data: {
      kind: "guild_broadcast",
      sourceType: "guild",
      sourceRefId: `guild:${membership.guildId}:${Date.now()}`,
      senderPlayerId: playerId,
      senderName,
      guildId: membership.guildId,
      subject: parsed.subject,
      body: parsed.body,
      deliveries: {
        create: membership.guild.members.map((member) => ({
          recipientPlayerId: member.playerId
        }))
      }
    },
    select: { id: true }
  });

  const [delivery, unreadCount] = await Promise.all([
    loadDelivery(prisma, playerId, message.id),
    getUnreadCountInternal(prisma, playerId)
  ]);

  return mailboxMessageMutationResponseSchema.parse({
    message: detailFromDelivery(delivery),
    deletedMessageId: null,
    unreadCount
  });
}
