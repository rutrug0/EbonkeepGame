import { describe, expect, it, vi } from "vitest";

import { ARENA_OFFER_COUNT } from "@ebonkeep/shared/arena";

import {
  buildMockCombatSnapshot,
  calculateArenaCooldownEndsAt,
  calculateArenaRatingDelta,
  pickArenaOfferCandidates
} from "../../src/modules/arena/service.js";

describe("arena service helpers", () => {
  it("prefers nearby ratings and widens the search band when needed", () => {
    const selectedIds = pickArenaOfferCandidates({
      playerRating: 1000,
      candidates: [
        { id: "near-a", rating: 995 },
        { id: "near-b", rating: 1012 },
        { id: "near-c", rating: 1148 },
        { id: "far-a", rating: 1420 },
        { id: "far-b", rating: 1540 }
      ],
      excludedEntryIds: new Set(["near-b"])
    });

    expect(selectedIds).toHaveLength(ARENA_OFFER_COUNT);
    expect(selectedIds).toEqual(["near-a", "near-c", "far-a"]);
  });

  it("can return more arena offers when guild academy bonuses increase the option count", () => {
    const selectedIds = pickArenaOfferCandidates({
      playerRating: 1000,
      candidates: [
        { id: "near-a", rating: 995 },
        { id: "near-b", rating: 1002 },
        { id: "near-c", rating: 1012 },
        { id: "near-d", rating: 1026 },
        { id: "far-a", rating: 1420 }
      ],
      offerCount: 4
    });

    expect(selectedIds).toHaveLength(4);
    expect(selectedIds).toEqual(["near-b", "near-a", "near-c", "near-d"]);
  });

  it("grants more rating for beating a stronger opponent than a weaker one", () => {
    const strongerOpponentWin = calculateArenaRatingDelta({
      playerRating: 1000,
      opponentRating: 1120,
      didWin: true
    });
    const weakerOpponentWin = calculateArenaRatingDelta({
      playerRating: 1000,
      opponentRating: 880,
      didWin: true
    });
    const strongerOpponentLoss = calculateArenaRatingDelta({
      playerRating: 1000,
      opponentRating: 1120,
      didWin: false
    });

    expect(strongerOpponentWin).toBeGreaterThan(weakerOpponentWin);
    expect(strongerOpponentLoss).toBeLessThan(0);
  });

  it("shrinks arena cooldowns to 2 seconds when the cheat is enabled", () => {
    const now = new Date("2026-03-17T09:00:00.000Z");

    const normalCooldownEndsAt = calculateArenaCooldownEndsAt({
      now,
      fastArenaReplenishEnabled: false
    });
    const fastCooldownEndsAt = calculateArenaCooldownEndsAt({
      now,
      fastArenaReplenishEnabled: true
    });

    expect(normalCooldownEndsAt.getTime() - now.getTime()).toBe(600_000);
    expect(fastCooldownEndsAt.getTime() - now.getTime()).toBe(2_000);
  });

  it("applies guild academy arena cooldown reductions when no cheat is active", () => {
    const now = new Date("2026-03-17T09:00:00.000Z");

    const reducedCooldownEndsAt = calculateArenaCooldownEndsAt({
      now,
      fastArenaReplenishEnabled: false,
      academyEffects: {
        staminaRegenPercent: 0,
        contractDucatsPercent: 0,
        contractXpPercent: 0,
        contractItemDropBps: 0,
        contractReplenishPercent: 0,
        contractSlotCountFlat: 0,
        restCostPercent: 0,
        maxMembersFlat: 0,
        arenaOfferCountFlat: 0,
        arenaCooldownPercent: 15,
        arenaRatingWinFlat: 0,
        arenaRatingLossReductionFlat: 0,
        statBonuses: {}
      }
    });

    expect(reducedCooldownEndsAt.getTime() - now.getTime()).toBe(510_000);
  });

  it("uses the stored mock class when building combat snapshots", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const playerState = {
      level: 60,
      gearScore: 1500,
      statSnapshot: {
        total: {
          maxHitpoints: 4000,
          damage: 700,
          initiative: 150,
          accuracy: 90,
          dodgeChance: 1200,
          critChance: 900,
          critMultiplier: 18000,
          extraAttackChance: 600,
          armor: 320,
          spellShield: 410,
          missileResistance: 260,
          physicalDefense: 50,
          magicDefense: 55
        }
      }
    } as Parameters<typeof buildMockCombatSnapshot>[0]["playerState"];

    try {
      const intelligenceSnapshot = buildMockCombatSnapshot({
        entryId: "mock-int",
        playerState,
        playerRating: 1000,
        targetRating: 1000,
        playerClass: "runecaster"
      });
      const dexteritySnapshot = buildMockCombatSnapshot({
        entryId: "mock-dex",
        playerState,
        playerRating: 1000,
        targetRating: 1000,
        playerClass: "shade"
      });

      expect(intelligenceSnapshot.damageKind).toBe("spell");
      expect(dexteritySnapshot.damageKind).toBe("ranged");
    } finally {
      randomSpy.mockRestore();
    }
  });
});
