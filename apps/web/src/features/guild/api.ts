import type {
  CreateGuildRequest,
  CreateGuildResponse,
  GetInvitesResponse,
  Guild,
  GuildActivityQuery,
  GuildActivityResponse,
  GuildDetailsResponse,
  GuildMembersQuery,
  GuildMembersResponse,
  GuildSearchQuery,
  GuildSearchResponse,
  UpdateGuildRequest
} from "@ebonkeep/shared/guild";
import {
  createGuildResponseSchema,
  getInvitesResponseSchema,
  guildActivityResponseSchema,
  guildDetailsResponseSchema,
  guildMembersResponseSchema,
  guildSchema,
  guildSearchResponseSchema
} from "@ebonkeep/shared/guild";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function createGuild(token: string, body: CreateGuildRequest): Promise<CreateGuildResponse> {
  const response = await fetch(`${API_URL}/v1/guild`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to create guild"));
  }

  return createGuildResponseSchema.parse(await response.json());
}

export async function getMyGuild(token: string): Promise<GuildDetailsResponse | null> {
  const response = await fetch(`${API_URL}/v1/guild/my`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch guild"));
  }

  return guildDetailsResponseSchema.parse(await response.json());
}

export async function updateGuild(token: string, guildId: string, body: UpdateGuildRequest): Promise<Guild> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update guild"));
  }

  return guildSchema.parse(await response.json());
}

export async function searchGuilds(token: string, query: GuildSearchQuery): Promise<GuildSearchResponse> {
  const params = new URLSearchParams();
  if (query.name) params.set("name", query.name);
  if (query.tag) params.set("tag", query.tag);
  if (query.minMembers !== undefined) params.set("minMembers", query.minMembers.toString());
  if (query.maxMembers !== undefined) params.set("maxMembers", query.maxMembers.toString());
  params.set("limit", (query.limit ?? 20).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/search?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to search guilds"));
  }

  return guildSearchResponseSchema.parse(await response.json());
}

export async function getGuildMembers(
  token: string,
  guildId: string,
  query: Partial<GuildMembersQuery> = {}
): Promise<GuildMembersResponse> {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  params.set("limit", (query.limit ?? 50).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch members"));
  }

  return guildMembersResponseSchema.parse(await response.json());
}

export async function getGuildActivity(
  token: string,
  guildId: string,
  query: Partial<GuildActivityQuery> = {}
): Promise<GuildActivityResponse> {
  const params = new URLSearchParams();
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.since) params.set("since", query.since);
  params.set("limit", (query.limit ?? 20).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/${guildId}/activity?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch activity"));
  }

  return guildActivityResponseSchema.parse(await response.json());
}

export async function leaveGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/leave`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to leave guild"));
  }
}

export async function disbandGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/disband`, {
    method: "DELETE",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to disband guild"));
  }
}

export async function getGuildById(guildId: string, token?: string | null): Promise<GuildDetailsResponse> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}`, {
    method: "GET",
    headers: authHeaders(token ?? null)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch guild"));
  }

  return guildDetailsResponseSchema.parse(await response.json());
}

export async function joinGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/join`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to join guild"));
  }
}

export async function kickMember(token: string, guildId: string, memberId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members/${memberId}/kick`, {
    method: "DELETE",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to kick member"));
  }
}

export async function updateMemberRole(
  token: string,
  guildId: string,
  memberId: string,
  role: "officer" | "member"
): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members/${memberId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update role"));
  }
}

export async function transferLeadership(token: string, guildId: string, newLeaderId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/transfer-leadership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ newLeaderId })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to transfer leadership"));
  }
}

export async function sendGuildInvite(token: string, guildId: string, inviteeId: string, message?: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ inviteeId, message })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to send invite"));
  }
}

export async function getReceivedInvites(token: string): Promise<GetInvitesResponse> {
  const response = await fetch(`${API_URL}/v1/guild/invites/received`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch invites"));
  }

  return getInvitesResponseSchema.parse(await response.json());
}

export async function acceptGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/accept`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to accept invite"));
  }
}

export async function declineGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/decline`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to decline invite"));
  }
}

export async function cancelGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/cancel`, {
    method: "DELETE",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to cancel invite"));
  }
}
