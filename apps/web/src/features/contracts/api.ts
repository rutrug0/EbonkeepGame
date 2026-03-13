import {
  contractBoardResponseSchema,
  contractRunResultSchema,
  contractRunSnapshotSchema,
  startContractRunResponseSchema,
  type ContractBoardResponse,
  type ContractRunResult,
  type ContractRunSnapshot,
  type StartContractRunResponse
} from "@ebonkeep/shared/combat";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

export async function fetchContractsBoard(token: string): Promise<ContractBoardResponse> {
  const response = await fetch(`${API_URL}/v1/contracts/board`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Contracts board failed"));
  }

  return contractBoardResponseSchema.parse(await response.json());
}

export async function startContractsRun(token: string, slotId: number): Promise<StartContractRunResponse> {
  const response = await fetch(`${API_URL}/v1/contracts/slots/${slotId}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Start contract failed"));
  }

  return startContractRunResponseSchema.parse(await response.json());
}

export async function abandonContractsSlot(token: string, slotId: number): Promise<ContractBoardResponse> {
  const response = await fetch(`${API_URL}/v1/contracts/slots/${slotId}/abandon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Abandon contract failed"));
  }

  return contractBoardResponseSchema.parse(await response.json());
}

export async function fetchContractRun(token: string, runId: string): Promise<ContractRunSnapshot> {
  const response = await fetch(`${API_URL}/v1/contracts/runs/${runId}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Load contract run failed"));
  }

  return contractRunSnapshotSchema.parse(await response.json());
}

export async function claimContractRun(token: string, runId: string): Promise<ContractRunResult> {
  const response = await fetch(`${API_URL}/v1/contracts/runs/${runId}/claim-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Claim contract result failed"));
  }

  return contractRunResultSchema.parse(await response.json());
}
