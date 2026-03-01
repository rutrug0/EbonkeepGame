import {
  shopPurchaseBodySchema,
  shopPurchaseResponseSchema,
  startJobBodySchema,
  startJobResponseSchema
} from "@ebonkeep/shared";
import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

function getCompletionDate(jobType: "short" | "medium" | "long"): Date {
  const now = Date.now();
  const durationsMs: Record<typeof jobType, number> = {
    short: 30 * 60 * 1000,
    medium: 2 * 60 * 60 * 1000,
    long: 8 * 60 * 60 * 1000
  };
  return new Date(now + durationsMs[jobType]);
}

export const economyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/v1/jobs/start",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = startJobBodySchema.parse(request.body ?? {});
      const completeAt = getCompletionDate(body.jobType);

      const jobRun = await fastify.prisma.jobRun.create({
        data: {
          playerId: request.user.playerId,
          jobType: body.jobType,
          status: "active",
          completeAt
        }
      });

      const payload = startJobResponseSchema.parse({
        jobRunId: jobRun.id,
        completeAt: completeAt.toISOString()
      });

      return reply.send(payload);
    }
  );

  fastify.post(
    "/v1/shop/purchase",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = shopPurchaseBodySchema.parse(request.body ?? {});

      const payload = shopPurchaseResponseSchema.parse({
        purchased: true,
        offerId: body.offerId ?? `offer_${randomUUID().replaceAll("-", "")}`
      });

      return reply.send(payload);
    }
  );
};
