import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { ZodError } from "zod";

import {
  craftingCombineRequestSchema,
  craftingClaimJobRequestSchema,
  craftingItemCraftRequestSchema,
  craftingStartJobRequestSchema
} from "@ebonkeep/shared/crafting";

import {
  CraftingError,
  claimCraftingJob,
  getCraftingInventory,
  startCraftingJob
} from "./service.js";

function replyForCraftingError(reply: FastifyReply, error: unknown) {
  if (error instanceof CraftingError) {
    return reply.code(error.statusCode).send({ error: error.message, code: error.code });
  }
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Invalid crafting payload." });
  }

  const message = error instanceof Error ? error.message : "Crafting request failed.";
  return reply.code(500).send({ error: message });
}

export const craftingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/crafting/inventory", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await getCraftingInventory(fastify.prisma, request.user.playerId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/crafting/inventory");
      return replyForCraftingError(reply, error);
    }
  });

  fastify.post("/v1/crafting/start", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = craftingStartJobRequestSchema.parse(request.body ?? {});
      return reply.send(await startCraftingJob(fastify.prisma, request.user.playerId, body.recipeId, body.recipeType, body.slotIndex));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/crafting/start");
      return replyForCraftingError(reply, error);
    }
  });

  fastify.post("/v1/crafting/combine", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = craftingCombineRequestSchema.parse(request.body ?? {});
      return reply.send(await startCraftingJob(fastify.prisma, request.user.playerId, body.recipeId, "combine", body.slotIndex));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/crafting/combine");
      return replyForCraftingError(reply, error);
    }
  });

  fastify.post("/v1/crafting/craft-item", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = craftingItemCraftRequestSchema.parse(request.body ?? {});
      return reply.send(await startCraftingJob(fastify.prisma, request.user.playerId, body.recipeId, "item", body.slotIndex));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/crafting/craft-item");
      return replyForCraftingError(reply, error);
    }
  });

  fastify.post("/v1/crafting/claim", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = craftingClaimJobRequestSchema.parse(request.body ?? {});
      return reply.send(await claimCraftingJob(fastify.prisma, request.user.playerId, body.jobId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/crafting/claim");
      return replyForCraftingError(reply, error);
    }
  });
};
