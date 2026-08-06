#!/usr/bin/env node
/**
 * Brings the local environment into a state where the app can actually start:
 * picks a usable Postgres host port, propagates the root .env to the workspaces
 * that read their own copy, starts Postgres/Redis, and applies migrations.
 *
 * This is the subset of run-local.bat needed before `npm run dev`. It does not
 * start the observability stack, reset data, or spawn windows, so it is safe to
 * run repeatedly and works when the dev servers are driven by tooling.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rootEnv = path.join(repoRoot, ".env");
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

/** Workspaces that load their own .env rather than the root one. */
const ENV_CONSUMERS = ["apps/api", "apps/web"];

function step(message) {
  console.log(`[prepare-local] ${message}`);
}

function fail(message) {
  console.error(`[prepare-local] ${message}`);
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, { cwd: repoRoot, stdio: "inherit" });
}

/**
 * Node refuses to spawn .cmd shims directly, so npm goes through a shell. The
 * arguments below are all literals, so string concatenation is safe here.
 */
function runNpm(args) {
  execSync(`${npm} ${args.join(" ")}`, { cwd: repoRoot, stdio: "inherit" });
}

function ensureRootEnv() {
  if (fs.existsSync(rootEnv)) {
    return;
  }

  const example = path.join(repoRoot, ".env.example");
  if (!fs.existsSync(example)) {
    fail("Neither .env nor .env.example exists; cannot build a local environment.");
  }

  step("Creating .env from .env.example");
  fs.copyFileSync(example, rootEnv);
}

/**
 * Windows frequently reserves the preferred Postgres port (55432), which makes
 * `docker compose up` fail with a socket permission error. The existing
 * PowerShell helper picks a free port and rewrites the root .env; it is a no-op
 * when the current port still works.
 */
function syncPostgresPort() {
  if (!isWindows) {
    return null;
  }

  const script = path.join(repoRoot, "scripts/windows/sync-local-postgres-port.ps1");
  const output = execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-EnvPath", ".env"],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const port = output.trim().split(/\r?\n/).pop();
  step(`Postgres host port: ${port}`);
  return port;
}

/**
 * apps/api and apps/web each read their own .env. If only the root copy is
 * updated, Prisma and Vite keep pointing at a stale port and startup fails in a
 * way that looks like the database is down.
 */
function syncWorkspaceEnvFiles() {
  for (const workspace of ENV_CONSUMERS) {
    const target = path.join(repoRoot, workspace, ".env");
    fs.copyFileSync(rootEnv, target);
  }
  step(`Synced .env to ${ENV_CONSUMERS.join(", ")}`);
}

function assertDockerRunning() {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    fail("Docker is not running. Start Docker Desktop and rerun.");
  }
}

function startInfrastructure() {
  step("Starting Postgres and Redis");
  // --wait blocks until both containers report healthy.
  run("docker", [
    "compose",
    "--env-file",
    ".env",
    "-f",
    "infra/docker/docker-compose.yml",
    "up",
    "-d",
    "--wait",
    "postgres",
    "redis"
  ]);
}

function applyMigrations() {
  step("Generating Prisma client");
  runNpm(["run", "db:generate"]);
  step("Applying migrations");
  runNpm(["run", "db:migrate"]);
}

ensureRootEnv();
syncPostgresPort();
syncWorkspaceEnvFiles();
assertDockerRunning();
startInfrastructure();
applyMigrations();

step("Local environment ready. Postgres and Redis are up and migrated.");
