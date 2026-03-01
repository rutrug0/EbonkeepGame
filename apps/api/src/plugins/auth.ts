import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";

import { getEnv } from "../config/env.js";

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
});
