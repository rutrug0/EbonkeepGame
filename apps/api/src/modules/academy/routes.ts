import type { FastifyInstance } from "fastify";

import { donateToNodeRequestSchema } from "@ebonkeep/shared/guild";

import { AcademyError, donateToNode, getAcademyTreeState, getDonationHistory, getMemberContributions } from "./service.js";

export async function academyRoutes(fastify: FastifyInstance) {
  // ── GET  /v1/guild/:guildId/academy ────────────────────────────────────────
  // Returns the full tree config + guild progress.  Any guild member.
  fastify.get<{ Params: { guildId: string } }>(
    "/v1/guild/:guildId/academy",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const { guildId } = request.params;
        const state = await getAcademyTreeState(fastify.prisma, playerId, guildId);
        return reply.send(state);
      } catch (error: any) {
        return handleAcademyError(fastify, reply, error, "Failed to fetch academy state");
      }
    }
  );

  // ── POST /v1/guild/:guildId/academy/donate ─────────────────────────────────
  // Donate ducats to a node.  Any guild member.
  fastify.post<{ Params: { guildId: string }; Body: unknown }>(
    "/v1/guild/:guildId/academy/donate",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const { guildId } = request.params;
        const parsed = donateToNodeRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
        }
        const result = await donateToNode(fastify.prisma, playerId, guildId, parsed.data);
        return reply.code(200).send(result);
      } catch (error: any) {
        return handleAcademyError(fastify, reply, error, "Failed to donate to node");
      }
    }
  );

  // ── GET  /v1/guild/:guildId/academy/donations ──────────────────────────────
  // Donation history log.  Any guild member.
  fastify.get<{
    Params: { guildId: string };
    Querystring: { nodeId?: string; limit?: string; offset?: string };
  }>(
    "/v1/guild/:guildId/academy/donations",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const { guildId } = request.params;
        const { nodeId, limit, offset } = request.query;
        const result = await getDonationHistory(
          fastify.prisma,
          playerId,
          guildId,
          nodeId,
          limit ? Math.min(100, parseInt(limit, 10)) : 50,
          offset ? parseInt(offset, 10) : 0
        );
        return reply.send(result);
      } catch (error: any) {
        return handleAcademyError(fastify, reply, error, "Failed to fetch donation history");
      }
    }
  );

  // ── GET  /v1/guild/:guildId/academy/contributions ─────────────────────────
  // Per-member total donation ranking.  Any guild member.
  fastify.get<{ Params: { guildId: string } }>(
    "/v1/guild/:guildId/academy/contributions",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const { guildId } = request.params;
        const result = await getMemberContributions(fastify.prisma, playerId, guildId);
        return reply.send(result);
      } catch (error: any) {
        return handleAcademyError(fastify, reply, error, "Failed to fetch contributions");
      }
    }
  );
}

// ── Error mapper ──────────────────────────────────────────────────────────────

function handleAcademyError(
  fastify: FastifyInstance,
  reply: any,
  error: any,
  context: string
) {
  if (error instanceof AcademyError) {
    const messageMap: Record<string, string> = {
      NOT_GUILD_MEMBER: "You are not a member of this guild.",
      INVALID_NODE: "Research node not found.",
      NODE_ALREADY_MAXED: "This research node is already at max level.",
      PREREQUISITES_NOT_MET: "Prerequisites for this node are not met.",
      INSUFFICIENT_DUCATS: "Not enough Ducats.",
      INVALID_AMOUNT: "Donation amount must be at least 1.",
    };
    return reply.code(error.status).send({ error: messageMap[error.code] ?? error.code });
  }
  fastify.log.error(error, context);
  return reply.code(500).send({ error: `${context}.` });
}
