# Shared Contracts Guide

These instructions apply to `packages/shared/**`.

## Ownership
- `src/index.ts` is the API/web contract source of truth for shared schemas, types, enums, and constants.
- Prefer changing shared contracts here before updating API or web consumers.

## Change Rules
- Prefer additive changes over breaking renames or removals unless the task explicitly requires a contract break.
- Keep Zod schemas, exported TypeScript types, and related constants aligned in the same edit.
- Be careful with enum changes; adding or renaming values can affect persisted data, API validation, and localization.

## Coordination
- After changing shared contracts, update all impacted API route handlers, frontend adapters, and UI assumptions in the same task when feasible.
- If the repo docs still describe an older contract shape, call out the mismatch instead of silently treating docs as runtime truth.

## Verification
- `npm.cmd --workspace @ebonkeep/shared run build`
- Prefer building dependent API/web surfaces too when the change is consumed outside this package.
