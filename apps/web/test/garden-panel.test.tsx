import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GardenStateResponse } from "@ebonkeep/shared/garden";

import { GardenPanel } from "../src/features/garden/GardenPanel";

const gardenApiMocks = vi.hoisted(() => ({
  fetchGardenState: vi.fn(),
  plantGardenSeed: vi.fn(),
  harvestGardenPlot: vi.fn(),
  clearGardenPlot: vi.fn()
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      if (options?.duration) return `${key}:${options.duration}`;
      if (options?.slot) return `${key}:${options.slot}`;
      if (options?.quantity) return `${key}:${options.quantity}`;
      if (options?.count) return `${key}:${options.count}`;
      if (options?.plant) return `${key}:${options.plant}`;
      if (options?.seed) return `${key}:${options.seed}`;
      if (options?.yield) return `${key}:${options.yield}`;
      if (options?.recipes) return `${key}:${options.recipes}`;
      return key;
    }
  })
}));

vi.mock("../src/features/garden/api", () => ({
  fetchGardenState: gardenApiMocks.fetchGardenState,
  plantGardenSeed: gardenApiMocks.plantGardenSeed,
  harvestGardenPlot: gardenApiMocks.harvestGardenPlot,
  clearGardenPlot: gardenApiMocks.clearGardenPlot
}));

function createGardenState(overrides?: Partial<GardenStateResponse>): GardenStateResponse {
  const unlockedSlotCount = overrides?.unlockedSlotCount ?? 18;
  const defaultPlots: GardenStateResponse["plots"] = Array.from({ length: 18 }, (_, index) => ({
    slotIndex: index + 1,
    isUnlocked: index < unlockedSlotCount,
    plantId: null,
    phase: "empty" as const,
    plantedAt: null,
    growthEndsAt: null,
    bloomStartsAt: null,
    bloomEndsAt: null,
    wiltAt: null,
    nextTransitionAt: null,
    harvestYield: null
  }));

  const plots = (overrides?.plots ?? defaultPlots).map((plot) => ({
    ...plot,
    isUnlocked: plot.isUnlocked ?? plot.slotIndex <= unlockedSlotCount
  })) as GardenStateResponse["plots"];

  const inventory = overrides?.inventory ?? [
    {
      inventoryEntryId: "seed_1",
      plantId: "bloodleaf",
      kind: "seed",
      itemCode: "seed_bloodleaf",
      displayName: "Bloodleaf Seeds",
      rarity: "common",
      quantity: 999
    }
  ];

  return {
    serverTime: overrides?.serverTime ?? "2026-03-18T10:00:00.000Z",
    unlockedSlotCount,
    plots,
    inventory
  };
}

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

