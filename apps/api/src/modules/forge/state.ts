import type { Prisma, PrismaClient } from "@prisma/client";

import {
  forgeInstabilitySchema,
  forgeStateSchema,
  type ForgeInstability,
  type ForgeState
} from "@ebonkeep/shared/forge";

export type ForgeDbClient = PrismaClient | Prisma.TransactionClient;

export const FORGE_EVENT_CODE = "forge_state_v1";

type PersistedForgeState = {
  instability: ForgeInstability | null;
};

function createDefaultPersistedForgeState(): PersistedForgeState {
  return {
    instability: null
  };
}

function normalizePersistedForgeState(payload: unknown): PersistedForgeState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return createDefaultPersistedForgeState();
  }

  const rawState = payload as Partial<PersistedForgeState>;
  const parsedInstability = rawState.instability ? forgeInstabilitySchema.safeParse(rawState.instability) : null;

  return {
    instability: parsedInstability?.success ? parsedInstability.data : null
  };
}

async function loadForgeProgressRow(prisma: ForgeDbClient, playerId: string) {
  return prisma.eventProgress.findFirst({
    where: {
      playerId,
      eventCode: FORGE_EVENT_CODE
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function loadPersistedForgeState(
  prisma: ForgeDbClient,
  playerId: string
): Promise<PersistedForgeState> {
  const row = await loadForgeProgressRow(prisma, playerId);
  return normalizePersistedForgeState(row?.payload ?? null);
}

export async function savePersistedForgeState(
  prisma: ForgeDbClient,
  playerId: string,
  state: PersistedForgeState
): Promise<void> {
  const payload: Prisma.InputJsonValue = {
    instability: state.instability
  };

  const updateResult = await prisma.eventProgress.updateMany({
    where: {
      playerId,
      eventCode: FORGE_EVENT_CODE
    },
    data: {
      payload
    }
  });

  if (updateResult.count === 0) {
    await prisma.eventProgress.create({
      data: {
        playerId,
        eventCode: FORGE_EVENT_CODE,
        payload
      }
    });
  }
}

export async function loadForgeState(
  prisma: ForgeDbClient,
  playerId: string
): Promise<ForgeState> {
  const persistedState = await loadPersistedForgeState(prisma, playerId);
  return forgeStateSchema.parse({
    serverTime: new Date().toISOString(),
    instability: persistedState.instability
  });
}

export async function getForgeInstabilityDamagePenaltyBps(
  prisma: ForgeDbClient,
  playerId: string
): Promise<number> {
  const persistedState = await loadPersistedForgeState(prisma, playerId);
  return persistedState.instability?.damagePenaltyBps ?? 0;
}
