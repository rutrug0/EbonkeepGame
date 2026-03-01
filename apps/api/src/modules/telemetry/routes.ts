import type { FastifyPluginAsync } from "fastify";

const telemetryBodySchema = {
  type: "object",
  required: ["eventName"],
  properties: {
    eventName: { type: "string" },
    payload: { type: "object" }
  }
} as const;

export const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/v1/telemetry/event",
    {
      preHandler: fastify.authenticate,
      schema: {
        body: telemetryBodySchema
      }
    },
    async (request, reply) => {
      fastify.log.info(
        {
          playerId: request.user.playerId,
          telemetry: request.body
        },
        "Telemetry event captured"
      );
      return reply.code(202).send({ accepted: true });
    }
  );
};
