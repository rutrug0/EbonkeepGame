import { readFile, rm } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeveloperContractSimulationJob,
  getDeveloperContractSimulationJob,
  resetDeveloperContractSimulationJobsForTests,
  runDeveloperContractSimulationToArtifact,
  simulateDeveloperContractProgression
} from "../../src/modules/contracts/developer-simulation.js";

afterEach(() => {
  vi.restoreAllMocks();
  resetDeveloperContractSimulationJobsForTests();
});

describe("contracts developer simulation", () => {
  it("is deterministic for the same input", async () => {
    const first = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 3
      }
    });
    const second = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 3
      }
    });

    expect(second).toEqual(first);
    expect(first.archetypes).toHaveLength(3);
    expect(first.archetypes[0]?.levels.map((level) => level.level)).toEqual([2, 3]);
    expect(first.archetypes[0]?.levels[0]?.avgElapsedSecondsToClearLevel).toBeGreaterThan(
      first.archetypes[0]?.levels[0]?.avgActivePlaySecondsToClearLevel ?? 0
    );
    expect(first.archetypes[0]?.levels[0]?.avgActivePlaySecondsToClearLevel).toBeGreaterThan(0);
    expect(first.archetypes[0]?.levels[0]?.avgIdleSecondsToClearLevel).toBeGreaterThanOrEqual(0);
    expect(first.archetypes[0]?.levels[0]?.completionRate).toBe(1);
  });

  it("keeps late-level slow samples numerically stable", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 60
      }
    });

    const slow = result.archetypes.find((entry) => entry.archetype === "slow");
    const finalLevels = slow?.levels.filter((level) => level.level >= 58) ?? [];

    expect(finalLevels).toHaveLength(3);
    expect(finalLevels.every((level) => Number.isFinite(level.completionRate))).toBe(true);
    expect(finalLevels.every((level) => Number.isFinite(level.avgFightsToClearLevel))).toBe(true);
    expect(finalLevels.every((level) => level.completionRate >= 0)).toBe(true);
  });

  it("scales synthetic gear upward over progression", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 30
      }
    });

    const active = result.archetypes.find((entry) => entry.archetype === "active");
    const earlyGear = active?.levels.find((level) => level.level === 5)?.gearScore ?? 0;
    const laterGear = active?.levels.find((level) => level.level === 30)?.gearScore ?? 0;

    expect(laterGear).toBeGreaterThan(earlyGear);
  });

  it("continues improving synthetic gear into the late-game checkpoints", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 90
      }
    });

    const active = result.archetypes.find((entry) => entry.archetype === "active");
    const midGear = active?.levels.find((level) => level.level === 70)?.gearScore ?? 0;
    const lateGear = active?.levels.find((level) => level.level === 90)?.gearScore ?? 0;

    expect(lateGear).toBeGreaterThan(midGear);
  });

  it("samples centered boards while still reaching off-band contracts over progression", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 6,
        maxLevel: 30
      }
    });

    for (const archetype of result.archetypes) {
      const attemptsByBand = archetype.levels.reduce(
        (totals, level) => ({
          under_level: totals.under_level + level.avgWinsByBand.under_level + level.avgLossesByBand.under_level,
          on_level: totals.on_level + level.avgWinsByBand.on_level + level.avgLossesByBand.on_level,
          over_level: totals.over_level + level.avgWinsByBand.over_level + level.avgLossesByBand.over_level
        }),
        { under_level: 0, on_level: 0, over_level: 0 }
      );

      expect(attemptsByBand.on_level).toBeGreaterThan(0);
      expect(attemptsByBand.under_level + attemptsByBand.over_level).toBeGreaterThan(0);
      expect(attemptsByBand.on_level).toBeGreaterThan(attemptsByBand.under_level);
      expect(attemptsByBand.on_level).toBeGreaterThan(attemptsByBand.over_level);
    }
  });

  it("populates benchmark HP loss metrics for all three level bands", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 10
      }
    });

    for (const archetype of result.archetypes) {
      const levelTen = archetype.levels.find((level) => level.level === 10);

      expect(levelTen).toBeTruthy();
      expect(levelTen?.avgPlayerHpLossPercentByBand.under_level).toBeGreaterThanOrEqual(0);
      expect(levelTen?.avgPlayerHpLossPercentByBand.on_level).toBeGreaterThanOrEqual(0);
      expect(levelTen?.avgPlayerHpLossPercentByBand.over_level).toBeGreaterThanOrEqual(0);
      expect(levelTen?.avgEncounterHpToPlayerHpRatioByBand.under_level).toBeGreaterThan(0);
      expect(levelTen?.avgEncounterHpToPlayerHpRatioByBand.on_level).toBeGreaterThan(0);
      expect(levelTen?.avgEncounterHpToPlayerHpRatioByBand.over_level).toBeGreaterThan(0);
      expect(levelTen?.avgPlayerActionTurnsByBand.under_level ?? 0).toBeGreaterThan(0);
      expect(levelTen?.avgEnemyActionTurnsByBand.on_level ?? 0).toBeGreaterThan(0);
      expect(levelTen?.avgPlayerStrikesByBand.over_level ?? 0).toBeGreaterThan(0);
      expect(levelTen?.avgEnemyStrikesByBand.over_level ?? 0).toBeGreaterThanOrEqual(
        levelTen?.avgEnemyActionTurnsByBand.over_level ?? 0
      );
      expect(levelTen?.avgStaminaCostPerFight ?? 0).toBeGreaterThan(0);
      expect(archetype.benchmarkTurnTargetHitRateByBand.on_level).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses the same synthetic gear curve across archetypes", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 30
      }
    });

    const active = result.archetypes.find((entry) => entry.archetype === "active");
    const average = result.archetypes.find((entry) => entry.archetype === "average");
    const slow = result.archetypes.find((entry) => entry.archetype === "slow");

    const activeGear = active?.levels.find((level) => level.level === 30)?.gearScore ?? 0;
    const averageGear = average?.levels.find((level) => level.level === 30)?.gearScore ?? 0;
    const slowGear = slow?.levels.find((level) => level.level === 30)?.gearScore ?? 0;

    expect(activeGear).toBe(averageGear);
    expect(averageGear).toBe(slowGear);
  });

  it("does not evict existing jobs when reading status at capacity", () => {
    const jobs = Array.from({ length: 10 }, () =>
      createDeveloperContractSimulationJob({
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 2
      })
    );

    const oldestJobId = jobs[0]?.jobId;
    expect(oldestJobId).toBeTruthy();
    expect(getDeveloperContractSimulationJob(oldestJobId!)).not.toBeNull();
    expect(getDeveloperContractSimulationJob(oldestJobId!)).not.toBeNull();
  });

  it("keeps queued or running jobs even when their creation time is older than the TTL", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);
    const oldJob = createDeveloperContractSimulationJob({
      playerClass: "juggernaut",
      sampleSize: 1,
      maxLevel: 100
    });

    nowSpy.mockReturnValue((31 * 60 * 1000) + 1);
    for (let index = 0; index < 10; index += 1) {
      createDeveloperContractSimulationJob({
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 2
      });
    }

    expect(getDeveloperContractSimulationJob(oldJob.jobId)).not.toBeNull();
  });

  it("can write a local simulation artifact for iterative tuning", async () => {
    const output = await runDeveloperContractSimulationToArtifact({
      playerClass: "juggernaut",
      sampleSize: 1,
      maxLevel: 3
    });

    const file = await readFile(output.artifactPath, "utf8");
    const payload = JSON.parse(file) as {
      artifactVersion: number;
      mitigation: {
        floorBps: number;
        maxMitigationBps: number;
        scaleMultiplier: number;
      };
      result: {
        archetypes: Array<{
          archetype: string;
          benchmarkTargetBandHitRateByBand: { under_level: number; on_level: number; over_level: number };
          benchmarkTurnTargetHitRateByBand: { under_level: number; on_level: number; over_level: number };
          levels: Array<{
            avgStaminaCostPerFight: number;
            avgPlayerActionTurnsByBand: { under_level: number; on_level: number; over_level: number };
            avgEnemyActionTurnsByBand: { under_level: number; on_level: number; over_level: number };
            avgEncounterHpToPlayerHpRatioByBand: { under_level: number; on_level: number; over_level: number };
          }>;
        }>;
      };
    };

    expect(payload.artifactVersion).toBe(6);
    expect(payload.mitigation.floorBps).toBe(500);
    expect(payload.mitigation.maxMitigationBps).toBe(7500);
    expect(payload.mitigation.scaleMultiplier).toBe(1.5);
    expect(payload.result.archetypes).toHaveLength(3);
    expect(payload.result.archetypes[1]?.benchmarkTargetBandHitRateByBand.on_level).toBeGreaterThanOrEqual(0);
    expect(payload.result.archetypes[1]?.benchmarkTurnTargetHitRateByBand.on_level).toBeGreaterThanOrEqual(0);
    expect(payload.result.archetypes[1]?.levels[0]?.avgStaminaCostPerFight ?? 0).toBeGreaterThan(0);
    expect(payload.result.archetypes[1]?.levels[0]?.avgPlayerActionTurnsByBand.on_level ?? 0).toBeGreaterThan(0);
    expect(payload.result.archetypes[1]?.levels[0]?.avgEnemyActionTurnsByBand.on_level ?? 0).toBeGreaterThan(0);
    expect(payload.result.archetypes[1]?.levels[0]?.avgEncounterHpToPlayerHpRatioByBand.on_level ?? 0).toBeGreaterThan(0);

    await rm(output.artifactPath, { force: true });
  });
});
