import { describe, expect, it } from "vitest";

import {
  getContractReplenishPacingRow,
  resolveContractBaseTravelSeconds,
  resolveContractTravelDurationSeconds,
  resolveStaminaRegenPercentPerHour
} from "../../src/config/activity-pacing.js";
import { getDeveloperContractsStaticCurves } from "../../src/modules/contracts/developer-static-curves.js";
import {
  calculateRestCost,
  resolveHealthState,
  rebaseStaminaStateForRegenChange,
  resolveStaminaState
} from "../../src/modules/player/progression-service.js";

describe("activity pacing tables", () => {
  it("matches base travel anchors at representative levels", () => {
    expect(resolveContractBaseTravelSeconds(1)).toBe(5);
    expect(resolveContractBaseTravelSeconds(10)).toBe(60);
    expect(resolveContractBaseTravelSeconds(20)).toBe(300);
    expect(resolveContractBaseTravelSeconds(50)).toBe(1080);
    expect(resolveContractBaseTravelSeconds(60)).toBe(1500);
    expect(resolveContractBaseTravelSeconds(100)).toBe(3780);
  });

  it("matches replenish anchors at representative levels", () => {
    expect(getContractReplenishPacingRow(1)).toMatchObject({
      replenishMinSeconds: 45,
      replenishMaxSeconds: 75
    });
    expect(getContractReplenishPacingRow(10)).toMatchObject({
      replenishMinSeconds: 90,
      replenishMaxSeconds: 150
    });
    expect(getContractReplenishPacingRow(20)).toMatchObject({
      replenishMinSeconds: 180,
      replenishMaxSeconds: 300
    });
    expect(getContractReplenishPacingRow(40)).toMatchObject({
      replenishMinSeconds: 900,
      replenishMaxSeconds: 1350
    });
    expect(getContractReplenishPacingRow(60)).toMatchObject({
      replenishMinSeconds: 2400,
      replenishMaxSeconds: 3300
    });
    expect(getContractReplenishPacingRow(80)).toMatchObject({
      replenishMinSeconds: 5400,
      replenishMaxSeconds: 6900
    });
    expect(getContractReplenishPacingRow(100)).toMatchObject({
      replenishMinSeconds: 9000,
      replenishMaxSeconds: 10800
    });
  });

  it("applies efficiency-tier travel multipliers around the base duration", () => {
    expect(resolveContractTravelDurationSeconds(10, "low_cost")).toBe(42);
    expect(resolveContractTravelDurationSeconds(10, "standard_cost")).toBe(60);
    expect(resolveContractTravelDurationSeconds(10, "high_cost")).toBe(78);
  });

  it("reports weighted stamina metrics in developer static curves", () => {
    const rows = getDeveloperContractsStaticCurves().levels;
    const levelSixty = rows.find((row) => row.level === 60);
    const levelEighty = rows.find((row) => row.level === 80);
    const levelHundred = rows.find((row) => row.level === 100);

    expect(levelSixty).toMatchObject({
      averageStaminaWaitSecondsForContract: 3984,
      weightedAverageStaminaWaitSecondsForContract: 3984,
      weightedAverageStaminaCostPerContract: 16.6
    });
    expect(levelEighty).toMatchObject({
      weightedAverageStaminaCostPerContract: 22.25
    });
    expect(levelHundred).toMatchObject({
      weightedAverageStaminaCostPerContract: 27.9
    });
  });
});

describe("stamina regeneration", () => {
  it("uses a fixed percent-per-hour model based on max stamina", () => {
    expect(resolveStaminaRegenPercentPerHour(1)).toBe(12.5);
    expect(resolveStaminaRegenPercentPerHour(60)).toBe(12.5);

    const now = new Date("2026-03-13T12:00:00.000Z");
    const stamina = resolveStaminaState({
      current: 10,
      max: 120,
      updatedAt: new Date("2026-03-13T11:00:00.000Z"),
      level: 1,
      now
    });

    expect(stamina.current).toBe(25);
    expect(stamina.updatedAt.toISOString()).toBe(now.toISOString());
    expect(stamina.nextPointAt).toBe("2026-03-13T12:04:00.000Z");
  });

  it("fully restores depleted 120-stamina bars in eight hours", () => {
    const now = new Date("2026-03-13T08:00:00.000Z");
    const stamina = resolveStaminaState({
      current: 0,
      max: 120,
      updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      level: 1,
      now
    });

    expect(stamina.current).toBe(120);
    expect(stamina.updatedAt.toISOString()).toBe(now.toISOString());
    expect(stamina.nextPointAt).toBeNull();
  });

  it("accelerates stamina regeneration when academy bonuses are present", () => {
    const now = new Date("2026-03-13T12:00:00.000Z");
    const stamina = resolveStaminaState({
      current: 0,
      max: 120,
      updatedAt: new Date("2026-03-13T11:00:00.000Z"),
      level: 1,
      bonusRegenPercent: 5,
      now
    });

    expect(stamina.current).toBe(21);
    expect(stamina.updatedAt.toISOString()).toBe(now.toISOString());
  });

  it("reduces rest costs when academy discounts are active", () => {
    const discounted = calculateRestCost({
      currentHealth: 50,
      maxHealth: 100,
      currentStamina: 30,
      maxStamina: 60,
      discountPercent: 10
    });

    expect(discounted).toBe(32);
  });

  it("does not retroactively apply a newly gained academy stamina bonus", () => {
    const bonusUnlockedAt = new Date("2026-03-13T12:00:00.000Z");
    const rebased = rebaseStaminaStateForRegenChange({
      current: 0,
      max: 120,
      updatedAt: new Date("2026-03-13T11:00:00.000Z"),
      level: 1,
      previousBonusRegenPercent: 0,
      nextBonusRegenPercent: 5,
      now: bonusUnlockedAt
    });

    expect(rebased.current).toBe(15);
    expect(rebased.updatedAt.toISOString()).toBe(bonusUnlockedAt.toISOString());

    const oneHourAfterUnlock = resolveStaminaState({
      current: rebased.current,
      max: 120,
      updatedAt: rebased.updatedAt,
      level: 1,
      bonusRegenPercent: 5,
      now: new Date("2026-03-13T13:00:00.000Z")
    });

    expect(oneHourAfterUnlock.current).toBe(36);
  });
});

describe("health regeneration", () => {
  it("regenerates 1% of max health per minute", () => {
    const now = new Date("2026-03-13T12:05:00.000Z");
    const health = resolveHealthState({
      current: 50,
      max: 200,
      updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      now
    });

    expect(health.current).toBe(60);
    expect(health.updatedAt.toISOString()).toBe(now.toISOString());
    expect(health.nextPointAt).toBe("2026-03-13T12:05:30.000Z");
  });

  it("supports fractional minute thresholds for low max-health pools", () => {
    const health = resolveHealthState({
      current: 3,
      max: 50,
      updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      now: new Date("2026-03-13T12:03:00.000Z")
    });

    expect(health.current).toBe(4);
    expect(health.updatedAt.toISOString()).toBe("2026-03-13T12:02:00.000Z");
    expect(health.nextPointAt).toBe("2026-03-13T12:04:00.000Z");
  });

  it("returns null for nextPointAt and refreshes the timestamp when health is full", () => {
    const now = new Date("2026-03-13T12:05:00.000Z");
    const health = resolveHealthState({
      current: 120,
      max: 120,
      updatedAt: new Date("2026-03-13T11:00:00.000Z"),
      now
    });

    expect(health.current).toBe(120);
    expect(health.updatedAt.toISOString()).toBe(now.toISOString());
    expect(health.nextPointAt).toBeNull();
  });
});
