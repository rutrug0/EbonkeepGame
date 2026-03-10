import type {
  AccountOverviewResponse,
  CreateGuildRequest,
  CreateGuildResponse,
  DevGuestLoginResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  GuildActivityQuery,
  GuildActivityResponse,
  GuildDetailsResponse,
  GuildLeaderboardQuery,
  GuildLeaderboardResponse,
  GuildMembersQuery,
  GuildMembersResponse,
  GuildSearchQuery,
  GuildSearchResponse,
  InventoryMoveResponse,
  LeaderboardResponse,
  LeaderboardType,
  LoginBody,
  LoginResponse,
  MerchantState,
  MerchantTransactionResponse,
  PlayerClass,
  PlayerPreferences,
  PlayerState,
  RegisterBody,
  RegisterResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  SendGuildInviteRequest,
  UpdateGuildRequest,
  UpdatePlayerPreferencesBody,
  VerifyEmailBody,
  VerifyEmailResponse
} from "@ebonkeep/shared";
import {
  accountOverviewResponseSchema,
  createGuildResponseSchema,
  devGuestLoginResponseSchema,
  forgotPasswordResponseSchema,
  guildActivityResponseSchema,
  guildDetailsResponseSchema,
  guildLeaderboardResponseSchema,
  guildMembersResponseSchema,
  guildSchema,
  guildSearchResponseSchema,
  inventoryMoveResponseSchema,
  leaderboardResponseSchema,
  loginResponseSchema,
  merchantStateSchema,
  merchantTransactionResponseSchema,
  playerPreferencesSchema,
  playerStateSchema,
  registerResponseSchema,
  resetPasswordResponseSchema,
  verifyEmailResponseSchema
} from "@ebonkeep/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function authHeaders(token: string | null): HeadersInit {
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(error.error || `Registration failed (${response.status})`);
  }
  const data = await response.json();
  return registerResponseSchema.parse(data);
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Login failed" }));
    throw new Error(error.error || `Login failed (${response.status})`);
  }
  const data = await response.json();
  return loginResponseSchema.parse(data);
}

export async function getAccountOverview(token: string): Promise<AccountOverviewResponse> {
  const response = await fetch(`${API_URL}/v1/account/overview`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    throw new Error(`Account overview failed (${response.status})`);
  }
  const data = await response.json();
  return accountOverviewResponseSchema.parse(data);
}

