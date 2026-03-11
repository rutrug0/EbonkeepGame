import type {
  GuildLeaderboardQuery,
  GuildLeaderboardResponse,
  LeaderboardResponse,
  LeaderboardType
} from "@ebonkeep/shared/leaderboard";
import {
  guildLeaderboardResponseSchema,
  leaderboardResponseSchema
} from "@ebonkeep/shared/leaderboard";
import type { PlayerClass } from "@ebonkeep/shared/core";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchLeaderboard(
  token: string,
  leaderboardType: LeaderboardType,
  classFilter: PlayerClass | "all" = "all",
  limit = 50
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    type: leaderboardType,
    classFilter,
    limit: limit.toString()
  });

  const response = await fetch(`${API_URL}/v1/leaderboard?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch leaderboard"));
  }

  return leaderboardResponseSchema.parse(await response.json());
}

export async function getGuildLeaderboard(
  query: Partial<GuildLeaderboardQuery> = {}
): Promise<GuildLeaderboardResponse> {
  const params = new URLSearchParams();
  params.set("sortBy", query.sortBy ?? "power");
  params.set("limit", (query.limit ?? 50).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/leaderboards?${params.toString()}`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch leaderboard"));
  }

  return guildLeaderboardResponseSchema.parse(await response.json());
}
