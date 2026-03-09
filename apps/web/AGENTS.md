# Web Scope Guide

These instructions apply to `apps/web/**`.

## UI Consistency Rules
- Preserve established interaction patterns in `src/App.tsx` unless task explicitly requests redesign.
- Reuse shared visual systems from `src/styles.css` (buttons, tooltips, cards, rarity styling).
- Keep existing responsive behavior (`compact`, `standard`, `wide`) intact.
- `src/App.tsx` is a large prototype hotspot; keep diffs surgical and avoid opportunistic refactors or broad formatting churn.

## Data and Contracts
- Treat `packages/shared/src/index.ts` as source of truth for typed API contracts.
- Keep frontend API adapters in `src/api.ts` aligned with shared schemas.
- Prefer flowing network access through `src/api.ts` and shared helpers rather than adding new hardcoded fetch URLs in feature code.
- If a UI feature depends on shared contract changes, update shared types first and then adapt the web state/view logic.

## Generated Assets
- Generated icon maps, manifests, and encyclopedia data are versioned in git and should be refreshed when their upstream source data or generators change.
- Prefer script-driven updates for generated manifests and art outputs.
- `src/generated/itemArtManifest.ts` is generated and should track pipeline outputs.
- `src/generated/itemEncyclopediaData.ts` is generated data and should stay aligned with the current pipeline output.

## Localization
- Supported locales are defined in `packages/shared/src/index.ts` and `src/i18n/supportedLocales.ts`; keep them aligned.
- When adding user-facing copy, update the locale JSON files that already participate in the UI flow unless the task explicitly scopes to one locale only.

## Verification
- Prefer TypeScript check before broader build:
  - `cmd /d /s /c "cd apps\\web && node ..\\..\\node_modules\\typescript\\bin\\tsc -p tsconfig.json --noEmit"`
- Use the full web build when the change affects bundling, generated imports, or Vite-only behavior:
  - `npm.cmd --workspace @ebonkeep/web run build`
