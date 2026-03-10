/**
 * Guild permission system
 * Handles role-based access control for guild actions
 */

import type { PrismaClient } from "@prisma/client";
import type { GuildRole } from "@ebonkeep/shared";

export interface PermissionCheckResult {
  allowed: boolean;
  membership?: {
    id: string;
    guildId: string;
    playerId: string;
    role: string;
    joinedAt: Date;
    contributedPower: number;
  };
  reason?: string;
}

/**
 * Role hierarchy for permission checks
 */
const ROLE_HIERARCHY: Record<string, number> = {
  leader: 3,
  officer: 2,
  member: 1
};

/**
 * Check if a player has permission to perform an action requiring a specific role
 */
export async function checkGuildPermission(
  prisma: PrismaClient,
  guildId: string,
  playerId: string,
  requiredRole: GuildRole
): Promise<PermissionCheckResult> {
  // Find player's membership
  const membership = await prisma.guildMember.findFirst({
    where: {
      guildId,
      playerId
    }
  });

  // Player not in guild
  if (!membership) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  // Check role hierarchy
  const playerRoleLevel = ROLE_HIERARCHY[membership.role] ?? 0;
  const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  if (playerRoleLevel < requiredRoleLevel) {
    return {
      allowed: false,
      membership,
      reason: "INSUFFICIENT_ROLE"
    };
  }

  return {
    allowed: true,
    membership
  };
}

/**
 * Check if a player can kick another member
 * Rules:
 * - Cannot kick yourself
 * - Cannot kick the leader
 * - Leader can kick anyone
 * - Officer can only kick members (not other officers)
 */
export async function canKickMember(
  prisma: PrismaClient,
  guildId: string,
  kickerId: string,
  targetId: string
): Promise<PermissionCheckResult> {
  // Cannot kick yourself
  if (kickerId === targetId) {
    return {
      allowed: false,
      reason: "CANNOT_KICK_SELF"
    };
  }

  // Get both memberships
  const [kicker, target] = await Promise.all([
    prisma.guildMember.findFirst({
      where: { guildId, playerId: kickerId }
    }),
    prisma.guildMember.findFirst({
      where: { guildId, playerId: targetId }
    })
  ]);

  // Kicker not in guild
  if (!kicker) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  // Target not in guild
  if (!target) {
    return {
      allowed: false,
      reason: "TARGET_NOT_IN_GUILD"
    };
  }

  // Cannot kick the leader
  if (target.role === "leader") {
    return {
      allowed: false,
      membership: kicker,
      reason: "CANNOT_KICK_LEADER"
    };
  }

  // Leader can kick anyone (except themselves, already checked)
  if (kicker.role === "leader") {
    return {
      allowed: true,
      membership: kicker
    };
  }

  // Officer can only kick members
  if (kicker.role === "officer") {
    if (target.role === "member") {
      return {
        allowed: true,
        membership: kicker
      };
    } else {
      return {
        allowed: false,
        membership: kicker,
        reason: "OFFICER_CANNOT_KICK_OFFICER"
      };
    }
  }

  // Members cannot kick anyone
  return {
    allowed: false,
    membership: kicker,
    reason: "INSUFFICIENT_PERMISSIONS"
  };
}

/**
 * Check if a player can promote/demote another member
 * Rules:
 * - Only leaders can promote/demote
 * - Cannot change your own role
 * - Cannot demote the leader
 */
