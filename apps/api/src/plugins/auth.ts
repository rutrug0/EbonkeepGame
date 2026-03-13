import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";

import { getEnv } from "../config/env.js";
import { isDeveloperToolsEnabledForAccount } from "../modules/auth/developer-tools.js";

export const authPlugin = fp(async (fastify) => {
  const env = getEnv();
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      void reply.code(401).send({ error: "Unauthorized" });
    }
  });

  fastify.decorate("requireAdmin", async (request, reply) => {
    try {
      await request.jwtVerify();
      
      // Check if user is admin based on environment variable
      const adminIds = process.env.ADMIN_ACCOUNT_IDS?.split(",") ?? [];
      if (!adminIds.includes(request.user.accountId)) {
        void reply.code(403).send({ error: "Admin access required" });
      }
    } catch {
      void reply.code(401).send({ error: "Unauthorized" });
    }
  });

  fastify.decorate("requireDeveloperTools", async (request, reply) => {
    try {
      await request.jwtVerify();

      const enabled = await isDeveloperToolsEnabledForAccount(fastify.prisma, request.user.accountId);
      if (!enabled) {
        void reply.code(403).send({ error: "Developer tools access required" });
      }
    } catch {
      void reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
