import type { InventoryMoveResponse } from "@ebonkeep/shared/inventory";
import { inventoryMoveResponseSchema } from "@ebonkeep/shared/inventory";
import type {
  DevGuestLoginResponse,
  PlayerPreferences,
  PlayerState,
  UpdatePlayerPreferencesBody,
  UpdatePortraitBody
} from "@ebonkeep/shared/player";
import {
  devGuestLoginResponseSchema,
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
