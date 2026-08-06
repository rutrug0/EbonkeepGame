# Ebonkeep

A dark-fantasy, web-first PvE browser RPG in the Gladiatus / Shakes & Fidget lineage — turn-based
server-resolved combat, stamina-gated contract runs, gear hunting, timers, and account-level
metaprogression. Not action combat, not idle.

Core loop: claim finished timers → prepare loadout → spend stamina on contracts/encounters → server
resolves combat → receive XP/loot/currency → upgrade, sell/salvage → restart timers. Nine classes
across three stat trees (STR/DEX/INT), level cap 100, 14 equipment slots, currencies are
**ducats / imperials / renown**. Web is the primary target; Electron (Steam) and Capacitor (Android)
wrappers are planned.

## Layout

npm-workspaces monorepo (`apps/*`, `packages/*`), Node >= 22.

| Path | What it is |
| --- | --- |
| `apps/web` | React 19 + Vite 6 SPA — the game client |
| `apps/api` | Fastify 5 modular monolith, Prisma + PostgreSQL, Redis |
| `apps/desktop` | Thin Electron wrapper around the web URL — keep it thin |
| `packages/shared` | `@ebonkeep/shared` — Zod contracts + pure game math shared by web and api |
| `docs`, `docs/data` | Design docs + canonical balance CSVs (generator inputs) |
| `tools` | Generators, validators, test-DB prep |
| `tests/e2e` | Playwright smoke + nightly |
| `infra/docker` | Postgres, Redis, Prometheus, Loki, Grafana |

## Stack

TypeScript 5.7, `strict: true`, ESM throughout. The root `tsconfig.json` is a solution file with
project references (shared → api → web); `build` runs `tsc -b` and **doubles as the typecheck**.
ESLint 9 flat config with `eslint-plugin-boundaries` enforcing the layering rules below. Vitest 3
for unit/integration, Playwright 1.52 for e2e.

## Commands

On Windows use `npm.cmd`.

| Command | Purpose |
| --- | --- |
| `run-local.bat` / `stop-local.bat` | Full local stack (web 5173, API 4000, Postgres host 55432) |
| `npm run build` | Build all workspaces — this *is* the typecheck |
| `npm run lint` | Lint all workspaces |
| `npm run test:ci` | Unit + integration + smoke (what CI runs) |
| `npm run test:unit` | Unit tests only (shared → api → web) |
| `npm run test:db:prepare` | Prepare the DB required by integration/e2e |
| `npm run test:smoke` / `test:e2e` | Playwright |
| `npm --workspace @ebonkeep/{api,web,shared} run build` | Typecheck one workspace |
| `npm --workspace @ebonkeep/web run i18n:check` | Validate locale files |

**There is no repo-wide typecheck script** — use a workspace `build`.

## Verifying UI work in a real browser

Unit tests are not sufficient evidence that a UI change works. Any change that affects
rendering, layout, or interaction must be verified by driving the running app in a browser,
**and must be checked at both mobile and desktop resolutions.**

**Launch.** Start Docker Desktop, then launch the `ebonkeep` config from `.claude/launch.json`. It
runs `npm run dev:browser`, which is `local:prepare` followed by `npm run dev` (API + web, client
on `http://localhost:5173`). Wait for `http://localhost:4000/health` to return 200 before driving
the UI. Use `ebonkeep-web-only` when an API is already running.

`.claude/` is gitignored, so a fresh clone has no launch config. Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "ebonkeep", "runtimeExecutable": "npm.cmd", "runtimeArgs": ["run", "dev:browser"], "port": 5173 },
    { "name": "ebonkeep-web-only", "runtimeExecutable": "npm.cmd", "runtimeArgs": ["run", "dev:web"], "port": 5173 }
  ]
}
```

Running `npm run dev:browser` directly works too and needs no config file.

`npm run local:prepare` (`tools/dev/prepare-local.mjs`) makes the environment correct before the
servers start, and is safe to re-run:

- Picks a usable Postgres host port. Windows commonly reserves the preferred `55432`, which makes
  `docker compose up` fail with a socket permission error; the existing
  `scripts/windows/sync-local-postgres-port.ps1` selects a free one.
- Copies the root `.env` to `apps/api/.env` and `apps/web/.env`. **These are three separate
  files** and each workspace reads its own. Updating only the root leaves Prisma pointed at a
  stale port, which fails as though the database were down.
- Starts Postgres and Redis (`up -d --wait`) and applies migrations.

It deliberately does not start the observability stack, reset data, or spawn windows.
`run-local.bat` remains the full-stack path for manual work, but it launches the dev servers in a
separate window, so it is not usable for browser-driven testing.

**Authenticate.** Do not hand-register an account. The auth screen has a **"Login as Guest"**
button (`data-testid="guest-login-button"`) — click it. It calls `devGuestLogin()`, stores the
token, and drops you on the inventory tab. Requires `DEV_GUEST_AUTH=true` in `.env`.

Only when you need a specific class or a stable identity across reloads, use the API path the
Playwright suite uses (`tests/e2e/utils/auth.ts`): `POST /v1/dev/guest-login` with
`{ guestId, class }`, write the returned `accessToken` to `localStorage` under
`ebonkeep.dev.token`, then reload. The nine valid class values are in `packages/shared/src/core`.

**Resolutions to check.** The client switches layout at hard breakpoints defined by
`getLayoutMode` in `apps/web/src/app/navigation.tsx`:

| Mode | Viewport width | Test at |
| --- | --- | --- |
| `compact` | `< 960` | 375x812 (mobile preset) |
| `standard` | `960`–`1399` | 1280x800 |
| `wide` | `>= 1400` | 1440x900 |

Mobile and desktop are both mandatory; `wide` is worth a look whenever the change touches
multi-column layout. Reload after resizing so any load-time layout decisions re-run.

**Prefer the accessibility tree** (`read_page`, `find`) over screenshots for locating elements
and asserting text — it is faster and more reliable. Use screenshots to judge visual layout,
spacing, and overflow, which the tree cannot show.

**Synthesized input is unreliable in the in-app Browser pane.** Clicking and typing time out after
30s whenever the hosted page reports `document.visibilityState === "hidden"`, which it does even
when the pane is displayed, fronted via `tabs_select`, and sized normally. Screenshots and all
reads (`read_page`, `get_page_text`, `javascript_tool`, `read_console_messages`) keep working, and
the page's main thread stays responsive — so a timeout here means input dispatch, not a hung app.
Check `document.visibilityState` before concluding anything else. Verification that depends on
multi-step interaction may need Playwright (`tests/e2e`) instead.

A quick overflow check that needs no screenshot:
`document.body.scrollWidth > window.innerWidth` — run it at each viewport.

Check the browser console for errors before calling a change verified. `ws://localhost:5173`
WebSocket failures are Vite HMR under the preview proxy, not the game socket
(`ws://localhost:4000/ws`) — ignore them.

