import type { PrismaClient } from "@prisma/client";

import type {
  AcademyNodeState,
  AcademyNodeStatus,
  AcademyTreeState,
  DonateToNodeRequest,
  DonateToNodeResponse
} from "@ebonkeep/shared/guild";

import { ACADEMY_TREE_CONFIG } from "./academy-tree.config.js";

export class AcademyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the cumulative ducat cost required to reach `targetLevel`.
 * Levels are 1-based. Result is the TOTAL invested needed from 0 → targetLevel.
 */
function cumulativeCost(nodeId: string, targetLevel: number): number {
  const node = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  return node.levels
    .slice(0, targetLevel)
    .reduce((sum, lvl) => sum + lvl.ducatCost, 0);
}

/**
 * Compute the effective level from total ducats invested.
 */
function computeLevel(nodeId: string, ducatsInvested: number): number {
  const node = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  let level = 0;
  let cumulative = 0;
  for (const lvl of node.levels) {
    cumulative += lvl.ducatCost;
    if (ducatsInvested >= cumulative) {
      level = lvl.level;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Ducats needed to reach the NEXT level from current investment.
 * Returns null when the node is maxed.
 */
function ducatsToNextLevel(nodeId: string, ducatsInvested: number, currentLevel: number): number | null {
  const node = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!node || currentLevel >= node.maxLevel) return null;
  const cumCostForNextLevel = cumulativeCost(nodeId, currentLevel + 1);
  return Math.max(0, cumCostForNextLevel - ducatsInvested);
}

/**
 * Evaluate unlock status for a single node given the guildNodeMap
 * (a map of nodeId → { currentLevel, ducatsInvested }).
 */
function computeNodeStatus(
  nodeId: string,
  ducatsInvested: number,
  currentLevel: number,
  guildNodeMap: Map<string, { currentLevel: number; ducatsInvested: number }>
): AcademyNodeStatus {
  const node = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!node) return "locked";

  // Check prerequisites
  for (const prereq of node.prerequisites) {
    const prereqState = guildNodeMap.get(prereq.nodeId);
    if (!prereqState || prereqState.currentLevel < prereq.minLevel) {
      return "locked";
    }
  }

  if (currentLevel >= node.maxLevel) return "maxed";
  if (ducatsInvested > 0) return "in_progress";
  if (currentLevel > 0) return "completed"; // shouldn't happen with maxed check but safe
  return "available";
}

// ── Public service functions ───────────────────────────────────────────────

/**
 * Fetch the full academy tree state for a guild.
 * Any guild member can call this.
 */
export async function getAcademyTreeState(
  prisma: PrismaClient,
  playerId: string,
  guildId: string
): Promise<AcademyTreeState> {
  // Verify player is a member of the guild
  const membership = await prisma.guildMember.findFirst({
    where: { playerId, guildId }
  });
  if (!membership) {
    throw new AcademyError("NOT_GUILD_MEMBER", 403);
  }

  const dbNodes = await prisma.guildAcademyNode.findMany({
    where: { guildId }
  });

  // Build lookup for status computation
  const guildNodeMap = new Map<string, { currentLevel: number; ducatsInvested: number }>();
  for (const row of dbNodes) {
    guildNodeMap.set(row.nodeId, {
      currentLevel: row.currentLevel,
      ducatsInvested: row.ducatsInvested
    });
  }

  const nodes: Record<string, AcademyNodeState> = {};
  let totalDonated = 0;

  for (const nodeConfig of ACADEMY_TREE_CONFIG.nodes) {
    const dbRow = guildNodeMap.get(nodeConfig.id);
    const invested = dbRow?.ducatsInvested ?? 0;
    const level = dbRow?.currentLevel ?? 0;
    const status = computeNodeStatus(nodeConfig.id, invested, level, guildNodeMap);
    const toNext = ducatsToNextLevel(nodeConfig.id, invested, level);

    nodes[nodeConfig.id] = {
      nodeId: nodeConfig.id,
      currentLevel: level,
      ducatsInvested: invested,
      ducatsToNextLevel: toNext,
      status
    };
    totalDonated += invested;
  }

  return {
    guildId,
    config: ACADEMY_TREE_CONFIG,
    nodes,
    totalDonated
  };
}

/**
 * Donate ducats to a specific academy node.
 * Any guild member can donate. The donation is capped so the node is never
 * over-funded (excess ducats not taken from the player).
 */
export async function donateToNode(
  prisma: PrismaClient,
  playerId: string,
  guildId: string,
  body: DonateToNodeRequest
): Promise<DonateToNodeResponse> {
  const { nodeId, amount } = body;

  if (amount < 1) {
    throw new AcademyError("INVALID_AMOUNT", 400);
  }

  // Verify membership
  const membership = await prisma.guildMember.findFirst({
    where: { playerId, guildId }
  });
  if (!membership) {
    throw new AcademyError("NOT_GUILD_MEMBER", 403);
  }

  // Validate node exists in config
  const nodeConfig = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!nodeConfig) {
    throw new AcademyError("INVALID_NODE", 404);
  }

  // Load current node state + prerequisite states in one query
  const allNodeRows = await prisma.guildAcademyNode.findMany({
    where: { guildId }
  });
  const guildNodeMap = new Map(
    allNodeRows.map((r) => [r.nodeId, { currentLevel: r.currentLevel, ducatsInvested: r.ducatsInvested }])
  );

  const dbNode = guildNodeMap.get(nodeId) ?? { currentLevel: 0, ducatsInvested: 0 };

  // Must not be maxed
  if (dbNode.currentLevel >= nodeConfig.maxLevel) {
    throw new AcademyError("NODE_ALREADY_MAXED", 400);
  }

  // Check prerequisites
  for (const prereq of nodeConfig.prerequisites) {
    const prereqState = guildNodeMap.get(prereq.nodeId);
    if (!prereqState || prereqState.currentLevel < prereq.minLevel) {
      throw new AcademyError("PREREQUISITES_NOT_MET", 400);
    }
  }

  // Calculate total cost to fully max the node
  const totalCostToMax = cumulativeCost(nodeId, nodeConfig.maxLevel);
  const remaining = totalCostToMax - dbNode.ducatsInvested;

  // Cap donation at what is actually needed (prevent over-donation)
  const effectiveAmount = Math.min(amount, remaining);
  if (effectiveAmount <= 0) {
    throw new AcademyError("NODE_ALREADY_MAXED", 400);
  }

  // Load player currency
  const currency = await prisma.currencyBalance.findUnique({
    where: { playerId }
  });
  if (!currency || currency.ducats < effectiveAmount) {
    throw new AcademyError("INSUFFICIENT_DUCATS", 400);
  }

  // Execute transaction: deduct ducats, update node, log donation + activity
  const newInvested = dbNode.ducatsInvested + effectiveAmount;
  const newLevel = computeLevel(nodeId, newInvested);
  const levelsGained = newLevel - dbNode.currentLevel;
  const isNowMaxed = newLevel >= nodeConfig.maxLevel;
  const toNext = ducatsToNextLevel(nodeId, newInvested, newLevel);

  let remainingDucats = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Deduct ducats from player
    const updated = await tx.currencyBalance.update({
      where: { playerId },
      data: { ducats: { decrement: effectiveAmount } }
    });
    remainingDucats = updated.ducats;

    // 2. Upsert academy node progress
    await tx.guildAcademyNode.upsert({
      where: { guildId_nodeId: { guildId, nodeId } },
      create: {
        guildId,
        nodeId,
        currentLevel: newLevel,
        ducatsInvested: effectiveAmount,
        completedAt: isNowMaxed ? new Date() : null
      },
      update: {
        currentLevel: newLevel,
        ducatsInvested: newInvested,
        completedAt: isNowMaxed ? new Date() : undefined
      }
    });

    // 3. Record individual donation
    await tx.guildAcademyDonation.create({
      data: {
        guildId,
        playerId,
        nodeId,
        amount: effectiveAmount
      }
    });

    // 4. Log guild activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: playerId,
        actionType: "academy_donated",
        metadata: {
          nodeId,
          amount: effectiveAmount,
          levelsGained,
          newLevel
        }
      }
    });
  });

  let status: AcademyNodeStatus = "in_progress";
  if (isNowMaxed) status = "maxed";
  else if (newLevel > 0) status = "in_progress";

  return {
    nodeId,
    newLevel,
    ducatsInvested: newInvested,
    ducatsToNextLevel: toNext,
    status,
    levelsGained,
    remainingDucats
  };
}

