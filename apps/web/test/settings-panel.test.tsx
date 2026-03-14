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
          easy: 100,
          medium: 120,
          hard: 140
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
          easy: 110,
          medium: 130,
          hard: 155
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
              avgWinsByDifficulty: { easy: 1, medium: 0.5, hard: 0.25 },
              avgLossesByDifficulty: { easy: 0, medium: 0.5, hard: 0.75 },
              winRateByDifficulty: { easy: 1, medium: 0.5, hard: 0.25 },
              avgXpPerFight: 100,
              avgStaminaSpent: 8,
              avgRestCount: 0,
              avgCombatSeconds: 7,
              avgInputOverheadSeconds: 5,
              avgPlayerAttackRoll: 31,
              avgPlayerHpLossPercent: 12,
              avgPlayerHpLossPercentByDifficulty: { easy: 5, medium: 12, hard: 19 }
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
              avgWinsByDifficulty: { easy: 1, medium: 0.5, hard: 0.5 },
              avgLossesByDifficulty: { easy: 0, medium: 0.5, hard: 0.5 },
              winRateByDifficulty: { easy: 1, medium: 0.5, hard: 0.5 },
              avgXpPerFight: 120,
              avgStaminaSpent: 10,
              avgRestCount: 1,
              avgCombatSeconds: 10,
              avgInputOverheadSeconds: 5,
              avgPlayerAttackRoll: 36,
              avgPlayerHpLossPercent: 18,
              avgPlayerHpLossPercentByDifficulty: { easy: 6, medium: 13, hard: 22 }
            }
          ],
          benchmarkTargetBandHitRateByDifficulty: { easy: 1, medium: 0.5, hard: 0.5 }
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
              avgWinsByDifficulty: { easy: 1, medium: 0.5, hard: 0 },
              avgLossesByDifficulty: { easy: 0, medium: 0.5, hard: 1 },
              winRateByDifficulty: { easy: 1, medium: 0.5, hard: 0 },
              avgXpPerFight: 80,
              avgStaminaSpent: 8,
              avgRestCount: 1,
              avgCombatSeconds: 9,
              avgInputOverheadSeconds: 15,
              avgPlayerAttackRoll: 26,
              avgPlayerHpLossPercent: 19,
              avgPlayerHpLossPercentByDifficulty: { easy: 7, medium: 14, hard: 21 }
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
              avgWinsByDifficulty: { easy: 1, medium: 0.5, hard: 0.1 },
              avgLossesByDifficulty: { easy: 0, medium: 0.5, hard: 0.9 },
              winRateByDifficulty: { easy: 1, medium: 0.5, hard: 0.1 },
              avgXpPerFight: 90,
              avgStaminaSpent: 10,
              avgRestCount: 1,
              avgCombatSeconds: 13,
              avgInputOverheadSeconds: 15,
              avgPlayerAttackRoll: 28,
              avgPlayerHpLossPercent: 24,
              avgPlayerHpLossPercentByDifficulty: { easy: 8, medium: 15, hard: 24 }
            }
          ],
          benchmarkTargetBandHitRateByDifficulty: { easy: 0.8, medium: 1, hard: 0.5 }
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
              avgWinsByDifficulty: { easy: 1, medium: 0.2, hard: 0 },
              avgLossesByDifficulty: { easy: 0, medium: 0.8, hard: 1 },
              winRateByDifficulty: { easy: 1, medium: 0.2, hard: 0 },
              avgXpPerFight: 70,
              avgStaminaSpent: 8,
              avgRestCount: 1,
              avgCombatSeconds: 10,
              avgInputOverheadSeconds: 30,
              avgPlayerAttackRoll: 21,
              avgPlayerHpLossPercent: 27,
              avgPlayerHpLossPercentByDifficulty: { easy: 9, medium: 16, hard: 26 }
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
              avgWinsByDifficulty: { easy: 1, medium: 0.25, hard: 0 },
              avgLossesByDifficulty: { easy: 0, medium: 0.75, hard: 1 },
              winRateByDifficulty: { easy: 1, medium: 0.25, hard: 0 },
              avgXpPerFight: 75,
              avgStaminaSpent: 10,
              avgRestCount: 2,
              avgCombatSeconds: 14,
              avgInputOverheadSeconds: 30,
              avgPlayerAttackRoll: 22,
              avgPlayerHpLossPercent: 31,
              avgPlayerHpLossPercentByDifficulty: { easy: 10, medium: 18, hard: 28 }
            }
          ],
          benchmarkTargetBandHitRateByDifficulty: { easy: 0.7, medium: 0.5, hard: 0.2 }
        }
      ]
    }
  }),
  fetchDeveloperContractSimulation: vi.fn()
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
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-easy-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-medium-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-sim-benchmark-hp-loss-hard-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-travel-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-replenish-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-stamina-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-contract-wait-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-xp-contract-chart")).not.toBeNull();
      expect(screen.getByTestId("developer-static-xp-required-chart")).not.toBeNull();
    });
  });
});
