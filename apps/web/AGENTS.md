# Web Scope Guide

These instructions apply to `apps/web/**`.

## Start Points
- App-layer orchestration lives in `src/app/AppShell.tsx` and `src/app/*`.
- Feature code lives in `src/features/{auth,player,profile,economy,combat,contracts,guild,leaderboard,auction}`.
- Generated outputs live in `src/generated/*`.
- `src/App.tsx` is only a thin entrypoint now.

## Structure Rules
- Keep app-shell concerns in `src/app`; move domain-specific UI/state/helpers into the owning `src/features/*` folder.
- Prefer feature-local API modules such as `src/features/*/api.ts`.
- `src/api.ts` is a compatibility barrel. Do not grow it with new logic.
- Preserve the current app/feature boundary rules enforced by ESLint. App-layer files should import feature entrypoints, not feature internals.

## Contracts And Imports
- Prefer `@ebonkeep/shared/<domain>` or `@ebonkeep/shared/core` imports in refactored web files.
- Keep frontend adapters aligned with shared domain contracts.
- Do not add new hardcoded fetch URLs in feature code; use existing feature API modules or `src/lib/api/system.ts`.

## Generated Assets And Localization
- Treat `src/generated/itemArtManifest.ts` and `src/generated/itemEncyclopediaData.ts` as generated, versioned outputs.
- Update generators or upstream source data first, then regenerate tracked outputs.
- Keep `src/i18n/supportedLocales.ts` aligned with shared locale definitions in `@ebonkeep/shared/core`.
- When adding user-facing copy, update the locale files participating in that flow.

## Verification
- Build/typecheck: `npm.cmd --workspace @ebonkeep/web run build`
- Unit tests: `npm.cmd --workspace @ebonkeep/web run test:unit`
- Lint: `npm.cmd --workspace @ebonkeep/web run lint`
- Locale validation when touching translations/locales: `npm.cmd --workspace @ebonkeep/web run i18n:check`
