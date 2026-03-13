# Locale Surface

Use this file to find every place that must stay aligned when localization changes.

## Base Locale Files

- `apps/web/src/i18n/locales/en/common.json`
  Source of truth for key structure.
- `apps/web/src/i18n/locales/es-419/common.json`
- `apps/web/src/i18n/locales/pt-BR/common.json`
- `apps/web/src/i18n/locales/ru/common.json`
- `apps/web/src/i18n/locales/fil/common.json`
- `apps/web/src/i18n/locales/zh-CN/common.json`
- `apps/web/src/i18n/locales/ko/common.json`

## Locale Definition Surfaces

- `packages/shared/src/core/index.ts`
  `supportedLocaleSchema` and `SupportedLocale`
- `apps/web/src/i18n/supportedLocales.ts`
  locale options, default locale, storage key, normalization
- `apps/web/src/i18n/index.ts`
  imported locale resources, browser-locale mapping, runtime initialization

## Typical Change Paths

### Adding or renaming a translation key

1. Update `en/common.json`.
2. Update each translated `common.json`.
3. Run `npm.cmd --workspace @ebonkeep/web run i18n:check`.

### Adding a new locale

1. Extend `supportedLocaleSchema` in `packages/shared/src/core/index.ts`.
2. Add the locale to `apps/web/src/i18n/supportedLocales.ts`.
3. Add the import and resource entry in `apps/web/src/i18n/index.ts`.
4. Create the new `common.json`.
5. Run locale validation and the relevant builds.

### Fixing locale drift

Look for:
- keys present in non-English locale files but absent in English
- mismatched `{{token}}` placeholders
- resource map entries missing for a shipped locale
