import type { RenownState } from "@ebonkeep/shared/player";
import { renownStateSchema } from "@ebonkeep/shared/player";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function getMyRenownState(token: string): Promise<RenownState> {
  const response = await fetch(`${API_URL}/v1/renown/state`, {
    headers: authHeaders(token)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch renown state"));
  }
  return renownStateSchema.parse(await response.json());
}

export async function unlockRenownNode(token: string, nodeId: string): Promise<RenownState> {
  const response = await fetch(`${API_URL}/v1/renown/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ nodeId })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to unlock renown node"));
  }
  return renownStateSchema.parse(await response.json());
}
