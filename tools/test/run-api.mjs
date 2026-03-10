import { spawn } from "node:child_process";

import { applyTestEnv, getRepoRoot } from "./test-env.mjs";

const testEnv = applyTestEnv();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npmCommand, ["--workspace", "@ebonkeep/api", "exec", "tsx", "src/index.ts"], {
  cwd: getRepoRoot(),
  env: {
    ...process.env,
    ...testEnv
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
