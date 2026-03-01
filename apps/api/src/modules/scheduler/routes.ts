import type { FastifyPluginAsync } from "fastify";

export const schedulerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/scheduler/status", async (_request, reply) => {
    const redisOk = fastify.redis.status === "ready";
    return reply.send({
      status: redisOk ? "ok" : "degraded",
      redisStatus: fastify.redis.status
    });
  });
};
