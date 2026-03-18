import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { MAX_GARDEN_SLOT_COUNT, plantGardenSeedBodySchema } from "@ebonkeep/shared/garden";

import {
  GardenError,
  clearWiltedGardenPlot,
  getGardenState,
  harvestGardenPlot,
  plantGardenSeed
} from "./service.js";

function parseSlotIndex(raw: string): number | null {
  const slotIndex = Number.parseInt(raw, 10);
  if (!Number.isFinite(slotIndex) || slotIndex < 1 || slotIndex > MAX_GARDEN_SLOT_COUNT) {
    return null;
  }
  return slotIndex;
}

function replyForGardenError(reply: FastifyReply, error: unknown) {
  if (error instanceof GardenError) {
    return reply.code(error.statusCode).send({ error: error.message, code: error.code });
  }
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Invalid garden payload." });
  }

  const message = error instanceof Error ? error.message : "Garden request failed.";
  return reply.code(500).send({ error: message });
}

export const gardenRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/garden/state", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await getGardenState(fastify.prisma, request.user.playerId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/garden/state");
      return replyForGardenError(reply, error);
    }
  });

  fastify.post("/v1/garden/slots/:slotIndex/plant", { preHandler: fastify.authenticate }, async (request, reply) => {
    const slotIndex = parseSlotIndex((request.params as { slotIndex: string }).slotIndex);
    if (!slotIndex) {
      return reply.code(400).send({ error: "Invalid garden slot." });
    }

    try {
      const body = plantGardenSeedBodySchema.parse(request.body ?? {});
      return reply.send(await plantGardenSeed(fastify.prisma, request.user.playerId, slotIndex, body.plantId));
    } catch (error) {
      return replyForGardenError(reply, error);
    }
  });

  fastify.post("/v1/garden/slots/:slotIndex/harvest", { preHandler: fastify.authenticate }, async (request, reply) => {
    const slotIndex = parseSlotIndex((request.params as { slotIndex: string }).slotIndex);
    if (!slotIndex) {
      return reply.code(400).send({ error: "Invalid garden slot." });
    }

    try {
      return reply.send(await harvestGardenPlot(fastify.prisma, request.user.playerId, slotIndex));
    } catch (error) {
      return replyForGardenError(reply, error);
    }
  });

  fastify.post("/v1/garden/slots/:slotIndex/clear", { preHandler: fastify.authenticate }, async (request, reply) => {
    const slotIndex = parseSlotIndex((request.params as { slotIndex: string }).slotIndex);
    if (!slotIndex) {
      return reply.code(400).send({ error: "Invalid garden slot." });
    }

    try {
      return reply.send(await clearWiltedGardenPlot(fastify.prisma, request.user.playerId, slotIndex));
    } catch (error) {
      return replyForGardenError(reply, error);
    }
  });
};
