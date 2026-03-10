/**
 * Guild member management service
 * Handles member operations: join, leave, kick, promote, demote
 */

import type { PrismaClient } from "@prisma/client";
import type { GuildMember, GuildMembersQuery, UpdateMemberRoleRequest, TransferLeadershipRequest } from "@ebonkeep/shared";
import {
  canKickMember,
  canChangeRole,
  canTransferLeadership,
  canLeaveGuild,
  canSendInvites
} from "./permissions.js";

/**
 * Get guild members with player details
 */
export async function getGuildMembers(
  prisma: PrismaClient,
  guildId: string,
  requestingPlayerId: string,
  query: GuildMembersQuery
) {
  // Check if requester is a member
  const membership = await prisma.guildMember.findFirst({
    where: { guildId, playerId: requestingPlayerId }
  });

  if (!membership) {
    throw new Error("NOT_GUILD_MEMBER");
  }

  // Build where clause
  const where: any = { guildId };
  if (query.role) {
    where.role = query.role;
  }

  const [members, total] = await Promise.all([
    prisma.guildMember.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            class: true,
            level: true,
            gearScore: true,
            account: {
              select: {
                username: true
              }
            }
          }
        }
      },
      take: Number(query.limit) || 50,
      skip: Number(query.offset) || 0,
      orderBy: { contributedPower: "desc" }
    }),
    prisma.guildMember.count({ where })
  ]);

  return {
    members: members.map((m) => ({
      ...m,
      joinedAt: m.joinedAt.toISOString()
    })),
    total
  };
}

/**
 * Join guild (public guilds only)
 */
export async function joinGuild(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<void> {
  // Check if player is already in a guild
  const existingMembership = await prisma.guildMember.findFirst({
    where: { playerId }
  });

  if (existingMembership) {
    throw new Error("ALREADY_IN_GUILD");
  }

  await prisma.$transaction(async (tx) => {
    // Get guild
    const guild = await tx.guild.findUnique({
      where: { id: guildId },
      select: {
        isRecruiting: true,
        maxMembers: true,
        _count: {
          select: { members: true }
        }
      }
    });

    if (!guild) {
      throw new Error("GUILD_NOT_FOUND");
    }

    if (!guild.isRecruiting) {
      throw new Error("GUILD_NOT_RECRUITING");
    }

    if (guild._count.members >= guild.maxMembers) {
      throw new Error("GUILD_FULL");
    }

    // Get player's gear score
    const player = await tx.playerProfile.findUnique({
      where: { id: playerId },
      select: { gearScore: true }
    });

    if (!player) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    // Create membership
    await tx.guildMember.create({
      data: {
        guildId,
        playerId,
        role: "member",
        contributedPower: player.gearScore,
        joinedAt: new Date()
      }
    });

    // Update guild stats
    await tx.guild.update({
      where: { id: guildId },
      data: {
        totalPower: { increment: player.gearScore }
      }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: playerId,
        actionType: "joined",
        timestamp: new Date()
      }
    });
  });
}

/**
 * Leave guild
 */
export async function leaveGuild(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<void> {
  // Check permissions
  const permCheck = await canLeaveGuild(prisma, guildId, playerId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "CANNOT_LEAVE");
  }

  await prisma.$transaction(async (tx) => {
    // Get member to update guild totalPower
    const member = await tx.guildMember.findFirst({
      where: { guildId, playerId }
    });

    if (!member) {
      throw new Error("NOT_GUILD_MEMBER");
    }

    // Remove member
    await tx.guildMember.delete({
      where: { id: member.id }
    });

    // Update guild totalPower
    await tx.guild.update({
      where: { id: guildId },
      data: {
        totalPower: {
          decrement: member.contributedPower
        }
      }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: playerId,
        actionType: "left",
        timestamp: new Date()
      }
    });
  });
}

/**
 * Kick a member from the guild
 */