export async function canChangeRole(
  prisma: PrismaClient,
  guildId: string,
  actorId: string,
  targetId: string
): Promise<PermissionCheckResult> {
  // Cannot change your own role
  if (actorId === targetId) {
    return {
      allowed: false,
      reason: "CANNOT_CHANGE_OWN_ROLE"
    };
  }

  // Get both memberships
  const [actor, target] = await Promise.all([
    prisma.guildMember.findFirst({
      where: { guildId, playerId: actorId }
    }),
    prisma.guildMember.findFirst({
      where: { guildId, playerId: targetId }
    })
  ]);

  // Actor not in guild
  if (!actor) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  // Target not in guild
  if (!target) {
    return {
      allowed: false,
      reason: "TARGET_NOT_IN_GUILD"
    };
  }

  // Only leader can promote/demote
  if (actor.role !== "leader") {
    return {
      allowed: false,
      membership: actor,
      reason: "ONLY_LEADER_CAN_CHANGE_ROLES"
    };
  }

  // Cannot demote the leader (would need transfer leadership)
  if (target.role === "leader") {
    return {
      allowed: false,
      membership: actor,
      reason: "CANNOT_CHANGE_LEADER_ROLE"
    };
  }

  return {
    allowed: true,
    membership: actor
  };
}

/**
 * Check if a player can transfer leadership
 * Rules:
 * - Must be the current leader
 * - Target must be in the guild
 * - Target must be an officer or member (not already leader)
 */
export async function canTransferLeadership(
  prisma: PrismaClient,
  guildId: string,
  currentLeaderId: string,
  newLeaderId: string
): Promise<PermissionCheckResult> {
  // Cannot transfer to yourself
  if (currentLeaderId === newLeaderId) {
    return {
      allowed: false,
      reason: "CANNOT_TRANSFER_TO_SELF"
    };
  }

  // Get both memberships
  const [currentLeader, newLeader] = await Promise.all([
    prisma.guildMember.findFirst({
      where: { guildId, playerId: currentLeaderId }
    }),
    prisma.guildMember.findFirst({
      where: { guildId, playerId: newLeaderId }
    })
  ]);

  // Current player not in guild
  if (!currentLeader) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  // Must be the leader
  if (currentLeader.role !== "leader") {
    return {
      allowed: false,
      membership: currentLeader,
      reason: "ONLY_LEADER_CAN_TRANSFER"
    };
  }

  // Target not in guild
  if (!newLeader) {
    return {
      allowed: false,
      membership: currentLeader,
      reason: "TARGET_NOT_IN_GUILD"
    };
  }

  // Target already leader (shouldn't happen, but check anyway)
  if (newLeader.role === "leader") {
    return {
      allowed: false,
      membership: currentLeader,
      reason: "TARGET_ALREADY_LEADER"
    };
  }

  return {
    allowed: true,
    membership: currentLeader
  };
}

/**
 * Check if a player can leave the guild
 * Rules:
 * - Must be in the guild
 * - Leader must transfer leadership or disband before leaving
 */
export async function canLeaveGuild(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<PermissionCheckResult> {
  const membership = await prisma.guildMember.findFirst({
    where: { guildId, playerId }
  });

  if (!membership) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  // Leader cannot leave without transferring or disbanding
  if (membership.role === "leader") {
    return {
      allowed: false,
      membership,
      reason: "LEADER_MUST_TRANSFER_OR_DISBAND"
    };
  }

  return {
    allowed: true,
    membership
  };
}

/**
 * Check if a player can disband the guild
 * Rules:
 * - Must be the leader
 */
export async function canDisbandGuild(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<PermissionCheckResult> {
  const membership = await prisma.guildMember.findFirst({
    where: { guildId, playerId }
  });

  if (!membership) {
    return {
      allowed: false,
      reason: "NOT_GUILD_MEMBER"
    };
  }

  if (membership.role !== "leader") {
    return {
      allowed: false,
      membership,
      reason: "ONLY_LEADER_CAN_DISBAND"
    };
  }

  return {
    allowed: true,
    membership
  };
}

/**
 * Check if a player can edit guild settings (description, crest, recruiting status)
 * Rules:
 * - Leader or Officer
 */
export async function canEditGuildSettings(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<PermissionCheckResult> {
  return checkGuildPermission(prisma, guildId, playerId, "officer");
}

/**
 * Check if a player can send guild invites
 * Rules:
 * - Leader or Officer
 */
export async function canSendInvites(
  prisma: PrismaClient,
  guildId: string,
  playerId: string
): Promise<PermissionCheckResult> {
  return checkGuildPermission(prisma, guildId, playerId, "officer");
}
