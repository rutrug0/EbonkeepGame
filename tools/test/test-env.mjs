import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const envFilePath = path.join(repoRoot, ".env");

function parseEnvFile(contents) {
  return contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value =
        rawValue.startsWith("\"") && rawValue.endsWith("\"")
          ? rawValue.slice(1, -1)
          : rawValue;

      accumulator[key] = value;
      return accumulator;
    }, {});
}

export function loadRepoEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(envFilePath, "utf8"));
}

export function getTestEnv(overrides = {}) {
  const fileEnv = loadRepoEnv();
  const mergedEnv = {
    ...fileEnv,
    ...process.env
  };
  const postgresPort = mergedEnv.EBONKEEP_POSTGRES_HOST_PORT ?? "55432";
  const apiPort = mergedEnv.TEST_API_PORT ?? "4010";
  const webPort = mergedEnv.TEST_WEB_PORT ?? "4173";

  return {
    ...mergedEnv,
    NODE_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: apiPort,
    DEV_GUEST_AUTH: "true",
    JWT_SECRET: mergedEnv.TEST_JWT_SECRET ?? "test-super-secret",
    DATABASE_URL:
      mergedEnv.TEST_DATABASE_URL ??
      `postgresql://ebonkeep:ebonkeep@localhost:${postgresPort}/ebonkeep?schema=test`,
    REDIS_URL: mergedEnv.TEST_REDIS_URL ?? "redis://localhost:6379/15",
    VITE_API_URL: `http://127.0.0.1:${apiPort}`,
    VITE_WS_URL: `ws://127.0.0.1:${apiPort}/ws`,
    EBONKEEP_WEB_URL: `http://127.0.0.1:${webPort}`,
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${webPort}`,
    ...overrides
  };
}

export function applyTestEnv(overrides = {}) {
  const testEnv = getTestEnv(overrides);
  for (const [key, value] of Object.entries(testEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
  return testEnv;
}

export function getRepoRoot() {
  return repoRoot;
}
