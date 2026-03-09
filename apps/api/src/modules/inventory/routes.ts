import { inventoryMoveBodySchema, inventoryMoveResponseSchema } from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/inventory - Get player's inventory items
   */
  fastify.get(
    "/v1/inventory",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user!.playerId;

      const items = await fastify.prisma.inventoryItem.findMany({
        where: { playerId },
        orderBy: { createdAt: "desc" }
      });

      return reply.send({ items });
    }
  );

  fastify.post(
    "/v1/inventory/move-item",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = inventoryMoveBodySchema.parse(request.body ?? {});

      const payload = inventoryMoveResponseSchema.parse({
        moved: true,
        itemId: body.itemId
      });

      return reply.send(payload);
    }
  );
};
