import {
  advanceJobsDebugBodySchema,
  claimJobsRunBodySchema,
  jobsMutationResponseSchema,
  jobsStateResponseSchema,
  rerollJobsBoardBodySchema,
  selectJobsBonusBodySchema,
  startJobsRunBodySchema
} from "@ebonkeep/shared/jobs";

import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  JobsError,
  advanceJobsDebug,
  claimJobsRun,
  getJobsState,
  rerollJobsBoard,
  selectJobsBonus,
  startJobsRun
} from "./service.js";

function replyForJobsError(reply: FastifyReply, error: unknown) {
  if (error instanceof JobsError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  const message = error instanceof Error ? error.message : "Jobs request failed.";
  return reply.code(500).send({ error: message });
}

export const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/jobs/state", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(jobsStateResponseSchema.parse(await getJobsState(fastify.prisma, request.user.playerId)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/jobs/state");
      return replyForJobsError(reply, error);
    }
  });

  fastify.post("/v1/jobs/start", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = startJobsRunBodySchema.parse(request.body ?? {});
      return reply.send(jobsMutationResponseSchema.parse(await startJobsRun(fastify.prisma, request.user.playerId, body)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/jobs/start");
      return replyForJobsError(reply, error);
    }
  });

  fastify.post("/v1/jobs/reroll", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      rerollJobsBoardBodySchema.parse(request.body ?? {});
      return reply.send(jobsMutationResponseSchema.parse(await rerollJobsBoard(fastify.prisma, request.user.playerId)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/jobs/reroll");
      return replyForJobsError(reply, error);
    }
  });

  fastify.post("/v1/jobs/bonus", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = selectJobsBonusBodySchema.parse(request.body ?? {});
      return reply.send(jobsMutationResponseSchema.parse(await selectJobsBonus(fastify.prisma, request.user.playerId, body.optionId)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/jobs/bonus");
      return replyForJobsError(reply, error);
    }
  });

  fastify.post("/v1/jobs/claim", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = claimJobsRunBodySchema.parse(request.body ?? {});
      return reply.send(jobsMutationResponseSchema.parse(await claimJobsRun(fastify.prisma, request.user.playerId, body.claimType)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/jobs/claim");
      return replyForJobsError(reply, error);
    }
  });

  fastify.post("/v1/jobs/debug/advance", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = advanceJobsDebugBodySchema.parse(request.body ?? {});
      return reply.send(jobsMutationResponseSchema.parse(await advanceJobsDebug(fastify.prisma, request.user.playerId, body.hours)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/jobs/debug/advance");
      return replyForJobsError(reply, error);
    }
  });
};
