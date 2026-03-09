# Desktop Scope Guide

These instructions apply to `apps/desktop/**`.

## Responsibility Boundary
- Keep the Electron wrapper focused on window bootstrap, shell behavior, and platform integration.
- Do not move gameplay, API, or shared contract logic into the desktop wrapper unless the task explicitly requires platform-specific behavior.

## Runtime Rules
- The desktop app should load the web client via `EBONKEEP_WEB_URL` or the local default URL.
- Prefer isolating desktop-only behavior in `src/main.cjs` and keep the wrapper thin.
- Preserve secure defaults such as `contextIsolation: true` and `nodeIntegration: false` unless the user explicitly requests a security tradeoff.

## Verification
- Use `npm.cmd --workspace @ebonkeep/desktop run dev` when the task requires manual wrapper validation.
- For code-only changes, inspect `src/main.cjs` carefully and avoid unrelated Electron configuration churn.
