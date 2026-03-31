import type {
  CraftingClaimJobResponse,
  CraftingInventoryResponse,
  CraftingStartJobResponse
} from "@ebonkeep/shared/crafting";
import {
  craftingClaimJobResponseSchema,
  craftingInventoryResponseSchema,
  craftingStartJobResponseSchema
} from "@ebonkeep/shared/crafting";

import { API_URL, authHeaders } from "../../lib/api/http";

export class CraftingApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "CraftingApiError";
  }
}

async function readCraftingError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => ({ error: fallback }));
  throw new CraftingApiError(payload.error ?? fallback, payload.code);
}

export async function fetchCraftingInventory(token: string): Promise<CraftingInventoryResponse> {
  const response = await fetch(`${API_URL}/v1/crafting/inventory`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    return readCraftingError(response, "Crafting inventory failed");
  }

  return craftingInventoryResponseSchema.parse(await response.json());
}

export async function startCraftingJob(
  token: string,
  recipeId: string,
  recipeType: "combine" | "item" | "distill",
  slotIndex: number
): Promise<CraftingStartJobResponse> {
  const response = await fetch(`${API_URL}/v1/crafting/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ recipeId, recipeType, slotIndex })
  });

  if (!response.ok) {
    return readCraftingError(response, "Crafting start failed");
  }

  return craftingStartJobResponseSchema.parse(await response.json());
}

export async function combineMaterials(token: string, recipeId: string, slotIndex: number): Promise<CraftingStartJobResponse> {
  return startCraftingJob(token, recipeId, "combine", slotIndex);
}

export async function craftItem(token: string, recipeId: string, slotIndex: number): Promise<CraftingStartJobResponse> {
  return startCraftingJob(token, recipeId, "item", slotIndex);
}

export async function distillConsumable(token: string, recipeId: string, slotIndex: number): Promise<CraftingStartJobResponse> {
  return startCraftingJob(token, recipeId, "distill", slotIndex);
}

export async function claimCraftingJob(token: string, jobId: string): Promise<CraftingClaimJobResponse> {
  const response = await fetch(`${API_URL}/v1/crafting/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ jobId })
  });

  if (!response.ok) {
    return readCraftingError(response, "Crafting claim failed");
  }

  return craftingClaimJobResponseSchema.parse(await response.json());
}