export async function verifyEmail(body: VerifyEmailBody): Promise<VerifyEmailResponse> {
  const response = await fetch(`${API_URL}/v1/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Email verification failed" }));
    throw new Error(error.error || `Email verification failed (${response.status})`);
  }
  const data = await response.json();
  return verifyEmailResponseSchema.parse(data);
}

export async function forgotPassword(body: ForgotPasswordBody): Promise<ForgotPasswordResponse> {
  const response = await fetch(`${API_URL}/v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  const data = await response.json();
  return forgotPasswordResponseSchema.parse(data);
}

export async function resetPassword(body: ResetPasswordBody): Promise<ResetPasswordResponse> {
  const response = await fetch(`${API_URL}/v1/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Password reset failed" }));
    throw new Error(error.error || `Password reset failed (${response.status})`);
  }
  const data = await response.json();
  return resetPasswordResponseSchema.parse(data);
}

export async function resendVerificationEmail(token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/v1/auth/resend-verification`, {
    method: "POST",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to resend verification email" }));
    throw new Error(error.error || `Failed to resend verification email (${response.status})`);
  }
  return await response.json();
}

export async function devGuestLogin(): Promise<DevGuestLoginResponse> {
  const response = await fetch(`${API_URL}/v1/dev/guest-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    throw new Error(`Login failed (${response.status})`);
  }
  const data = await response.json();
  return devGuestLoginResponseSchema.parse(data);
}

export async function fetchPlayerState(token: string): Promise<PlayerState> {
  const response = await fetch(`${API_URL}/v1/player/state`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    throw new Error(`Player state failed (${response.status})`);
  }
  const data = await response.json();
  return playerStateSchema.parse(data);
}

export async function updatePlayerPreferences(
  token: string,
  body: UpdatePlayerPreferencesBody
): Promise<PlayerPreferences> {
  const response = await fetch(`${API_URL}/v1/player/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Update preferences failed (${response.status})`);
  }
  const data = await response.json();
  return playerPreferencesSchema.parse(data);
}

export async function moveInventoryItem(
  token: string,
  itemId: string,
  fromSlot: string,
  toSlot: string
): Promise<InventoryMoveResponse> {
  const response = await fetch(`${API_URL}/v1/inventory/move-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({
      itemId,
      fromSlot,
      toSlot
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Move item failed" }));
    throw new Error(error.error || `Move item failed (${response.status})`);
  }
  const data = await response.json();
  return inventoryMoveResponseSchema.parse(data);
}

export async function fetchMerchantState(token: string): Promise<MerchantState> {
  const response = await fetch(`${API_URL}/v1/merchant/state`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Merchant state failed" }));
    throw new Error(error.error || `Merchant state failed (${response.status})`);
  }
  const data = await response.json();
  return merchantStateSchema.parse(data);
}

export async function buyMerchantOffer(token: string, offerId: string): Promise<MerchantTransactionResponse> {
  const response = await fetch(`${API_URL}/v1/merchant/buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ offerId })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Merchant purchase failed" }));
    throw new Error(error.error || `Merchant purchase failed (${response.status})`);
  }
  const data = await response.json();
  return merchantTransactionResponseSchema.parse(data);
}

export async function sellMerchantItem(
  token: string,
  itemId: string,
  fromSlot: string
): Promise<MerchantTransactionResponse> {
  const response = await fetch(`${API_URL}/v1/merchant/sell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({
      itemId,
      fromSlot
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Merchant sale failed" }));
    throw new Error(error.error || `Merchant sale failed (${response.status})`);
  }
  const data = await response.json();
  return merchantTransactionResponseSchema.parse(data);
}

export async function restockMerchant(token: string): Promise<MerchantTransactionResponse> {
  const response = await fetch(`${API_URL}/v1/merchant/restock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Merchant restock failed" }));
    throw new Error(error.error || `Merchant restock failed (${response.status})`);
  }
  const data = await response.json();
  return merchantTransactionResponseSchema.parse(data);
}

export async function fetchReady(): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/ready`);
  const data = (await response.json()) as Record<string, string>;
  return data;
}

export async function fetchLeaderboard(
  token: string,
  leaderboardType: LeaderboardType,
  classFilter: PlayerClass | "all" = "all",
  limit: number = 50
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
    const error = await response.json().catch(() => ({ error: "Failed to fetch leaderboard" }));
    throw new Error(error.error || `Failed to fetch leaderboard (${response.status})`);
  }

  const data = await response.json();
  return leaderboardResponseSchema.parse(data);
}

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
}

// ========================================
// Guild API
// ========================================

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
    const error = await response.json().catch(() => ({ error: "Failed to create guild" }));
    throw new Error(error.error || `Failed to create guild (${response.status})`);
  }

  const data = await response.json();
  return createGuildResponseSchema.parse(data);
}

export async function getMyGuild(token: string): Promise<GuildDetailsResponse | null> {
  const response = await fetch(`${API_URL}/v1/guild/my`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch guild" }));
    throw new Error(error.error || `Failed to fetch guild (${response.status})`);
  }

  const data = await response.json();
  return guildDetailsResponseSchema.parse(data);
}

export async function updateGuild(token: string, guildId: string, body: UpdateGuildRequest) {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to update guild" }));
    throw new Error(error.error || `Failed to update guild (${response.status})`);
  }

  const data = await response.json();
  return guildSchema.parse(data);
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
    headers: {
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to search guilds" }));
    throw new Error(error.error || `Failed to search guilds (${response.status})`);
  }

  const data = await response.json();
  return guildSearchResponseSchema.parse(data);
}

export async function getGuildMembers(token: string, guildId: string, query: Partial<GuildMembersQuery> = {}): Promise<GuildMembersResponse> {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  params.set("limit", (query.limit ?? 50).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members?${params.toString()}`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch members" }));
    throw new Error(error.error || `Failed to fetch members (${response.status})`);
  }

  const data = await response.json();
  return guildMembersResponseSchema.parse(data);
}

export async function getGuildActivity(token: string, guildId: string, query: Partial<GuildActivityQuery> = {}): Promise<GuildActivityResponse> {
  const params = new URLSearchParams();
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.since) params.set("since", query.since);
  params.set("limit", (query.limit ?? 20).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/${guildId}/activity?${params.toString()}`, {
    method: "GET",
    headers: {
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch activity" }));
    throw new Error(error.error || `Failed to fetch activity (${response.status})`);
  }

  const data = await response.json();
  return guildActivityResponseSchema.parse(data);
}

export async function leaveGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/leave`, {
    method: "POST",
    headers: {
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to leave guild" }));
    throw new Error(error.error || `Failed to leave guild (${response.status})`);
  }
}

export async function disbandGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/disband`, {
    method: "DELETE",
    headers: {
      ...authHeaders(token)
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to disband guild" }));
    throw new Error(error.error || `Failed to disband guild (${response.status})`);
  }
}

export async function getGuildById(guildId: string, token?: string | null): Promise<GuildDetailsResponse> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch guild" }));
    throw new Error(error.error || `Failed to fetch guild (${response.status})`);
  }

  const data = await response.json();
  return guildDetailsResponseSchema.parse(data);
}

export async function joinGuild(token: string, guildId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to join guild" }));
    throw new Error(error.error || `Failed to join guild (${response.status})`);
  }
}

