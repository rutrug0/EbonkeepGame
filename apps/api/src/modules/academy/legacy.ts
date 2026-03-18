import type { Prisma, PrismaClient } from "@prisma/client";

import { ACADEMY_TREE_CONFIG } from "./academy-tree.config.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type AcademyProgressRow = {
  nodeId: string;
  currentLevel: number;
  ducatsInvested?: number;
  completedAt?: Date | null;
};

type NormalizedAcademyProgressRow = {
  nodeId: string;
  currentLevel: number;
  ducatsInvested?: number;
  completedAt: Date | null;
};

const ACADEMY_NODE_CONFIG_BY_ID = new Map(ACADEMY_TREE_CONFIG.nodes.map((node) => [node.id, node] as const));

export const LEGACY_ACADEMY_NODE_ID_MAP = {
  combat_basics: "drill_square",
  heavy_arms: "plated_forms",
  swift_strike: "shield_wall",
  warlord_creed: "bulwark_standard",
  arcane_basics: "scribe_hall",
  runic_shields: "ward_lattice",
  spellweaving: "null_wards",
  high_sorcery: "astral_sanctum",
  guild_hall: "shared_barracks",
  war_council: "field_rations",
  alliance_pact: "contract_ledgers",
  merchant_ties: "dispatch_desk",
  trade_routes: "trail_markers",
  royal_charter: "bounty_brokers"
} as const satisfies Record<string, string>;

const LEGACY_ACADEMY_NODE_IDS = Object.keys(LEGACY_ACADEMY_NODE_ID_MAP);

function clampNodeLevel(nodeId: string, currentLevel: number): number {
  const node = ACADEMY_NODE_CONFIG_BY_ID.get(nodeId);
  if (!node) {
    return 0;
  }

  return Math.max(0, Math.min(node.maxLevel, Math.floor(currentLevel)));
}

function selectEarlierCompletedAt(currentValue: Date | null, nextValue: Date | null | undefined): Date | null {
  if (!currentValue) {
    return nextValue ?? null;
  }
  if (!nextValue) {
    return currentValue;
  }
  return currentValue.getTime() <= nextValue.getTime() ? currentValue : nextValue;
}

export function resolveCanonicalAcademyNodeId(nodeId: string): string {
  return LEGACY_ACADEMY_NODE_ID_MAP[nodeId as keyof typeof LEGACY_ACADEMY_NODE_ID_MAP] ?? nodeId;
}

export function getAcademyNodeCumulativeCost(nodeId: string, targetLevel: number): number {
  const node = ACADEMY_NODE_CONFIG_BY_ID.get(nodeId);
  if (!node) {
    return 0;
  }

  return node.levels
    .slice(0, targetLevel)
    .reduce((sum, level) => sum + level.ducatCost, 0);
}

export function computeAcademyNodeLevel(nodeId: string, ducatsInvested: number): number {
  const node = ACADEMY_NODE_CONFIG_BY_ID.get(nodeId);
  if (!node) {
    return 0;
  }

  let currentLevel = 0;
  let cumulativeCost = 0;

  for (const level of node.levels) {
    cumulativeCost += level.ducatCost;
    if (ducatsInvested >= cumulativeCost) {
      currentLevel = level.level;
      continue;
    }
    break;
  }

  return currentLevel;
}

export function normalizeAcademyProgressRows<T extends AcademyProgressRow>(
  rows: ReadonlyArray<T>
): NormalizedAcademyProgressRow[] {
  const merged = new Map<
    string,
    NormalizedAcademyProgressRow & {
      maxRequestedLevel: number;
    }
  >();

  for (const row of rows) {
    const canonicalNodeId = resolveCanonicalAcademyNodeId(row.nodeId);
    if (!ACADEMY_NODE_CONFIG_BY_ID.has(canonicalNodeId)) {
      continue;
    }

    const requestedLevel = clampNodeLevel(canonicalNodeId, row.currentLevel);
    const normalizedInvested =
      typeof row.ducatsInvested === "number" && Number.isFinite(row.ducatsInvested)
        ? Math.max(0, Math.floor(row.ducatsInvested))
        : undefined;
    const existing = merged.get(canonicalNodeId);

    if (!existing) {
      const computedLevel = normalizedInvested === undefined
        ? requestedLevel
        : computeAcademyNodeLevel(canonicalNodeId, normalizedInvested);
      merged.set(canonicalNodeId, {
        nodeId: canonicalNodeId,
        currentLevel: Math.max(computedLevel, requestedLevel),
        ducatsInvested: normalizedInvested,
        completedAt: row.completedAt ?? null,
        maxRequestedLevel: requestedLevel
      });
      continue;
    }

    const combinedInvested =
      existing.ducatsInvested !== undefined || normalizedInvested !== undefined
        ? Math.max(existing.ducatsInvested ?? 0, normalizedInvested ?? 0)
        : undefined;
    const maxRequestedLevel = Math.max(existing.maxRequestedLevel, requestedLevel);
    const computedLevel = combinedInvested === undefined
      ? maxRequestedLevel
      : computeAcademyNodeLevel(canonicalNodeId, combinedInvested);

    merged.set(canonicalNodeId, {
      nodeId: canonicalNodeId,
      currentLevel: Math.max(computedLevel, maxRequestedLevel),
      ducatsInvested: combinedInvested,
      completedAt: selectEarlierCompletedAt(existing.completedAt, row.completedAt),
      maxRequestedLevel
    });
  }

  return Array.from(merged.values()).map(({ maxRequestedLevel: _ignored, ...row }) => row);
}

export async function migrateLegacyAcademyRowsForGuild(
  prisma: DbClient,
  guildId: string
): Promise<boolean> {
  const migrateRows = async (tx: DbClient): Promise<boolean> => {
    const allRows = await tx.guildAcademyNode.findMany({
      where: { guildId },
      select: {
        nodeId: true,
        currentLevel: true,
        ducatsInvested: true,
        completedAt: true
      }
    });

    if (!allRows.some((row) => LEGACY_ACADEMY_NODE_IDS.includes(row.nodeId))) {
      return false;
    }

    const normalizedRows = normalizeAcademyProgressRows(allRows);

    for (const row of normalizedRows) {
      await tx.guildAcademyNode.upsert({
        where: {
          guildId_nodeId: {
            guildId,
            nodeId: row.nodeId
          }
        },
        create: {
          guildId,
          nodeId: row.nodeId,
          currentLevel: row.currentLevel,
          ducatsInvested: row.ducatsInvested ?? getAcademyNodeCumulativeCost(row.nodeId, row.currentLevel),
          completedAt: row.completedAt
        },
        update: {
          currentLevel: row.currentLevel,
          ducatsInvested: row.ducatsInvested ?? getAcademyNodeCumulativeCost(row.nodeId, row.currentLevel),
          completedAt: row.completedAt
        }
      });
    }

    await tx.guildAcademyNode.deleteMany({
      where: {
        guildId,
        nodeId: {
          in: LEGACY_ACADEMY_NODE_IDS
        }
      }
    });

    return true;
  };

  if ("$transaction" in prisma) {
    return prisma.$transaction((tx) => migrateRows(tx));
  }

  return migrateRows(prisma);
}
