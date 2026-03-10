import { spawn } from "node:child_process";

import Redis from "ioredis";

import { applyTestEnv, getRepoRoot } from "./test-env.mjs";

function runCommand(command, args, extraEnv = {}, cwd = getRepoRoot()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function ensureDockerServices() {
  if (process.env.EBONKEEP_SKIP_DOCKER === "1") {
    return;
  }

  await runCommand("docker", [
    "compose",
    "--env-file",
    ".env",
    "-f",
    "infra/docker/docker-compose.yml",
    "up",
    "-d"
  ]);
}

async function flushRedisDatabase(redisUrl) {
  const redis = new Redis(redisUrl, {
    lazyConnect: false
  });

  try {
    await redis.flushdb();
  } finally {
    await redis.quit();
  }
}

async function main() {
  const testEnv = applyTestEnv();
  await ensureDockerServices();

  const apiDir = `${getRepoRoot()}/apps/api`;
  const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await runCommand(prismaCommand, ["prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"], testEnv, apiDir);
  await runCommand(npmCommand, ["run", "db:seed"], testEnv, apiDir);
  await flushRedisDatabase(testEnv.REDIS_URL);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
