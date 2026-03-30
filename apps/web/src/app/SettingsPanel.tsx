import { useEffect, useState, type ReactNode } from "react";

import type { AccountOverviewResponse } from "@ebonkeep/shared/auth";
import type { SupportedLocale } from "@ebonkeep/shared/core";

import i18n from "../i18n";
import { fetchObservabilityStatus, type ObservabilityServiceSnapshot, type ObservabilityStatusResponse } from "../lib/api/system";
import { LOCALE_OPTIONS, normalizeLocale } from "../i18n/supportedLocales";

export type SettingsPanelProps = {
  accountInfo: AccountOverviewResponse | null;
  preferredLocale: SupportedLocale;
  isSavingLocale: boolean;
  localeStatusMessage: string | null;
  onResendVerification: () => void;
  onLocaleChange: (locale: SupportedLocale) => void;
  cheatsPanel?: ReactNode;
  developerToolsPanel?: ReactNode;
};

const monitoringStatusStyles = {
  ready: {
    color: "#7ebf7a",
    border: "1px solid rgba(126, 191, 122, 0.32)",
    background: "rgba(58, 94, 56, 0.22)"
  },
  degraded: {
    color: "#d6b36b",
    border: "1px solid rgba(214, 179, 107, 0.32)",
    background: "rgba(110, 78, 29, 0.24)"
  },
  down: {
    color: "#e07e74",
    border: "1px solid rgba(224, 126, 116, 0.28)",
    background: "rgba(112, 39, 35, 0.22)"
  }
} as const;

function getMonitoringStatusLabel(status: ObservabilityServiceSnapshot["status"]) {
  switch (status) {
    case "ready":
      return i18n.t("settings.monitoringReady");
    case "degraded":
      return i18n.t("settings.monitoringDegraded");
    default:
      return i18n.t("settings.monitoringDown");
  }
}

function MonitoringCard(args: {
  title: string;
  service: ObservabilityServiceSnapshot;
  actionLabel: string;
}) {
  const statusStyle = monitoringStatusStyles[args.service.status];

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "14px",
        borderRadius: "12px",
        border: "1px solid rgba(186, 166, 131, 0.16)",
        background: "rgba(13, 17, 24, 0.48)",
        minHeight: "148px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <strong style={{ fontSize: "15px" }}>{args.title}</strong>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "86px",
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            ...statusStyle
          }}
        >
          {getMonitoringStatusLabel(args.service.status)}
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>
        {args.service.detail}
      </p>
      <a
        href={args.service.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          marginTop: "auto",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(186, 166, 131, 0.25)",
          color: "var(--text-main)",
          background: "rgba(186, 166, 131, 0.10)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "13px"
        }}
      >
        {args.actionLabel}
      </a>
    </article>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"general" | "cheats">("general");
  const [observability, setObservability] = useState<ObservabilityStatusResponse | null>(null);
  const [isObservabilityLoading, setIsObservabilityLoading] = useState(true);
  const [observabilityError, setObservabilityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadObservability() {
      try {
        const next = await fetchObservabilityStatus();
        if (cancelled) {
          return;
        }
        setObservability(next);
        setObservabilityError(null);
      } catch {
        if (cancelled) {
          return;
        }
        setObservabilityError(i18n.t("settings.monitoringStatusFailed"));
      } finally {
        if (!cancelled) {
          setIsObservabilityLoading(false);
        }
      }
    }

    void loadObservability();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefreshObservability() {
    setIsObservabilityLoading(true);
    try {
      const next = await fetchObservabilityStatus();
      setObservability(next);
      setObservabilityError(null);
    } catch {
      setObservabilityError(i18n.t("settings.monitoringStatusFailed"));
    } finally {
      setIsObservabilityLoading(false);
    }
  }

  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard">
          <h2>{i18n.t("settings.title")}</h2>
          <p>{i18n.t("settings.description")}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              aria-pressed={activeTab === "general"}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: activeTab === "general" ? "1px solid rgba(186, 166, 131, 0.48)" : "1px solid rgba(186, 166, 131, 0.18)",
                background: activeTab === "general" ? "rgba(186, 166, 131, 0.16)" : "rgba(24, 22, 19, 0.66)",
                color: "var(--text-main)",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              {i18n.t("settings.tabs.general")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cheats")}
              aria-pressed={activeTab === "cheats"}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: activeTab === "cheats" ? "1px solid rgba(186, 166, 131, 0.48)" : "1px solid rgba(186, 166, 131, 0.18)",
                background: activeTab === "cheats" ? "rgba(186, 166, 131, 0.16)" : "rgba(24, 22, 19, 0.66)",
                color: "var(--text-main)",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              {i18n.t("settings.tabs.cheats")}
            </button>
          </div>
        </article>
        {activeTab === "general" ? (
          <>
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
                        <span className="ducatsAmount" style={{ flex: "0 0 60%", fontWeight: "bold" }}>{props.accountInfo.currency.ducats.toLocaleString()}</span>
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
              <h3 style={{ marginTop: 0 }}>{i18n.t("settings.monitoring")}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: 0, marginBottom: "16px" }}>
                {i18n.t("settings.monitoringDesc")}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
                  {observability
                    ? `${i18n.t("settings.monitoringCredentials")} ${observability.grafanaCredentials}`
                    : i18n.t("settings.monitoringChecking")}
                </p>
                <button
                  type="button"
                  onClick={() => void handleRefreshObservability()}
                  disabled={isObservabilityLoading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(186, 166, 131, 0.22)",
                    background: "rgba(24, 22, 19, 0.66)",
                    color: "var(--text-main)",
                    cursor: isObservabilityLoading ? "progress" : "pointer",
                    fontWeight: 600
                  }}
                >
                  {i18n.t("settings.monitoringRefresh")}
                </button>
              </div>
              {observabilityError ? (
                <p style={{ color: "#e07e74", fontSize: "13px", marginTop: 0 }}>
                  {observabilityError}
                </p>
              ) : null}
              {isObservabilityLoading && !observability ? (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: 0 }}>
                  {i18n.t("settings.monitoringChecking")}
                </p>
              ) : null}
              {observability ? (
                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <MonitoringCard
                    title="Grafana"
                    service={observability.services.grafana}
                    actionLabel={i18n.t("settings.openGrafana")}
                  />
                  <MonitoringCard
                    title="Prometheus"
                    service={observability.services.prometheus}
                    actionLabel={i18n.t("settings.openPrometheus")}
                  />
                  <MonitoringCard
                    title="API Metrics"
                    service={observability.services.apiMetrics}
                    actionLabel={i18n.t("settings.openApiMetrics")}
                  />
                  <MonitoringCard
                    title="Loki"
                    service={observability.services.loki}
                    actionLabel={i18n.t("settings.openLoki")}
                  />
                </div>
              ) : null}
            </article>
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
            {props.developerToolsPanel}
          </>
        ) : (
          props.cheatsPanel ?? (
            <article className="contentCard">
              <h3 style={{ marginTop: 0 }}>{i18n.t("settings.tabs.cheats")}</h3>
              <p>{i18n.t("settings.cheats.unavailable")}</p>
            </article>
          )
        )}
      </section>
    </section>
  );
}
