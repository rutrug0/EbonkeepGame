import {
  playerPreferencesSchema,
  playerStateSchema,
  updatePlayerPreferencesBodySchema
} from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";
import { getStartupDevWeapons } from "./dev-weapons.js";

export const playerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/player/state",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user.playerId;

      const profile = await fastify.prisma.playerProfile.findUnique({
        where: { id: playerId }
      });
      const stats = await fastify.prisma.playerStat.findUnique({
        where: { playerId }
      });
      const currency = await fastify.prisma.currencyBalance.findUnique({
        where: { playerId }
      });

      if (!profile || !stats || !currency) {
        return reply.code(404).send({ error: "Player state not found." });
      }

      const payload = playerStateSchema.parse({
        playerId: profile.id,
        accountId: profile.accountId,
        class: profile.class,
        preferredLocale:
          (profile as { preferredLocale?: string | null }).preferredLocale ?? "en",
        level: profile.level,
        gearScore: profile.gearScore,
        stats: {
          strength: stats.strength,
          intelligence: stats.intelligence,
          dexterity: stats.dexterity,
          vitality: stats.vitality,
          initiative: stats.initiative,
          luck: stats.luck
        },
        currency: {
          ducats: currency.ducats,
          imperials: currency.imperials
        },
        devWeapons: getStartupDevWeapons()
      });

      return reply.send(payload);
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
};
