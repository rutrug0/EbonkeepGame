import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAuctionHouseCacheForTests, AuctionHouse } from "../src/features/auction/AuctionHouse";

const auctionTestTranslate = (key: string, options?: Record<string, string | number>) => {
  if (options?.count !== undefined) return `${key}:${options.count}`;
  if (options?.minutes !== undefined) return `${key}:${options.minutes}`;
  if (options?.seconds !== undefined) return `${key}:${options.seconds}`;
  if (options?.amount !== undefined) return `${key}:${options.amount}`;
  if (options?.value !== undefined) return `${key}:${options.value}`;
  return key;
};

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: auctionTestTranslate
  })
}));

function createOkResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload
  } as Response;
}

describe("auction house", () => {
  beforeEach(() => {
    __resetAuctionHouseCacheForTests();
    let activeAuctionRequestCount = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/v1/auction/active")) {
        activeAuctionRequestCount += 1;
        if (activeAuctionRequestCount > 1) {
          return await new Promise<Response>(() => {});
        }

        return createOkResponse({
          auctions: [
            {
              id: "auction_1",
              levelBracketMin: 1,
              levelBracketMax: 10,
              startTime: "2026-03-21T09:00:00.000Z",
              endTime: "2026-03-21T10:00:00.000Z",
              status: "active",
              items: [
                {
                  id: "item_1",
                  itemCode: "iron_sword",
                  itemLevel: 5,
                  itemRarity: "common",
                  itemCategory: "weapon",
                  startingBid: 50,
                  currentBid: 50,
                  currentWinnerId: null,
                  bidCount: 0,
                  extensionsUsed: 0,
                  isPlayerSubmitted: false,
                  minimumNextBid: 55,
                  itemData: {
                    itemCode: "iron_sword",
                    itemName: "Iron Sword",
                    levelRequirement: 5,
                    rarity: "common",
                    category: "weapon",
                    power: 12
                  }
                }
              ]
            }
          ]
        });
      }

      if (url.endsWith("/v1/auction/my-bids")) {
        return createOkResponse({ bids: [] });
      }

      if (url.endsWith("/v1/auction/rewards/pending")) {
        return createOkResponse({ rewards: [] });
      }

      if (url.endsWith("/v1/auction/my-submissions")) {
        return createOkResponse({ submissions: [] });
      }

      if (url.endsWith("/v1/inventory")) {
        return createOkResponse({ items: [] });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses the warm auction response on remount without flashing the loading shell", async () => {
    const firstRender = render(<AuctionHouse token="token" currentDucats={0} />);

    expect(await screen.findByText("Left Wing")).toBeTruthy();

    firstRender.unmount();

    render(<AuctionHouse token="token" currentDucats={0} />);

    expect(screen.queryByText("inventory.loading")).toBeNull();
    expect(screen.getByText("Left Wing")).toBeTruthy();
  });
});
