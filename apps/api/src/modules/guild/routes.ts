/**
 * Guild API routes
 * Handles all guild-related HTTP endpoints
 */

import type { FastifyPluginAsync } from "fastify";
import type {
  CreateGuildRequest,
  UpdateGuildRequest,
  SearchGuildsQuery,
  GuildMembersQuery,
  UpdateMemberRoleRequest,
  TransferLeadershipRequest,
  SendGuildInviteRequest,
  GuildActivityQuery,
  GuildLeaderboardQuery
} from "@ebonkeep/shared";
import {
  createGuild,
  getGuild,
  updateGuild,
  searchGuilds,
  disbandGuild,
  joinGuild,
  getGuildMembers,
  leaveGuild,
  kickMember,
  updateMemberRole,
  transferLeadership,
  getReceivedInvites,
  sendGuildInvite,
  acceptGuildInvite,
  declineGuildInvite,
  cancelGuildInvite,
  getGuildActivity,
  getGuildLeaderboard
} from "./index.js";

export const guildRoutes: FastifyPluginAsync = async (fastify) => {
  // Create guild (main endpoint)
  fastify.post<{ Body: CreateGuildRequest }>("/v1/guild", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const guild = await createGuild(fastify.prisma, playerId, request.body);
        return reply.code(201).send(guild);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          ALREADY_IN_GUILD: { status: 400, message: "Player is already in a guild" },
          INVALID_NAME: { status: 400, message: "Invalid guild name" },
          INVALID_TAG: { status: 400, message: "Invalid guild tag" },
          INVALID_DESCRIPTION: { status: 400, message: "Invalid description" },
          INVALID_CREST_ID: { status: 400, message: "Invalid crest selection" },
          GUILD_NAME_TAKEN: { status: 409, message: "Guild name already exists" },
          GUILD_TAG_TAKEN: { status: 409, message: "Guild tag already exists" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error creating guild");
        return reply.code(500).send({ error: "Failed to create guild" });
      }
    }
  });

  // Create guild (alias for backwards compatibility)
  fastify.post<{ Body: CreateGuildRequest }>("/v1/guild/create", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const guild = await createGuild(fastify.prisma, playerId, request.body);
        return reply.code(201).send(guild);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          ALREADY_IN_GUILD: { status: 400, message: "Player is already in a guild" },
          INVALID_NAME: { status: 400, message: "Invalid guild name" },
          INVALID_TAG: { status: 400, message: "Invalid guild tag" },
          INVALID_DESCRIPTION: { status: 400, message: "Invalid description" },
          INVALID_CREST_ID: { status: 400, message: "Invalid crest selection" },
          NAME_EXISTS: { status: 409, message: "Guild name already exists" },
          TAG_EXISTS: { status: 409, message: "Guild tag already exists" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error creating guild");
        return reply.code(500).send({ error: "Failed to create guild" });
      }
    }
  });

  // Get current player's guild
  fastify.get("/v1/guild/my", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        
        // Find player's guild membership
        const membership = await fastify.prisma.guildMember.findFirst({
          where: { playerId },
          select: { guildId: true }
        });

        if (!membership) {
          return reply.code(404).send({ error: "Not a member of any guild" });
        }

        const guild = await getGuild(fastify.prisma, membership.guildId, playerId);
        if (!guild) {
          return reply.code(404).send({ error: "Guild not found" });
        }

        return reply.send(guild);
      } catch (error: any) {
        fastify.log.error(error, "Error fetching player's guild");
        return reply.code(500).send({ error: "Failed to fetch guild" });
      }
    }
  });

  // Get guild by ID
  fastify.get<{
    Params: { guildId: string };
    Querystring: { playerId?: string };
  }>("/v1/guild/:guildId", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.query.playerId ?? request.user.playerId;
        
        const guild = await getGuild(fastify.prisma, guildId, playerId);
        if (!guild) {
          return reply.code(404).send({ error: "Guild not found" });
        }

        return reply.send(guild);
      } catch (error: any) {
        fastify.log.error(error, "Error fetching guild");
        return reply.code(500).send({ error: "Failed to fetch guild" });
      }
    }
  });

  // Update guild
  fastify.patch<{
    Params: { guildId: string };
    Body: UpdateGuildRequest;
  }>("/v1/guild/:guildId", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.user.playerId;
        
        const guild = await updateGuild(fastify.prisma, guildId, playerId, request.body);
        return reply.send(guild);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          GUILD_NOT_FOUND: { status: 404, message: "Guild not found" },
          NOT_GUILD_MEMBER: { status: 403, message: "Not a guild member" },
          INSUFFICIENT_PERMISSIONS: { status: 403, message: "Insufficient permissions" },
          INVALID_DESCRIPTION: { status: 400, message: "Invalid description" },
          INVALID_CREST_ID: { status: 400, message: "Invalid crest selection" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error updating guild");
        return reply.code(500).send({ error: "Failed to update guild" });
      }
    }
  });

  // Search guilds
  fastify.get<{ Querystring: SearchGuildsQuery }>("/v1/guild/search", {
    handler: async (request, reply) => {
      try {
        const results = await searchGuilds(fastify.prisma, request.query);
        return reply.send(results);
      } catch (error: any) {
        fastify.log.error(error, "Error searching guilds");
        return reply.code(500).send({ error: "Failed to search guilds" });
      }
    }
  });

  // Join guild
  fastify.post<{ Params: { guildId: string } }>("/v1/guild/:guildId/join", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.user.playerId;

        await joinGuild(fastify.prisma, guildId, playerId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          ALREADY_IN_GUILD: { status: 400, message: "Already in a guild" },
          GUILD_NOT_FOUND: { status: 404, message: "Guild not found" },
          GUILD_NOT_RECRUITING: { status: 403, message: "Guild is not recruiting" },
          GUILD_FULL: { status: 400, message: "Guild is full" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error joining guild");
        return reply.code(500).send({ error: "Failed to join guild" });
      }
    }
  });

  // Leave guild
  fastify.post<{ Params: { guildId: string } }>("/v1/guild/:guildId/leave", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.user.playerId;

        await leaveGuild(fastify.prisma, guildId, playerId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_MEMBER: { status: 400, message: "Not a guild member" },
          CANNOT_LEAVE: { status: 403, message: "Leaders must transfer leadership or disband guild before leaving" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error leaving guild");
        return reply.code(500).send({ error: "Failed to leave guild" });
      }
    }
  });

  // Kick member
  fastify.delete<{
    Params: { guildId: string; playerId: string };
  }>("/v1/guild/:guildId/members/:playerId/kick", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId, playerId: targetId } = request.params;
        const kickerId = request.user.playerId;

        await kickMember(fastify.prisma, guildId, kickerId, targetId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_MEMBER: { status: 403, message: "Not a guild member" },
          CANNOT_KICK: { status: 403, message: "Insufficient permissions to kick this member" },
          TARGET_NOT_IN_GUILD: { status: 404, message: "Target player not in guild" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error kicking member");
        return reply.code(500).send({ error: "Failed to kick member" });
      }
    }
  });

  // Update member role
  fastify.patch<{
    Params: { guildId: string; playerId: string };
    Body: UpdateMemberRoleRequest;
  }>("/v1/guild/:guildId/members/:playerId/role", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId, playerId: targetId } = request.params;
        const actorId = request.user.playerId;
        const { role } = request.body;

        const member = await updateMemberRole(fastify.prisma, guildId, actorId, targetId, role);
        return reply.send(member);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_MEMBER: { status: 403, message: "Not a guild member" },
          CANNOT_CHANGE_ROLE: { status: 403, message: "Insufficient permissions to change roles" },
          TARGET_NOT_IN_GUILD: { status: 404, message: "Target player not in guild" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error updating member role");
        return reply.code(500).send({ error: "Failed to update member role" });
      }
    }
  });

  // Transfer leadership
  fastify.post<{
    Params: { guildId: string };
    Body: TransferLeadershipRequest;
  }>("/v1/guild/:guildId/transfer-leadership", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const currentLeaderId = request.user.playerId;
        const { newLeaderId } = request.body;

        await transferLeadership(fastify.prisma, guildId, currentLeaderId, newLeaderId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_LEADER: { status: 403, message: "Only the guild leader can transfer leadership" },
          TARGET_NOT_IN_GUILD: { status: 404, message: "Target player not in guild" },
          CANNOT_TRANSFER: { status: 403, message: "Cannot transfer leadership" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error transferring leadership");
        return reply.code(500).send({ error: "Failed to transfer leadership" });
      }
    }
  });

  // Disband guild
  fastify.delete<{ Params: { guildId: string } }>("/v1/guild/:guildId/disband", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const leaderId = request.user.playerId;

        await disbandGuild(fastify.prisma, guildId, leaderId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          GUILD_NOT_FOUND: { status: 404, message: "Guild not found" },
          NOT_GUILD_LEADER: { status: 403, message: "Only the guild leader can disband the guild" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error disbanding guild");
        return reply.code(500).send({ error: "Failed to disband guild" });
      }
    }
  });

  // Get guild members
  fastify.get<{
    Params: { guildId: string };
    Querystring: GuildMembersQuery;
  }>("/v1/guild/:guildId/members", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.user.playerId;

        const results = await getGuildMembers(fastify.prisma, guildId, playerId, request.query);
        return reply.send(results);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_MEMBER: { status: 403, message: "Not a guild member" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error fetching guild members");
        return reply.code(500).send({ error: "Failed to fetch guild members" });
      }
    }
  });

  // Get guild activity
  fastify.get<{
    Params: { guildId: string };
    Querystring: GuildActivityQuery;
  }>("/v1/guild/:guildId/activity", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const playerId = request.user.playerId;

        const results = await getGuildActivity(fastify.prisma, guildId, playerId, request.query);
        return reply.send(results);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          NOT_GUILD_MEMBER: { status: 403, message: "Not a guild member" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error fetching guild activity");
        return reply.code(500).send({ error: "Failed to fetch guild activity" });
      }
    }
  });

  // Send guild invite
  fastify.post<{
    Params: { guildId: string };
    Body: SendGuildInviteRequest;
  }>("/v1/guild/:guildId/invites", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { guildId } = request.params;
        const inviterId = request.user.playerId;
        const { inviteeId } = request.body;

        const invite = await sendGuildInvite(fastify.prisma, guildId, inviterId, inviteeId);
        return reply.code(201).send(invite);
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          CANNOT_SEND_INVITES: { status: 403, message: "Insufficient permissions to send invites" },
          PLAYER_NOT_FOUND: { status: 404, message: "Player not found" },
          INVITEE_ALREADY_IN_GUILD: { status: 400, message: "Invitee is already in a guild" },
          INVITE_ALREADY_EXISTS: { status: 409, message: "Invite already exists" },
          GUILD_FULL: { status: 400, message: "Guild is full" },
          GUILD_NOT_FOUND: { status: 404, message: "Guild not found" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error sending guild invite");
        return reply.code(500).send({ error: "Failed to send guild invite" });
      }
    }
  });

  // Get received invites
  fastify.get("/v1/guild/invites/received", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const invites = await getReceivedInvites(fastify.prisma, playerId);
        return reply.send({ invites });
      } catch (error: any) {
        fastify.log.error(error, "Error fetching received invites");
        return reply.code(500).send({ error: "Failed to fetch invites" });
      }
    }
  });

  // Accept guild invite
  fastify.post<{ Params: { inviteId: string } }>("/v1/guild/invites/:inviteId/accept", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { inviteId } = request.params;
        const playerId = request.user.playerId;

        await acceptGuildInvite(fastify.prisma, inviteId, playerId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          INVITE_NOT_FOUND: { status: 404, message: "Invite not found" },
          NOT_YOUR_INVITE: { status: 403, message: "This invite is not for you" },
          INVITE_ALREADY_HANDLED: { status: 400, message: "Invite already accepted or declined" },
          INVITE_EXPIRED: { status: 400, message: "Invite has expired" },
          ALREADY_IN_GUILD: { status: 400, message: "Already in a guild" },
          GUILD_FULL: { status: 400, message: "Guild is full" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error accepting guild invite");
        return reply.code(500).send({ error: "Failed to accept invite" });
      }
    }
  });

  // Decline guild invite
  fastify.post<{ Params: { inviteId: string } }>("/v1/guild/invites/:inviteId/decline", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { inviteId } = request.params;
        const playerId = request.user.playerId;

        await declineGuildInvite(fastify.prisma, inviteId, playerId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          INVITE_NOT_FOUND: { status: 404, message: "Invite not found" },
          NOT_YOUR_INVITE: { status: 403, message: "This invite is not for you" },
          INVITE_ALREADY_HANDLED: { status: 400, message: "Invite already accepted or declined" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error declining guild invite");
        return reply.code(500).send({ error: "Failed to decline invite" });
      }
    }
  });

  // Cancel guild invite  
  fastify.delete<{ Params: { inviteId: string } }>("/v1/guild/invites/:inviteId/cancel", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const { inviteId } = request.params;
        const actorId = request.user.playerId;

        await cancelGuildInvite(fastify.prisma, inviteId, actorId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
          INVITE_NOT_FOUND: { status: 404, message: "Invite not found" },
          CANNOT_CANCEL_INVITE: { status: 403, message: "Cannot cancel this invite" },
          INVITE_ALREADY_HANDLED: { status: 400, message: "Invite already accepted or declined" }
        };

        const mapped = errorMap[error.message];
        if (mapped) {
          return reply.code(mapped.status).send({ error: mapped.message });
        }

        fastify.log.error(error, "Error canceling guild invite");
        return reply.code(500).send({ error: "Failed to cancel invite" });
      }
    }
  });

  // Get guild leaderboards
  fastify.get<{ Querystring: GuildLeaderboardQuery }>("/v1/guild/leaderboards", {
    handler: async (request, reply) => {
      try {
        fastify.log.info({ query: request.query }, "Fetching guild leaderboards");
        const limit = Number(request.query.limit) || 50;
        const offset = Number(request.query.offset) || 0;
        const results = await getGuildLeaderboard(
          fastify.prisma,
          request.query.sortBy,
          limit,
          offset
        );
        fastify.log.info({ resultCount: results.guilds.length }, "Guild leaderboards fetched successfully");
        return reply.send(results);
      } catch (error: any) {
        fastify.log.error(error, "Error fetching guild leaderboards");
        return reply.code(500).send({ error: "Failed to fetch leaderboards" });
      }
    }
  });
};