export async function kickMember(token: string, guildId: string, memberId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members/${memberId}/kick`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to kick member" }));
    throw new Error(error.error || `Failed to kick member (${response.status})`);
  }
}

export async function updateMemberRole(token: string, guildId: string, memberId: string, role: "officer" | "member"): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/members/${memberId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to update role" }));
    throw new Error(error.error || `Failed to update role (${response.status})`);
  }
}

export async function transferLeadership(token: string, guildId: string, newLeaderId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/transfer-leadership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ newLeaderId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to transfer leadership" }));
    throw new Error(error.error || `Failed to transfer leadership (${response.status})`);
  }
}

export async function sendGuildInvite(token: string, guildId: string, inviteeId: string, message?: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ inviteeId, message })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to send invite" }));
    throw new Error(error.error || `Failed to send invite (${response.status})`);
  }
}

export async function getReceivedInvites(token: string): Promise<{ invites: any[] }> {
  const response = await fetch(`${API_URL}/v1/guild/invites/received`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch invites" }));
    throw new Error(error.error || `Failed to fetch invites (${response.status})`);
  }

  return await response.json();
}

export async function acceptGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to accept invite" }));
    throw new Error(error.error || `Failed to accept invite (${response.status})`);
  }
}

export async function declineGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/decline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to decline invite" }));
    throw new Error(error.error || `Failed to decline invite (${response.status})`);
  }
}

export async function cancelGuildInvite(token: string, inviteId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/guild/invites/${inviteId}/cancel`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to cancel invite" }));
    throw new Error(error.error || `Failed to cancel invite (${response.status})`);
  }
}

export async function getGuildLeaderboard(query: Partial<GuildLeaderboardQuery> = {}): Promise<GuildLeaderboardResponse> {
  const params = new URLSearchParams();
  params.set("sortBy", query.sortBy ?? "power");
  params.set("limit", (query.limit ?? 50).toString());
  params.set("offset", (query.offset ?? 0).toString());

  const response = await fetch(`${API_URL}/v1/guild/leaderboards?${params.toString()}`, {
    method: "GET"
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch leaderboard" }));
    throw new Error(error.error || `Failed to fetch leaderboard (${response.status})`);
  }

  const data = await response.json();
  return guildLeaderboardResponseSchema.parse(data);
}
