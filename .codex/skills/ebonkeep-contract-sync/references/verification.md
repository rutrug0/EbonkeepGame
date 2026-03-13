# Verification

Use the narrowest checks that cover the touched surface, but preserve dependency order.

## Default Build Order

1. `npm.cmd --workspace @ebonkeep/shared run build`
2. `npm.cmd --workspace @ebonkeep/api run build` if API consumers changed
3. `npm.cmd --workspace @ebonkeep/web run build` if web consumers changed

## Targeted Tests

- Shared unit tests
  `npm.cmd --workspace @ebonkeep/shared run test:unit`
- API unit tests
  `npm.cmd --workspace @ebonkeep/api run test:unit`
- API integration tests
  `npm.cmd --workspace @ebonkeep/api run test:integration`
- Web unit tests
  `npm.cmd --workspace @ebonkeep/web run test:unit`
- Web locale validation
  `npm.cmd --workspace @ebonkeep/web run i18n:check`

## When To Escalate

- Run API integration tests when a route contract or persistence behavior changed.
- Run web unit tests when component state, parsing, or adapter logic changed.
- Run locale validation if any user-facing copy or locale definitions changed.
- If a local stack is already running and the contract affects runtime behavior, verify the smallest affected route or screen instead of stopping at static checks.
