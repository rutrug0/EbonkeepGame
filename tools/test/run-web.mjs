import { spawn } from "node:child_process";

import { applyTestEnv, getRepoRoot } from "./test-env.mjs";

const testEnv = applyTestEnv();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(
  npmCommand,
  ["--workspace", "@ebonkeep/web", "exec", "vite", "--", "--host", "127.0.0.1", "--port", testEnv.TEST_WEB_PORT ?? "4173"],
  {
    cwd: getRepoRoot(),
    env: {
      ...process.env,
      ...testEnv
    },
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
