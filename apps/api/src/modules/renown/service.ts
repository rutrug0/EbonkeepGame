import type { PrismaClient } from "@prisma/client";

import type { RenownState } from "@ebonkeep/shared/player";

// ---------------------------------------------------------------------------
// Tree config — mirrors the frontend RENOWN_NODES structure
// Prerequisites use node IDs, not labels
// ---------------------------------------------------------------------------

type RenownNodeConfig = {
  cost: number;
  prereqs: readonly string[];
};

const RENOWN_NODE_CONFIG: Record<string, RenownNodeConfig> = {
  first_charter:        { cost: 0, prereqs: [] },
  ledger_quills:        { cost: 1, prereqs: ["first_charter"] },
  garden_patronage:     { cost: 1, prereqs: ["first_charter"] },
  campaign_banners:     { cost: 1, prereqs: ["first_charter"] },
  surveyor_marks:       { cost: 2, prereqs: ["ledger_quills"] },
  wardens_lantern:      { cost: 2, prereqs: ["ledger_quills"] },
  stillroom_measures:   { cost: 2, prereqs: ["garden_patronage"] },
  seed_vaults:          { cost: 2, prereqs: ["garden_patronage"] },
  quartermaster_routes: { cost: 2, prereqs: ["campaign_banners"] },
  tempering_clause:     { cost: 3, prereqs: ["quartermaster_routes"] },
  archive_ciphers:      { cost: 3, prereqs: ["surveyor_marks", "wardens_lantern"] },
  draught_reserve:      { cost: 3, prereqs: ["stillroom_measures", "seed_vaults"] },
  veteran_dispatch:     { cost: 3, prereqs: ["quartermaster_routes", "tempering_clause"] }
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RenownError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "RenownError";
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Returns the player's current Renown state (unlocked node IDs + balance).
 * Auto-seeds `first_charter` for first-time visitors so the root is always unlocked.
 */
export async function getRenownState(playerId: string, prisma: PrismaClient): Promise<RenownState> {
  const [unlockedRows, currency] = await Promise.all([
    prisma.playerRenownNode.findMany({
      where: { playerId },
      select: { nodeId: true }
    }),
    prisma.currencyBalance.findUnique({
      where: { playerId },
      select: { renown: true }
    })
  ]);

  let unlockedNodeIds = unlockedRows.map((r) => r.nodeId);

  // Auto-seed the root node (cost = 0) if this player has never seen the tree.
  // Use upsert to avoid a race condition when two requests hit simultaneously.
  if (!unlockedNodeIds.includes("first_charter")) {
    await prisma.playerRenownNode.upsert({
      where: { playerId_nodeId: { playerId, nodeId: "first_charter" } },
      update: {},
      create: { playerId, nodeId: "first_charter" }
    });
    unlockedNodeIds = ["first_charter", ...unlockedNodeIds];
  }

  return {
    unlockedNodeIds,
    renownBalance: currency?.renown ?? 0
  };
}

/**
 * Unlocks a renown node for the player, deducting the renown cost atomically.
 * Returns the updated RenownState.
 */
export async function unlockRenownNode(
  playerId: string,
  nodeId: string,
  prisma: PrismaClient
): Promise<RenownState> {
  const nodeConfig = RENOWN_NODE_CONFIG[nodeId];
  if (!nodeConfig) {
    throw new RenownError("UNKNOWN_NODE", 400, `Unknown renown node: ${nodeId}`);
  }

  await prisma.$transaction(async (tx) => {
    // Re-read current state inside transaction to prevent races
    const [unlockedRows, currency] = await Promise.all([
      tx.playerRenownNode.findMany({
        where: { playerId },
        select: { nodeId: true }
      }),
      tx.currencyBalance.findUnique({
        where: { playerId },
        select: { renown: true }
      })
    ]);

    const unlockedSet = new Set(unlockedRows.map((r) => r.nodeId));

    if (unlockedSet.has(nodeId)) {
      throw new RenownError("ALREADY_UNLOCKED", 409, `Node ${nodeId} is already unlocked`);
    }

    // Verify prerequisites
    for (const prereq of nodeConfig.prereqs) {
      if (!unlockedSet.has(prereq)) {
        throw new RenownError(
          "PREREQUISITES_NOT_MET",
          422,
          `Prerequisite not met: ${prereq}`
        );
      }
    }

    // Atomic balance guard — deducts only if balance is sufficient
    if (nodeConfig.cost > 0) {
      const currentBalance = currency?.renown ?? 0;
      const update = await tx.currencyBalance.updateMany({
        where: { playerId, renown: { gte: nodeConfig.cost } },
        data: { renown: { decrement: nodeConfig.cost } }
      });
      if (update.count === 0) {
        throw new RenownError(
          "INSUFFICIENT_RENOWN",
          402,
          `Insufficient renown. Need ${nodeConfig.cost}, have ${currentBalance}`
        );
      }
    }

    await tx.playerRenownNode.create({
      data: { playerId, nodeId }
    });
  });

  return getRenownState(playerId, prisma);
}
