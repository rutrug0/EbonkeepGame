import { resolveLokiUrl } from "../../config/logger.js";

type LocalObservabilityStatus = "ready" | "degraded" | "down";

export type LocalObservabilityService = {
  status: LocalObservabilityStatus;
  url: string;
  detail: string;
};

export type LocalObservabilitySnapshot = {
  status: "ok" | "degraded";
  checkedAt: string;
  grafanaCredentials: string;
  services: {
    apiMetrics: LocalObservabilityService;
    prometheus: LocalObservabilityService & {
      apiScrapeHealthy: boolean;
    };
    grafana: LocalObservabilityService;
    loki: LocalObservabilityService;
  };
};

const LOCAL_OBSERVABILITY_URLS = {
  apiMetrics: "http://localhost:4000/metrics",
  prometheus: "http://localhost:9090/targets?search=ebonkeep-api",
  grafana: "http://localhost:3000/d/ebonkeep-api-v1/ebonkeep-api?orgId=1",
  loki: "http://localhost:3000/explore?orgId=1"
} as const;

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isHttpHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function isPrometheusScrapingApi(): Promise<boolean> {
  const params = new URLSearchParams({
    query: 'up{job="ebonkeep-api"}'
  });

  try {
    const response = await fetchWithTimeout(`http://localhost:9090/api/v1/query?${params.toString()}`);
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      data?: {
        result?: Array<{
          value?: [number, string];
        }>;
      };
    };

    return payload.data?.result?.some((entry) => entry.value?.[1] === "1") ?? false;
  } catch {
    return false;
  }
}

export async function getLocalObservabilityStatus(): Promise<LocalObservabilitySnapshot> {
  const [prometheusReady, grafanaReady, lokiReady, apiScrapeHealthy] = await Promise.all([
    isHttpHealthy("http://localhost:9090/-/ready"),
    isHttpHealthy("http://localhost:3000/api/health"),
    isHttpHealthy("http://localhost:3100/ready"),
    isPrometheusScrapingApi()
  ]);

  const lokiConfigured = Boolean(resolveLokiUrl());

  const services: LocalObservabilitySnapshot["services"] = {
    apiMetrics: {
      status: "ready",
      url: LOCAL_OBSERVABILITY_URLS.apiMetrics,
      detail: "Fastify exposes /metrics for Prometheus scraping."
    },
    prometheus: {
      status: !prometheusReady ? "down" : apiScrapeHealthy ? "ready" : "degraded",
      url: LOCAL_OBSERVABILITY_URLS.prometheus,
      detail: !prometheusReady
        ? "Prometheus is not reachable on localhost:9090."
        : apiScrapeHealthy
          ? "Prometheus is up and scraping the ebonkeep-api target."
          : "Prometheus is up, but the ebonkeep-api target is not healthy yet.",
      apiScrapeHealthy
    },
    grafana: {
      status: grafanaReady ? "ready" : "down",
      url: LOCAL_OBSERVABILITY_URLS.grafana,
      detail: grafanaReady
        ? "Grafana is up and the local Ebonkeep API dashboard is available."
        : "Grafana is not reachable on localhost:3000."
    },
    loki: {
      status: !lokiReady ? "down" : lokiConfigured ? "ready" : "degraded",
      url: LOCAL_OBSERVABILITY_URLS.loki,
      detail: !lokiReady
        ? "Loki is not reachable on localhost:3100."
        : lokiConfigured
          ? "Loki is up and API logs are configured for shipping."
          : "Loki is up, but API log shipping is not configured."
    }
  };

  const hasIssues = Object.values(services).some((service) => service.status !== "ready");

  return {
    status: hasIssues ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    grafanaCredentials: "admin / admin",
    services
  };
}
