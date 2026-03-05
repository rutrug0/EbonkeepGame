import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import type { SupportedLocale } from "@ebonkeep/shared";

import enCommon from "./locales/en/common.json";
import es419Common from "./locales/es-419/common.json";
import filCommon from "./locales/fil/common.json";
import koCommon from "./locales/ko/common.json";
import ptBrCommon from "./locales/pt-BR/common.json";
import ruCommon from "./locales/ru/common.json";
import zhCnCommon from "./locales/zh-CN/common.json";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale } from "./supportedLocales";

const resources = {
  en: { common: enCommon },
  "es-419": { common: es419Common },
  "pt-BR": { common: ptBrCommon },
  ru: { common: ruCommon },
  fil: { common: filCommon },
  "zh-CN": { common: zhCnCommon },
  ko: { common: koCommon }
} as const;

function mapBrowserLocale(languageTag: string | undefined): SupportedLocale {
  if (!languageTag) {
    return DEFAULT_LOCALE;
  }
  const normalized = languageTag.toLowerCase();
  if (normalized.startsWith("es")) {
    return "es-419";
  }
  if (normalized.startsWith("pt")) {
    return "pt-BR";
  }
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("fil") || normalized.startsWith("tl")) {
    return "fil";
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("ko")) {
    return "ko";
  }
  return DEFAULT_LOCALE;
}

function resolveInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  const cachedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (cachedLocale) {
    return normalizeLocale(cachedLocale);
  }
  return mapBrowserLocale(window.navigator.language);
}

const initialLocale = resolveInitialLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  ns: ["common"],
  defaultNS: "common",
  interpolation: {
    escapeValue: false
  },
  returnNull: false
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLocale;
}

export function setLocale(locale: SupportedLocale): void {
  void i18n.changeLanguage(locale);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export default i18n;
