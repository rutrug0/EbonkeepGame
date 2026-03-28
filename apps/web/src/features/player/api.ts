import type { InventoryMoveResponse } from "@ebonkeep/shared/inventory";
import { inventoryMoveResponseSchema } from "@ebonkeep/shared/inventory";
import type {
  DevGuestLoginResponse,
  PlayerCheatActionResponse,
  PlayerCheatGenerateEquipmentBody,
  PlayerCheatGenerateEquipmentResponse,
  PlayerCheatGuildRaidResetResponse,
  PlayerCheatGuildRaidSquadResponse,
  PlayerCheatGrantCurrencyResponse,
  PlayerCheatLevelUpBody,
  PlayerRestResponse,
  PlayerPreferences,
  PlayerState,
  UpdatePlayerCheatSettingsBody,
  UpdatePlayerPreferencesBody,
  UpdatePortraitBody
} from "@ebonkeep/shared/player";
import {
  devGuestLoginResponseSchema,
  playerCheatActionResponseSchema,
  playerCheatGenerateEquipmentResponseSchema,
  playerCheatGuildRaidResetResponseSchema,
  playerCheatGuildRaidSquadResponseSchema,
  playerCheatGrantCurrencyResponseSchema,
  playerRestResponseSchema,
  playerPreferencesSchema,
  playerStateSchema
} from "@ebonkeep/shared/player";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

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

  return devGuestLoginResponseSchema.parse(await response.json());
}

export async function fetchPlayerState(token: string): Promise<PlayerState> {
  const response = await fetch(`${API_URL}/v1/player/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Player state failed (${response.status})`);
  }

  return playerStateSchema.parse(await response.json());
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

  return playerPreferencesSchema.parse(await response.json());
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
    throw new Error(await readErrorMessage(response, "Move item failed"));
  }

  return inventoryMoveResponseSchema.parse(await response.json());
}

export async function updatePortrait(
  token: string,
  body: UpdatePortraitBody
): Promise<{ portraitId?: string; backgroundId?: string }> {
  const response = await fetch(`${API_URL}/v1/player/portrait`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Update portrait failed (${response.status})`);
  }

  return response.json() as Promise<{ portraitId?: string; backgroundId?: string }>;
}

export async function restPlayer(token: string): Promise<PlayerRestResponse> {
  const response = await fetch(`${API_URL}/v1/player/rest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Rest failed"));
  }

  return playerRestResponseSchema.parse(await response.json());
}

export async function updatePlayerCheatSettings(
  token: string,
  body: UpdatePlayerCheatSettingsBody
): Promise<PlayerCheatActionResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Update cheat settings failed"));
  }

  return playerCheatActionResponseSchema.parse(await response.json());
}

export async function replenishPlayerCheats(token: string): Promise<PlayerCheatActionResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/replenish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Cheat replenish failed"));
  }

  return playerCheatActionResponseSchema.parse(await response.json());
}

export async function levelUpPlayerCheats(
  token: string,
  body: PlayerCheatLevelUpBody
): Promise<PlayerCheatActionResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/level-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Cheat level up failed"));
  }

  return playerCheatActionResponseSchema.parse(await response.json());
}

export async function generateEquipmentCheats(
  token: string,
  body: PlayerCheatGenerateEquipmentBody
): Promise<PlayerCheatGenerateEquipmentResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/generate-equipment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Generate equipment failed"));
  }

  return playerCheatGenerateEquipmentResponseSchema.parse(await response.json());
}

export async function grantCurrencyCheats(token: string): Promise<PlayerCheatGrantCurrencyResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/grant-currency`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Grant currency failed"));
  }

  return playerCheatGrantCurrencyResponseSchema.parse(await response.json());
}

export async function seedGuildRaidSquadCheats(token: string): Promise<PlayerCheatGuildRaidSquadResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/guild-raid-squad`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Seed guild raid squad failed"));
  }

  return playerCheatGuildRaidSquadResponseSchema.parse(await response.json());
}

export async function resetGuildRaidCheats(token: string): Promise<PlayerCheatGuildRaidResetResponse> {
  const response = await fetch(`${API_URL}/v1/player/cheats/guild-raid-reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Reset guild raid failed"));
  }

  return playerCheatGuildRaidResetResponseSchema.parse(await response.json());
}
