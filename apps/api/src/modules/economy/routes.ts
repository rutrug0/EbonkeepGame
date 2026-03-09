import {
  merchantBuyBodySchema,
  merchantRestockBodySchema,
  merchantStateResponseSchema,
  merchantSellBodySchema,
  merchantTransactionResponseSchema,
  shopPurchaseBodySchema,
  shopPurchaseResponseSchema,
  startJobBodySchema,
  startJobResponseSchema
} from "@ebonkeep/shared";
import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

import {
  MerchantActionError,
  buyMerchantOffer,
  loadMerchantState,
  restockMerchant,
  sellMerchantItem
} from "./merchant-service.js";
import { loadPlayerState } from "../player/state-service.js";

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
    "/v1/merchant/restock",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        merchantRestockBodySchema.parse(request.body ?? {});

        await restockMerchant(fastify.prisma, request.user.playerId);

        const playerState = await loadPlayerState(fastify.prisma, request.user.playerId);
        if (!playerState) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        const merchantState = await loadMerchantState(fastify.prisma, request.user.playerId, playerState);
        return reply.send(
          merchantTransactionResponseSchema.parse({
            playerState,
            merchantState
          })
        );
      } catch (error) {
        if (error instanceof MerchantActionError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  fastify.get(
    "/v1/merchant/state",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const merchantState = await loadMerchantState(fastify.prisma, request.user.playerId);
        return reply.send(merchantStateResponseSchema.parse(merchantState));
      } catch (error) {
        if (error instanceof MerchantActionError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  fastify.post(
    "/v1/merchant/buy",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = merchantBuyBodySchema.parse(request.body ?? {});
        await buyMerchantOffer(fastify.prisma, request.user.playerId, body.offerId);

        const playerState = await loadPlayerState(fastify.prisma, request.user.playerId);
        if (!playerState) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        const merchantState = await loadMerchantState(fastify.prisma, request.user.playerId, playerState);
        return reply.send(
          merchantTransactionResponseSchema.parse({
            playerState,
            merchantState
          })
        );
      } catch (error) {
        if (error instanceof MerchantActionError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  fastify.post(
    "/v1/merchant/sell",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = merchantSellBodySchema.parse(request.body ?? {});
        await sellMerchantItem(fastify.prisma, request.user.playerId, body.itemId, body.fromSlot);

        const playerState = await loadPlayerState(fastify.prisma, request.user.playerId);
        if (!playerState) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        const merchantState = await loadMerchantState(fastify.prisma, request.user.playerId, playerState);
        return reply.send(
          merchantTransactionResponseSchema.parse({
            playerState,
            merchantState
          })
        );
      } catch (error) {
        if (error instanceof MerchantActionError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
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
