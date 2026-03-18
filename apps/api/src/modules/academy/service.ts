import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type {
  AcademyActiveEffect,
  AcademyDonationChargesState,
  AcademyNodeState,
  AcademyNodeStatus,
  AcademyTreeState,
  DonateToNodeRequest,
  DonateToNodeResponse
} from "@ebonkeep/shared/guild";

import { ACADEMY_TREE_CONFIG } from "./academy-tree.config.js";
import { resolveAcademyActiveEffectsFromRows } from "./effects.js";

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

// ── Donation charge helpers ────────────────────────────────────────────────

const MAX_ACADEMY_DONATION_CHARGES = 20;
const CHARGE_REGEN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const DUCATS_PER_CHARGE = 200;

function resolveChargeState(
  storedCharges: number,
  lastRechargeAt: Date
): { current: number; lastRechargeAtAdvanced: Date } {
  const elapsed = Date.now() - lastRechargeAt.getTime();
  const regenCount = Math.floor(elapsed / CHARGE_REGEN_INTERVAL_MS);
  const current = Math.min(MAX_ACADEMY_DONATION_CHARGES, storedCharges + regenCount);
  const advancedMs = lastRechargeAt.getTime() + regenCount * CHARGE_REGEN_INTERVAL_MS;
  return { current, lastRechargeAtAdvanced: new Date(advancedMs) };
}

function buildChargesStateResponse(
  storedCharges: number,
  lastRechargeAt: Date
): AcademyDonationChargesState {
  const { current, lastRechargeAtAdvanced } = resolveChargeState(storedCharges, lastRechargeAt);
  const isFull = current >= MAX_ACADEMY_DONATION_CHARGES;
  let nextChargeAt: string | null = null;
  let secondsUntilNext: number | null = null;
  if (!isFull) {
    const nextMs = lastRechargeAtAdvanced.getTime() + CHARGE_REGEN_INTERVAL_MS;
    nextChargeAt = new Date(nextMs).toISOString();
    secondsUntilNext = Math.max(0, Math.floor((nextMs - Date.now()) / 1000));
  }
  return {
    charges: current,
    maxCharges: 20,
    nextChargeAt,
    secondsUntilNext,
    ducatsPerCharge: DUCATS_PER_CHARGE
  };
}

function buildUnlimitedChargesStateResponse(): AcademyDonationChargesState {
  return {
    charges: MAX_ACADEMY_DONATION_CHARGES,
    maxCharges: MAX_ACADEMY_DONATION_CHARGES,
    nextChargeAt: null,
    secondsUntilNext: null,
    ducatsPerCharge: DUCATS_PER_CHARGE
  };
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
  const playerProfile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: { unlimitedAcademyDonationsEnabled: true }
  });
  const hasUnlimitedAcademyDonations = playerProfile?.unlimitedAcademyDonationsEnabled ?? false;

  // Fetch player's donation charge state
  const chargeRow = await prisma.playerAcademyDonationCharges.findUnique({
    where: { playerId }
  });
  const chargesState = hasUnlimitedAcademyDonations
    ? buildUnlimitedChargesStateResponse()
    : buildChargesStateResponse(
      chargeRow?.charges ?? MAX_ACADEMY_DONATION_CHARGES,
      chargeRow?.lastRechargeAt ?? new Date()
    );

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
  let activeEffects: AcademyActiveEffect[] = [];

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

  activeEffects = resolveAcademyActiveEffectsFromRows(dbNodes);

  return {
    guildId,
    config: ACADEMY_TREE_CONFIG,
    nodes,
    totalDonated,
    activeEffects,
    chargesState
  };
}

/**
 * Donate using player's regenerating charges to a specific academy node.
 * Each charge costs DUCATS_PER_CHARGE from the player's balance.
 * Players can spend 1 or more charges at once; charges regenerate 1 per 30 min up to 20 max.
 */
