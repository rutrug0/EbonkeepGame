import { randomUUID } from "node:crypto";

import { devGuestLoginResponseSchema } from "@ebonkeep/shared";
import { z } from "zod";

import type { FastifyPluginAsync } from "fastify";

import { getEnv } from "../../config/env.js";

const devGuestBodySchema = z.object({
  guestId: z.string().min(1).optional(),
  class: z.enum(["warrior", "wizard", "archer"]).default("warrior")
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/v1/dev/guest-login", async (request, reply) => {
    const env = getEnv();
    if (!env.DEV_GUEST_AUTH) {
      return reply.code(403).send({ error: "DEV_GUEST_AUTH is disabled." });
    }

    const body = devGuestBodySchema.parse(request.body ?? {});
    const providerUserId = body.guestId ?? "local-default";

    const account = await fastify.prisma.account.upsert({
      where: {
        provider_providerUserId: {
          provider: "dev-guest",
          providerUserId
        }
      },
      update: {},
      create: {
        provider: "dev-guest",
        providerUserId
      }
    });

    let profile = await fastify.prisma.playerProfile.findFirst({
      where: { accountId: account.id }
    });

    if (!profile) {
      profile = await fastify.prisma.playerProfile.create({
        data: {
          id: `player_${randomUUID().replaceAll("-", "")}`,
          accountId: account.id,
          class: body.class,
          level: 1,
          gearScore: 10
        }
      });
    }

    await fastify.prisma.playerStat.upsert({
      where: { playerId: profile.id },
      update: {},
      create: {
        playerId: profile.id,
        strength: 12,
        intelligence: 8,
        dexterity: 10,
        vitality: 12,
        initiative: 10,
        luck: 9
      }
    });

    await fastify.prisma.currencyBalance.upsert({
      where: { playerId: profile.id },
      update: {},
      create: {
        playerId: profile.id,
        ducats: 100,
        imperials: 10
      }
    });

    const accessToken = await reply.jwtSign({
      accountId: account.id,
      playerId: profile.id
    });

    const payload = devGuestLoginResponseSchema.parse({
      accessToken,
      playerId: profile.id,
      accountId: account.id
    });

    return reply.send(payload);
  });
};
