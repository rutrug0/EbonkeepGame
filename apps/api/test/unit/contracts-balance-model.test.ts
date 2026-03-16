import { afterEach, describe, expect, it } from "vitest";

import {
  buildExpectedLoadoutCurve,
  getExpectedPlayerCombatMetrics,
  resetExpectedBalanceCachesForTests
} from "../../src/modules/contracts/balance-model.js";
import {
  runExactDeltaSimulationAudit,
  runMirrorPvpSimulationAudit
} from "../../src/modules/contracts/developer-simulation.js";

afterEach(() => {
  resetExpectedBalanceCachesForTests();
});

describe("contracts balance model", () => {
  it("builds deterministic expected loadouts for the same class and level", () => {
    const first = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 70
    });
    const second = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 70
    });

    expect(second).toEqual(first);
  });

  it("keeps expected loadout growth smooth across adjacent levels", () => {
    const levelSixtyNine = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 69
    });
    const levelSeventy = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 70
    });
    const levelSeventyOne = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 71
    });

    expect(levelSeventy.gearScore).toBeGreaterThan(levelSixtyNine.gearScore);
    expect(levelSeventyOne.gearScore).toBeGreaterThan(levelSeventy.gearScore);
    expect(levelSeventy.gearScore - levelSixtyNine.gearScore).toBeLessThan(50);
    expect(levelSeventyOne.gearScore - levelSeventy.gearScore).toBeLessThan(50);
  });

  it("builds symmetric expected ring slots and a non-zero weapon expectation", () => {
    const loadout = buildExpectedLoadoutCurve({
      playerClass: "juggernaut",
      level: 80
    });

    expect(loadout.equipment.ringLeft?.power).toBe(loadout.equipment.ringRight?.power);
    expect(loadout.equipment.weapon?.damageRoll?.averageDamage ?? 0).toBeGreaterThan(0);
  });

  it("derives expected player metrics and exact-delta audits from the smooth loadout", () => {
    const metrics = getExpectedPlayerCombatMetrics({
      playerClass: "juggernaut",
      level: 90
    });
    const audit = runExactDeltaSimulationAudit({
      playerClass: "juggernaut",
      playerLevel: 90,
      sampleSize: 4
    });

    expect(metrics.ehp).toBeGreaterThan(0);
    expect(metrics.dps).toBeGreaterThan(0);
    expect(metrics.tempo).toBeGreaterThan(0);
    expect(audit).toHaveLength(13);
    expect(audit[6]?.levelDelta).toBe(0);
    expect(audit[6]?.expectedPlayerMetrics.gearScore).toBe(metrics.gearScore);
    expect(audit[6]?.avgTotalActionRounds ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgPlayerActionTurns ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgEnemyActionTurns ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgEnemyToPlayerActionTurnRatio ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgPlayerStrikes ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgEnemyStrikes ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.playerMaxHp ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgTotalEnemyHp ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgEnemyHpToPlayerHpRatio ?? 0).toBeGreaterThan(0);
    expect(audit[6]?.avgEnemyHitSize ?? 0).toBeGreaterThan(0);
  });

  it("emits non-zero mirror-duel audit metrics for PvP proxy tuning", () => {
    const audit = runMirrorPvpSimulationAudit({
      playerClass: "juggernaut",
      playerLevel: 75,
      sampleSize: 8
    });

    expect(audit.avgResolvedActions).toBeGreaterThan(0);
    expect(audit.avgWinnerHpLossPercent).toBeGreaterThan(0);
    expect(audit.avgMitigatedHitSize).toBeGreaterThan(0);
    expect(audit.avgApproxHitsToKill).toBeGreaterThan(0);
    expect(audit.firstActorWinRate).toBeGreaterThanOrEqual(0);
    expect(audit.firstActorWinRate).toBeLessThanOrEqual(1);
    expect(audit.avgPlayerMaxHp).toBeGreaterThan(0);
  });
});
