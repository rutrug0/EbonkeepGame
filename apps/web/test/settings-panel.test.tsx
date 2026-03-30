import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) =>
      typeof options?.archetype === "string"
        ? `${key}:${options.archetype}`
        : key
  })
}));

vi.mock("../src/features/contracts/api", () => ({
  fetchDeveloperContractsStaticCurves: vi.fn().mockResolvedValue({
    levels: [
      {
        level: 1,
        averageTravelSeconds: 30,
        averageReplenishSeconds: 60,
        averageStaminaWaitSecondsForContract: 120,
        averageContractAvailabilityWaitSeconds: 18,
        averageExperiencePerContract: {
          under_level: 100,
          on_level: 120,
          over_level: 140
        },
        experienceToNextLevel: 250
      },
      {
        level: 2,
        averageTravelSeconds: 33,
        averageReplenishSeconds: 63,
        averageStaminaWaitSecondsForContract: 132,
        averageContractAvailabilityWaitSeconds: 19,
        averageExperiencePerContract: {
          under_level: 110,
          on_level: 130,
          over_level: 155
        },
        experienceToNextLevel: 300
      }
    ]
  }),
  runDeveloperContractSimulation: vi.fn().mockResolvedValue({
    jobId: "job_1",
    status: "completed",
    config: {
      playerClass: "juggernaut",
      sampleSize: 200,
      maxLevel: 2
    },
    progress: {
      totalSamples: 600,
      completedSamples: 600,
      currentArchetype: null,
      currentLevel: null,
      currentSampleIndex: null
    },
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    artifactPath: "D:\\Ebonkeep\\artifacts\\contracts-simulations\\contracts-simulation-job_1.json",
    error: null,
    result: {
      playerClass: "juggernaut",
      sampleSize: 200,
      maxLevel: 2,
      archetypes: [
        {
          archetype: "active",
          levels: [
            {
              level: 2,
              gearScore: 10,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 7200,
              avgActivePlaySecondsToClearLevel: 12,
              avgIdleSecondsToClearLevel: 7188,
              avgStaminaWaitSecondsToClearLevel: 4800,
              avgContractAvailabilityWaitSecondsToClearLevel: 1800,
              avgFightsToClearLevel: 2,
              avgWinsByBand: { under_level: 1, on_level: 0.5, over_level: 0.25 },
              avgLossesByBand: { under_level: 0, on_level: 0.5, over_level: 0.75 },
              winRateByBand: { under_level: 1, on_level: 0.5, over_level: 0.25 },
              avgXpPerFight: 100,
              avgStaminaSpent: 8,
              avgRestCount: 0,
              avgCombatSeconds: 7,
              avgInputOverheadSeconds: 5,
              avgPlayerAttackRoll: 31,
              avgPlayerHpLossPercent: 12,
              avgPlayerHpLossPercentByBand: { under_level: 5, on_level: 12, over_level: 19 }
            },
            {
              level: 3,
              gearScore: 20,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 10800,
              avgActivePlaySecondsToClearLevel: 18,
              avgIdleSecondsToClearLevel: 10782,
              avgStaminaWaitSecondsToClearLevel: 7200,
              avgContractAvailabilityWaitSecondsToClearLevel: 2100,
              avgFightsToClearLevel: 3,
              avgWinsByBand: { under_level: 1, on_level: 0.5, over_level: 0.5 },
              avgLossesByBand: { under_level: 0, on_level: 0.5, over_level: 0.5 },
              winRateByBand: { under_level: 1, on_level: 0.5, over_level: 0.5 },
              avgXpPerFight: 120,
              avgStaminaSpent: 10,
              avgRestCount: 1,
              avgCombatSeconds: 10,
              avgInputOverheadSeconds: 5,
              avgPlayerAttackRoll: 36,
              avgPlayerHpLossPercent: 18,
              avgPlayerHpLossPercentByBand: { under_level: 6, on_level: 13, over_level: 22 }
            }
          ],
          benchmarkTargetBandHitRateByBand: { under_level: 1, on_level: 0.5, over_level: 0.5 }
        },
        {
          archetype: "average",
          levels: [
            {
              level: 2,
              gearScore: 10,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 9800,
              avgActivePlaySecondsToClearLevel: 20,
              avgIdleSecondsToClearLevel: 9780,
              avgStaminaWaitSecondsToClearLevel: 4200,
              avgContractAvailabilityWaitSecondsToClearLevel: 2600,
              avgFightsToClearLevel: 3,
              avgWinsByBand: { under_level: 1, on_level: 0.5, over_level: 0 },
              avgLossesByBand: { under_level: 0, on_level: 0.5, over_level: 1 },
              winRateByBand: { under_level: 1, on_level: 0.5, over_level: 0 },
              avgXpPerFight: 80,
              avgStaminaSpent: 8,
              avgRestCount: 1,
              avgCombatSeconds: 9,
              avgInputOverheadSeconds: 15,
              avgPlayerAttackRoll: 26,
              avgPlayerHpLossPercent: 19,
              avgPlayerHpLossPercentByBand: { under_level: 7, on_level: 14, over_level: 21 }
            },
            {
              level: 3,
              gearScore: 20,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 15400,
              avgActivePlaySecondsToClearLevel: 28,
              avgIdleSecondsToClearLevel: 15372,
              avgStaminaWaitSecondsToClearLevel: 6300,
              avgContractAvailabilityWaitSecondsToClearLevel: 3400,
              avgFightsToClearLevel: 4,
              avgWinsByBand: { under_level: 1, on_level: 0.5, over_level: 0.1 },
              avgLossesByBand: { under_level: 0, on_level: 0.5, over_level: 0.9 },
              winRateByBand: { under_level: 1, on_level: 0.5, over_level: 0.1 },
              avgXpPerFight: 90,
              avgStaminaSpent: 10,
              avgRestCount: 1,
              avgCombatSeconds: 13,
              avgInputOverheadSeconds: 15,
              avgPlayerAttackRoll: 28,
              avgPlayerHpLossPercent: 24,
              avgPlayerHpLossPercentByBand: { under_level: 8, on_level: 15, over_level: 24 }
            }
          ],
          benchmarkTargetBandHitRateByBand: { under_level: 0.8, on_level: 1, over_level: 0.5 }
        },
        {
          archetype: "slow",
          levels: [
            {
              level: 2,
              gearScore: 10,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 14400,
              avgActivePlaySecondsToClearLevel: 30,
              avgIdleSecondsToClearLevel: 14370,
              avgStaminaWaitSecondsToClearLevel: 3100,
              avgContractAvailabilityWaitSecondsToClearLevel: 4700,
              avgFightsToClearLevel: 4,
              avgWinsByBand: { under_level: 1, on_level: 0.2, over_level: 0 },
              avgLossesByBand: { under_level: 0, on_level: 0.8, over_level: 1 },
              winRateByBand: { under_level: 1, on_level: 0.2, over_level: 0 },
              avgXpPerFight: 70,
              avgStaminaSpent: 8,
              avgRestCount: 1,
              avgCombatSeconds: 10,
              avgInputOverheadSeconds: 30,
              avgPlayerAttackRoll: 21,
              avgPlayerHpLossPercent: 27,
              avgPlayerHpLossPercentByBand: { under_level: 9, on_level: 16, over_level: 26 }
            },
            {
              level: 3,
              gearScore: 20,
              completedSamples: 200,
              completionRate: 1,
              avgElapsedSecondsToClearLevel: 21600,
              avgActivePlaySecondsToClearLevel: 42,
              avgIdleSecondsToClearLevel: 21558,
              avgStaminaWaitSecondsToClearLevel: 4600,
              avgContractAvailabilityWaitSecondsToClearLevel: 6900,
              avgFightsToClearLevel: 5,
              avgWinsByBand: { under_level: 1, on_level: 0.25, over_level: 0 },
              avgLossesByBand: { under_level: 0, on_level: 0.75, over_level: 1 },
              winRateByBand: { under_level: 1, on_level: 0.25, over_level: 0 },
              avgXpPerFight: 75,
              avgStaminaSpent: 10,
              avgRestCount: 2,
              avgCombatSeconds: 14,
              avgInputOverheadSeconds: 30,
              avgPlayerAttackRoll: 22,
              avgPlayerHpLossPercent: 31,
              avgPlayerHpLossPercentByBand: { under_level: 10, on_level: 18, over_level: 28 }
            }
          ],
          benchmarkTargetBandHitRateByBand: { under_level: 0.7, on_level: 0.5, over_level: 0.2 }
        }
      ]
    }
  }),
  fetchDeveloperContractSimulation: vi.fn()
}));

