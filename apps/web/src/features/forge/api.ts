import type { ForgeMendResponse, ForgeEnchantBody, ForgeEnchantResponse, ForgeState } from "@ebonkeep/shared/forge";
import { forgeMendResponseSchema, forgeEnchantResponseSchema, forgeStateSchema } from "@ebonkeep/shared/forge";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchForgeState(token: string): Promise<ForgeState> {
  const response = await fetch(`${API_URL}/v1/forge/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Forge state failed"));
  }

  return forgeStateSchema.parse(await response.json());
}

export async function attemptForgeEnchant(
  token: string,
  body: ForgeEnchantBody
): Promise<ForgeEnchantResponse> {
  const response = await fetch(`${API_URL}/v1/forge/enchant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Enchant failed"));
  }

  return forgeEnchantResponseSchema.parse(await response.json());
}

export async function mendForgeWeapon(token: string, weaponItemId: string): Promise<ForgeMendResponse> {
  const response = await fetch(`${API_URL}/v1/forge/mend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ weaponItemId })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Forge mend failed"));
  }

  return forgeMendResponseSchema.parse(await response.json());
}
