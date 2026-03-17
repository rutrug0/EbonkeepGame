import {
  arenaMatchResultSchema,
  arenaStateResponseSchema,
  type ArenaMatchResult,
  type ArenaStateResponse
} from "@ebonkeep/shared/arena";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchArenaState(token: string): Promise<ArenaStateResponse> {
  const response = await fetch(`${API_URL}/v1/arena/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Arena state failed"));
  }

  return arenaStateResponseSchema.parse(await response.json());
}

export async function findArenaOpponents(token: string): Promise<ArenaStateResponse> {
  const response = await fetch(`${API_URL}/v1/arena/find-opponents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Find arena opponents failed"));
  }

  return arenaStateResponseSchema.parse(await response.json());
}

export async function fightArenaOffer(token: string, offerId: string): Promise<ArenaMatchResult> {
  const response = await fetch(`${API_URL}/v1/arena/offers/${offerId}/fight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Arena duel failed"));
  }

  return arenaMatchResultSchema.parse(await response.json());
}
