/**
 * Guild activity and leaderboards service
 * Handles activity logging, history queries, and leaderboard generation
 */

import type { PrismaClient } from "@prisma/client";
import type {
  GuildActivity,
  GuildActivityQuery,
  GuildActivityWithDetails,
  GuildLeaderboardEntry,
  GuildLeaderboardSort
} from "@ebonkeep/shared";
import { normalizeGuildCrestId } from "./validation.js";

/**
 * Log guild activity (internal helper)
 */
export async function logGuildActivity(
  prisma: PrismaClient,
  guildId: string,
  actionType: "created" | "updated" | "disbanded" | "joined" | "left" | "kicked" | "promoted" | "demoted" | "transferred_leadership" | "invited" | "description_changed",
  actorId: string | null,
  targetId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await prisma.guildActivity.create({
    data: {
      guildId,
      actorId,
      actionType,
      targetId,
      metadata,
      timestamp: new Date()
    }
  });
}

/**
 * Get guild activity history
 */
export async function getGuildActivity(
  prisma: PrismaClient,
  guildId: string,
  requestingPlayerId: string,
  query: GuildActivityQuery
): Promise<{ activities: GuildActivityWithDetails[]; total: number }> {
  // Check if requester is a member
  const membership = await prisma.guildMember.findFirst({
    where: { guildId, playerId: requestingPlayerId }
  });

  if (!membership) {
    throw new Error("NOT_GUILD_MEMBER");
  }

  // Build where clause
  const where: any = { guildId };
  if (query.actionType) {
    where.actionType = query.actionType;
  }
  if (query.actorId) {
    where.actorId = query.actorId;
  }
  if (query.since) {
    where.timestamp = { gte: new Date(query.since) };
  }

  const [activities, total] = await Promise.all([
    prisma.guildActivity.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            class: true,
            level: true,
            account: {
              select: {
                username: true
              }
            }
          }
        },
        target: {
          select: {
            id: true,
            class: true,
            level: true,
            account: {
              select: {
                username: true
              }
            }
          }
        }
      },
      take: Number(query.limit) || 20,
      skip: Number(query.offset) || 0,
      orderBy: { timestamp: "desc" }
    }),
    prisma.guildActivity.count({ where })
  ]);

  return {
    activities: activities.map((a) => ({
      id: a.id,
      guildId: a.guildId,
      actorId: a.actorId,
      actionType: a.actionType as GuildActivityWithDetails["actionType"],
      targetId: a.targetId,
      metadata: (a.metadata as Record<string, any>) || null,
      timestamp: a.timestamp.toISOString(),
      actor: a.actor,
      target: a.target
    })),
    total
  };
}

/**
 * Get guild leaderboards
 */
