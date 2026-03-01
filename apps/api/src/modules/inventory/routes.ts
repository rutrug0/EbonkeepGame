import { inventoryMoveBodySchema, inventoryMoveResponseSchema } from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
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
