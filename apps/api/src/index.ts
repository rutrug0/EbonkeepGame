import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { getEnv } from "./config/env.js";
import { authRoutes } from "./modules/auth/routes.js";
import { initEmailService } from "./modules/auth/services/email.js";
import { combatRoutes } from "./modules/combat/routes.js";
import { economyRoutes } from "./modules/economy/routes.js";
import { inventoryRoutes } from "./modules/inventory/routes.js";
import { playerRoutes } from "./modules/player/routes.js";
import { schedulerRoutes } from "./modules/scheduler/routes.js";
import { telemetryRoutes } from "./modules/telemetry/routes.js";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { websocketRoutes } from "./routes/ws.js";

async function buildServer() {
  const env = getEnv();
  
  // Initialize email service
  initEmailService({
    host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
    port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER ?? "",
    password: process.env.EMAIL_PASSWORD ?? ""
  });

  const fastify = Fastify({
    logger: {
      level: "info"
    }
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });
  await fastify.register(websocket);
  await fastify.register(authPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);

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
  await fastify.register(schedulerRoutes);
  await fastify.register(telemetryRoutes);
  await fastify.register(websocketRoutes);

  await fastify.listen({
    port: env.API_PORT,
    host: env.API_HOST
  });

  fastify.log.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
  return fastify;
}

void buildServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
