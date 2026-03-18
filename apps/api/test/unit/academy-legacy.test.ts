import { describe, expect, it } from "vitest";

import { resolveAcademyActiveEffectsFromRows } from "../../src/modules/academy/effects.js";
import { normalizeAcademyProgressRows } from "../../src/modules/academy/legacy.js";

describe("academy legacy node migration", () => {
  it("maps legacy academy node ids onto the current tree without dropping stored investment", () => {
    const normalizedRows = normalizeAcademyProgressRows([
      {
        nodeId: "academy_core",
        currentLevel: 1,
        ducatsInvested: 15_000,
        completedAt: new Date("2026-03-01T00:00:00.000Z")
      },
      {
        nodeId: "combat_basics",
        currentLevel: 5,
        ducatsInvested: 75_000,
        completedAt: new Date("2026-03-02T00:00:00.000Z")
      },
      {
        nodeId: "heavy_arms",
        currentLevel: 2,
        ducatsInvested: 28_000,
        completedAt: null
      }
    ]);

    expect(normalizedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "academy_core",
          currentLevel: 1,
          ducatsInvested: 15_000
        }),
        expect.objectContaining({
          nodeId: "drill_square",
          currentLevel: 3,
          ducatsInvested: 75_000
        }),
        expect.objectContaining({
          nodeId: "plated_forms",
          currentLevel: 2,
          ducatsInvested: 28_000
        })
      ])
    );
  });

  it("still resolves active effects from legacy node ids until rows are migrated", () => {
    const activeEffects = resolveAcademyActiveEffectsFromRows([
      { nodeId: "academy_core", currentLevel: 1 },
      { nodeId: "combat_basics", currentLevel: 3 }
    ]);

    expect(activeEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "strength_flat",
          value: 1
        })
      ])
    );
  });

  it("does not double-count a canonical node when a legacy row still exists beside it", () => {
    const normalizedRows = normalizeAcademyProgressRows([
      {
        nodeId: "combat_basics",
        currentLevel: 3,
        ducatsInvested: 24_500
      },
      {
        nodeId: "drill_square",
        currentLevel: 3,
        ducatsInvested: 24_500
      }
    ]);

    expect(normalizedRows).toEqual([
      expect.objectContaining({
        nodeId: "drill_square",
        currentLevel: 3,
        ducatsInvested: 24_500
      })
    ]);
  });
});
