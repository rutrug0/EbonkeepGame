import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientConstructor } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";

import { applyTestEnv } from "../../../../tools/test/test-env.mjs";
import { buildServer } from "../../src/app.js";

type ApiTestContext = {
  app: FastifyInstance;
  prisma: PrismaClient;
  redis: Redis;
  resetState: () => Promise<void>;
  close: () => Promise<void>;
};

const testEnv = applyTestEnv();

async function truncateAllTables(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const qualifiedTables = tables.map(({ tablename }) => `"${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`);
}

async function flushRedis(redis: Redis) {
  await redis.flushdb();
}

export async function createApiTestContext(options?: {
  startBackgroundJobs?: boolean;
}): Promise<ApiTestContext> {
  const prisma = new PrismaClientConstructor();
  await prisma.$connect();

  const redis = new Redis(testEnv.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: null
  });

  const app = await buildServer({
    prisma,
    redis,
    logger: false,
    startBackgroundJobs: options?.startBackgroundJobs ?? false,
    registerPayments: false
  });
  await app.ready();

  return {
    app,
    prisma,
    redis,
    resetState: async () => {
      await truncateAllTables(prisma);
      await flushRedis(redis);
    },
    close: async () => {
      await app.close();
      await redis.quit();
      await prisma.$disconnect();
    }
  };
}
