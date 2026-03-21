import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { forgeEnchantBodySchema, forgeMendBodySchema } from "@ebonkeep/shared/forge";

import { ForgeError, attemptWeaponEnchant, mendForgeWeapon, getForgeState } from "./service.js";

function replyForForgeError(reply: FastifyReply, error: unknown) {
  if (error instanceof ForgeError) {
    return reply.code(error.statusCode).send({ error: error.message, code: error.code });
  }
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Invalid forge payload." });
  }

  const message = error instanceof Error ? error.message : "Forge request failed.";
  return reply.code(500).send({ error: message });
}

export const forgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/forge/state", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await getForgeState(fastify.prisma, request.user.playerId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/forge/state");
      return replyForForgeError(reply, error);
    }
  });

  fastify.post("/v1/forge/enchant", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = forgeEnchantBodySchema.parse(request.body ?? {});
      return reply.send(await attemptWeaponEnchant(fastify.prisma, request.user.playerId, body.weaponItemId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/forge/enchant");
      return replyForForgeError(reply, error);
    }
  });

  fastify.post("/v1/forge/mend", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = forgeMendBodySchema.parse(request.body ?? {});
      return reply.send(await mendForgeWeapon(fastify.prisma, request.user.playerId, body.weaponItemId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/forge/mend");
      return replyForForgeError(reply, error);
    }
  });
};

