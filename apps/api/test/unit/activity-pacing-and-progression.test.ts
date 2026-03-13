import { describe, expect, it } from "vitest";

import {
  getContractReplenishPacingRow,
  resolveContractBaseTravelSeconds,
  resolveContractTravelDurationSeconds,
  resolveStaminaRegenPercentPerHour
} from "../../src/config/activity-pacing.js";
import { resolveStaminaState } from "../../src/modules/player/progression-service.js";

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
      replenishMinSeconds: 240,
      replenishMaxSeconds: 360
    });
    expect(getContractReplenishPacingRow(50)).toMatchObject({
      replenishMinSeconds: 1080,
      replenishMaxSeconds: 1500
    });
    expect(getContractReplenishPacingRow(60)).toMatchObject({
      replenishMinSeconds: 1500,
      replenishMaxSeconds: 2100
    });
    expect(getContractReplenishPacingRow(100)).toMatchObject({
      replenishMinSeconds: 3900,
      replenishMaxSeconds: 4500
    });
  });

  it("applies efficiency-tier travel multipliers around the base duration", () => {
    expect(resolveContractTravelDurationSeconds(10, "low_cost")).toBe(42);
    expect(resolveContractTravelDurationSeconds(10, "standard_cost")).toBe(60);
    expect(resolveContractTravelDurationSeconds(10, "high_cost")).toBe(78);
  });
});

describe("stamina regeneration", () => {
  it("uses a fixed percent-per-hour model based on max stamina", () => {
    expect(resolveStaminaRegenPercentPerHour(1)).toBe(25);
    expect(resolveStaminaRegenPercentPerHour(60)).toBe(25);

    const now = new Date("2026-03-13T12:00:00.000Z");
    const stamina = resolveStaminaState({
      current: 10,
      max: 120,
      updatedAt: new Date("2026-03-13T11:00:00.000Z"),
      level: 1,
      now
    });

    expect(stamina.current).toBe(40);
    expect(stamina.updatedAt.toISOString()).toBe(now.toISOString());
    expect(stamina.nextPointAt).toBe("2026-03-13T12:02:00.000Z");
  });
});