/**
 * Get donation history for a guild (any member can view).
 */
export async function getDonationHistory(
  prisma: PrismaClient,
  playerId: string,
  guildId: string,
  nodeId?: string,
  limit = 50,
  offset = 0
) {
  // Verify membership
  const membership = await prisma.guildMember.findFirst({
    where: { playerId, guildId }
  });
  if (!membership) {
    throw new AcademyError("NOT_GUILD_MEMBER", 403);
  }

  const where = { guildId, ...(nodeId ? { nodeId } : {}) };

  const [donations, total] = await prisma.$transaction([
    prisma.guildAcademyDonation.findMany({
      where,
      include: {
        player: { include: { account: { select: { username: true } } } }
      },
      orderBy: { donatedAt: "desc" },
      take: limit,
      skip: offset
    }),
    prisma.guildAcademyDonation.count({ where })
  ]);

  return {
    donations: donations.map((d) => ({
      id: d.id,
      playerId: d.playerId,
      playerName: d.player.account?.username ?? "Unknown",
      nodeId: d.nodeId,
      amount: d.amount,
      donatedAt: d.donatedAt.toISOString()
    })),
    total
  };
}

/**
 * Get per-member contribution totals for the guild leaderboard.
 * Any member can view.
 */
export async function getMemberContributions(
  prisma: PrismaClient,
  playerId: string,
  guildId: string
) {
  const membership = await prisma.guildMember.findFirst({
    where: { playerId, guildId }
  });
  if (!membership) {
    throw new AcademyError("NOT_GUILD_MEMBER", 403);
  }

  const rows = await prisma.guildAcademyDonation.groupBy({
    by: ["playerId"],
    where: { guildId },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } }
  });

  if (rows.length === 0) return { contributions: [] };

  const playerIds = rows.map((r) => r.playerId);
  const profiles = await prisma.playerProfile.findMany({
    where: { id: { in: playerIds } },
    include: { account: { select: { username: true } } }
  });
  const nameMap = new Map(profiles.map((p) => [p.id, p.account?.username ?? "Unknown"]));

  return {
    contributions: rows.map((r) => ({
      playerId: r.playerId,
      playerName: nameMap.get(r.playerId) ?? "Unknown",
      totalDonated: r._sum.amount ?? 0
    }))
  };
}
