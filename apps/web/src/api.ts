import type { DevGuestLoginResponse, PlayerState } from "@ebonkeep/shared";
import {
  devGuestLoginResponseSchema,
  playerStateSchema
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

export async function fetchReady(): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/ready`);
  const data = (await response.json()) as Record<string, string>;
  return data;
}

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
}
