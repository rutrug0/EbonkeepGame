import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeveloperContractSimulationJob,
  getDeveloperContractSimulationJob,
  resetDeveloperContractSimulationJobsForTests,
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

  it("keeps high-level slow samples completable instead of reserve-locking them", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 1,
        maxLevel: 100
      }
    });

    const slow = result.archetypes.find((entry) => entry.archetype === "slow");
    const finalLevels = slow?.levels.filter((level) => level.level >= 98) ?? [];

    expect(finalLevels).toHaveLength(3);
    expect(finalLevels.every((level) => level.completionRate > 0)).toBe(true);
    expect(finalLevels.every((level) => level.avgFightsToClearLevel > 0)).toBe(true);
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

  it("samples all difficulties for every archetype", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 2,
        maxLevel: 30
      }
    });

    for (const archetype of result.archetypes) {
      const finalLevel = archetype.levels.find((level) => level.level === 30);

      expect(finalLevel).toBeTruthy();
      expect((finalLevel?.avgWinsByDifficulty.easy ?? 0) + (finalLevel?.avgLossesByDifficulty.easy ?? 0)).toBeGreaterThan(0);
      expect((finalLevel?.avgWinsByDifficulty.medium ?? 0) + (finalLevel?.avgLossesByDifficulty.medium ?? 0)).toBeGreaterThan(0);
      expect((finalLevel?.avgWinsByDifficulty.hard ?? 0) + (finalLevel?.avgLossesByDifficulty.hard ?? 0)).toBeGreaterThan(0);
    }
  });

  it("gives active archetypes higher-quality synthetic gear than slower archetypes", async () => {
    const result = await simulateDeveloperContractProgression({
      body: {
        playerClass: "juggernaut",
        sampleSize: 6,
        maxLevel: 30
      }
    });

    const active = result.archetypes.find((entry) => entry.archetype === "active");
    const average = result.archetypes.find((entry) => entry.archetype === "average");
    const slow = result.archetypes.find((entry) => entry.archetype === "slow");

    const activeGear = active?.levels.find((level) => level.level === 30)?.gearScore ?? 0;
    const averageGear = average?.levels.find((level) => level.level === 30)?.gearScore ?? 0;
    const slowGear = slow?.levels.find((level) => level.level === 30)?.gearScore ?? 0;

    expect(activeGear).toBeGreaterThan(averageGear);
    expect(averageGear).toBeGreaterThan(slowGear);
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
});
