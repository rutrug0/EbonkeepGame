import { supportedLocaleSchema, type SupportedLocale } from "@ebonkeep/shared";

export type LocaleOption = {
  code: SupportedLocale;
  nativeName: string;
  englishName: string;
};

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "es-419", nativeName: "Español (LatAm)", englishName: "Spanish (LatAm)" },
  { code: "pt-BR", nativeName: "Português (Brasil)", englishName: "Portuguese (Brazil)" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino" },
  { code: "zh-CN", nativeName: "简体中文", englishName: "Chinese (Simplified)" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" }
];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const LOCALE_STORAGE_KEY = "ebonkeep.settings.locale";

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  const parsed = supportedLocaleSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  return DEFAULT_LOCALE;
}
