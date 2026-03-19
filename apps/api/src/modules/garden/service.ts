import type { Prisma, PrismaClient } from "@prisma/client";

import {
  MAX_GARDEN_SLOT_COUNT,
  STARTER_GARDEN_SEED_QUANTITY,
  buildGardenPlotTiming,
  clearGardenPlotResponseSchema,
  gardenInventoryEntrySchema,
  gardenStateResponseSchema,
  getGardenPlantDefinition,
  getGardenPlotNextTransitionAt,
  harvestGardenPlotResponseSchema,
  plantGardenSeedResponseSchema,
  resolveGardenHarvestYield,
  resolveGardenPlotPhase,
  starterGardenPlantIds,
  type ClearGardenPlotResponse,
  type GardenInventoryKind,
  type GardenPlantId,
  type GardenStateResponse,
  type HarvestGardenPlotResponse,
  type PlantGardenSeedResponse
} from "@ebonkeep/shared/garden";
import { assertJobsActivityIdle } from "../jobs/service.js";

type GardenDbClient = PrismaClient | Prisma.TransactionClient;
const LEGACY_INFINITE_GARDEN_SEED_QUANTITY = 5;

type GardenPlotRecord = {
  id: string;
  playerId: string;
  slotIndex: number;
  plantId: string | null;
  plantedAt: Date | null;
  growthEndsAt: Date | null;
  bloomStartsAt: Date | null;
  bloomEndsAt: Date | null;
  wiltAt: Date | null;
};

type GardenInventoryRecord = {
  id: string;
  playerId: string;
  plantId: string;
  kind: string;
  quantity: number;
};

export class GardenError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "GardenError";
  }
}

function buildGardenDisplayName(plantId: GardenPlantId, kind: GardenInventoryKind): string {
  const definition = getGardenPlantDefinition(plantId);
  return kind === "seed" ? `${definition.displayName} Seeds` : definition.displayName;
}

async function assertPlayerExists(prisma: GardenDbClient, playerId: string): Promise<void> {
  const player = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: { id: true }
  });

  if (!player) {
    throw new GardenError("PLAYER_NOT_FOUND", 404, "Player not found.");
  }
}

async function ensureGardenBootstrapped(prisma: GardenDbClient, playerId: string): Promise<void> {
  await assertPlayerExists(prisma, playerId);

  await prisma.gardenPlot.createMany({
    data: Array.from({ length: MAX_GARDEN_SLOT_COUNT }, (_, index) => ({
      playerId,
      slotIndex: index + 1
    })),
    skipDuplicates: true
  });

  await prisma.gardenInventoryEntry.createMany({
    data: starterGardenPlantIds.map((plantId) => ({
      playerId,
      plantId,
      kind: "seed",
      quantity: STARTER_GARDEN_SEED_QUANTITY
    })),
    skipDuplicates: true
  });

  await prisma.gardenInventoryEntry.updateMany({
    where: {
      playerId,
      kind: "seed",
      plantId: {
        in: Array.from(starterGardenPlantIds)
      },
      quantity: LEGACY_INFINITE_GARDEN_SEED_QUANTITY
    },
    data: {
      quantity: STARTER_GARDEN_SEED_QUANTITY
    }
  });
}

function mapInventoryEntry(entry: GardenInventoryRecord) {
  const plantId = entry.plantId as GardenPlantId;
  const kind = entry.kind as GardenInventoryKind;
  const definition = getGardenPlantDefinition(plantId);

  return gardenInventoryEntrySchema.parse({
    inventoryEntryId: entry.id,
    plantId,
    kind,
    itemCode: kind === "seed" ? definition.seedItemCode : definition.ingredientItemCode,
    displayName: buildGardenDisplayName(plantId, kind),
    rarity: definition.rarity,
    quantity: entry.quantity
  });
}

function mapPlot(plot: GardenPlotRecord, now: Date) {
  const plantId = plot.plantId as GardenPlantId | null;
  const phase = resolveGardenPlotPhase({
    plantId,
    growthEndsAt: plot.growthEndsAt,
    bloomStartsAt: plot.bloomStartsAt,
    bloomEndsAt: plot.bloomEndsAt,
    wiltAt: plot.wiltAt,
    now
  });

  return {
    slotIndex: plot.slotIndex,
    plantId,
    phase,
    plantedAt: plot.plantedAt?.toISOString() ?? null,
    growthEndsAt: plot.growthEndsAt?.toISOString() ?? null,
    bloomStartsAt: plot.bloomStartsAt?.toISOString() ?? null,
    bloomEndsAt: plot.bloomEndsAt?.toISOString() ?? null,
    wiltAt: plot.wiltAt?.toISOString() ?? null,
    nextTransitionAt: getGardenPlotNextTransitionAt({
      phase,
      growthEndsAt: plot.growthEndsAt,
      bloomStartsAt: plot.bloomStartsAt,
      bloomEndsAt: plot.bloomEndsAt,
      wiltAt: plot.wiltAt
    }),
    harvestYield: resolveGardenHarvestYield({ plantId, phase })
  };
}

