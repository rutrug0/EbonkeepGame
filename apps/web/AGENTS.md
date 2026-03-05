# Web Scope Guide

These instructions apply to `apps/web/**`.

## UI Consistency Rules
- Preserve established interaction patterns in `src/App.tsx` unless task explicitly requests redesign.
- Reuse shared visual systems from `src/styles.css` (buttons, tooltips, cards, rarity styling).
- Keep existing responsive behavior (`compact`, `standard`, `wide`) intact.

## Data and Contracts
- Treat `packages/shared/src/index.ts` as source of truth for typed API contracts.
- Keep frontend API adapters in `src/api.ts` aligned with shared schemas.

## Generated Assets
- Do not manually maintain generated icon maps unless requested.
- Prefer script-driven updates for generated manifests and art outputs.
- `src/generated/itemArtManifest.ts` is generated and should track pipeline outputs.

## Verification
- Prefer TypeScript check before broader build:
  - `cmd /d /s /c "cd apps\\web && node ..\\..\\node_modules\\typescript\\bin\\tsc -p tsconfig.json --noEmit"`