vi.mock("../src/lib/api/system", () => ({
  fetchReady: vi.fn(),
  fetchObservabilityStatus: vi.fn().mockResolvedValue({
    status: "ok",
    checkedAt: new Date().toISOString(),
    grafanaCredentials: "admin / admin",
    services: {
      apiMetrics: {
        status: "ready",
        url: "http://localhost:4000/metrics",
        detail: "Fastify exposes /metrics for Prometheus scraping."
      },
      prometheus: {
        status: "ready",
        url: "http://localhost:9090/targets?search=ebonkeep-api",
        detail: "Prometheus is up and scraping the ebonkeep-api target.",
        apiScrapeHealthy: true
      },
      grafana: {
        status: "ready",
        url: "http://localhost:3000/d/ebonkeep-api-v1/ebonkeep-api?orgId=1",
        detail: "Grafana is up and the local Ebonkeep API dashboard is available."
      },
      loki: {
        status: "ready",
        url: "http://localhost:3000/explore?orgId=1",
        detail: "Loki is up and API logs are configured for shipping."
      }
    }
  }),
  getWsUrl: () => "ws://localhost:4000/ws"
}));

import type { AccountOverviewResponse } from "@ebonkeep/shared/auth";

import { SettingsPanel } from "../src/app/SettingsPanel";
import { DeveloperContractsSimulationPanel } from "../src/features/contracts/DeveloperContractsSimulationPanel";

