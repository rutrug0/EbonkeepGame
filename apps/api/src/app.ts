import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyLoggerOptions } from "fastify";
import type { Redis } from "ioredis";

import { getEnv } from "./config/env.js";
import { initializeAuctionJobs } from "./modules/auction/background-jobs.js";
import { auctionRoutes } from "./modules/auction/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { initEmailService } from "./modules/auth/services/email.js";
import { combatRoutes } from "./modules/combat/routes.js";
import { economyRoutes } from "./modules/economy/routes.js";
import { guildRoutes } from "./modules/guild/routes.js";
import { inventoryRoutes } from "./modules/inventory/routes.js";
import { leaderboardRoutes } from "./modules/leaderboard/routes.js";
import { playerRoutes } from "./modules/player/routes.js";
import { schedulerRoutes } from "./modules/scheduler/routes.js";
import { telemetryRoutes } from "./modules/telemetry/routes.js";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { websocketRoutes } from "./routes/ws.js";

export type BuildServerOptions = {
  logger?: FastifyLoggerOptions<FastifyBaseLogger> | boolean;
  prisma?: PrismaClient;
  redis?: Redis;
  startBackgroundJobs?: boolean;
  registerPayments?: boolean;
};

function initializeEmailTransport() {
  initEmailService({
    host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
    port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER ?? "",
    password: process.env.EMAIL_PASSWORD ?? ""
  });
}

function attachExternalClients(fastify: FastifyInstance, options: BuildServerOptions) {
  if (options.prisma) {
    fastify.decorate("prisma", options.prisma);
  }
  if (options.redis) {
    fastify.decorate("redis", options.redis);
  }
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  initializeEmailTransport();

  const fastify = Fastify({
    logger: options.logger ?? {
      level: "info"
    }
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });
  await fastify.register(websocket);
  await fastify.register(authPlugin);

  if (options.prisma || options.redis) {
    attachExternalClients(fastify, options);
    if (!options.prisma) {
      await fastify.register(prismaPlugin);
    }
    if (!options.redis) {
      await fastify.register(redisPlugin);
    }
  } else {
    await fastify.register(prismaPlugin);
    await fastify.register(redisPlugin);
  }

  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.get("/ready", async (_request, reply) => {
    const redisOk = fastify.redis.status === "ready";
    let dbOk = true;
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    if (!redisOk || !dbOk) {
      return reply.code(503).send({
        status: "degraded",
        redis: redisOk ? "ok" : "down",
        postgres: dbOk ? "ok" : "down"
      });
    }
    return reply.send({
      status: "ok",
      redis: "ok",
      postgres: "ok"
    });
  });

  await fastify.register(authRoutes);
  await fastify.register(playerRoutes);
  await fastify.register(combatRoutes);
  await fastify.register(inventoryRoutes);
  await fastify.register(economyRoutes);
  if (options.registerPayments ?? true) {
    const { paymentsRoutes } = await import("./modules/payments/routes.js");
    await fastify.register(paymentsRoutes);
  }
  await fastify.register(schedulerRoutes);
  await fastify.register(telemetryRoutes);
  await fastify.register(auctionRoutes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(guildRoutes);
  await fastify.register(websocketRoutes);

  if (options.startBackgroundJobs ?? true) {
    initializeAuctionJobs(fastify.prisma).start();
  }

  return fastify;
}

export async function startServer(): Promise<FastifyInstance> {
  const env = getEnv();
  const fastify = await buildServer();
  await fastify.listen({
    port: env.API_PORT,
    host: env.API_HOST
  });

  fastify.log.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
  return fastify;
}
