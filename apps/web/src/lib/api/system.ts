import { API_URL } from "./http";

export async function fetchReady(): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/ready`);
  return (await response.json()) as Record<string, string>;
}

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
}
