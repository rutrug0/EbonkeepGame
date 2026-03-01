import { playerStateSchema } from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";
import { getStartupDevMeleeWeapons } from "./dev-weapons.js";

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
        devMeleeWeapons: getStartupDevMeleeWeapons()
      });

      return reply.send(payload);
    }
  );
};
