/**
 * Guild service layer
 * Core business logic for guild operations
 */

import type { PrismaClient } from "@prisma/client";
import type {
  Guild,
  GuildMember,
  CreateGuildRequest,
  UpdateGuildRequest,
  GuildSearchQuery
} from "@ebonkeep/shared";
import { DEFAULT_GUILD_CREST_ID } from "@ebonkeep/shared";
import { getEffectiveGuildMaxMembers } from "../academy/effects.js";
import { validateGuildName, validateGuildTag, validateGuildDescription, validateGuildCrestId } from "./validation.js";
import {
  canEditGuildSettings
} from "./permissions.js";

/**
 * Create a new guild
 */
export async function createGuild(
  prisma: PrismaClient,
  playerId: string,
  data: CreateGuildRequest
): Promise<{ guild: Guild; membership: GuildMember }> {
  const crestId = data.crestId ?? DEFAULT_GUILD_CREST_ID;

  // Validate guild name
  const nameValidation = validateGuildName(data.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  //Validate guild tag
  const tagValidation = validateGuildTag(data.tag);
  if (!tagValidation.valid) {
    throw new Error(tagValidation.error);
  }

  // Validate description if provided
  if (data.description) {
    const descValidation = validateGuildDescription(data.description);
    if (!descValidation.valid) {
      throw new Error(descValidation.error);
    }
  }

  // Validate crest
  const crestValidation = validateGuildCrestId(crestId);
  if (!crestValidation.valid) {
    throw new Error(crestValidation.error);
  }

  // Check if player is already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { playerId }
  });

  if (existingMembership) {
    throw new Error("ALREADY_IN_GUILD");
  }

  // Check if name is taken
  const nameExists = await prisma.guild.findUnique({
    where: { name: data.name }
  });

  if (nameExists) {
    throw new Error("GUILD_NAME_TAKEN");
  }

  // Check if tag is taken
  const tagExists = await prisma.guild.findUnique({
    where: { tag: data.tag }
  });

  if (tagExists) {
    throw new Error("GUILD_TAG_TAKEN");
  }

  // Get player's current gearScore
  const player = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: { gearScore: true }
  });

  if (!player) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  // Create guild and membership in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create guild
    const guild = await tx.guild.create({
      data: {
        name: data.name,
        tag: data.tag,
        description: data.description ?? "",
        crestId,
        leaderId: playerId,
        totalPower: player.gearScore,
        crestBgShape: "shield_01",
        crestBgColor: "crimson",
        crestBgPattern: null,
        crestFgSymbol: "sword_01",
        crestFgColor: "gold",
        crestFrame: null
      }
    });

    // Create leader membership
    const membership = await tx.guildMember.create({
      data: {
        guildId: guild.id,
        playerId,
        role: "leader",
        contributedPower: player.gearScore
      }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId: guild.id,
        actorId: playerId,
        actionType: "created",
        timestamp: new Date()
      }
    });

    return { guild, membership };
  });

  return {
    guild: await serializeGuildWithAcademy(prisma, result.guild),
    membership: serializeMember(result.membership)
  };
}

/**
 * Get guild details
 */
export async function getGuild(
  prisma: PrismaClient,
  guildId: string,
  requestingPlayerId?: string
) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      members: true
    }
  });

  if (!guild) {
    throw new Error("GUILD_NOT_FOUND");
  }

  // Get requesting player's membership if provided
  let currentUserMembership = null;
  if (requestingPlayerId) {
    const membership = await prisma.guildMember.findFirst({
      where: {
        guildId,
        playerId: requestingPlayerId
      }
    });
    if (membership) {
      currentUserMembership = serializeMember(membership);
    }
  }

  return {
    guild: {
      ...(await serializeGuildWithAcademy(prisma, guild)),
      memberCount: guild.members.length
    },
    memberCount: guild.members.length,
    currentUserMembership
  };
}

/**
 * Update guild settings
 */
