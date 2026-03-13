import type {
  AcademyDonationHistoryResponse,
  AcademyMemberContributionsResponse,
  AcademyTreeState,
  DonateToNodeRequest,
  DonateToNodeResponse
} from "@ebonkeep/shared/guild";
import {
  academyDonationHistoryResponseSchema,
  academyMemberContributionsResponseSchema,
  academyTreeStateSchema,
  donateToNodeResponseSchema
} from "@ebonkeep/shared/guild";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function getAcademyTree(token: string, guildId: string): Promise<AcademyTreeState> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/academy`, {
    headers: authHeaders(token)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch academy"));
  }
  return academyTreeStateSchema.parse(await response.json());
}

export async function donateToAcademyNode(
  token: string,
  guildId: string,
  body: DonateToNodeRequest
): Promise<DonateToNodeResponse> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/academy/donate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to donate"));
  }
  return donateToNodeResponseSchema.parse(await response.json());
}

export async function getAcademyDonationHistory(
  token: string,
  guildId: string,
  nodeId?: string,
  limit = 50,
  offset = 0
): Promise<AcademyDonationHistoryResponse> {
  const params = new URLSearchParams();
  if (nodeId) params.set("nodeId", nodeId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/academy/donations?${params}`, {
    headers: authHeaders(token)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch donations"));
  }
  return academyDonationHistoryResponseSchema.parse(await response.json());
}

export async function getAcademyMemberContributions(
  token: string,
  guildId: string
): Promise<AcademyMemberContributionsResponse> {
  const response = await fetch(`${API_URL}/v1/guild/${guildId}/academy/contributions`, {
    headers: authHeaders(token)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch contributions"));
  }
  return academyMemberContributionsResponseSchema.parse(await response.json());
}
