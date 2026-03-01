import type { PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    authenticate: preHandlerHookHandler;
  }

  interface FastifyRequest {
    user: {
      accountId: string;
      playerId: string;
    };
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      accountId: string;
      playerId: string;
    };
    user: {
      accountId: string;
      playerId: string;
    };
  }
}

export type AuthenticatedRequest = FastifyRequest & {
  user: {
    accountId: string;
    playerId: string;
  };
};

export type AuthenticatedHandler = (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => Promise<void>;
