import { API_URL } from "./http";

export type ObservabilityServiceStatus = "ready" | "degraded" | "down";

export type ObservabilityServiceSnapshot = {
  status: ObservabilityServiceStatus;
  url: string;
  detail: string;
};

export type ObservabilityStatusResponse = {
  status: "ok" | "degraded";
  checkedAt: string;
  grafanaCredentials: string;
  services: {
    apiMetrics: ObservabilityServiceSnapshot;
    prometheus: ObservabilityServiceSnapshot & {
      apiScrapeHealthy: boolean;
    };
    grafana: ObservabilityServiceSnapshot;
    loki: ObservabilityServiceSnapshot;
  };
};

export async function fetchReady(): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/ready`);
  return (await response.json()) as Record<string, string>;
}

export async function fetchObservabilityStatus(): Promise<ObservabilityStatusResponse> {
  const response = await fetch(`${API_URL}/health/observability`);
  if (!response.ok) {
    throw new Error(`Failed to load observability status (${response.status})`);
  }
  return (await response.json()) as ObservabilityStatusResponse;
}

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
}
