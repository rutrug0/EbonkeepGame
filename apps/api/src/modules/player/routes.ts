import {
  playerCheatActionResponseSchema,
  playerCheatGenerateEquipmentBodySchema,
  playerCheatGenerateEquipmentResponseSchema,
  playerCheatGuildRaidResetResponseSchema,
  playerCheatGuildRaidSquadResponseSchema,
  playerCheatGrantCurrencyResponseSchema,
  playerCheatLevelUpBodySchema,
  playerPreferencesSchema,
  publicPlayerProfileSchema,
  updatePlayerCheatSettingsBodySchema,
  updatePlayerPreferencesBodySchema,
  updatePortraitBodySchema
} from "@ebonkeep/shared/player";

import type { FastifyPluginAsync } from "fastify";
import {
  generateEquipmentForCheats,
  grantCurrencyForCheats,
  levelPlayerForCheats,
  replenishPlayerForCheats,
  resetGuildRaidProgressForCheats,
  seedGuildRaidSquadForCheats,
  updatePlayerCheatSettings
} from "./cheat-service.js";
import { loadPlayerState, getPublicPlayerProfile } from "./state-service.js";
import { restPlayerResources } from "./progression-service.js";
import { playerRestResponseSchema } from "@ebonkeep/shared/player";

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

  fastify.post(
    "/v1/player/rest",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const currentState = await loadPlayerState(fastify.prisma, playerId);
        if (!currentState) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        const now = new Date();
        const result = await fastify.prisma.$transaction(async (tx) => {
          const restOutcome = await restPlayerResources({
            tx,
            playerId,
            maxHealth: currentState.health.max,
            now
          });
          const playerState = await loadPlayerState(tx, playerId);
          if (!playerState) {
            throw new Error("Player state not found.");
          }
          return {
            playerState,
            costDucats: restOutcome.costDucats
          };
        });

        return reply.send(playerRestResponseSchema.parse(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to rest.";
        const statusCode = message.includes("ducats") ? 400 : message.includes("not found") ? 404 : 500;
        fastify.log.error({ err: error }, "Error in POST /v1/player/rest");
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.patch(
    "/v1/player/cheats/settings",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const playerId = request.user.playerId;
        const body = updatePlayerCheatSettingsBodySchema.parse(request.body ?? {});
        const playerState = await updatePlayerCheatSettings(fastify.prisma, playerId, body);

        return reply.send(
          playerCheatActionResponseSchema.parse({
            playerState
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update cheat settings.";
        const statusCode = message.includes("not found") ? 404 : 400;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/replenish",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const playerState = await replenishPlayerForCheats(fastify.prisma, request.user.playerId);
        return reply.send(playerCheatActionResponseSchema.parse({ playerState }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to replenish player resources.";
        const statusCode = message.includes("not found") ? 404 : 500;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/level-up",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = playerCheatLevelUpBodySchema.parse(request.body ?? {});
        const playerState = await levelPlayerForCheats(fastify.prisma, request.user.playerId, body.targetLevel);
        return reply.send(playerCheatActionResponseSchema.parse({ playerState }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to level up player.";
        const statusCode =
          message.includes("Target level") ? 400 :
          message.includes("not found") ? 404 :
          500;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/generate-equipment",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const body = playerCheatGenerateEquipmentBodySchema.parse(request.body ?? {});
        const result = await fastify.prisma.$transaction((tx) =>
          generateEquipmentForCheats(tx, request.user.playerId, body.rarity)
        );
        return reply.send(playerCheatGenerateEquipmentResponseSchema.parse(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate equipment.";
        const statusCode =
          message.includes("No item template") ? 400 :
          message.includes("not found") ? 404 :
          500;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/grant-currency",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const result = await grantCurrencyForCheats(fastify.prisma, request.user.playerId);
        return reply.send(playerCheatGrantCurrencyResponseSchema.parse(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to grant cheat currency.";
        const statusCode = message.includes("not found") ? 404 : 500;
        return reply.code(statusCode).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/guild-raid-squad",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const result = await fastify.prisma.$transaction((tx) =>
          seedGuildRaidSquadForCheats(tx, request.user.playerId)
        );
        return reply.send(playerCheatGuildRaidSquadResponseSchema.parse(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to seed the guild raid squad.";
        if (message.includes("PLAYER_NOT_IN_GUILD")) {
          return reply.code(400).send({ error: "Join a guild before seeding raid members." });
        }
        return reply.code(500).send({ error: message });
      }
    }
  );

  fastify.post(
    "/v1/player/cheats/guild-raid-reset",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        const result = await fastify.prisma.$transaction((tx) =>
          resetGuildRaidProgressForCheats(tx, request.user.playerId)
        );
        return reply.send(playerCheatGuildRaidResetResponseSchema.parse(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reset guild raids.";
        if (message.includes("PLAYER_NOT_IN_GUILD")) {
          return reply.code(400).send({ error: "Join a guild before resetting guild raids." });
        }
        return reply.code(500).send({ error: message });
      }
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
