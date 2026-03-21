import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GardenStateResponse } from "@ebonkeep/shared/garden";

import { __resetRefineryPanelCacheForTests, RefineryPanel } from "../src/features/refinery/RefineryPanel";

const gardenApiMocks = vi.hoisted(() => ({
  fetchGardenState: vi.fn()
}));
const refineryTestTranslate = (key: string, options?: Record<string, string | number>) => {
  if (options?.duration) return `${key}:${options.duration}`;
  if (options?.item) return `${key}:${options.item}`;
  if (options?.quantity) return `${key}:${options.quantity}`;
  if (options?.completed !== undefined && options?.total !== undefined) {
    return `${key}:${options.completed}/${options.total}`;
  }
  return key;
};

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: refineryTestTranslate
  })
}));

vi.mock("../src/features/garden/api", () => ({
  fetchGardenState: gardenApiMocks.fetchGardenState
}));

function createGardenState(): GardenStateResponse {
  return {
    serverTime: "2026-03-21T09:00:00.000Z",
    unlockedSlotCount: 18,
    plots: Array.from({ length: 18 }, (_, index) => ({
      slotIndex: index + 1,
      isUnlocked: true,
      plantId: null,
      phase: "empty" as const,
      plantedAt: null,
      growthEndsAt: null,
      bloomStartsAt: null,
      bloomEndsAt: null,
      wiltAt: null,
      nextTransitionAt: null,
      harvestYield: null
    })),
    inventory: [
      {
        inventoryEntryId: "ingredient_1",
        plantId: "bloodleaf",
        kind: "ingredient",
        itemCode: "ingredient_bloodleaf",
        displayName: "Bloodleaf",
        rarity: "common",
        quantity: 6
      }
    ]
  };
}

describe("refinery panel", () => {
  beforeEach(() => {
    __resetRefineryPanelCacheForTests();
    gardenApiMocks.fetchGardenState.mockReset();
  });

  it("reuses the warm refinery response on remount without flashing the loading shell", async () => {
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState());

    const firstRender = render(<RefineryPanel token="token" />);

    expect((await screen.findAllByText("refineryPanel.awaitingRecipe")).length).toBeGreaterThan(0);

    firstRender.unmount();

    render(<RefineryPanel token="token" />);

    expect(screen.queryByText("refineryPanel.loading")).toBeNull();
    expect(screen.getAllByText("refineryPanel.awaitingRecipe").length).toBeGreaterThan(0);
  });
});
