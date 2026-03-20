import type {
  ClearGardenPlotResponse,
  GardenStateResponse,
  HarvestGardenPlotResponse,
  PlantGardenSeedBody,
  PlantGardenSeedResponse,
  UpdateGardenUnlockedSlotsBody,
  UpdateGardenUnlockedSlotsResponse
} from "@ebonkeep/shared/garden";
import {
  clearGardenPlotResponseSchema,
  gardenStateResponseSchema,
  harvestGardenPlotResponseSchema,
  plantGardenSeedResponseSchema,
  updateGardenUnlockedSlotsResponseSchema
} from "@ebonkeep/shared/garden";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchGardenState(token: string): Promise<GardenStateResponse> {
  const response = await fetch(`${API_URL}/v1/garden/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Garden state failed"));
  }

  return gardenStateResponseSchema.parse(await response.json());
}

export async function plantGardenSeed(
  token: string,
  slotIndex: number,
  body: PlantGardenSeedBody
): Promise<PlantGardenSeedResponse> {
  const response = await fetch(`${API_URL}/v1/garden/slots/${slotIndex}/plant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Planting seed failed"));
  }

  return plantGardenSeedResponseSchema.parse(await response.json());
}

export async function harvestGardenPlot(
  token: string,
  slotIndex: number
): Promise<HarvestGardenPlotResponse> {
  const response = await fetch(`${API_URL}/v1/garden/slots/${slotIndex}/harvest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Harvest failed"));
  }

  return harvestGardenPlotResponseSchema.parse(await response.json());
}

export async function clearGardenPlot(
  token: string,
  slotIndex: number
): Promise<ClearGardenPlotResponse> {
  const response = await fetch(`${API_URL}/v1/garden/slots/${slotIndex}/clear`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Clearing plot failed"));
  }

  return clearGardenPlotResponseSchema.parse(await response.json());
}

export async function updateGardenUnlockedSlots(
  token: string,
  body: UpdateGardenUnlockedSlotsBody
): Promise<UpdateGardenUnlockedSlotsResponse> {
  const response = await fetch(`${API_URL}/v1/garden/cheats/unlocked-slots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Garden slot unlock failed"));
  }

  return updateGardenUnlockedSlotsResponseSchema.parse(await response.json());
}
