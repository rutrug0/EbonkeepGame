import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRefineryPanelCacheForTests, RefineryPanel } from "../src/features/refinery/RefineryPanel";

const craftingApiMocks = vi.hoisted(() => ({
  fetchCraftingInventory: vi.fn(),
  combineMaterials: vi.fn(),
  craftItem: vi.fn(),
  distillConsumable: vi.fn(),
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
  if (options) {
    return `${key}:${Object.entries(options)
      .map(([name, value]) => `${name}=${value}`)
      .join(",")}`;
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
  distillConsumable: craftingApiMocks.distillConsumable,
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
        itemCode: "consumable_healing_potion",
        quantity: 3,
        itemName: "Healing Potion",
        rarity: "common",
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
    craftingApiMocks.distillConsumable.mockReset();
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

  it("renders healing tiers in one progression row with potent and mythic names", async () => {
    const playerState = createPlayerState();

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [
        { itemCode: "ingredient_bloodleaf", quantity: 3 },
        { itemCode: "ingredient_fenroot", quantity: 3 },
        { itemCode: "reagent_binder_salts", quantity: 3 }
      ],
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

    fireEvent.click(screen.getAllByRole("button", { name: "refineryPanel.recipes" })[0]!);

    const baseButton = await screen.findByRole("button", { name: "Healing Potion" });
    const potentButton = screen.getByRole("button", { name: "Potent Healing Potion" });
    const mythicButton = screen.getByRole("button", { name: "Mythic Healing Potion" });

    const progressionRow = baseButton.closest(".refineryRecipeProgressionRow");
    expect(progressionRow).toBeTruthy();
    expect(potentButton.closest(".refineryRecipeProgressionRow")).toBe(progressionRow);
    expect(mythicButton.closest(".refineryRecipeProgressionRow")).toBe(progressionRow);
    expect(baseButton.querySelector(".refineryRecipeTileTime")?.textContent).toBe("05:00");
    expect(document.body.querySelectorAll(".refineryRecipeProgressionArrow").length).toBeGreaterThan(0);
    expect(
      Array.from(progressionRow?.querySelectorAll(".refineryConsumableTierBadge") ?? []).map((badge) => badge.textContent)
    ).toEqual(["I", "II", "III"]);

    fireEvent.mouseEnter(mythicButton.closest(".refineryRecipeTileWrap")!);

    expect(await screen.findByText("refineryPanel.tooltip.effects")).toBeTruthy();
    expect(screen.getByText("refineryPanel.tooltip.restoreHealth:value=50%")).toBeTruthy();
    expect(screen.getByText("refineryPanel.tooltip.recipe")).toBeTruthy();
  });

  it("shows actual ingredient art and ingredient tooltip content for active crafting inputs", async () => {
    const playerState = createPlayerState();
    const now = Date.now();

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [],
      activeJobs: [
        {
          id: "job_healing",
          slotIndex: 0,
          recipeId: "craft_consumable_healing_potion",
          recipeType: "item",
          startedAt: new Date(now - 30_000).toISOString(),
          finishesAt: new Date(now + 270_000).toISOString(),
          claimed: false
        }
      ]
    });
    playerApiMocks.fetchPlayerState.mockResolvedValue(playerState);

    render(
      <RefineryPanel
        token="token"
        playerState={playerState}
        onPlayerStateChange={vi.fn()}
      />
    );

    const bloodleafSlot = await screen.findByLabelText("refineryPanel.inputSlotLabel:Bloodleaf");
    const fenrootSlot = screen.getByLabelText("refineryPanel.inputSlotLabel:Fenroot");
    const binderSaltsSlot = screen.getByLabelText("refineryPanel.inputSlotLabel:Binder Salts");

    expect(bloodleafSlot.querySelector("img")?.getAttribute("src")).toBe(
      "/assets/items/generated/garden/bloodleaf/bloodleaf_ingredient.png"
    );
    expect(fenrootSlot.querySelector("img")?.getAttribute("src")).toBe(
      "/assets/items/generated/garden/fenroot/fenroot_ingredient.png"
    );
    expect(binderSaltsSlot.querySelector("img")?.getAttribute("src")).toBe("/assets/materials/mat_pitch_resin.png");

    fireEvent.mouseEnter(bloodleafSlot);

    expect(await screen.findByText("Bloodleaf")).toBeTruthy();
    expect(screen.getByText("Bloodleaf, cultivated for Refinery use.")).toBeTruthy();
    expect(screen.queryByText("refineryPanel.tooltip.effects")).toBeNull();
  });

  it("fans out repeated recipe ingredients into separate lane slots", async () => {
    const playerState = createPlayerState();
    const now = Date.now();

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [],
      activeJobs: [
        {
          id: "job_metal_uncommon",
          slotIndex: 0,
          recipeId: "combine_t1_metal_common_to_uncommon",
          recipeType: "combine",
          startedAt: new Date(now - 30_000).toISOString(),
          finishesAt: new Date(now + 270_000).toISOString(),
          claimed: false
        }
      ]
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

    expect(screen.getAllByLabelText("refineryPanel.inputSlotLabel:Iron Sand")).toHaveLength(2);
    expect(screen.getByLabelText("refineryPanel.inputSlotLabel:Amber Resin")).toBeTruthy();
  });

  it("renders roman tier badges for crafting materials in recipes and lane outputs", async () => {
    const playerState = {
      ...createPlayerState(),
      inventory: [
        {
          id: "mat_stack_1",
          itemCode: "mat_t3_metal_common",
          quantity: 1,
          itemName: "Aethersteel Powder",
          rarity: "common",
          category: "Material",
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
        },
        {
          id: "mat_stack_2",
          itemCode: "mat_t3_arcane_common",
          quantity: 1,
          itemName: "Aether Dust",
          rarity: "common",
          category: "Material",
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
        },
        {
          id: "mat_stack_3",
          itemCode: "mat_t3_binding_common",
          quantity: 1,
          itemName: "Obsidian Resin",
          rarity: "common",
          category: "Material",
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
      ]
    } as any;
    const now = new Date();

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [
        { itemCode: "mat_t3_metal_common", quantity: 1 },
        { itemCode: "mat_t3_arcane_common", quantity: 1 },
        { itemCode: "mat_t3_binding_common", quantity: 1 }
      ],
      activeJobs: [
        {
          id: "job_void_core_complete",
          slotIndex: 0,
          recipeId: "combine_t3_arcane_common_to_uncommon",
          recipeType: "combine",
          startedAt: new Date(now.getTime() - (20 * 60 * 1000)).toISOString(),
          finishesAt: new Date(now.getTime() - 1_000).toISOString(),
          claimed: false
        }
      ]
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

    fireEvent.click(screen.getAllByRole("button", { name: "refineryPanel.recipes" })[1]!);
    fireEvent.click(await screen.findByRole("button", { name: "refineryPanel.category.materials" }));

    const voidCoreButton = await screen.findByRole("button", { name: "Void Core" });
    const voidCoreTile = voidCoreButton.closest(".refineryRecipeTile");
    expect(voidCoreTile?.querySelector(".refineryMaterialTierBadge")?.textContent).toBe("III");

    const laneOutput = document.body.querySelector(".refineryOutputSlot");
    expect(laneOutput?.querySelector(".refineryMaterialTierBadge")?.textContent).toBe("III");
  });

  it("shows the item tooltip when hovering an active input slot", async () => {
    const playerState = createPlayerState();
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [],
      activeJobs: [
        {
          id: "job_1",
          slotIndex: 0,
          recipeId: "distill_consumable_healing_potion_d2",
          recipeType: "distill",
          startedAt: now.toISOString(),
          finishesAt: later.toISOString(),
          claimed: false
        }
      ]
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

    const inputSlots = document.body.querySelectorAll(".refineryLaneCard .refinerySlotRow .refinerySlot");
    expect(inputSlots.length).toBeGreaterThan(0);

    fireEvent.mouseEnter(inputSlots[0]!);

    expect(await screen.findByText("Potent Healing Potion")).toBeTruthy();
    expect(screen.getByText("Potent refinement of Healing Potion.")).toBeTruthy();
    expect(screen.getByText("x1")).toBeTruthy();
    expect(screen.queryByText("refineryPanel.tooltip.effects")).toBeNull();
  });

  it("shows the recipe tooltip when hovering a completed output slot", async () => {
    const playerState = createPlayerState();
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const finishedAt = new Date(Date.now() - 60 * 1000);

    craftingApiMocks.fetchCraftingInventory.mockResolvedValue({
      materials: [],
      activeJobs: [
        {
          id: "job_output_1",
          slotIndex: 0,
          recipeId: "distill_consumable_healing_potion_d2",
          recipeType: "distill",
          startedAt: startedAt.toISOString(),
          finishesAt: finishedAt.toISOString(),
          claimed: false
        }
      ]
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

    const outputSlot = document.body.querySelector(".refineryLaneCard .refineryOutputSlot");
    expect(outputSlot).toBeTruthy();

    fireEvent.mouseEnter(outputSlot!);

    expect(await screen.findByText("refineryPanel.tooltip.effects")).toBeTruthy();
    expect(screen.getByText("refineryPanel.tooltip.restoreHealth:value=50%")).toBeTruthy();
    expect(screen.getByText("refineryPanel.tooltip.recipe")).toBeTruthy();
  });

  it("fades lane items on claim and clears the output tooltip immediately", async () => {
    const playerState = createPlayerState();
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const finishedAt = new Date(Date.now() - 60 * 1000);

    craftingApiMocks.fetchCraftingInventory
      .mockResolvedValueOnce({
        materials: [],
        activeJobs: [
          {
            id: "job_claim_1",
            slotIndex: 0,
            recipeId: "distill_consumable_healing_potion_d2",
            recipeType: "distill",
            startedAt: startedAt.toISOString(),
            finishesAt: finishedAt.toISOString(),
            claimed: false
          }
        ]
      })
      .mockResolvedValueOnce({
        materials: [],
        activeJobs: []
      });
    craftingApiMocks.claimCraftingJob.mockResolvedValue({
      success: true,
      item: {
        id: "itm_claimed",
        itemCode: "consumable_healing_potion_d2"
      }
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

    const outputSlot = document.body.querySelector(".refineryLaneCard .refineryOutputSlot");
    expect(outputSlot).toBeTruthy();

    fireEvent.mouseEnter(outputSlot!);
    expect(await screen.findByText("refineryPanel.tooltip.effects")).toBeTruthy();

    fireEvent.click(outputSlot!);

    await waitFor(() => {
      expect(craftingApiMocks.claimCraftingJob).toHaveBeenCalledWith("token", "job_claim_1");
    });

    expect(screen.queryByText("refineryPanel.tooltip.effects")).toBeNull();
    expect(document.body.querySelectorAll(".refinerySlot.isClaiming").length).toBeGreaterThan(0);
    expect(document.body.querySelectorAll(".refinerySlotVisualContent.isClaiming").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(craftingApiMocks.fetchCraftingInventory).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 });
  });

  it("shows Materials and an empty Recycling tab in the recipes menu", async () => {
    const playerState = createPlayerState();

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

    fireEvent.click(screen.getAllByRole("button", { name: "refineryPanel.recipes" })[0]!);

    expect(screen.getByRole("button", { name: "refineryPanel.category.materials" })).toBeTruthy();
    const recyclingButton = screen.getByRole("button", { name: "refineryPanel.category.recycling" });
    expect(recyclingButton).toBeTruthy();

    fireEvent.click(recyclingButton);

    expect(screen.getByText("refineryPanel.emptyRecycling")).toBeTruthy();
  });
});