Navigation elements carry `data-testid` (for example `menu-inventory`); most feature panels do
not. Add a `data-testid` when an element is genuinely hard to address semantically — not as a
routine habit.

## Architecture essentials

- **The server is the source of truth.** `PlayerState` is fetched and re-fetched after mutations.
  There are no save files; accounts and player profiles in Postgres are the save data.
- **The web client has no state library** (no zustand/redux/react-query/Context). `app/AppShell.tsx`
  holds nearly all client state in `useState` and threads it down as props. `src/App.tsx` is a thin
  shim, not the hotspot.
- **Web layering:** `app/` orchestration → `features/<domain>/` → `lib/`, `constants/`, `i18n/`,
  `generated/`. Each feature exposes a public `index.ts` barrel alongside its `<Domain>Panel.tsx`
  and feature-local `api.ts`; deep imports into another feature's internals are a lint error.
- **API layering:** one module per domain under `src/modules/*`, each owning its own routes and
  services. Keep changes inside the owning module; no cross-module leakage.
- **Contracts are Zod-first:** declare `xSchema`, then `export type X = z.infer<typeof xSchema>`.
  Schemas are the wire contract and are parsed on both ends. Percent-like values travel as basis
  points (`*Bps`).
- **Shared imports** use `@ebonkeep/shared/<domain>` or `@ebonkeep/shared/core`. The root barrel is
  compatibility-only and is lint-banned in web `app/**`, `features/**`, and `lib/**`.
  `shared/core` may not import `shared/domains`.
- **Styling** is plain global CSS (`apps/web/src/styles.css` plus per-feature `.css`). No Tailwind,
  no CSS modules, no CSS-in-JS.
- **i18n** is i18next with a single `common` namespace and 7 locales (`en`, `es-419`, `pt-BR`, `ru`,
  `fil`, `zh-CN`, `ko`) under `apps/web/src/i18n/locales/<code>/common.json`. The locale codes are
  canonical in `packages/shared/src/core`.

## Gotchas

- `apps/web/src/generated/*` and `packages/shared/src/domains/*/catalog.generated.ts` are generated,
  versioned output. Change the CSV in `docs/data` or the generator in `tools/`, then regenerate —
  never hand-edit the artifact.
- Prisma migrations are append-only: edit `apps/api/prisma/schema.prisma`, then add a new migration.
- CI runs only `npm run test:ci`, so lint and build regressions must be caught locally.
- If docs disagree with runtime code, treat current code + Prisma schema + shared contracts as
  implementation truth, and call out the mismatch.
- `.env` is gitignored and holds real secrets — do not echo or paste its contents.

## Further reading

`AGENTS.md` at the root is the detailed guide (repo map, "Open First By Task", full command list,
"Do Not" list, "Done When" criteria), with nested `AGENTS.md` files in `apps/api`, `apps/web`,
`apps/desktop`, `packages/shared`, and `tools`. See also `docs/00-index.md`,
`docs/codex-context-map.md`, and `docs/local-runtime.md`. Start narrow — do not preload large parts
of `docs/`.

## Working Agreement

1. Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
2. Simplest solution first. Always implement the simplest thing that could work. Do not add abstractions or flexibility that weren't explicitly requested.
3. Don't touch unrelated code. If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.
4. Flag uncertainty explicitly. If you are not confident about an approach or technical detail, say so before proceeding. Confidence without certainty causes more damage than admitting a gap.
5. Test the real UI, always. Any change touching the client must be verified by driving the running app in the browser, not by unit tests alone. See "Verifying UI work in a real browser" above.
6. Test mobile and desktop, always. Every UI change is checked at a mobile viewport and a desktop viewport before it is called done. A change that only works at one width is not done.
