import { describe, expect, it } from "vitest";

import { ARENA_OFFER_COUNT } from "@ebonkeep/shared/arena";

import {
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
});