export async function updateGuild(
  prisma: PrismaClient,
  guildId: string,
  playerId: string,
  data: UpdateGuildRequest
): Promise<Guild> {
  // Check permissions
  const permCheck = await canEditGuildSettings(prisma, guildId, playerId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "INSUFFICIENT_PERMISSIONS");
  }

  const existingGuild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: {
      description: true,
      isRecruiting: true,
      crestId: true
    }
  });

  if (!existingGuild) {
    throw new Error("GUILD_NOT_FOUND");
  }

  // Validate description if provided
  if (data.description !== undefined) {
    const descValidation = validateGuildDescription(data.description);
    if (!descValidation.valid) {
      throw new Error(descValidation.error);
    }
  }

  // Validate crest if provided
  if (data.crestId) {
    const crestValidation = validateGuildCrestId(data.crestId);
    if (!crestValidation.valid) {
      throw new Error(crestValidation.error);
    }
  }

  // Build update data
  const updateData: any = {};
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.isRecruiting !== undefined) {
    updateData.isRecruiting = data.isRecruiting;
  }
  if (data.crestId) {
    updateData.crestId = data.crestId;
  }

  const nextDescription = data.description ?? existingGuild.description;
  const nextIsRecruiting = data.isRecruiting ?? existingGuild.isRecruiting;
  const nextCrestId = data.crestId ?? existingGuild.crestId;

  const crestChanged = nextCrestId !== existingGuild.crestId;
  const descriptionChanged = nextDescription !== existingGuild.description;
  const recruitingChanged = nextIsRecruiting !== existingGuild.isRecruiting;

  const guild = await prisma.$transaction(async (tx) => {
    const updated = await tx.guild.update({
      where: { id: guildId },
      data: updateData
    });

    // Log activity
    const actionType = crestChanged
      ? "crest_changed"
      : descriptionChanged
        ? "description_changed"
        : recruitingChanged
          ? "recruiting_toggled"
          : null;
    if (actionType) {
      await tx.guildActivity.create({
        data: {
          guildId,
          actorId: playerId,
          actionType,
          timestamp: new Date()
        }
      });
    }

    return updated;
  });

  return serializeGuildWithAcademy(prisma, guild);
}

/**
 * Search for guilds
 */
export async function searchGuilds(
  prisma: PrismaClient,
  query: GuildSearchQuery
) {
  const where: any = {};

  if (query.name) {
    where.name = {
      contains: query.name,
      mode: "insensitive"
    };
  }

  if (query.tag) {
    where.tag = {
      contains: query.tag.toUpperCase(),
      mode: "insensitive"
    };
  }

  const [guilds, total] = await Promise.all([
    prisma.guild.findMany({
      where,
      include: {
        _count: {
          select: { members: true }
        }
      },
      take: Number(query.limit) || 20,
      skip: Number(query.offset) || 0,
      orderBy: { totalPower: "desc" }
    }),
    prisma.guild.count({ where })
  ]);

  // Filter by member count if specified
  let filtered = guilds;
  if (query.minMembers !== undefined || query.maxMembers !== undefined) {
    filtered = guilds.filter((g) => {
      const count = g._count.members;
      if (query.minMembers !== undefined && count < query.minMembers) return false;
      if (query.maxMembers !== undefined && count > query.maxMembers) return false;
      return true;
    });
  }

  return {
    guilds: await Promise.all(
      filtered.map(async (g) => ({
        ...(await serializeGuildWithAcademy(prisma, g)),
        memberCount: g._count.members
      }))
    ),
    total
  };
}


/**
 * Disband guild (leader only)
 */
export async function disbandGuild(
  prisma: PrismaClient,
  guildId: string,
  leaderId: string
): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { leaderId: true }
  });

  if (!guild) {
    throw new Error("GUILD_NOT_FOUND");
  }

  if (guild.leaderId !== leaderId) {
    throw new Error("NOT_GUILD_LEADER");
  }

  await prisma.$transaction(async (tx) => {
    // Log final activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: leaderId,
        actionType: "disbanded",
        timestamp: new Date()
      }
    });

    // Delete all members (cascade will handle invites and activities)
    await tx.guildMember.deleteMany({
      where: { guildId }
    });

    // Delete guild
    await tx.guild.delete({
      where: { id: guildId }
    });
  });
}

/**
 * Helper to serialize guild data
 */
function serializeGuild(guild: any): Guild {
  return {
    ...guild,
    createdAt: guild.createdAt.toISOString(),
    updatedAt: guild.updatedAt.toISOString()
  };
}

async function serializeGuildWithAcademy(prisma: PrismaClient, guild: any): Promise<Guild> {
  const serialized = serializeGuild(guild);
  return {
    ...serialized,
    maxMembers: await getEffectiveGuildMaxMembers(prisma, guild.id, guild.maxMembers)
  };
}

/**
 * Helper to serialize member data
 */
function serializeMember(member: any): GuildMember {
  return {
    ...member,
    joinedAt: member.joinedAt.toISOString()
  };
}
