import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRefineryPanelCacheForTests, RefineryPanel } from "../src/features/refinery/RefineryPanel";

const craftingApiMocks = vi.hoisted(() => ({
  fetchCraftingInventory: vi.fn(),
  combineMaterials: vi.fn(),
  craftItem: vi.fn(),
  distillPotion: vi.fn(),
  claimCraftingJob: vi.fn()
}));

const playerApiMocks = vi.hoisted(() => ({
  fetchPlayerState: vi.fn()
}));

const refineryTestTranslate = (key: string, options?: Record<string, string | number>) => {
  if (options?.duration) return `${key}:${options.duration}`;
  if (options?.item) return `${key}:${options.item}`;
  if (options?.quantity) return `${key}:${options.quantity}`;
  if (options?.completed !== undefined && options?.total !== undefined) {
    return `${key}:${options.completed}/${options.total}`;
  }
  if (options?.count !== undefined) {
    return `${key}:${options.count}`;
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

vi.mock("../src/features/crafting/api", () => ({
  fetchCraftingInventory: craftingApiMocks.fetchCraftingInventory,
  combineMaterials: craftingApiMocks.combineMaterials,
  craftItem: craftingApiMocks.craftItem,
  distillPotion: craftingApiMocks.distillPotion,
  claimCraftingJob: craftingApiMocks.claimCraftingJob
}));

vi.mock("../src/features/player", () => ({
  fetchPlayerState: playerApiMocks.fetchPlayerState
}));

function createPlayerState() {
  return {
    level: 42,
    inventory: [
      {
        id: "stack_1",
        itemCode: "consumable_vigorous_restorative",
        quantity: 3,
        itemName: "Vigorous Restorative",
        rarity: "uncommon",
        category: "Consumable",
        equipable: false,
        levelRequirement: 1,
        allowedSlotIds: [],
        baseLevel: 1,
        power: 0,
        archetype: {
          majorCategory: "consumable"
        },
        statBonuses: {},
        description: "Used by tests."
      }
    ],
    currency: {
      ducats: 5_000,
      imperials: 0
    }
  } as any;
}

describe("refinery panel", () => {
  beforeEach(() => {
    __resetRefineryPanelCacheForTests();
    craftingApiMocks.fetchCraftingInventory.mockReset();
    craftingApiMocks.combineMaterials.mockReset();
    craftingApiMocks.craftItem.mockReset();
    craftingApiMocks.distillPotion.mockReset();
    craftingApiMocks.claimCraftingJob.mockReset();
    playerApiMocks.fetchPlayerState.mockReset();
  });

  it("reuses the warm crafting response on remount without flashing the loading shell", async () => {
    const playerState = createPlayerState();

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [{ itemCode: "mat_t1_metal_common", quantity: 4 }],
      activeJobs: []
    });
    playerApiMocks.fetchPlayerState.mockResolvedValue(playerState);

    const firstRender = render(
      <RefineryPanel
        token="token"
        playerState={playerState}
        onPlayerStateChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(craftingApiMocks.fetchCraftingInventory).toHaveBeenCalledWith("token");
    });

    expect((await screen.findAllByText("refineryPanel.awaitingRecipe")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("img", { name: "refineryPanel.materialChipLabel:Iron Sand" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "menu.refinery refineryPanel.materialStashTitle" }));
    const ironSandChip = screen.getByRole("img", { name: "refineryPanel.materialChipLabel:Iron Sand" });
    expect(ironSandChip).toBeTruthy();
    expect(ironSandChip.querySelector("img")?.getAttribute("src")).toBe("/assets/materials/mat_iron_ore.png");

    firstRender.unmount();

    render(
      <RefineryPanel
        token="token"
        playerState={playerState}
        onPlayerStateChange={vi.fn()}
      />
    );

    expect(screen.queryByText("refineryPanel.loading")).toBeNull();
    expect(screen.getAllByText("refineryPanel.awaitingRecipe").length).toBeGreaterThan(0);
  });

  it("shows the full refinery material stash when the unlimited refinery cheat is enabled", async () => {
    const playerState = {
      ...createPlayerState(),
      cheatSettings: {
        unlimitedRefineryMaterialsEnabled: true
      }
    } as any;

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [],
      activeJobs: []
    });
    playerApiMocks.fetchPlayerState.mockResolvedValue(playerState);

    render(
      <RefineryPanel
        token="token"
        playerState={playerState}
        onPlayerStateChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(craftingApiMocks.fetchCraftingInventory).toHaveBeenCalledWith("token");
    });

    fireEvent.click(screen.getByRole("button", { name: "menu.refinery refineryPanel.materialStashTitle" }));

    const ironSandChip = screen.getByRole("img", { name: "refineryPanel.materialChipLabel:Iron Sand" });
    expect(ironSandChip).toBeTruthy();
    expect(ironSandChip.querySelector("img")?.getAttribute("src")).toBe("/assets/materials/mat_iron_ore.png");
    expect(screen.getByRole("img", { name: "refineryPanel.materialChipLabel:Voidlord's Ash" })).toBeTruthy();
  });
});
