import type { MerchantState, MerchantTransactionResponse } from "@ebonkeep/shared/economy";
import { merchantStateSchema, merchantTransactionResponseSchema } from "@ebonkeep/shared/economy";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchMerchantState(token: string): Promise<MerchantState> {
  const response = await fetch(`${API_URL}/v1/merchant/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Merchant state failed"));
  }

  return merchantStateSchema.parse(await response.json());
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
    throw new Error(await readErrorMessage(response, "Merchant purchase failed"));
  }

  return merchantTransactionResponseSchema.parse(await response.json());
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
    throw new Error(await readErrorMessage(response, "Merchant sale failed"));
  }

  return merchantTransactionResponseSchema.parse(await response.json());
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
    throw new Error(await readErrorMessage(response, "Merchant restock failed"));
  }

  return merchantTransactionResponseSchema.parse(await response.json());
}
