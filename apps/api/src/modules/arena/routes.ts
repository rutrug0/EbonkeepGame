import type { FastifyPluginAsync } from "fastify";

import { fightArenaOffer, findArenaOpponents, getArenaState } from "./service.js";
import { JobsError } from "../jobs/service.js";

export const arenaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/arena/state", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await getArenaState(fastify.prisma, request.user.playerId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load arena state.";
      fastify.log.error({ err: error }, "Error in GET /v1/arena/state");
      return reply.code(500).send({ error: message });
    }
  });

  fastify.post("/v1/arena/find-opponents", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await findArenaOpponents(fastify.prisma, request.user.playerId));
    } catch (error) {
      if (error instanceof JobsError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      const message = error instanceof Error ? error.message : "Failed to find arena opponents.";
      const statusCode = message.includes("cooldown") || message.includes("active") ? 409 : 500;
      return reply.code(statusCode).send({ error: message });
    }
  });

  fastify.post("/v1/arena/offers/:offerId/fight", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(
        await fightArenaOffer(fastify.prisma, request.user.playerId, (request.params as { offerId: string }).offerId)
      );
    } catch (error) {
      if (error instanceof JobsError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      const message = error instanceof Error ? error.message : "Failed to resolve arena fight.";
      const statusCode = message.includes("not found") || message.includes("expired") ? 404 : 500;
      return reply.code(statusCode).send({ error: message });
    }
  });
};
