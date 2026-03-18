/**
 * Guild invite service
 * Handles invitation operations: send, accept, decline, cancel
 */

import type { PrismaClient } from "@prisma/client";
import type { GuildInvite, SendGuildInviteRequest } from "@ebonkeep/shared";

import { getEffectiveGuildMaxMembers } from "../academy/effects.js";
import { canSendInvites } from "./permissions.js";

/**
 * Get received guild invites for a player
 */
export async function getReceivedInvites(
  prisma: PrismaClient,
  playerId: string
): Promise<GuildInvite[]> {
  const invites = await prisma.guildInvite.findMany({
    where: {
      inviteeId: playerId,
      status: "pending",
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      guild: {
        select: {
          id: true,
          name: true,
          tag: true,
          description: true,
          crestId: true,
          leaderId: true,
          isRecruiting: true,
          level: true,
          totalPower: true,
          maxMembers: true,
          createdAt: true,
          updatedAt: true,
          crestBgShape: true,
          crestBgColor: true,
          crestBgPattern: true,
          crestFgSymbol: true,
          crestFgColor: true,
          crestFrame: true,
          _count: {
            select: { members: true }
          }
        }
      },
      inviter: {
        select: {
          id: true,
          class: true,
          level: true,
          account: {
            select: {
              username: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return Promise.all(
    invites.map(async (inv) => ({
      ...inv,
      status: inv.status as GuildInvite["status"],
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      respondedAt: inv.respondedAt?.toISOString() || null,
      guild: inv.guild
        ? {
            ...inv.guild,
            maxMembers: await getEffectiveGuildMaxMembers(prisma, inv.guild.id, inv.guild.maxMembers),
            createdAt: inv.guild.createdAt.toISOString(),
            updatedAt: inv.guild.updatedAt.toISOString(),
            memberCount: inv.guild._count.members
          }
        : inv.guild
    }))
  );
}

/**
 * Send guild invite
 */
export async function sendGuildInvite(
  prisma: PrismaClient,
  guildId: string,
  inviterId: string,
  inviteeInput: string
): Promise<GuildInvite> {
  // Resolve username → player profile ID if the input is not already a profile ID
  let inviteeId = inviteeInput;

  const accountByUsername = await prisma.account.findFirst({
    where: { username: { equals: inviteeInput, mode: "insensitive" } },
    include: { profiles: { select: { id: true }, take: 1 } }
  });

  if (accountByUsername?.profiles[0]) {
    inviteeId = accountByUsername.profiles[0].id;
  } else {
    // Verify the raw value is a valid player profile ID
    const playerById = await prisma.playerProfile.findUnique({
      where: { id: inviteeInput },
      select: { id: true }
    });
    if (!playerById) {
      throw new Error("PLAYER_NOT_FOUND");
    }
  }

  // Check permissions
  const permCheck = await canSendInvites(prisma, guildId, inviterId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "CANNOT_SEND_INVITES");
  }

  // Check if invitee is already in a guild
  const existingMembership = await prisma.guildMember.findFirst({
    where: { playerId: inviteeId }
  });

  if (existingMembership) {
    throw new Error("INVITEE_ALREADY_IN_GUILD");
  }

  // Check for existing pending invite
  const existing = await prisma.guildInvite.findFirst({
    where: {
      guildId,
      inviteeId,
      status: "pending",
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (existing) {
    throw new Error("INVITE_ALREADY_EXISTS");
  }

  // Check guild member count
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: {
      id: true,
      maxMembers: true,
      _count: {
        select: { members: true }
      }
    }
  });

  if (!guild) {
    throw new Error("GUILD_NOT_FOUND");
  }

  const effectiveMaxMembers = await getEffectiveGuildMaxMembers(prisma, guild.id, guild.maxMembers);
  if (guild._count.members >= effectiveMaxMembers) {
    throw new Error("GUILD_FULL");
  }

  // Create invite (expires in 7 days)
  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.guildInvite.create({
      data: {
        guildId,
        inviterId,
        inviteeId,
        status: "pending",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      include: {
        guild: {
          select: {
            id: true,
            name: true,
            tag: true,
            description: true,
            crestId: true,
            leaderId: true,
            isRecruiting: true,
            level: true,
            totalPower: true,
            maxMembers: true,
            createdAt: true,
            updatedAt: true,
            crestBgShape: true,
            crestBgColor: true,
            crestBgPattern: true,
            crestFgSymbol: true,
            crestFgColor: true,
            crestFrame: true,
            _count: {
              select: { members: true }
            }
          }
        },
        inviter: {
          select: {
            id: true,
            class: true,
            level: true,
            account: {
              select: {
                username: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: inviterId,
        actionType: "invited",
        targetId: inviteeId,
        timestamp: new Date()
      }
    });

    return created;
  });

  return {
    id: invite.id,
    guildId: invite.guildId,
    inviterId: invite.inviterId,
    inviteeId: invite.inviteeId,
    message: invite.message,
    status: invite.status as GuildInvite["status"],
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    respondedAt: invite.respondedAt?.toISOString() ?? null,
  };
}

/**
 * Accept guild invite
 */
export async function acceptGuildInvite(
  prisma: PrismaClient,
  inviteId: string,
  playerId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get invite
    const invite = await tx.guildInvite.findUnique({
      where: { id: inviteId },
      include: {
        guild: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    if (!invite) {
      throw new Error("INVITE_NOT_FOUND");
    }

    if (invite.inviteeId !== playerId) {
      throw new Error("NOT_YOUR_INVITE");
    }

    if (invite.status !== "pending") {
      throw new Error("INVITE_ALREADY_HANDLED");
    }

    if (invite.expiresAt < new Date()) {
      throw new Error("INVITE_EXPIRED");
    }

    // Check if player is already in a guild
    const existingMembership = await tx.guildMember.findFirst({
      where: { playerId }
    });

    if (existingMembership) {
      throw new Error("ALREADY_IN_GUILD");
    }

    // Check guild capacity
    const guild = invite.guild;
    const effectiveMaxMembers = await getEffectiveGuildMaxMembers(tx, guild.id, guild.maxMembers);
    if (guild._count.members >= effectiveMaxMembers) {
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
        guildId: guild.id,
        playerId,
        role: "member",
        contributedPower: player.gearScore,
        joinedAt: new Date()
      }
    });

    // Update guild stats
    await tx.guild.update({
      where: { id: guild.id },
      data: {
        totalPower: { increment: player.gearScore }
      }
    });

    // Update invite status
    await tx.guildInvite.update({
      where: { id: inviteId },
      data: { status: "accepted" }
    });

    // Log activity
    await tx.guildActivity.create({
      data: {
        guildId: guild.id,
        actorId: playerId,
        actionType: "joined",
        timestamp: new Date()
      }
    });
  });
}

/**
 * Decline guild invite
 */
export async function declineGuildInvite(
  prisma: PrismaClient,
  inviteId: string,
  playerId: string
): Promise<void> {
  const invite = await prisma.guildInvite.findUnique({
    where: { id: inviteId }
  });

  if (!invite) {
    throw new Error("INVITE_NOT_FOUND");
  }

  if (invite.inviteeId !== playerId) {
    throw new Error("NOT_YOUR_INVITE");
  }

  if (invite.status !== "pending") {
    throw new Error("INVITE_ALREADY_HANDLED");
  }

  await prisma.guildInvite.update({
    where: { id: inviteId },
    data: { status: "declined" }
  });
}

/**
 * Cancel guild invite (by inviter or guild officer+)
 */
export async function cancelGuildInvite(
  prisma: PrismaClient,
  inviteId: string,
  actorId: string
): Promise<void> {
  const invite = await prisma.guildInvite.findUnique({
    where: { id: inviteId }
  });

  if (!invite) {
    throw new Error("INVITE_NOT_FOUND");
  }

  // Check if actor is the inviter or has permissions
  if (invite.inviterId !== actorId) {
    const permCheck = await canSendInvites(prisma, invite.guildId, actorId);
    if (!permCheck.allowed) {
      throw new Error("CANNOT_CANCEL_INVITE");
    }
  }

  if (invite.status !== "pending") {
    throw new Error("INVITE_ALREADY_HANDLED");
  }

  await prisma.guildInvite.update({
    where: { id: inviteId },
    data: { status: "cancelled" }
  });
}

/**
 * Clean up expired invites (cron job helper)
 */
export async function cleanupExpiredInvites(prisma: PrismaClient): Promise<number> {
  const result = await prisma.guildInvite.updateMany({
    where: {
      status: "pending",
      expiresAt: {
        lt: new Date()
      }
    },
    data: {
      status: "expired"
    }
  });

  return result.count;
}
