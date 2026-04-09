import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  mailboxInboxResponseSchema,
  mailboxMessageDetailSchema,
  mailboxMessageMutationResponseSchema,
  mailboxReplayResponseSchema,
  mailboxUnreadCountResponseSchema,
  sendDirectMailboxMessageBodySchema,
  sendGuildMailboxMessageBodySchema
} from "@ebonkeep/shared/messages";

import {
  MessageError,
  claimMailboxMessageRewards,
  getMailboxMessage,
  getMailboxReplay,
  getMailboxUnreadCount,
  listMailbox,
  markMailboxMessageRead,
  sendDirectMailboxMessage,
  sendGuildMailboxMessage
} from "./service.js";

function replyForMailboxError(reply: FastifyReply, error: unknown) {
  if (error instanceof MessageError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  return reply.code(500).send({
    error: error instanceof Error ? error.message : "Mailbox request failed."
  });
}

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/messages", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(mailboxInboxResponseSchema.parse(await listMailbox(fastify.prisma, request.user.playerId)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/messages");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.get("/v1/messages/unread-count", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(mailboxUnreadCountResponseSchema.parse(await getMailboxUnreadCount(fastify.prisma, request.user.playerId)));
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/messages/unread-count");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.get("/v1/messages/:messageId", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(
        mailboxMessageDetailSchema.parse(
          await getMailboxMessage(fastify.prisma, request.user.playerId, (request.params as { messageId: string }).messageId)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/messages/:messageId");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.post("/v1/messages/direct", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = sendDirectMailboxMessageBodySchema.parse(request.body ?? {});
      return reply.send(
        mailboxMessageMutationResponseSchema.parse(
          await sendDirectMailboxMessage(fastify.prisma, request.user.playerId, body)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/messages/direct");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.post("/v1/messages/guild", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const body = sendGuildMailboxMessageBodySchema.parse(request.body ?? {});
      return reply.send(
        mailboxMessageMutationResponseSchema.parse(
          await sendGuildMailboxMessage(fastify.prisma, request.user.playerId, body)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/messages/guild");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.post("/v1/messages/:messageId/read", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(
        mailboxMessageMutationResponseSchema.parse(
          await markMailboxMessageRead(fastify.prisma, request.user.playerId, (request.params as { messageId: string }).messageId)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/messages/:messageId/read");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.post("/v1/messages/:messageId/claim", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(
        mailboxMessageMutationResponseSchema.parse(
          await claimMailboxMessageRewards(fastify.prisma, request.user.playerId, (request.params as { messageId: string }).messageId)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in POST /v1/messages/:messageId/claim");
      return replyForMailboxError(reply, error);
    }
  });

  fastify.get("/v1/messages/:messageId/replay", { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      return reply.send(
        mailboxReplayResponseSchema.parse(
          await getMailboxReplay(fastify.prisma, request.user.playerId, (request.params as { messageId: string }).messageId)
        )
      );
    } catch (error) {
      fastify.log.error({ err: error }, "Error in GET /v1/messages/:messageId/replay");
      return replyForMailboxError(reply, error);
    }
  });
};