export async function getGuildLeaderboard(
  prisma: PrismaClient,
  sortBy: GuildLeaderboardSort = "power",
  limit: number = 100,
  offset: number = 0
): Promise<{ leaderboardType: GuildLeaderboardSort; guilds: GuildLeaderboardEntry[]; totalGuilds: number }> {
  console.log(`[getGuildLeaderboard] sortBy=${sortBy}, limit=${limit}, offset=${offset}`);
  
  // Build orderBy clause - Prisma doesn't support ordering by relation counts
  // so we'll handle memberCount sorting in JavaScript
  let orderBy: any;
  let fetchAll = false;
  
  switch (sortBy) {
    case "power":
      orderBy = { totalPower: "desc" };
      break;
    case "level":
      orderBy = { level: "desc" };
      break;
    case "memberCount":
      // Fetch all guilds and sort in memory since Prisma can't order by relation count
      orderBy = { createdAt: "desc" }; // temporary order
      fetchAll = true;
      break;
  }

  console.log(`[getGuildLeaderboard] orderBy=${JSON.stringify(orderBy)}, fetchAll=${fetchAll}`);

  const [allGuilds, total] = await Promise.all([
    prisma.guild.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        description: true,
        level: true,
        totalPower: true,
        maxMembers: true,
        isRecruiting: true,
        createdAt: true,
        updatedAt: true,
        crestId: true,
        crestBgShape: true,
        crestBgColor: true,
        crestBgPattern: true,
        crestFgSymbol: true,
        crestFgColor: true,
        crestFrame: true,
        leaderId: true,
        leader: {
          select: {
            id: true,
            class: true,
            level: true,
            account: {
              select: {
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy,
      // If sorting by memberCount, fetch all; otherwise use pagination
      take: fetchAll ? undefined : limit,
      skip: fetchAll ? undefined : offset
    }),
    prisma.guild.count()
  ]);

  console.log(`[getGuildLeaderboard] Fetched ${allGuilds.length} guilds, total=${total}`);

  // Sort by memberCount in JavaScript if needed
  let guilds = allGuilds;
  if (sortBy === "memberCount") {
    guilds = allGuilds
      .sort((a, b) => b._count.members - a._count.members)
      .slice(offset, offset + limit);
  }

  console.log(`[getGuildLeaderboard] After sorting/slicing: ${guilds.length} guilds`);

  return {
    leaderboardType: sortBy,
    guilds: guilds.map((g, index) => {
      // Calculate the ranked value based on sortBy
      let value = 0;
      switch (sortBy) {
        case "power":
          value = g.totalPower;
          break;
        case "level":
          value = g.level;
          break;
        case "memberCount":
          value = g._count.members;
          break;
      }
      
      return {
        rank: offset + index + 1,
        guild: {
          id: g.id,
          name: g.name,
          tag: g.tag,
          description: g.description,
          level: g.level,
          totalPower: g.totalPower,
          maxMembers: g.maxMembers,
          isRecruiting: g.isRecruiting,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
          crestId: normalizeGuildCrestId(g.crestId),
          crestBgShape: g.crestBgShape,
          crestBgColor: g.crestBgColor,
          crestBgPattern: g.crestBgPattern,
          crestFgSymbol: g.crestFgSymbol,
          crestFgColor: g.crestFgColor,
          crestFrame: g.crestFrame,
          leaderId: g.leaderId,
          memberCount: g._count.members
        },
        memberCount: g._count.members,
        value
      };
    }),
    totalGuilds: total
  };
}

/**
 * Get guild member leaderboard (within a guild)
 */
export async function getGuildMemberLeaderboard(
  prisma: PrismaClient,
  guildId: string,
  limit: number = 50
): Promise<Array<{
  rank: number;
  player: any;
  contributedPower: number;
  role: string;
  joinedAt: string;
}>> {
  const members = await prisma.guildMember.findMany({
    where: { guildId },
    include: {
      player: {
        select: {
          id: true,
          class: true,
          level: true,
          gearScore: true,
          account: {
            select: {
              username: true
            }
          }
        }
      }
    },
    orderBy: { contributedPower: "desc" },
    take: limit
  });

  return members.map((m, index) => ({
    rank: index + 1,
    player: m.player,
    contributedPower: m.contributedPower,
    role: m.role,
    joinedAt: m.joinedAt.toISOString()
  }));
}

/**
 * Prune old activity logs (cron job helper)
 * Keep only last 90 days of activity
 */
export async function pruneOldActivity(prisma: PrismaClient): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const result = await prisma.guildActivity.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate
      }
    }
  });

  return result.count;
}

/**
 * Get guild statistics (for analytics)
 */
export async function getGuildStats(prisma: PrismaClient) {
  const [
    totalGuilds,
    totalMembers,
    averageStats,
    topGuildByPower,
    topGuildByLevel
  ] = await Promise.all([
    prisma.guild.count(),
    prisma.guildMember.count(),
    prisma.guild.aggregate({
      _avg: {
        totalPower: true,
        level: true
      }
    }),
    prisma.guild.findFirst({
      orderBy: { totalPower: "desc" },
      select: {
        name: true,
        tag: true,
        totalPower: true
      }
    }),
    prisma.guild.findFirst({
      orderBy: { level: "desc" },
      select: {
        name: true,
        tag: true,
        level: true
      }
    })
  ]);

  // Calculate average guild size
  const averageGuildSize = totalGuilds > 0 ? totalMembers / totalGuilds : 0;

  return {
    totalGuilds,
    totalMembers,
    averageGuildSize,
    averagePower: averageStats._avg.totalPower ?? 0,
    averageLevel: averageStats._avg.level ?? 0,
    topGuildByPower,
    topGuildByLevel
  };
}