async function loadGardenStateInternal(
  prisma: GardenDbClient,
  playerId: string,
  now: Date
): Promise<GardenStateResponse> {
  const [plots, inventoryEntries] = await Promise.all([
    prisma.gardenPlot.findMany({
      where: { playerId },
      orderBy: { slotIndex: "asc" }
    }),
    prisma.gardenInventoryEntry.findMany({
      where: { playerId },
      orderBy: [{ kind: "asc" }, { plantId: "asc" }]
    })
  ]);

  return gardenStateResponseSchema.parse({
    serverTime: now.toISOString(),
    plots: plots.map((plot) => mapPlot(plot, now)),
    inventory: inventoryEntries.map((entry) => mapInventoryEntry(entry))
  });
}

async function getRequiredPlot(
  prisma: GardenDbClient,
  playerId: string,
  slotIndex: number
): Promise<GardenPlotRecord> {
  const plot = await prisma.gardenPlot.findUnique({
    where: {
      playerId_slotIndex: {
        playerId,
        slotIndex
      }
    }
  });

  if (!plot) {
    throw new GardenError("PLOT_NOT_FOUND", 404, "Garden plot not found.");
  }

  return plot;
}

async function addGardenInventoryQuantity(args: {
  prisma: GardenDbClient;
  playerId: string;
  plantId: GardenPlantId;
  kind: GardenInventoryKind;
  quantity: number;
}): Promise<void> {
  await args.prisma.gardenInventoryEntry.upsert({
    where: {
      playerId_plantId_kind: {
        playerId: args.playerId,
        plantId: args.plantId,
        kind: args.kind
      }
    },
    update: {
      quantity: {
        increment: args.quantity
      }
    },
    create: {
      playerId: args.playerId,
      plantId: args.plantId,
      kind: args.kind,
      quantity: args.quantity
    }
  });
}

async function consumeGardenSeed(args: {
  prisma: GardenDbClient;
  playerId: string;
  plantId: GardenPlantId;
}): Promise<void> {
  const result = await args.prisma.gardenInventoryEntry.updateMany({
    where: {
      playerId: args.playerId,
      plantId: args.plantId,
      kind: "seed",
      quantity: {
        gt: 0
      }
    },
    data: {
      quantity: {
        decrement: 1
      }
    }
  });

  if (result.count !== 1) {
    throw new GardenError("SEED_UNAVAILABLE", 409, "You do not have any seeds of this type.");
  }
}

async function clearPlot(prisma: GardenDbClient, playerId: string, slotIndex: number): Promise<void> {
  await prisma.gardenPlot.update({
    where: {
      playerId_slotIndex: {
        playerId,
        slotIndex
      }
    },
    data: {
      plantId: null,
      plantedAt: null,
      growthEndsAt: null,
      bloomStartsAt: null,
      bloomEndsAt: null,
      wiltAt: null
    }
  });
}

async function claimPlotForHarvest(
  prisma: GardenDbClient,
  playerId: string,
  slotIndex: number,
  plot: GardenPlotRecord
): Promise<void> {
  const result = await prisma.gardenPlot.updateMany({
    where: {
      playerId,
      slotIndex,
      plantId: plot.plantId,
      plantedAt: plot.plantedAt,
      growthEndsAt: plot.growthEndsAt,
      bloomStartsAt: plot.bloomStartsAt,
      bloomEndsAt: plot.bloomEndsAt,
      wiltAt: plot.wiltAt
    },
    data: {
      plantId: null,
      plantedAt: null,
      growthEndsAt: null,
      bloomStartsAt: null,
      bloomEndsAt: null,
      wiltAt: null
    }
  });

  if (result.count !== 1) {
    throw new GardenError("PLOT_ALREADY_CHANGED", 409, "This plot changed before harvest completed.");
  }
}

async function claimEmptyPlotForPlanting(args: {
  prisma: GardenDbClient;
  playerId: string;
  slotIndex: number;
  plantId: GardenPlantId;
  plantedAt: Date;
  growthEndsAt: Date;
  bloomStartsAt: Date;
  bloomEndsAt: Date;
  wiltAt: Date;
}): Promise<void> {
  const result = await args.prisma.gardenPlot.updateMany({
    where: {
      playerId: args.playerId,
      slotIndex: args.slotIndex,
      plantId: null
    },
    data: {
      plantId: args.plantId,
      plantedAt: args.plantedAt,
      growthEndsAt: args.growthEndsAt,
      bloomStartsAt: args.bloomStartsAt,
      bloomEndsAt: args.bloomEndsAt,
      wiltAt: args.wiltAt
    }
  });

  if (result.count !== 1) {
    throw new GardenError("PLOT_OCCUPIED", 409, "This plot is already occupied.");
  }
}

