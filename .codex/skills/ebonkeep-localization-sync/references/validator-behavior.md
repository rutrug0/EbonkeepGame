# Validator Behavior

This skill relies on `tools/validate_locales.mjs`.

## What The Validator Uses As Baseline

- Base schema: `apps/web/src/i18n/locales/en/common.json`
- Other locale folders: every directory under `apps/web/src/i18n/locales` except `en`

## What It Checks

- Missing keys relative to English
- Extra keys that exist only in a translated locale
- Interpolation token mismatches such as `{{count}}` in English versus `{{value}}` in another locale

## What Fails The Command

The command currently exits non-zero when either of these is true:
- a locale has extra keys
- a locale has interpolation-token mismatches

Missing keys are reported in the coverage output but do not currently fail the command.

## Practical Rule

Do not treat a green validator run as proof that localization is complete. It only proves there are no extra keys or token mismatches according to the current script.
