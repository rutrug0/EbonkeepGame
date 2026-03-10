import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale } from "../src/i18n/supportedLocales";

describe("supportedLocales", () => {
  it("keeps supported locales unchanged", () => {
    expect(normalizeLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeLocale("ko")).toBe("ko");
  });

  it("falls back to the default locale for unsupported values", () => {
    expect(normalizeLocale("fr-FR")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(LOCALE_STORAGE_KEY).toBe("ebonkeep.settings.locale");
  });
});
