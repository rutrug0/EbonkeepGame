import type { FastifyPluginAsync } from "fastify";

import {
  developerContractsStaticCurvesResponseSchema,
  developerContractSimulationJobSchema,
  runDeveloperContractSimulationBodySchema,
  MAX_CONTRACT_SLOT_COUNT
} from "@ebonkeep/shared/combat";

import { abandonContractOffer, claimContractRunResult, getContractBoard, getContractRun, startContractRun } from "./service.js";
import { getDeveloperContractsStaticCurves } from "./developer-static-curves.js";
import { createDeveloperContractSimulationJob, getDeveloperContractSimulationJob } from "./developer-simulation.js";

function parseSlotId(raw: string): number | null {
  const slotId = Number.parseInt(raw, 10);
  if (!Number.isFinite(slotId) || slotId < 1 || slotId > MAX_CONTRACT_SLOT_COUNT) {
    return null;
  }
  return slotId;
}

export const contractRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/contracts/board", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await getContractBoard(fastify.prisma, request.user.playerId));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/contracts/board");
      return reply.code(500).send({ error: error instanceof Error ? error.message : "Failed to load contracts." });
    }
  });

  fastify.post("/v1/contracts/slots/:slotId/start", { preHandler: fastify.authenticate }, async (request, reply) => {
    const slotId = parseSlotId((request.params as { slotId: string }).slotId);
    if (!slotId) {
      return reply.code(400).send({ error: "Invalid contract slot." });
    }

    try {
      return reply.send(await startContractRun(fastify.prisma, request.user.playerId, slotId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start contract.";
      const statusCode =
        message.includes("stamina") ? 400 :
        message.includes("rest") ? 400 :
        message.includes("active") ? 409 :
        message.includes("available") || message.includes("expired") ? 400 :
        500;
      return reply.code(statusCode).send({ error: message });
    }
  });

  fastify.post("/v1/contracts/slots/:slotId/abandon", { preHandler: fastify.authenticate }, async (request, reply) => {
    const slotId = parseSlotId((request.params as { slotId: string }).slotId);
    if (!slotId) {
      return reply.code(400).send({ error: "Invalid contract slot." });
    }

    try {
      return reply.send(await abandonContractOffer(fastify.prisma, request.user.playerId, slotId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to abandon contract.";
      const statusCode = message.includes("available") ? 400 : 500;
      return reply.code(statusCode).send({ error: message });
    }
  });

  fastify.get("/v1/contracts/runs/:runId", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const run = await getContractRun(fastify.prisma, request.user.playerId, (request.params as { runId: string }).runId);
      if (!run) {
        return reply.code(404).send({ error: "Contract run not found." });
      }
      return reply.send(run);
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/contracts/runs/:runId");
      return reply.code(500).send({ error: error instanceof Error ? error.message : "Failed to load contract run." });
    }
  });

  fastify.post("/v1/contracts/runs/:runId/claim-result", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(await claimContractRunResult(fastify.prisma, request.user.playerId, (request.params as { runId: string }).runId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim contract result.";
      const statusCode =
        message.includes("not found") ? 404 :
        message.includes("completed yet") ? 400 :
        message.includes("already claimed") ? 409 :
        500;
      return reply.code(statusCode).send({ error: message });
    }
  });

  fastify.post("/v1/contracts/simulations", { preHandler: fastify.requireDeveloperTools }, async (request, reply) => {
    try {
      const body = runDeveloperContractSimulationBodySchema.parse(request.body ?? {});
      return reply.send(developerContractSimulationJobSchema.parse(createDeveloperContractSimulationJob(body)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start contracts simulation.";
      return reply.code(400).send({ error: message });
    }
  });

  fastify.get("/v1/contracts/simulations/:jobId", { preHandler: fastify.requireDeveloperTools }, async (request, reply) => {
    const job = getDeveloperContractSimulationJob((request.params as { jobId: string }).jobId);
    if (!job) {
      return reply.code(404).send({ error: "Contracts simulation job not found." });
    }

    return reply.send(developerContractSimulationJobSchema.parse(job));
  });

  fastify.get("/v1/contracts/simulation-curves", { preHandler: fastify.requireDeveloperTools }, async (_request, reply) => {
    return reply.send(developerContractsStaticCurvesResponseSchema.parse(getDeveloperContractsStaticCurves()));
  });
};
