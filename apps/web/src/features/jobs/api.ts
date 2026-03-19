import {
  jobsMutationResponseSchema,
  jobsStateResponseSchema,
  type AdvanceJobsDebugBody,
  type ClaimJobsRunBody,
  type JobsMutationResponse,
  type JobsStateResponse,
  type SelectJobsBonusBody,
  type StartJobsRunBody
} from "@ebonkeep/shared/jobs";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchJobsState(token: string): Promise<JobsStateResponse> {
  const response = await fetch(`${API_URL}/v1/jobs/state`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Jobs state failed"));
  }

  return jobsStateResponseSchema.parse(await response.json());
}

async function postJobsMutation<TBody>(token: string, path: string, body: TBody): Promise<JobsMutationResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Jobs action failed"));
  }

  return jobsMutationResponseSchema.parse(await response.json());
}

export function startJobsRunApi(token: string, body: StartJobsRunBody): Promise<JobsMutationResponse> {
  return postJobsMutation(token, "/v1/jobs/start", body);
}

export function rerollJobsBoardApi(token: string): Promise<JobsMutationResponse> {
  return postJobsMutation(token, "/v1/jobs/reroll", {});
}

export function claimJobsRunApi(token: string, body: ClaimJobsRunBody): Promise<JobsMutationResponse> {
  return postJobsMutation(token, "/v1/jobs/claim", body);
}

export function selectJobsBonusApi(token: string, body: SelectJobsBonusBody): Promise<JobsMutationResponse> {
  return postJobsMutation(token, "/v1/jobs/bonus", body);
}

export function advanceJobsDebugApi(token: string, body: AdvanceJobsDebugBody): Promise<JobsMutationResponse> {
  return postJobsMutation(token, "/v1/jobs/debug/advance", body);
}
