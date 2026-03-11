import type { AccountOverviewResponse } from "@ebonkeep/shared/auth";
import type { SupportedLocale } from "@ebonkeep/shared/core";

import i18n from "../i18n";
import { LOCALE_OPTIONS, normalizeLocale } from "../i18n/supportedLocales";

export type SettingsPanelProps = {
  accountInfo: AccountOverviewResponse | null;
  preferredLocale: SupportedLocale;
  isSavingLocale: boolean;
  localeStatusMessage: string | null;
  onResendVerification: () => void;
  onLocaleChange: (locale: SupportedLocale) => void;
};

export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard">
          <h2>{i18n.t("settings.title")}</h2>
          <p>{i18n.t("settings.description")}</p>
        </article>
        {props.accountInfo && (
          <article className="contentCard">
            <h3 style={{ marginTop: 0 }}>{i18n.t("settings.accountInfo")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>{i18n.t("settings.username")}</span>
                <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "var(--text-main)" }}>{props.accountInfo.username || i18n.t("settings.notSet")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>{i18n.t("settings.email")}</span>
                <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "var(--text-main)" }}>{props.accountInfo.email || i18n.t("settings.notSet")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>{i18n.t("settings.emailVerified")}</span>
                <span style={{ flex: "0 0 60%", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: "bold", color: props.accountInfo.emailVerified ? "#6f8d5f" : "#97504a" }}>
                    {props.accountInfo.emailVerified ? i18n.t("settings.verified") : i18n.t("settings.notVerified")}
                  </span>
                  {!props.accountInfo.emailVerified && (
                    <button
                      onClick={props.onResendVerification}
                      style={{
                        padding: "4px 12px",
                        fontSize: "12px",
                        background: "var(--accent-focus)",
                        color: "var(--bg-stone)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600"
                      }}
                    >
                      {i18n.t("settings.resendEmail")}
                    </button>
                  )}
                </span>
              </div>
              {props.accountInfo.currency && (
                <>
                  <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(186, 166, 131, 0.14)" }}>
                    <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>{i18n.t("currencies.ducats")}</span>
                    <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "#be9651" }}>{props.accountInfo.currency.ducats.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
                    <span style={{ flex: "0 0 40%", color: "var(--text-muted)", fontSize: "14px" }}>{i18n.t("currencies.imperials")}</span>
                    <span style={{ flex: "0 0 60%", fontWeight: "bold", color: "#9d7bb8" }}>{props.accountInfo.currency.imperials.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </article>
        )}
        <article className="contentCard">
          <div className="settingsRow">
            <label htmlFor="language-select">{i18n.t("settings.languageLabel")}</label>
            <select
              id="language-select"
              value={props.preferredLocale}
              onChange={(event) => props.onLocaleChange(normalizeLocale(event.currentTarget.value))}
              disabled={props.isSavingLocale}
            >
              {LOCALE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.nativeName}
                </option>
              ))}
            </select>
          </div>
          {props.isSavingLocale ? <p>{i18n.t("settings.saving")}</p> : null}
          {props.localeStatusMessage ? <p>{props.localeStatusMessage}</p> : null}
        </article>
      </section>
    </section>
  );
}