function createAccountInfo(): AccountOverviewResponse {
  return {
    accountId: "acct_1",
    username: "warden",
    email: "warden@example.com",
    emailVerified: true,
    developerToolsEnabled: true,
    provider: "dev-guest",
    createdAt: new Date().toISOString(),
    profile: null,
    currency: null
  };
}

describe("settings developer simulation", () => {
  it("renders monitoring status cards", async () => {
    render(
      <SettingsPanel
        accountInfo={createAccountInfo()}
        preferredLocale="en"
        isSavingLocale={false}
        localeStatusMessage={null}
        onResendVerification={() => {}}
        onLocaleChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Grafana")).not.toBeNull();
      expect(screen.getByText("Prometheus is up and scraping the ebonkeep-api target.")).not.toBeNull();
      expect(screen.getByText("Open Loki Logs")).not.toBeNull();
    });
  });

  it("renders the developer tools panel when provided", () => {
    render(
      <SettingsPanel
        accountInfo={createAccountInfo()}
        preferredLocale="en"
        isSavingLocale={false}
        localeStatusMessage={null}
        onResendVerification={() => {}}
        onLocaleChange={() => {}}
        developerToolsPanel={<div data-testid="developer-tools-panel" />}
      />
    );

    expect(screen.getByTestId("developer-tools-panel")).not.toBeNull();
  });

  it("runs the developer contracts simulation and renders charts", async () => {
    render(<DeveloperContractsSimulationPanel token="token" initialPlayerClass="juggernaut" />);

    fireEvent.click(screen.getByText("settings.simulation.run"));

    await waitFor(() => {
      expect(screen.getByTestId("developer-sim-elapsed-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-cumulative-elapsed-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-idle-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-active-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-stamina-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-contract-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-fights-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-completion-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-gear-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-player-attack-roll-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-player-hp-loss-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-under-level-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-on-level-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-over-level-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-travel-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-replenish-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-stamina-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-contract-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-xp-contract-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-xp-required-chart")).not.toBeNull();
    });
  });
});
