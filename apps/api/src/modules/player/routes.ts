import {
  playerPreferencesSchema,
  publicPlayerProfileSchema,
  updatePlayerPreferencesBodySchema,
  updatePortraitBodySchema
} from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";
import { loadPlayerState, getPublicPlayerProfile } from "./state-service.js";

export const playerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/player/state",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;

        const payload = await loadPlayerState(fastify.prisma, playerId);

        if (!payload) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        return reply.send(payload);
      } catch (error) {
        fastify.log.error({ err: error }, "Error in GET /v1/player/state");
        return reply.code(500).send({ 
          error: "Internal server error", 
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  fastify.patch(
    "/v1/player/preferences",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user.playerId;
      const body = updatePlayerPreferencesBodySchema.parse(request.body ?? {});

      await fastify.prisma.$executeRaw`
        UPDATE "player_profiles"
        SET "preferredLocale" = ${body.preferredLocale}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${playerId}
      `;

      const rows = await fastify.prisma.$queryRaw<Array<{ preferredLocale: string }>>`
        SELECT "preferredLocale"
        FROM "player_profiles"
        WHERE "id" = ${playerId}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return reply.code(404).send({ error: "Player state not found." });
      }
      const preferredLocale = rows[0].preferredLocale ?? "en";

      const payload = playerPreferencesSchema.parse({
        preferredLocale
      });

      return reply.send(payload);
    }
  );

  fastify.patch(
    "/v1/player/portrait",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user.playerId;
      const body = updatePortraitBodySchema.parse(request.body ?? {});

      const updateData: { portraitId?: string; backgroundId?: string; updatedAt: Date } = { updatedAt: new Date() };
      if (body.portraitId !== undefined) updateData.portraitId = body.portraitId;
      if (body.backgroundId !== undefined) updateData.backgroundId = body.backgroundId;

      await fastify.prisma.playerProfile.update({
        where: { id: playerId },
        data: updateData
      });

      return reply.send({ portraitId: body.portraitId, backgroundId: body.backgroundId });
    }
  );

  fastify.get(
    "/v1/player/:playerId/public-profile",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const { playerId } = request.params as { playerId: string };
        const profile = await getPublicPlayerProfile(fastify.prisma, playerId);
        if (!profile) {
          return reply.code(404).send({ error: "Player not found." });
        }
        return reply.send(publicPlayerProfileSchema.parse(profile));
      } catch (error) {
        fastify.log.error({ err: error }, "Error in GET /v1/player/:playerId/public-profile");
        return reply.code(500).send({
          error: "Internal server error",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );
};
