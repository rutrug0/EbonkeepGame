import type { FastifyInstance } from "fastify";

import { renownUnlockBodySchema } from "@ebonkeep/shared/player";

import { getRenownState, RenownError, unlockRenownNode } from "./service.js";

export async function renownRoutes(fastify: FastifyInstance) {
  // GET /v1/renown/state  — returns the authenticated player's renown tree state
  fastify.get(
    "/v1/renown/state",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const playerId = request.user.playerId;
      const state = await getRenownState(playerId, fastify.prisma);
      return reply.send(state);
    }
  );

  // POST /v1/renown/unlock  — unlocks a single renown node, deducts renown cost
  fastify.post<{ Body: unknown }>(
    "/v1/renown/unlock",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const playerId = request.user.playerId;

      const parseResult = renownUnlockBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      try {
        const state = await unlockRenownNode(playerId, parseResult.data.nodeId, fastify.prisma);
        return reply.send(state);
      } catch (err) {
        if (err instanceof RenownError) {
          return reply.status(err.statusCode).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    }
  );
}
