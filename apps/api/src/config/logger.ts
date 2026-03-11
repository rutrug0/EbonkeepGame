import { randomUUID } from "node:crypto";
import pino, { type Logger, type LoggerOptions } from "pino";

export interface LoggerConfig {
  level?: string;
  /** Loki HTTP push endpoint, e.g. http://localhost:3100 */
  lokiUrl?: string;
  /** Enable pino-pretty transport (dev only). Requires pino-pretty to be installed. */
  pretty?: boolean;
}

/**
 * Creates a structured Pino logger.
 *
 * - Plain JSON → stdout when no overrides are active.
 * - Optionally multiplexes to Grafana Loki via the pino-loki transport when
 *   LOKI_URL env var (or config.lokiUrl) is set.
 * - Optionally uses pino-pretty for human-readable output when LOG_PRETTY=true.
 *
 * Every logger instance attaches a stable `correlationId` field to child
 * loggers (request-scoped loggers inherit request.id automatically via
 * Fastify's built-in child logger behaviour).
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const level = config.level ?? process.env.LOG_LEVEL ?? "info";
  const lokiUrl = config.lokiUrl ?? process.env.LOKI_URL;
  const pretty = config.pretty ?? process.env.LOG_PRETTY === "true";

  const pinoOptions: LoggerOptions = {
    level,
    base: { service: "ebonkeep-api", env: process.env.NODE_ENV ?? "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  const hasTransport = pretty || !!lokiUrl;
  if (!hasTransport) {
    return pino(pinoOptions);
  }

  type TransportTarget = {
    target: string;
    level: string;
    options: Record<string, unknown>;
  };

  const targets: TransportTarget[] = [];

  if (pretty) {
    targets.push({
      target: "pino-pretty",
      level,
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
        messageFormat: "[{service}] {msg}",
      },
    });
  } else {
    // Write structured JSON to stdout
    targets.push({
      target: "pino/file",
      level,
      options: { destination: 1 },
    });
  }

  if (lokiUrl) {
    targets.push({
      target: "pino-loki",
      level,
      options: {
        host: lokiUrl,
        labels: {
          app: "ebonkeep-api",
          env: process.env.NODE_ENV ?? "development",
        },
        replaceTimestamp: true,
        timeout: 10_000,
        silenceErrors: false,
        errorHandler: (err: Error) => {
          process.stderr.write(`[pino-loki] Failed to ship logs: ${err.message}\n`);
        },
      },
    });
  }

  return pino(pinoOptions, pino.transport({ targets }));
}

/** Generates a correlation/request ID from the incoming X-Request-Id header or a fresh UUID. */
export function genReqId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const header = req.headers["x-request-id"];
  if (typeof header === "string" && header.length > 0 && header.length <= 128) {
    return header;
  }
  return randomUUID();
}