export async function getGardenState(prisma: GardenDbClient, playerId: string): Promise<GardenStateResponse> {
  await ensureGardenBootstrapped(prisma, playerId);
  return loadGardenStateInternal(prisma, playerId, new Date());
}

export async function plantGardenSeed(
  prisma: PrismaClient,
  playerId: string,
  slotIndex: number,
  plantId: GardenPlantId
): Promise<PlantGardenSeedResponse> {
  const now = new Date();
  const timing = buildGardenPlotTiming(plantId, now);

  const garden = await prisma.$transaction(async (tx) => {
    await assertJobsActivityIdle(tx, playerId, now);
    await ensureGardenBootstrapped(tx, playerId);

    const plot = await getRequiredPlot(tx, playerId, slotIndex);
    if (plot.plantId) {
      throw new GardenError("PLOT_OCCUPIED", 409, "This plot is already occupied.");
    }

    await consumeGardenSeed({
      prisma: tx,
      playerId,
      plantId
    });

    await claimEmptyPlotForPlanting({
      prisma: tx,
      playerId,
      slotIndex,
      plantId,
      plantedAt: now,
      growthEndsAt: new Date(timing.growthEndsAt),
      bloomStartsAt: new Date(timing.bloomStartsAt),
      bloomEndsAt: new Date(timing.bloomEndsAt),
      wiltAt: new Date(timing.wiltAt)
    });

    return loadGardenStateInternal(tx, playerId, now);
  });

  return plantGardenSeedResponseSchema.parse({ garden });
}

export async function harvestGardenPlot(
  prisma: PrismaClient,
  playerId: string,
  slotIndex: number
): Promise<HarvestGardenPlotResponse> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await ensureGardenBootstrapped(tx, playerId);

    const plot = await getRequiredPlot(tx, playerId, slotIndex);
    const plantId = plot.plantId as GardenPlantId | null;
    if (!plantId) {
      throw new GardenError("PLOT_EMPTY", 400, "There is nothing planted in this plot.");
    }

    const phase = resolveGardenPlotPhase({
      plantId,
      growthEndsAt: plot.growthEndsAt,
      bloomStartsAt: plot.bloomStartsAt,
      bloomEndsAt: plot.bloomEndsAt,
      wiltAt: plot.wiltAt,
      now
    });

    if (phase === "growing") {
      throw new GardenError("PLANT_NOT_READY", 409, "This plant is still growing.");
    }
    if (phase === "wilted") {
      throw new GardenError("PLANT_WILTED", 409, "This plant has wilted and must be cleared.");
    }

    const quantity = resolveGardenHarvestYield({ plantId, phase });
    if (!quantity || quantity <= 0) {
      throw new GardenError("PLANT_NOT_READY", 409, "This plant is not ready to harvest.");
    }

    await claimPlotForHarvest(tx, playerId, slotIndex, plot);
    await addGardenInventoryQuantity({
      prisma: tx,
      playerId,
      plantId,
      kind: "ingredient",
      quantity
    });

    const garden = await loadGardenStateInternal(tx, playerId, now);
    const definition = getGardenPlantDefinition(plantId);

    return harvestGardenPlotResponseSchema.parse({
      garden,
      harvested: {
        plantId,
        quantity,
        itemCode: definition.ingredientItemCode,
        displayName: definition.displayName
      }
    });
  });
}

export async function clearWiltedGardenPlot(
  prisma: PrismaClient,
  playerId: string,
  slotIndex: number
): Promise<ClearGardenPlotResponse> {
  const now = new Date();

  const garden = await prisma.$transaction(async (tx) => {
    await ensureGardenBootstrapped(tx, playerId);

    const plot = await getRequiredPlot(tx, playerId, slotIndex);
    const plantId = plot.plantId as GardenPlantId | null;
    if (!plantId) {
      throw new GardenError("PLOT_EMPTY", 400, "This plot is already empty.");
    }

    const phase = resolveGardenPlotPhase({
      plantId,
      growthEndsAt: plot.growthEndsAt,
      bloomStartsAt: plot.bloomStartsAt,
      bloomEndsAt: plot.bloomEndsAt,
      wiltAt: plot.wiltAt,
      now
    });

    if (phase !== "wilted") {
      throw new GardenError("PLOT_NOT_WILTED", 409, "Only wilted plants can be cleared.");
    }

    await clearPlot(tx, playerId, slotIndex);
    return loadGardenStateInternal(tx, playerId, now);
  });

  return clearGardenPlotResponseSchema.parse({
    garden,
    clearedSlotIndex: slotIndex
  });
}