describe("garden panel", () => {
  beforeEach(() => {
    gardenApiMocks.fetchGardenState.mockReset();
    gardenApiMocks.plantGardenSeed.mockReset();
    gardenApiMocks.harvestGardenPlot.mockReset();
    gardenApiMocks.clearGardenPlot.mockReset();
  });

  it("loads the garden state and plants a selected seed into the selected slot", async () => {
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState());
    gardenApiMocks.plantGardenSeed.mockResolvedValue({
      garden: createGardenState({
        plots: [
          {
            slotIndex: 1,
            plantId: "bloodleaf",
            phase: "growing",
            plantedAt: "2026-03-18T10:00:00.000Z",
            growthEndsAt: "2026-03-18T10:00:05.000Z",
            bloomStartsAt: "2026-03-18T10:00:05.000Z",
            bloomEndsAt: "2026-03-18T10:00:10.000Z",
            wiltAt: "2026-03-18T10:00:15.000Z",
            nextTransitionAt: "2026-03-18T10:00:05.000Z",
            harvestYield: null
          },
          ...createGardenState().plots.slice(1)
        ],
        inventory: [
          {
            inventoryEntryId: "seed_1",
            plantId: "bloodleaf",
            kind: "seed",
            itemCode: "seed_bloodleaf",
            displayName: "Bloodleaf Seeds",
            rarity: "common",
            quantity: 998
          }
        ]
      })
    });

    const { container } = render(<GardenPanel token="token" />);

    expect(await screen.findByText("Bloodleaf Seeds")).toBeTruthy();
    expect(screen.getByRole("button", { name: "gardenPanel.slotTitle:1, gardenPanel.phase.empty" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bloodleaf Seeds" }));

    const firstPlotCard = container.querySelector(".gardenPlotCard");
    expect(firstPlotCard).toBeTruthy();
    fireEvent.click(firstPlotCard!);

    await waitFor(() => {
      expect(gardenApiMocks.plantGardenSeed).toHaveBeenCalledWith("token", 1, {
        plantId: "bloodleaf"
      });
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_growing.png"]')).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        document
          .querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_growing.png"]')
          ?.className.includes("fx-enter")
      ).toBe(true);
    });
    expect(screen.getByText("998")).toBeTruthy();
  });

  it("renders the bloodleaf seed art in the inventory grid", async () => {
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState());

    render(<GardenPanel token="token" />);

    expect(await screen.findByText("Bloodleaf Seeds")).toBeTruthy();
    const seedButton = screen.getByRole("button", { name: "Bloodleaf Seeds" });
    fireEvent.click(seedButton);
    expect(seedButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).not.toBe(seedButton);
    expect(screen.getByText("999")).toBeTruthy();
    expect(screen.getByText("gardenPanel.seedGrowTime:5s")).toBeTruthy();
    expect(screen.getByText("gardenPanel.seedHarvestableTime:10s")).toBeTruthy();
    expect(screen.getByText("gardenPanel.seedBloomTime:5s")).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_seed.png"]')).toBeTruthy();
  });

  it("renders fenroot seed and plant art when fenroot assets are available", async () => {
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
      plots: [
        {
          slotIndex: 1,
          plantId: "fenroot",
          phase: "growing",
          plantedAt: "2026-03-18T10:00:00.000Z",
          growthEndsAt: "2026-03-18T10:00:05.000Z",
          bloomStartsAt: "2026-03-18T10:00:05.000Z",
          bloomEndsAt: "2026-03-18T10:00:10.000Z",
          wiltAt: "2026-03-18T10:00:15.000Z",
          nextTransitionAt: "2026-03-18T10:00:05.000Z",
          harvestYield: null
        },
        ...createGardenState().plots.slice(1)
      ],
      inventory: [
        {
          inventoryEntryId: "seed_2",
          plantId: "fenroot",
          kind: "seed",
          itemCode: "seed_fenroot",
          displayName: "Fenroot Seeds",
          rarity: "common",
          quantity: 999
        }
      ]
    }));

    render(<GardenPanel token="token" />);

    expect(await screen.findByText("Fenroot Seeds")).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/fenroot/fenroot_growing.png"]')).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/fenroot/fenroot_seed.png"]')).toBeTruthy();
  });

  it("renders ironbloom seed and plant art when ironbloom assets are available", async () => {
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
      plots: [
        {
          slotIndex: 1,
          plantId: "ironbloom",
          phase: "growing",
          plantedAt: "2026-03-18T10:00:00.000Z",
          growthEndsAt: "2026-03-18T10:00:05.000Z",
          bloomStartsAt: "2026-03-18T10:00:05.000Z",
          bloomEndsAt: "2026-03-18T10:00:10.000Z",
          wiltAt: "2026-03-18T10:00:15.000Z",
          nextTransitionAt: "2026-03-18T10:00:05.000Z",
          harvestYield: null
        },
        ...createGardenState().plots.slice(1)
      ],
      inventory: [
        {
          inventoryEntryId: "seed_3",
          plantId: "ironbloom",
          kind: "seed",
          itemCode: "seed_ironbloom",
          displayName: "Ironbloom Seeds",
          rarity: "common",
          quantity: 999
        }
      ]
    }));

    render(<GardenPanel token="token" />);

    expect(await screen.findByText("Ironbloom Seeds")).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/ironbloom/ironbloom_growing.png"]')).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/ironbloom/ironbloom_seed.png"]')).toBeTruthy();
  });

  it("shows three stage progress dots and marks wilted plots red", async () => {
    vi.useFakeTimers();
    const localBaseTime = new Date("2026-03-19T09:00:00.000Z");
    vi.setSystemTime(localBaseTime);

    try {
      gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
        serverTime: localBaseTime.toISOString(),
        plots: [
          {
            slotIndex: 1,
            plantId: "bloodleaf",
            phase: "growing",
            plantedAt: new Date(localBaseTime.getTime() - 1_500).toISOString(),
            growthEndsAt: new Date(localBaseTime.getTime() + 3_500).toISOString(),
            bloomStartsAt: new Date(localBaseTime.getTime() + 3_500).toISOString(),
            bloomEndsAt: new Date(localBaseTime.getTime() + 8_500).toISOString(),
            wiltAt: new Date(localBaseTime.getTime() + 13_500).toISOString(),
            nextTransitionAt: new Date(localBaseTime.getTime() + 3_500).toISOString(),
            harvestYield: null
          },
          {
            slotIndex: 2,
            plantId: "bloodleaf",
            phase: "wilted",
            plantedAt: new Date(localBaseTime.getTime() - 15_000).toISOString(),
            growthEndsAt: new Date(localBaseTime.getTime() - 10_000).toISOString(),
            bloomStartsAt: new Date(localBaseTime.getTime() - 10_000).toISOString(),
            bloomEndsAt: new Date(localBaseTime.getTime() - 5_000).toISOString(),
            wiltAt: new Date(localBaseTime.getTime() - 500).toISOString(),
            nextTransitionAt: null,
            harvestYield: 0
          },
          ...createGardenState().plots.slice(2)
        ]
      }));

      const { container } = render(<GardenPanel token="token" />);
      await act(async () => {
        await Promise.resolve();
      });

      const progressGroups = container.querySelectorAll(".gardenPlotProgressDots");
      expect(progressGroups.length).toBeGreaterThanOrEqual(2);

      const growingDots = progressGroups[0]?.querySelectorAll(".gardenPlotProgressDot.isActive") ?? [];
      expect(growingDots.length).toBe(1);

      const wiltedGroup = progressGroups[1];
      expect(wiltedGroup?.className.includes("isWilted")).toBe(true);
      expect(wiltedGroup?.querySelectorAll(".gardenPlotProgressDot.isActive").length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("harvests a ready crop when the plot card is clicked", async () => {
    const nowMs = Date.now();
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
      serverTime: toIso(nowMs),
      plots: [
        {
          slotIndex: 1,
          plantId: "bloodleaf",
          phase: "bloom",
          plantedAt: toIso(nowMs - 120_000),
          growthEndsAt: toIso(nowMs - 30_000),
          bloomStartsAt: toIso(nowMs - 10_000),
          bloomEndsAt: toIso(nowMs + 50_000),
          wiltAt: toIso(nowMs + 110_000),
          nextTransitionAt: toIso(nowMs + 50_000),
          harvestYield: 4
        },
        ...createGardenState().plots.slice(1)
      ]
    }));
    gardenApiMocks.harvestGardenPlot.mockResolvedValue({
      harvested: {
        plantId: "bloodleaf",
        itemCode: "ingredient_bloodleaf",
        displayName: "Bloodleaf",
        quantity: 4
      },
      garden: createGardenState({
        inventory: [
          {
            inventoryEntryId: "seed_1",
            plantId: "bloodleaf",
            kind: "seed",
            itemCode: "seed_bloodleaf",
            displayName: "Bloodleaf Seeds",
            rarity: "common",
            quantity: 999
          },
          {
            inventoryEntryId: "ingredient_1",
            plantId: "bloodleaf",
            kind: "ingredient",
            itemCode: "ingredient_bloodleaf",
            displayName: "Bloodleaf",
            rarity: "common",
            quantity: 4
          }
        ]
      })
    });

    const { container } = render(<GardenPanel token="token" />);

    await waitFor(() => {
      expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_blooming.png"]')).toBeTruthy();
    });
    const firstPlotCard = container.querySelector(".gardenPlotCard");
    expect(firstPlotCard).toBeTruthy();

    fireEvent.click(firstPlotCard!);

    await waitFor(() => {
      expect(gardenApiMocks.harvestGardenPlot).toHaveBeenCalledWith("token", 1);
    });
    await waitFor(() => {
      expect(document.querySelector(".gardenPlantImage.fx-harvest-out")).toBeTruthy();
    });
    expect(document.querySelector(".gardenPlotProgressDots.fx-harvest-out")).toBeTruthy();
    expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_ingredient.png"]')).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector(".gardenIngredientInventoryIcon-positive")).toBeTruthy();
    });
    await waitFor(() => {
      expect(document.querySelector(".gardenIngredientInventoryCount.inventoryStatFlashValue-positive")).toBeTruthy();
    });
    expect(Array.from(document.querySelectorAll(".gardenIngredientInventoryCount")).some((node) => node.textContent === "4")).toBe(
      true
    );
    expect(screen.getByText("+4")).toBeTruthy();
  });

  it("keeps phase updates anchored to server time after the initial load", async () => {
    vi.useFakeTimers();
    const localBaseTime = new Date("2026-03-18T10:00:00.000Z");
    const serverBaseMs = localBaseTime.getTime() + 10_000;
    vi.setSystemTime(localBaseTime);

    try {
      gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
        serverTime: toIso(serverBaseMs),
        plots: [
          {
            slotIndex: 1,
            plantId: "bloodleaf",
            phase: "growing",
            plantedAt: toIso(serverBaseMs),
            growthEndsAt: toIso(serverBaseMs + 5_000),
            bloomStartsAt: toIso(serverBaseMs + 5_000),
            bloomEndsAt: toIso(serverBaseMs + 10_000),
            wiltAt: toIso(serverBaseMs + 15_000),
            nextTransitionAt: toIso(serverBaseMs + 5_000),
            harvestYield: null
          },
          ...createGardenState().plots.slice(1)
        ]
      }));

      render(<GardenPanel token="token" />);
      await act(async () => {
        await Promise.resolve();
      });

      expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_growing.png"]')).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });

      expect(document.querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_blooming.png"]')).toBeTruthy();
      expect(
        document
          .querySelector('img[src="/assets/items/generated/garden/bloodleaf/bloodleaf_blooming.png"]')
          ?.className.includes("fx-shake-once")
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fades wilted plants out into the persistent empty slot art when clearing", async () => {
    const nowMs = Date.now();
    let resolveClear: ((value: { garden: GardenStateResponse; clearedSlotIndex: number }) => void) | null = null;
    gardenApiMocks.fetchGardenState.mockResolvedValue(createGardenState({
      serverTime: toIso(nowMs),
      plots: [
        {
          slotIndex: 1,
          plantId: "bloodleaf",
          phase: "wilted",
          plantedAt: toIso(nowMs - 15_000),
          growthEndsAt: toIso(nowMs - 10_000),
          bloomStartsAt: toIso(nowMs - 10_000),
          bloomEndsAt: toIso(nowMs - 5_000),
          wiltAt: toIso(nowMs - 1_000),
          nextTransitionAt: null,
          harvestYield: 0
        },
        ...createGardenState().plots.slice(1)
      ]
    }));
    gardenApiMocks.clearGardenPlot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClear = resolve;
        })
    );

    const { container } = render(<GardenPanel token="token" />);

    await waitFor(() => {
      expect(document.querySelector(".gardenPlantImage.phase-wilted")).toBeTruthy();
    });

    const firstPlotCard = container.querySelector(".gardenPlotCard");
    expect(firstPlotCard).toBeTruthy();
    fireEvent.click(firstPlotCard!);

    expect(document.querySelector(".gardenPlantImage.fx-clear-fade-out")).toBeTruthy();
    expect(firstPlotCard?.querySelector(".gardenPlotBaseImage")).toBeTruthy();

    resolveClear?.({
      garden: createGardenState(),
      clearedSlotIndex: 1
    });
  });
});