export async function kickMember(
  prisma: PrismaClient,
  guildId: string,
  kickerId: string,
  targetId: string
): Promise<void> {
  // Check permissions
  const permCheck = await canKickMember(prisma, guildId, kickerId, targetId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "CANNOT_KICK");
  }

  await prisma.$transaction(async (tx) => {
    // Get target member
    const target = await tx.guildMember.findFirst({
      where: { guildId, playerId: targetId }
    });

    if (!target) {
      throw new Error("TARGET_NOT_IN_GUILD");
    }

    // Remove member
    await tx.guildMember.delete({
      where: { id: target.id }
    });

    // Update guild totalPower
    await tx.guild.update({
      where: { id: guildId },
      data: {
        totalPower: {
          decrement: target.contributedPower
        }
      }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: kickerId,
        actionType: "kicked",
        targetId,
        timestamp: new Date()
      }
    });
  });
}

/**
 * Update member role (promote/demote)
 */
export async function updateMemberRole(
  prisma: PrismaClient,
  guildId: string,
  actorId: string,
  targetId: string,
  newRole: "officer" | "member"
): Promise<GuildMember> {
  // Check permissions
  const permCheck = await canChangeRole(prisma, guildId, actorId, targetId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "CANNOT_CHANGE_ROLE");
  }

  const member = await prisma.$transaction(async (tx) => {
    // Get current role
    const target = await tx.guildMember.findFirst({
      where: { guildId, playerId: targetId }
    });

    if (!target) {
      throw new Error("TARGET_NOT_IN_GUILD");
    }

    const oldRole = target.role;

    // Update role
    const updated = await tx.guildMember.update({
      where: { id: target.id },
      data: { role: newRole }
    });

    // Log activity
    const actionType = newRole === "officer" ? "promoted" : "demoted";
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId,
        actionType,
        targetId,
        metadata: { oldRole, newRole },
        timestamp: new Date()
      }
    });

    return updated;
  });

  return {
    ...member,
    role: member.role as GuildMember["role"],
    joinedAt: member.joinedAt.toISOString()
  };
}

/**
 * Transfer guild leadership
 */
export async function transferLeadership(
  prisma: PrismaClient,
  guildId: string,
  currentLeaderId: string,
  newLeaderId: string
): Promise<void> {
  // Check permissions
  const permCheck = await canTransferLeadership(prisma, guildId, currentLeaderId, newLeaderId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "CANNOT_TRANSFER");
  }

  await prisma.$transaction(async (tx) => {
    // Update old leader to officer
    await tx.guildMember.updateMany({
      where: { guildId, playerId: currentLeaderId },
      data: { role: "officer" }
    });

    // Update new leader
    await tx.guildMember.updateMany({
      where: { guildId, playerId: newLeaderId },
      data: { role: "leader" }
    });

    // Update guild leaderId
    await tx.guild.update({
      where: { id: guildId },
      data: { leaderId: newLeaderId }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: currentLeaderId,
        actionType: "transferred_leadership",
        targetId: newLeaderId,
        timestamp: new Date()
      }
    });
  });
}

/**
 * Recalculate guild's total power
 * Should be called periodically or when member power changes significantly
 */
export async function recalculateGuildPower(
  prisma: PrismaClient,
  guildId: string
): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    // Get all members with their current gearScore
    const members = await tx.guildMember.findMany({
      where: { guildId },
      include: {
        player: {
          select: { gearScore: true }
        }
      }
    });

    // Update each member's contributedPower
    for (const member of members) {
      if (member.contributedPower !== member.player.gearScore) {
        await tx.guildMember.update({
          where: { id: member.id },
          data: { contributedPower: member.player.gearScore }
        });
      }
    }

    // Calculate total
    const totalPower = members.reduce((sum, m) => sum + m.player.gearScore, 0);

    // Update guild
    await tx.guild.update({
      where: { id: guildId },
      data: { totalPower }
    });

    return totalPower;
  });
}
