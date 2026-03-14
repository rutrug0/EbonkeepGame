import { describe, expect, it } from "vitest";

import {
  accountOverviewResponseSchema,
  developerContractsStaticCurvesResponseSchema,
  developerContractSimulationJobSchema,
  leaderboardTypeSchema as compatibilityLeaderboardTypeSchema,
  getAllowedClassesForArchetype,
  isItemUsableByClass,
  runDeveloperContractSimulationBodySchema,
  validateVestigeLoadout
} from "../src/index.js";
import { leaderboardTypeSchema } from "../src/domains/leaderboard/index.js";
import { supportedLocaleSchema } from "../src/core/index.js";

describe("shared contracts", () => {
  it("maps archetypes to allowed classes", () => {
    // armor archetypes grouped by equipment group (weapon stat)
    expect(getAllowedClassesForArchetype("armor", "heavy")).toEqual(["juggernaut", "arbalist", "runecaster"]);
    expect(getAllowedClassesForArchetype("weapon", "arcane")).toEqual(["runecaster", "chronomancer", "arcanist"]);
    expect(getAllowedClassesForArchetype("jewelry")).toEqual([
      "juggernaut", "sentinel", "reaver",
      "shade", "arbalist", "disciple",
      "runecaster", "chronomancer", "arcanist"
    ]);
  });

  it("checks whether an item is usable by a class", () => {
    expect(isItemUsableByClass("juggernaut", "weapon", "melee")).toBe(true);
    expect(isItemUsableByClass("juggernaut", "weapon", "arcane")).toBe(false);
    expect(isItemUsableByClass("arcanist", "jewelry")).toBe(true);
  });

  it("validates vestige loadout size and duplicates", () => {
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light"])).toEqual({ valid: true });
    expect(validateVestigeLoadout(["ashen-sovereign", "ashen-sovereign"])).toEqual({
      valid: false,
      reason: "duplicate_vestige"
    });
    expect(validateVestigeLoadout(["ashen-sovereign", "emberwake", "first-light", "hollow-star"])).toEqual({
      valid: false,
      reason: "max_vestiges_exceeded"
    });
  });

  it("exposes domain entrypoints directly", () => {
    expect(supportedLocaleSchema.options).toContain("en");
    expect(leaderboardTypeSchema.options).toEqual(["power", "level"]);
  });

  it("keeps the root barrel as a compatibility re-export", () => {
    expect(compatibilityLeaderboardTypeSchema).toBe(leaderboardTypeSchema);
  });

  it("parses the developer tools account flag", () => {
    expect(accountOverviewResponseSchema.parse({
      accountId: "acct_1",
      username: "warden",
      email: "warden@example.com",
      emailVerified: true,
      developerToolsEnabled: true,
      provider: "dev-guest",
      createdAt: new Date().toISOString(),
      profile: null,
      currency: null
    }).developerToolsEnabled).toBe(true);
  });

  it("parses contracts simulation requests and completed jobs", () => {
    const body = runDeveloperContractSimulationBodySchema.parse({
      playerClass: "juggernaut"
    });

    expect(body.sampleSize).toBe(200);
    expect(
      developerContractSimulationJobSchema.parse({
        jobId: "job_1",
        status: "completed",
        config: {
          playerClass: "juggernaut",
          sampleSize: 200,
          maxLevel: 3
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
          maxLevel: 3,
          archetypes: [
            {
              archetype: "active",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgLossesByDifficulty: { easy: 0, medium: 0, hard: 1 },
                  winRateByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgXpPerFight: 100,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerHpLossPercentByDifficulty: { easy: 6, medium: 12, hard: 20 }
                }
              ],
              benchmarkTargetBandHitRateByDifficulty: { easy: 1, medium: 0.5, hard: 0.25 }
            },
            {
              archetype: "average",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgLossesByDifficulty: { easy: 0, medium: 0, hard: 1 },
                  winRateByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgXpPerFight: 100,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerHpLossPercentByDifficulty: { easy: 7, medium: 13, hard: 21 }
                }
              ],
              benchmarkTargetBandHitRateByDifficulty: { easy: 0.8, medium: 0.6, hard: 0.3 }
            },
            {
              archetype: "slow",
              levels: [
                {
                  level: 1,
                  gearScore: 42,
                  completedSamples: 200,
                  completionRate: 1,
                  avgElapsedSecondsToClearLevel: 20,
                  avgActivePlaySecondsToClearLevel: 10,
                  avgIdleSecondsToClearLevel: 10,
                  avgStaminaWaitSecondsToClearLevel: 4,
                  avgContractAvailabilityWaitSecondsToClearLevel: 6,
                  avgFightsToClearLevel: 2,
                  avgWinsByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgLossesByDifficulty: { easy: 0, medium: 0, hard: 1 },
                  winRateByDifficulty: { easy: 1, medium: 1, hard: 0 },
                  avgXpPerFight: 100,
                  avgStaminaSpent: 8,
                  avgRestCount: 0,
                  avgCombatSeconds: 5,
                  avgInputOverheadSeconds: 5,
                  avgPlayerAttackRoll: 23,
                  avgPlayerHpLossPercent: 18,
                  avgPlayerHpLossPercentByDifficulty: { easy: 8, medium: 14, hard: 24 }
                }
              ],
              benchmarkTargetBandHitRateByDifficulty: { easy: 0.7, medium: 0.5, hard: 0.4 }
            }
          ]
        }
      }).status
    ).toBe("completed");
  });

  it("parses developer contracts static curves", () => {
    expect(
      developerContractsStaticCurvesResponseSchema.parse({
        levels: [
          {
            level: 1,
            averageTravelSeconds: 30,
            averageReplenishSeconds: 60,
            averageStaminaWaitSecondsForContract: 120,
            averageContractAvailabilityWaitSeconds: 20,
            averageExperiencePerContract: {
              easy: 100,
              medium: 125,
              hard: 150
            },
            experienceToNextLevel: 250
          }
        ]
      }).levels
    ).toHaveLength(1);
  });
});
