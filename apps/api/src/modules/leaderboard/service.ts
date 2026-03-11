import type { LeaderboardResponse, LeaderboardType, PlayerClass } from "@ebonkeep/shared";
import type { PrismaClient } from "@prisma/client";

export async function getLeaderboard(
  prisma: PrismaClient,
  leaderboardType: LeaderboardType,
  limit: number,
  classFilter?: PlayerClass,
  currentPlayerId?: string
): Promise<LeaderboardResponse> {
  const orderByColumn = leaderboardType === "power" ? "gearScore" : "level";
  
  // Build WHERE clause for class filter
  const whereClause = classFilter ? { class: classFilter } : {};

  // Get top players
  const topPlayers = await prisma.playerProfile.findMany({
    where: whereClause,
    orderBy: [
      { [orderByColumn]: "desc" },
      { level: "desc" }, // Secondary sort
      { updatedAt: "asc" } // Tiebreaker (earlier achiever wins)
    ],
    take: limit,
    select: {
      id: true,
      class: true,
      level: true,
      gearScore: true,
      account: {
        select: {
          username: true
        }
      },
      guildMembership: {
        select: {
          guildId: true,
          guild: { select: { tag: true, name: true } }
        }
      }
    }
  });

  // Get total player count
  const totalPlayers = await prisma.playerProfile.count({
    where: whereClause
  });

  // Get current player rank if provided
  let currentPlayerRank: number | null = null;
  if (currentPlayerId) {
    const currentPlayer = await prisma.playerProfile.findUnique({
      where: { id: currentPlayerId },
      select: { gearScore: true, level: true, updatedAt: true, class: true }
    });

    if (currentPlayer) {
      // Check if class filter matches
      const shouldInclude = !classFilter || currentPlayer.class === classFilter;
      
      if (shouldInclude) {
        const currentValue = leaderboardType === "power" ? currentPlayer.gearScore : currentPlayer.level;
        
        // Count how many players are ranked higher
        const higherRankedCount = await prisma.playerProfile.count({
          where: {
            ...whereClause,
            OR: [
              { [orderByColumn]: { gt: currentValue } },
              {
                [orderByColumn]: currentValue,
                level: { gt: currentPlayer.level }
              },
              {
                [orderByColumn]: currentValue,
                level: currentPlayer.level,
                updatedAt: { lt: currentPlayer.updatedAt }
              }
            ]
          }
        });
        
        currentPlayerRank = higherRankedCount + 1;
      }
    }
  }

  // Map to response format
  const entries = topPlayers.map((player, index) => ({
    rank: index + 1,
    playerId: player.id,
    username: player.account.username ?? "Unknown Warden",
    class: player.class as PlayerClass,
    level: player.level,
    gearScore: player.gearScore,
    value: leaderboardType === "power" ? player.gearScore : player.level,
    guildId: player.guildMembership?.guildId ?? null,
    guildTag: player.guildMembership?.guild?.tag ?? null,
    guildName: player.guildMembership?.guild?.name ?? null
  }));

  return {
    leaderboardType,
    entries,
    totalPlayers,
    currentPlayerRank
  };
}