export async function donateToNode(
  prisma: PrismaClient,
  playerId: string,
  guildId: string,
  body: DonateToNodeRequest
): Promise<DonateToNodeResponse> {
  const { nodeId, chargesSpent } = body;

  // Verify membership
  const membership = await prisma.guildMember.findFirst({
    where: { playerId, guildId }
  });
  if (!membership) {
    throw new AcademyError("NOT_GUILD_MEMBER", 403);
  }
  const playerProfile = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: { unlimitedAcademyDonationsEnabled: true }
  });
  const hasUnlimitedAcademyDonations = playerProfile?.unlimitedAcademyDonationsEnabled ?? false;

  // Validate node exists in config
  const nodeConfig = ACADEMY_TREE_CONFIG.nodes.find((n) => n.id === nodeId);
  if (!nodeConfig) {
    throw new AcademyError("INVALID_NODE", 404);
  }

  // Load current node state + prerequisite states outside tx for prereq check
  const allNodeRows = await prisma.guildAcademyNode.findMany({
    where: { guildId }
  });
  const guildNodeMap = new Map(
    allNodeRows.map((r) => [r.nodeId, { currentLevel: r.currentLevel, ducatsInvested: r.ducatsInvested }])
  );

  const dbNodeOuter = guildNodeMap.get(nodeId) ?? { currentLevel: 0, ducatsInvested: 0 };

  // Must not be maxed
  if (dbNodeOuter.currentLevel >= nodeConfig.maxLevel) {
    throw new AcademyError("NODE_ALREADY_MAXED", 400);
  }

  // Check prerequisites (safe outside tx: levels only ever increase)
  for (const prereq of nodeConfig.prerequisites) {
    const prereqState = guildNodeMap.get(prereq.nodeId);
    if (!prereqState || prereqState.currentLevel < prereq.minLevel) {
      throw new AcademyError("PREREQUISITES_NOT_MET", 400);
    }
  }

  // Execute transaction: all writes + authoritative state reads inside tx
  let remainingDucats = 0;
  let txNodeId = nodeId;
  let txNewLevel = 0;
  let txNewInvested = 0;
  let txLevelsGained = 0;
  let txToNext: number | null = null;
  let txIsNowMaxed = false;
  let txStoredCharges = 0;
  let txLastRechargeAt = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Re-read node state inside tx (authoritative, prevents lost-update)
    const txNodeRow = await tx.guildAcademyNode.findUnique({
      where: { guildId_nodeId: { guildId, nodeId } }
    });
    const txInvested = txNodeRow?.ducatsInvested ?? 0;
    const txCurrentLevel = txNodeRow?.currentLevel ?? 0;

    if (txCurrentLevel >= nodeConfig.maxLevel) {
      throw new AcademyError("NODE_ALREADY_MAXED", 400);
    }

    // 2. Resolve player's authoritative charge state inside tx
    const txChargeRow = await tx.playerAcademyDonationCharges.findUnique({
      where: { playerId }
    });
    const storedCharges = txChargeRow?.charges ?? MAX_ACADEMY_DONATION_CHARGES;
    const lastRechargeAt = txChargeRow?.lastRechargeAt ?? new Date();
    const { current: currentCharges, lastRechargeAtAdvanced } = resolveChargeState(storedCharges, lastRechargeAt);

    if (!hasUnlimitedAcademyDonations && chargesSpent > currentCharges) {
      throw new AcademyError("INSUFFICIENT_CHARGES", 400);
    }

    // 3. Compute ducat amount from charges, capped to what node still needs
    const totalCostToMax = cumulativeCost(nodeId, nodeConfig.maxLevel);
    const stillNeeded = totalCostToMax - txInvested;
    const requestedDucats = chargesSpent * DUCATS_PER_CHARGE;
    const effectiveAmount = Math.min(requestedDucats, stillNeeded);
    if (effectiveAmount <= 0) {
      throw new AcademyError("NODE_ALREADY_MAXED", 400);
    }

    // Compute actual charges consumed (may be fewer if the node is nearly full)
    const effectiveChargesConsumed = Math.ceil(effectiveAmount / DUCATS_PER_CHARGE);
    const actualChargesConsumed = Math.min(chargesSpent, effectiveChargesConsumed);

    // 4. Atomic balance check + deduct
    const currencyUpdate = await tx.currencyBalance.updateMany({
      where: { playerId, ducats: { gte: effectiveAmount } },
      data: { ducats: { decrement: effectiveAmount } }
    });
    if (currencyUpdate.count === 0) {
      throw new AcademyError("INSUFFICIENT_DUCATS", 400);
    }
    const updatedCurrency = await tx.currencyBalance.findUnique({ where: { playerId } });
    remainingDucats = updatedCurrency?.ducats ?? 0;

    // 5. Deduct charges atomically.
    // For existing rows: use lastRechargeAt as an optimistic lock and write the
    // computed effective balance (which includes time-based regeneration) directly.
    // This prevents races and correctly persists regenerated charges.
    // For first-time rows: create the row; catch P2002 (concurrent insert) and
    // surface as INSUFFICIENT_CHARGES since the competing request already consumed.
    if (!hasUnlimitedAcademyDonations) {
      if (txChargeRow) {
        const chargeUpdate = await tx.playerAcademyDonationCharges.updateMany({
          where: { playerId, lastRechargeAt: txChargeRow.lastRechargeAt, charges: txChargeRow.charges },
          data: {
            charges: currentCharges - actualChargesConsumed,
            lastRechargeAt: lastRechargeAtAdvanced
          }
        });
        if (chargeUpdate.count === 0) {
          throw new AcademyError("INSUFFICIENT_CHARGES", 400);
        }
      } else {
        try {
          await tx.playerAcademyDonationCharges.create({
            data: {
              playerId,
              charges: MAX_ACADEMY_DONATION_CHARGES - actualChargesConsumed,
              lastRechargeAt: lastRechargeAtAdvanced
            }
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // A concurrent request created the row and spent charges first.
            throw new AcademyError("INSUFFICIENT_CHARGES", 400);
          }
          throw err;
        }
      }
    }
    if (hasUnlimitedAcademyDonations) {
      txStoredCharges = MAX_ACADEMY_DONATION_CHARGES;
      txLastRechargeAt = new Date();
    } else {
      const updatedChargeRow = await tx.playerAcademyDonationCharges.findUnique({ where: { playerId } });
      txStoredCharges = updatedChargeRow?.charges ?? MAX_ACADEMY_DONATION_CHARGES - actualChargesConsumed;
      txLastRechargeAt = updatedChargeRow?.lastRechargeAt ?? lastRechargeAtAdvanced;
    }

    // 6. Compute new node state
    const newInvested = txInvested + effectiveAmount;
    const newLevel = computeLevel(nodeId, newInvested);
    const levelsGained = newLevel - txCurrentLevel;
    const isNowMaxed = newLevel >= nodeConfig.maxLevel;
    const toNext = ducatsToNextLevel(nodeId, newInvested, newLevel);

    // 7. Upsert academy node progress
    await tx.guildAcademyNode.upsert({
      where: { guildId_nodeId: { guildId, nodeId } },
      create: {
        guildId,
        nodeId,
        currentLevel: newLevel,
        ducatsInvested: newInvested,
        completedAt: isNowMaxed ? new Date() : null
      },
      update: {
        currentLevel: newLevel,
        ducatsInvested: newInvested,
        completedAt: isNowMaxed ? new Date() : undefined
      }
    });

    // 8. Record individual donation
    await tx.guildAcademyDonation.create({
      data: {
        guildId,
        playerId,
        nodeId,
        amount: effectiveAmount
      }
    });

    // 9. Log guild activity
    await tx.guildActivity.create({
      data: {
        guildId,
        actorId: playerId,
        actionType: "academy_donated",
        metadata: {
          nodeId,
          amount: effectiveAmount,
          chargesSpent: actualChargesConsumed,
          levelsGained,
          newLevel
        }
      }
    });

    txNodeId = nodeId;
    txNewLevel = newLevel;
    txNewInvested = newInvested;
    txLevelsGained = levelsGained;
    txToNext = toNext;
    txIsNowMaxed = isNowMaxed;
  });

  let status: AcademyNodeStatus = "in_progress";
  if (txIsNowMaxed) status = "maxed";

  return {
    nodeId: txNodeId,
    newLevel: txNewLevel,
    ducatsInvested: txNewInvested,
    ducatsToNextLevel: txToNext,
    status,
    levelsGained: txLevelsGained,
    remainingDucats,
    chargesState: hasUnlimitedAcademyDonations
      ? buildUnlimitedChargesStateResponse()
      : buildChargesStateResponse(txStoredCharges, txLastRechargeAt)
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
