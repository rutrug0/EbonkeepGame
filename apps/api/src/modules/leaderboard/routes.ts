import { leaderboardResponseSchema, leaderboardTypeSchema } from "@ebonkeep/shared";
import type { PlayerStatTree } from "@ebonkeep/shared/core";
import { z } from "zod";

import type { FastifyPluginAsync } from "fastify";
import { getLeaderboard } from "./service.js";

const leaderboardQuerySchema = z.object({
  type: leaderboardTypeSchema.default("power"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  classFilter: z.enum(["strength", "dexterity", "intelligence", "all"]).default("all")
});

export const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Get leaderboard
  fastify.get(
    "/v1/leaderboard",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const query = leaderboardQuerySchema.parse(request.query ?? {});
        const currentPlayerId = request.user.playerId;

        const result = await getLeaderboard(
          fastify.prisma,
          query.type,
          query.limit,
          query.classFilter === "all" ? undefined : query.classFilter as PlayerStatTree,
          currentPlayerId
        );

        return reply.send(leaderboardResponseSchema.parse(result));
      } catch (error) {
        fastify.log.error({ err: error }, "Error in GET /v1/leaderboard");
        return reply.code(500).send({
          error: "Failed to fetch leaderboard",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // Get public leaderboard (no auth required)
  fastify.get("/v1/leaderboard/public", async (request, reply) => {
    try {
      const query = leaderboardQuerySchema.parse(request.query ?? {});

      const result = await getLeaderboard(
        fastify.prisma,
        query.type,
        query.limit,
        query.classFilter === "all" ? undefined : query.classFilter as PlayerStatTree
      );

      return reply.send(leaderboardResponseSchema.parse(result));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/leaderboard/public");
      return reply.code(500).send({
        error: "Failed to fetch leaderboard",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
};
