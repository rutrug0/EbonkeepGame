---
name: ebonkeep-localization-sync
description: Keep Ebonkeep's web localization files, shared locale definitions, and validation behavior aligned. Use when adding or renaming translation keys, updating user-facing copy, changing supported locales, wiring new UI text into the web app, or fixing locale validation issues under apps/web/src/i18n and tools/validate_locales.mjs.
---

# Ebonkeep Localization Sync

Use this skill when touching user-facing copy in the web app. The goal is to keep locale keys, interpolation tokens, supported-locale definitions, and validation behavior aligned across the shared package and the web client.

## Workflow

1. Decide which kind of localization change you are making.
   For new or updated copy, start in `apps/web/src/i18n/locales/en/common.json`.
   For locale availability changes, also inspect `packages/shared/src/core/index.ts`, `apps/web/src/i18n/supportedLocales.ts`, and `apps/web/src/i18n/index.ts`.

2. Apply the English source-of-truth change first.
   Add or rename the key in `en/common.json`.
   Keep interpolation placeholders stable and intentional.

3. Propagate the change to every shipped locale.
   Update `es-419`, `pt-BR`, `ru`, `fil`, `zh-CN`, and `ko`.
   Read [references/locale-surface.md](./references/locale-surface.md) for the exact file list.

4. Verify tokens and structure.
   `tools/validate_locales.mjs` fails on extra keys and interpolation-token mismatches.
   It reports missing-key coverage, but missing keys do not currently fail the command. Treat missing translations as work still to do unless the task explicitly allows partial coverage.

5. Run the web locale check.
   Execute `npm.cmd --workspace @ebonkeep/web run i18n:check`.
   If locale definitions changed, build the touched packages after the validator passes.

## Decision Points

### Copy-only change

Touch `en/common.json` and the translated `common.json` files. Then run `i18n:check`.

### New interpolation variables

Update every locale string to use the same `{{token}}` names as English. The validator is strict about token set equality.

### Supported locale changes

Change all three surfaces together:
- `packages/shared/src/core/index.ts`
- `apps/web/src/i18n/supportedLocales.ts`
- `apps/web/src/i18n/index.ts`

Do not add a locale folder without also updating shared definitions and the loaded resource map.

## Repo Rules To Enforce

- Keep web locale options aligned with the shared `SupportedLocale` schema.
- Treat `apps/web/src/i18n/locales/en/common.json` as the base schema for keys.
- Update all participating locales for touched user-facing copy.
- Prefer fixing stale or extra locale keys rather than leaving drift for later.

## References

- [references/locale-surface.md](./references/locale-surface.md): files and commands involved in localization changes
- [references/validator-behavior.md](./references/validator-behavior.md): exact checks enforced by `tools/validate_locales.mjs`
