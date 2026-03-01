import {
  combatActionBodySchema,
  combatActionResponseSchema,
  createCombatSessionBodySchema,
  createCombatSessionResponseSchema
} from "@ebonkeep/shared";
import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

export const combatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/v1/combat/sessions",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = createCombatSessionBodySchema.parse(request.body ?? {});

      const session = await fastify.prisma.combatSession.create({
        data: {
          playerId: request.user.playerId,
          mode: body.mode,
          state: "created"
        }
      });

      const payload = createCombatSessionResponseSchema.parse({
        sessionId: session.id,
        state: "created",
        turnTimerSeconds: 8
      });

      return reply.send(payload);
    }
  );

  fastify.post(
    "/v1/combat/actions",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = combatActionBodySchema.parse(request.body ?? {});
      const actionId = `act_${randomUUID().replaceAll("-", "")}`;

      await fastify.prisma.combatAction.create({
        data: {
          id: actionId,
          playerId: request.user.playerId,
          sessionId: body.sessionId,
          action: body.actionType,
          targetId: body.targetId,
          skillId: body.skillId
        }
      });

      const payload = combatActionResponseSchema.parse({
        accepted: true,
        actionId
      });

      return reply.send(payload);
    }
  );
};
