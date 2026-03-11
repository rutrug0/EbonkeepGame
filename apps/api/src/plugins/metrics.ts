import fp from "fastify-plugin";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Fastify plugin: Prometheus metrics
 *
 * Registers default Node.js / process metrics and two HTTP metrics:
 *   - http_requests_total       — counter  (method, route, status_code)
 *   - http_request_duration_seconds — histogram (method, route, status_code)
 *
 * Exposes a GET /metrics endpoint that returns the Prometheus text format.
 * The endpoint is intentionally unauthenticated so Prometheus can scrape it.
 */
export const metricsPlugin = fp(async (fastify) => {
  const register = new Registry();
  register.setDefaultLabels({ app: "ebonkeep-api" });
  collectDefaultMetrics({ register });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  // Record start timestamp on every incoming request.
  fastify.addHook("onRequest", async (request) => {
    request.metricsStartTime = process.hrtime.bigint();
  });

  // Observe duration and increment counter after each response.
  fastify.addHook("onResponse", async (request, reply) => {
    if (!request.metricsStartTime) return;

    const route = request.routeOptions?.url ?? "unmatched";
    // Skip the scrape endpoint itself to avoid self-referential noise.
    if (route === "/metrics") return;

    const elapsed = process.hrtime.bigint() - request.metricsStartTime;
    const durationSec = Number(elapsed) / 1e9;

    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  // Prometheus scrape endpoint — silent log level so scrapes don't clutter request logs.
  fastify.get(
    "/metrics",
    { logLevel: "silent" },
    async (_request, reply) => {
      const body = await register.metrics();
      void reply.header("Content-Type", register.contentType);
      return body;
    },
  );
});
