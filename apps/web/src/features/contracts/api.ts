import {
  contractBoardResponseSchema,
  developerContractsStaticCurvesResponseSchema,
  developerContractSimulationJobSchema,
  contractRunResultSchema,
  contractRunSnapshotSchema,
  runDeveloperContractSimulationBodySchema,
  startContractRunResponseSchema,
  type ContractBoardResponse,
  type DeveloperContractsStaticCurvesResponse,
  type DeveloperContractSimulationJob,
  type ContractRunResult,
  type ContractRunSnapshot,
  type RunDeveloperContractSimulationBody,
  type StartContractRunResponse
} from "@ebonkeep/shared/combat";

import { API_URL, authHeaders, readErrorMessage } from "../../lib/api/http";

type DeveloperContractSimulationJobWithArtifact = DeveloperContractSimulationJob & {
  artifactPath?: string | null;
};

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

export async function runDeveloperContractSimulation(
  token: string,
  body: RunDeveloperContractSimulationBody
): Promise<DeveloperContractSimulationJobWithArtifact> {
  const payload = runDeveloperContractSimulationBodySchema.parse(body);
  const response = await fetch(`${API_URL}/v1/contracts/simulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Start contracts simulation failed"));
  }

  return developerContractSimulationJobSchema.parse(await response.json()) as DeveloperContractSimulationJobWithArtifact;
}

export async function fetchDeveloperContractSimulation(
  token: string,
  jobId: string
): Promise<DeveloperContractSimulationJobWithArtifact> {
  const response = await fetch(`${API_URL}/v1/contracts/simulations/${jobId}`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Load contracts simulation failed"));
  }

  return developerContractSimulationJobSchema.parse(await response.json()) as DeveloperContractSimulationJobWithArtifact;
}

export async function fetchDeveloperContractsStaticCurves(token: string): Promise<DeveloperContractsStaticCurvesResponse> {
  const response = await fetch(`${API_URL}/v1/contracts/simulation-curves`, {
    method: "GET",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Load contracts static curves failed"));
  }

  return developerContractsStaticCurvesResponseSchema.parse(await response.json());
}
