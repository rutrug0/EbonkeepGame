import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";
import { useTranslation } from "react-i18next";

import { type GardenInventoryEntry, type GardenPlantId, type GardenStateResponse } from "@ebonkeep/shared/garden";

import { GENERATED_ITEM_ICON_PATHS } from "../../generated/itemArtManifest";
import { getGardenIngredientImagePath } from "../garden/assets";
import { fetchGardenState } from "../garden/api";

export type RefineryCategory = "potions" | "recycling";

type RefineryItemTone = "garden" | "reagent" | "scrap" | "potion" | "salvage";

type RefineryItemDefinition = {
  id: string;
  displayName: string;
  shortLabel: string;
  tone: RefineryItemTone;
  plantId?: GardenPlantId;
};

type RefineryRecipeInput = {
  itemId: string;
  perCraft: number;
};

export type RefineryRecipe = {
  id: string;
  category: RefineryCategory;
  displayName: string;
  outputItemId: string;
  outputDisplayName: string;
  inputs: [RefineryRecipeInput, RefineryRecipeInput, RefineryRecipeInput];
};

type RefineryLaneSlot = {
  itemId: string | null;
  initialCount: number;
  remainingCount: number;
  perCraft: number;
};

type RefineryLaneStatus = "idle" | "running" | "complete";

export type RefineryLaneState = {
  laneIndex: number;
  selectedCategory: RefineryCategory;
  status: RefineryLaneStatus;
  selectedRecipeId: string | null;
  queuedTotal: number;
  completedCount: number;
  claimedOutputCount: number;
  outputCount: number;
  cycleStartedAt: number | null;
  outputItemId: string | null;
  inputSlots: [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot];
};

export type RefineryInventoryEntry = {
  itemId: string;
  quantity: number;
};

export type RefineryPanelProps = {
  token: string | null;
};

const REFINERY_BACKGROUND_KEY = "indoors:refinery";
const REFINERY_LANE_COUNT = 3;
const REFINERY_CRAFT_DURATION_MS = 5_000;
const REFINERY_OUTPUT_CLAIM_DURATION_MS = 560;
const EMPTY_LANE_SLOT: RefineryLaneSlot = {
  itemId: null,
  initialCount: 0,
  remainingCount: 0,
  perCraft: 0
};

const ITEM_DEFINITIONS: readonly RefineryItemDefinition[] = [
  { id: "ingredient_bloodleaf", displayName: "Bloodleaf", shortLabel: "BL", tone: "garden", plantId: "bloodleaf" },
  { id: "ingredient_fenroot", displayName: "Fenroot", shortLabel: "FR", tone: "garden", plantId: "fenroot" },
  { id: "ingredient_ironbloom", displayName: "Ironbloom", shortLabel: "IB", tone: "garden", plantId: "ironbloom" },
  { id: "ingredient_duskmint", displayName: "Duskmint", shortLabel: "DM", tone: "garden", plantId: "duskmint" },
  { id: "ingredient_kingsfoil", displayName: "Kingsfoil", shortLabel: "KF", tone: "garden", plantId: "kingsfoil" },
  { id: "binder_salts", displayName: "Binder Salts", shortLabel: "BS", tone: "reagent" },
  { id: "ward_resin", displayName: "Ward Resin", shortLabel: "WR", tone: "reagent" },
  { id: "spoiled_herbs", displayName: "Spoiled Herbs", shortLabel: "SH", tone: "scrap" },
  { id: "cloudy_vials", displayName: "Cloudy Vials", shortLabel: "CV", tone: "scrap" },
  { id: "bent_clasps", displayName: "Bent Clasps", shortLabel: "BC", tone: "scrap" },
  { id: "iron_shards", displayName: "Iron Shards", shortLabel: "IS", tone: "scrap" },
  { id: "coal_dust", displayName: "Coal Dust", shortLabel: "CD", tone: "scrap" },
  { id: "torn_cloth", displayName: "Torn Cloth", shortLabel: "TC", tone: "scrap" },
  { id: "resin_clumps", displayName: "Resin Clumps", shortLabel: "RC", tone: "scrap" },
  { id: "fenroot_fiber", displayName: "Fenroot Fiber", shortLabel: "FF", tone: "scrap" },
  { id: "potion_field_tonic", displayName: "Field Tonic", shortLabel: "FT", tone: "potion" },
  { id: "potion_healing", displayName: "Healing Potion", shortLabel: "HP", tone: "potion" },
  { id: "potion_wardens_draft", displayName: "Warden's Draft", shortLabel: "WD", tone: "potion" },
  { id: "potion_hunters_draft", displayName: "Hunter's Draft", shortLabel: "HD", tone: "potion" },
  { id: "potion_greater_healing", displayName: "Greater Healing Potion", shortLabel: "GH", tone: "potion" },
  { id: "distilled_slurry", displayName: "Distilled Slurry", shortLabel: "DS", tone: "salvage" },
  { id: "salvaged_ingot", displayName: "Salvaged Ingot", shortLabel: "SI", tone: "salvage" },
  { id: "binding_spool", displayName: "Binding Spool", shortLabel: "SP", tone: "salvage" }
];

const REFINERY_RECIPES: readonly RefineryRecipe[] = [
  {
    id: "field-tonic",
    category: "potions",
    displayName: "Field Tonic",
    outputItemId: "potion_field_tonic",
    outputDisplayName: "Field Tonic",
    inputs: [
      { itemId: "ingredient_bloodleaf", perCraft: 1 },
      { itemId: "ingredient_fenroot", perCraft: 1 },
      { itemId: "binder_salts", perCraft: 1 }
    ]
  },
  {
    id: "healing-potion",
    category: "potions",
    displayName: "Healing Potion",
    outputItemId: "potion_healing",
    outputDisplayName: "Healing Potion",
    inputs: [
      { itemId: "ingredient_bloodleaf", perCraft: 1 },
      { itemId: "ingredient_duskmint", perCraft: 1 },
      { itemId: "binder_salts", perCraft: 1 }
    ]
  },
  {
    id: "wardens-draft",
    category: "potions",
    displayName: "Warden's Draft",
    outputItemId: "potion_wardens_draft",
    outputDisplayName: "Warden's Draft",
    inputs: [
      { itemId: "ingredient_ironbloom", perCraft: 1 },
      { itemId: "ingredient_bloodleaf", perCraft: 1 },
      { itemId: "binder_salts", perCraft: 1 }
    ]
  },
  {
    id: "hunters-draft",
    category: "potions",
    displayName: "Hunter's Draft",
    outputItemId: "potion_hunters_draft",
    outputDisplayName: "Hunter's Draft",
    inputs: [
      { itemId: "ingredient_ironbloom", perCraft: 1 },
      { itemId: "ingredient_duskmint", perCraft: 1 },
      { itemId: "binder_salts", perCraft: 1 }
    ]
  },
  {
    id: "greater-healing-potion",
    category: "potions",
    displayName: "Greater Healing Potion",
    outputItemId: "potion_greater_healing",
    outputDisplayName: "Greater Healing Potion",
    inputs: [
      { itemId: "ingredient_bloodleaf", perCraft: 1 },
      { itemId: "ingredient_kingsfoil", perCraft: 1 },
      { itemId: "ward_resin", perCraft: 1 }
    ]
  },
  {
    id: "distilled-residue",
    category: "recycling",
    displayName: "Distilled Residue",
    outputItemId: "distilled_slurry",
    outputDisplayName: "Distilled Slurry",
    inputs: [
      { itemId: "spoiled_herbs", perCraft: 1 },
      { itemId: "cloudy_vials", perCraft: 1 },
      { itemId: "binder_salts", perCraft: 1 }
    ]
  },
  {
    id: "smelt-scrap",
    category: "recycling",
    displayName: "Smelt Scrap",
    outputItemId: "salvaged_ingot",
    outputDisplayName: "Salvaged Ingot",
    inputs: [
      { itemId: "bent_clasps", perCraft: 1 },
      { itemId: "iron_shards", perCraft: 1 },
      { itemId: "coal_dust", perCraft: 1 }
    ]
  },
  {
    id: "press-fiber",
    category: "recycling",
    displayName: "Press Fiber",
    outputItemId: "binding_spool",
    outputDisplayName: "Binding Spool",
    inputs: [
      { itemId: "torn_cloth", perCraft: 1 },
      { itemId: "resin_clumps", perCraft: 1 },
      { itemId: "fenroot_fiber", perCraft: 1 }
    ]
  }
];

const ITEM_DEFINITION_BY_ID = Object.freeze(
  Object.fromEntries(ITEM_DEFINITIONS.map((definition) => [definition.id, definition])) as Record<string, RefineryItemDefinition>
);

const RECIPE_BY_ID = Object.freeze(
  Object.fromEntries(REFINERY_RECIPES.map((recipe) => [recipe.id, recipe])) as Record<string, RefineryRecipe>
);

const MOCK_NON_GARDEN_COUNTS = Object.freeze<Record<string, number>>({
  binder_salts: 12,
  ward_resin: 6,
  spoiled_herbs: 14,
  cloudy_vials: 12,
  bent_clasps: 16,
  iron_shards: 18,
  coal_dust: 14,
  torn_cloth: 15,
  resin_clumps: 10,
  fenroot_fiber: 11
});

function createEmptyLaneState(laneIndex: number): RefineryLaneState {
  return {
    laneIndex,
    selectedCategory: "potions",
    status: "idle",
    selectedRecipeId: null,
    queuedTotal: 0,
    completedCount: 0,
    claimedOutputCount: 0,
    outputCount: 0,
    cycleStartedAt: null,
    outputItemId: null,
    inputSlots: [{ ...EMPTY_LANE_SLOT }, { ...EMPTY_LANE_SLOT }, { ...EMPTY_LANE_SLOT }]
  };
}

function createInitialLaneStates(): RefineryLaneState[] {
  return Array.from({ length: REFINERY_LANE_COUNT }, (_, index) => createEmptyLaneState(index));
}

function formatDurationFromMs(value: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function buildInitialAvailableInventory(gardenState: GardenStateResponse): Record<string, number> {
  const nextInventory: Record<string, number> = {};

  for (const definition of ITEM_DEFINITIONS) {
    nextInventory[definition.id] = 0;
  }

  for (const [itemId, quantity] of Object.entries(MOCK_NON_GARDEN_COUNTS)) {
    nextInventory[itemId] = quantity;
  }

  for (const entry of gardenState.inventory) {
    if (entry.kind !== "ingredient") {
      continue;
    }

    nextInventory[entry.itemCode] = entry.quantity;
  }

  return nextInventory;
}

function getMaxCraftable(recipe: RefineryRecipe, availableInventory: Record<string, number>): number {
  return recipe.inputs.reduce((lowest, input) => {
    const quantity = availableInventory[input.itemId] ?? 0;
    const craftable = Math.floor(quantity / input.perCraft);
    return Math.min(lowest, craftable);
  }, Number.POSITIVE_INFINITY);
}

function getLaneCycleProgressRatio(lane: RefineryLaneState, nowMs: number): number {
  if (lane.status === "complete") {
    return 1;
  }

  if (lane.status !== "running" || lane.cycleStartedAt === null) {
    return 0;
  }

  return Math.min(1, Math.max(0, (nowMs - lane.cycleStartedAt) / REFINERY_CRAFT_DURATION_MS));
}

function getLaneTotalProgressRatio(lane: RefineryLaneState, nowMs: number): number {
  if (lane.queuedTotal <= 0) {
    return 0;
  }

  if (lane.status === "complete") {
    return 1;
  }

  if (lane.status !== "running" || lane.cycleStartedAt === null) {
    return lane.completedCount / lane.queuedTotal;
  }

  const cycleProgress = getLaneCycleProgressRatio(lane, nowMs);
  return Math.min(1, (lane.completedCount + cycleProgress) / lane.queuedTotal);
}

function advanceLaneState(lane: RefineryLaneState, nowMs: number): RefineryLaneState {
  if (lane.status !== "running" || lane.cycleStartedAt === null) {
    return lane;
  }

  const elapsedMs = nowMs - lane.cycleStartedAt;
  const completedCycles = Math.floor(elapsedMs / REFINERY_CRAFT_DURATION_MS);

  if (completedCycles <= 0) {
    return lane;
  }

  const nextCompletedCount = Math.min(lane.queuedTotal, lane.completedCount + completedCycles);
  const appliedCycles = nextCompletedCount - lane.completedCount;

  if (appliedCycles <= 0) {
    return lane;
  }

  const nextInputSlots = lane.inputSlots.map((slot) => {
    if (!slot.itemId) {
      return slot;
    }

    return {
      ...slot,
      remainingCount: Math.max(0, slot.remainingCount - (slot.perCraft * appliedCycles))
    };
  }) as [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot];
  const nextOutputCount = Math.max(0, nextCompletedCount - lane.claimedOutputCount);

  if (nextCompletedCount >= lane.queuedTotal) {
    return {
      ...lane,
      status: "complete",
      completedCount: nextCompletedCount,
      outputCount: nextOutputCount,
      cycleStartedAt: null,
      inputSlots: nextInputSlots
    };
  }

  return {
    ...lane,
    completedCount: nextCompletedCount,
    outputCount: nextOutputCount,
    cycleStartedAt: lane.cycleStartedAt + (appliedCycles * REFINERY_CRAFT_DURATION_MS),
    inputSlots: nextInputSlots
  };
}

function getRecipeRequirementClassName(
  input: RefineryRecipeInput,
  availableInventory: Record<string, number>
): string {
  return (availableInventory[input.itemId] ?? 0) >= input.perCraft ? "isSufficient" : "isInsufficient";
}

function getItemMonogram(itemDefinition: RefineryItemDefinition | null): string {
  if (!itemDefinition) {
    return "";
  }

  return itemDefinition.shortLabel.slice(0, 2).toUpperCase();
}

function getItemImagePath(itemDefinition: RefineryItemDefinition | null): string | null {
  if (!itemDefinition?.plantId) {
    return null;
  }

  return getGardenIngredientImagePath(itemDefinition.plantId);
}

function getRecipeInputsForLane(recipe: RefineryRecipe, queueCount: number): [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot] {
  return recipe.inputs.map((input) => ({
    itemId: input.itemId,
    initialCount: input.perCraft * queueCount,
    remainingCount: input.perCraft * queueCount,
    perCraft: input.perCraft
  })) as [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot];
}

function getGardenIngredientEntries(gardenState: GardenStateResponse | null): GardenInventoryEntry[] {
  return (gardenState?.inventory ?? []).filter((entry) => entry.kind === "ingredient");
}

export function RefineryPanel({ token }: RefineryPanelProps): ReactElement {
  const { t } = useTranslation();
  const [gardenState, setGardenState] = useState<GardenStateResponse | null>(null);
  const [availableInventory, setAvailableInventory] = useState<Record<string, number>>(() =>
    Object.fromEntries(ITEM_DEFINITIONS.map((definition) => [definition.id, 0]))
  );
  const [laneStates, setLaneStates] = useState<RefineryLaneState[]>(() => createInitialLaneStates());
  const [openMenuLaneIndex, setOpenMenuLaneIndex] = useState<number | null>(null);
  const [openMenuCategory, setOpenMenuCategory] = useState<RefineryCategory>("potions");
  const [claimingOutputCountsByLane, setClaimingOutputCountsByLane] = useState<Record<number, number>>({});
  const [inputInsertTokensBySlot, setInputInsertTokensBySlot] = useState<Record<string, number>>({});
  const [inputPulseTokensBySlot, setInputPulseTokensBySlot] = useState<Record<string, number>>({});
  const [outputPulseTokensByLane, setOutputPulseTokensByLane] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const claimTimeoutsRef = useRef<Record<number, number>>({});
  const previousCompletedCountsRef = useRef<number[]>(createInitialLaneStates().map((lane) => lane.completedCount));

  const refineryBackgroundPath = GENERATED_ITEM_ICON_PATHS[REFINERY_BACKGROUND_KEY];
  const sceneStyle = refineryBackgroundPath
    ? ({
        "--indoor-scene-image": `url("${refineryBackgroundPath}")`
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    let isDisposed = false;

    async function loadGardenInventory() {
      setIsLoading(true);
      setError(null);

      if (!token) {
        setGardenState(null);
        setLaneStates(createInitialLaneStates());
        setAvailableInventory(Object.fromEntries(ITEM_DEFINITIONS.map((definition) => [definition.id, 0])));
        setIsLoading(false);
        return;
      }

      try {
        const nextGardenState = await fetchGardenState(token);

        if (isDisposed) {
          return;
        }

        setGardenState(nextGardenState);
        setAvailableInventory(buildInitialAvailableInventory(nextGardenState));
        setLaneStates(createInitialLaneStates());
      } catch (nextError) {
        if (isDisposed) {
          return;
        }

        setGardenState(null);
        setError(nextError instanceof Error ? nextError.message : t("refineryPanel.unavailable"));
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    }

    void loadGardenInventory();

    return () => {
      isDisposed = true;
    };
  }, [token, t]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextNowMs = Date.now();
      setNowMs(nextNowMs);
      setLaneStates((current) => current.map((lane) => advanceLaneState(lane, nextNowMs)));
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => () => {
    for (const timeoutId of Object.values(claimTimeoutsRef.current)) {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    const nextCompletedCounts = laneStates.map((lane) => lane.completedCount);
    const lanesWithNewCrafts = laneStates.filter(
      (lane, laneIndex) => lane.completedCount > (previousCompletedCountsRef.current[laneIndex] ?? 0)
    );

    if (lanesWithNewCrafts.length > 0) {
      setInputPulseTokensBySlot((current) => {
        const nextState = { ...current };

        for (const lane of lanesWithNewCrafts) {
          lane.inputSlots.forEach((slot, slotIndex) => {
            if (!slot.itemId) {
              return;
            }

            const slotKey = `${lane.laneIndex}-${slotIndex}`;
            nextState[slotKey] = (nextState[slotKey] ?? 0) + 1;
          });
        }

        return nextState;
      });

      setOutputPulseTokensByLane((current) => {
        const nextState = { ...current };

        for (const lane of lanesWithNewCrafts) {
          nextState[lane.laneIndex] = (nextState[lane.laneIndex] ?? 0) + 1;
        }

        return nextState;
      });
    }

    previousCompletedCountsRef.current = nextCompletedCounts;
  }, [laneStates]);

  const gardenIngredientEntries = useMemo(() => getGardenIngredientEntries(gardenState), [gardenState]);
  const visibleInventoryEntries = useMemo(
    () =>
      ITEM_DEFINITIONS
        .map((definition) => ({
          definition,
          quantity: availableInventory[definition.id] ?? 0
        }))
        .filter((entry) => entry.quantity > 0)
        .sort((left, right) => left.definition.displayName.localeCompare(right.definition.displayName)),
    [availableInventory]
  );
  const activeMenuRecipes = useMemo(
    () => REFINERY_RECIPES.filter((recipe) => recipe.category === openMenuCategory),
    [openMenuCategory]
  );

  function toggleLaneMenu(laneIndex: number, category: RefineryCategory) {
    setOpenMenuLaneIndex((current) => current === laneIndex ? null : laneIndex);
    setOpenMenuCategory(category);
  }

  function handleRecipeSelect(laneIndex: number, recipe: RefineryRecipe) {
    const lane = laneStates[laneIndex];
    const isClaimingOutput = laneIndex in claimingOutputCountsByLane;

    if (!lane || lane.status === "running" || isClaimingOutput) {
      return;
    }

    const queueCount = getMaxCraftable(recipe, availableInventory);

    if (queueCount <= 0) {
      return;
    }

    setAvailableInventory((current) => {
      const nextInventory = { ...current };

      for (const input of recipe.inputs) {
        nextInventory[input.itemId] = Math.max(0, (nextInventory[input.itemId] ?? 0) - (input.perCraft * queueCount));
      }

      return nextInventory;
    });

    setLaneStates((current) =>
      current.map((entry, entryIndex) => {
        if (entryIndex !== laneIndex) {
          return entry;
        }

        return {
          laneIndex,
          selectedCategory: recipe.category,
          status: "running",
          selectedRecipeId: recipe.id,
          queuedTotal: queueCount,
          completedCount: 0,
          claimedOutputCount: 0,
          outputCount: 0,
          cycleStartedAt: Date.now(),
          outputItemId: recipe.outputItemId,
          inputSlots: getRecipeInputsForLane(recipe, queueCount)
        };
      })
    );

    setInputInsertTokensBySlot((current) => {
      const nextState = { ...current };

      recipe.inputs.forEach((input, slotIndex) => {
        if (!input.itemId) {
          return;
        }

        const slotKey = `${laneIndex}-${slotIndex}`;
        nextState[slotKey] = (nextState[slotKey] ?? 0) + 1;
      });

      return nextState;
    });

    setOpenMenuLaneIndex(null);
  }

  function handleClaimOutput(laneIndex: number) {
    const lane = laneStates[laneIndex];

    if (!lane || lane.outputCount <= 0 || laneIndex in claimingOutputCountsByLane) {
      return;
    }

    const claimedCount = lane.outputCount;

    setOpenMenuLaneIndex((current) => current === laneIndex ? null : current);
    setClaimingOutputCountsByLane((current) => ({
      ...current,
      [laneIndex]: claimedCount
    }));

    setLaneStates((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === laneIndex
          ? {
              ...entry,
              claimedOutputCount: entry.claimedOutputCount + claimedCount,
              outputCount: Math.max(0, entry.completedCount - (entry.claimedOutputCount + claimedCount))
            }
          : entry
      )
    );

    const existingTimeoutId = claimTimeoutsRef.current[laneIndex];
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    claimTimeoutsRef.current[laneIndex] = window.setTimeout(() => {
      setClaimingOutputCountsByLane((current) => {
        const nextState = { ...current };
        delete nextState[laneIndex];
        return nextState;
      });

      delete claimTimeoutsRef.current[laneIndex];
    }, REFINERY_OUTPUT_CLAIM_DURATION_MS);
  }

  function handleClaimOutputKeyDown(event: KeyboardEvent<HTMLElement>, laneIndex: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleClaimOutput(laneIndex);
  }

  if (isLoading) {
    return (
      <section className="contentShell refineryViewportShell">
        <section className="contentStack refineryViewportStack">
          <article className="contentCard refineryPanelCard indoorSceneShell" style={sceneStyle}>
            <h2>{t("menu.refinery")}</h2>
            <p>{t("refineryPanel.loading")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (!gardenState) {
    return (
      <section className="contentShell refineryViewportShell">
        <section className="contentStack refineryViewportStack">
          <article className="contentCard refineryPanelCard indoorSceneShell" style={sceneStyle}>
            <h2>{t("menu.refinery")}</h2>
            <p>{error ?? t("refineryPanel.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <section className="contentShell refineryViewportShell">
      <section className="contentStack refineryViewportStack">
        <article className="contentCard refineryPanelCard indoorSceneShell" style={sceneStyle}>
          {error ? <p className="error">{error}</p> : null}

          <section className="refineryCraftInventoryBar" aria-label={t("refineryPanel.materialStashTitle")}>
            <div className="refineryCraftInventoryScroller">
              {visibleInventoryEntries.map(({ definition, quantity }) => {
                const itemImagePath = getItemImagePath(definition);
                const tooltipId = `refinery-material-tooltip-${definition.id}`;

                return (
                  <div
                    key={definition.id}
                    className="uiHoverTooltipTrigger refineryInventoryChip"
                    role="img"
                    tabIndex={0}
                    aria-label={t("refineryPanel.materialChipLabel", {
                      item: definition.displayName,
                      quantity
                    })}
                    aria-describedby={tooltipId}
                  >
                    <div className="refineryInventoryChipIcon">
                      {itemImagePath ? (
                        <img src={itemImagePath} alt="" loading="lazy" draggable={false} />
                      ) : (
                        <span>{getItemMonogram(definition)}</span>
                      )}
                    </div>
                    <span className="refineryInventoryChipCount">{quantity.toLocaleString()}</span>
                    <div id={tooltipId} className="uiHoverTooltip gardenIngredientTooltip" role="tooltip">
                      <p className="uiHoverTooltipLine">
                        <strong>{definition.displayName}</strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="refineryLaneList">
            {laneStates.map((lane) => {
              const outputDefinition = lane.outputItemId ? ITEM_DEFINITION_BY_ID[lane.outputItemId] ?? null : null;
              const isClaimingOutput = lane.laneIndex in claimingOutputCountsByLane;
              const claimingOutputCount = claimingOutputCountsByLane[lane.laneIndex] ?? 0;
              const outputPulseToken = outputPulseTokensByLane[lane.laneIndex] ?? 0;
              const showOutputItem = Boolean(outputDefinition) && (lane.outputCount > 0 || isClaimingOutput);
              const nextCraftMsRemaining =
                lane.status === "running" && lane.cycleStartedAt !== null
                  ? Math.max(0, REFINERY_CRAFT_DURATION_MS - (nowMs - lane.cycleStartedAt))
                  : 0;
              const totalProgressRatio = getLaneTotalProgressRatio(lane, nowMs);
              const cycleProgressRatio = getLaneCycleProgressRatio(lane, nowMs);

              return (
                <section key={lane.laneIndex} className="refineryLaneCard">
                  <div className="refineryLaneBody">
                    <div className="refinerySlotRow">
                      {lane.inputSlots.map((slot, slotIndex) => {
                        const itemDefinition = slot.itemId ? ITEM_DEFINITION_BY_ID[slot.itemId] ?? null : null;
                        const itemImagePath = getItemImagePath(itemDefinition);
                        const inputInsertToken = inputInsertTokensBySlot[`${lane.laneIndex}-${slotIndex}`] ?? 0;
                        const inputPulseToken = inputPulseTokensBySlot[`${lane.laneIndex}-${slotIndex}`] ?? 0;

                        return (
                          <article
                            key={`${lane.laneIndex}-${slotIndex}`}
                            className={`refinerySlot rarity-common${itemDefinition ? ` tone-${itemDefinition.tone}` : ""}`}
                            aria-label={
                              itemDefinition
                                ? t("refineryPanel.inputSlotLabel", {
                                    item: itemDefinition.displayName,
                                    quantity: slot.remainingCount
                                  })
                                : t("refineryPanel.emptyInput")
                            }
                          >
                            <div className="refinerySlotVisual">
                              {itemDefinition ? (
                                <span
                                  key={`${lane.laneIndex}-${slotIndex}-${inputInsertToken}-${inputPulseToken}`}
                                  className={`refinerySlotVisualContent${
                                    inputInsertToken > 0 && inputPulseToken === 0 ? " isInsert" : ""
                                  }${inputPulseToken > 0 ? " isPulse" : ""}`}
                                >
                                  {itemImagePath ? (
                                    <img src={itemImagePath} alt="" loading="lazy" draggable={false} />
                                  ) : (
                                    <span className="refinerySlotFallback">{getItemMonogram(itemDefinition)}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="refinerySlotPlaceholder">{t("refineryPanel.inputPlaceholder")}</span>
                              )}
                              {itemDefinition ? (
                                <strong className="refinerySlotCountBadge">{slot.remainingCount.toLocaleString()}</strong>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="refineryProgressSection" aria-label={t("refineryPanel.progressLabel")}>
                      <div className="refineryProgressTrack">
                        <div className="refineryProgressFill" style={{ width: `${totalProgressRatio * 100}%` }} />
                      </div>

                      <div className="refineryProgressTrack refineryProgressTrackSecondary">
                        <div
                          className="refineryProgressFill refineryProgressFillSecondary"
                          style={{ width: `${cycleProgressRatio * 100}%` }}
                        />
                      </div>

                      <div className="refineryProgressMeta">
                        <span>{t("refineryPanel.queueLabel", { completed: lane.completedCount, total: lane.queuedTotal })}</span>
                        {lane.status === "running" ? (
                          <strong>{t("refineryPanel.nextCraftIn", { duration: formatDurationFromMs(nextCraftMsRemaining) })}</strong>
                        ) : lane.status === "complete" ? (
                          <strong>{t("refineryPanel.queueComplete")}</strong>
                        ) : (
                          <strong>{t("refineryPanel.awaitingRecipe")}</strong>
                        )}
                      </div>
                    </div>

                    <article
                      className={`refinerySlot refineryOutputSlot rarity-common${outputDefinition ? ` tone-${outputDefinition.tone}` : ""}${
                        lane.outputCount > 0 && !isClaimingOutput ? " isClaimable" : ""
                      }${isClaimingOutput ? " isClaiming" : ""}`}
                      aria-label={
                        showOutputItem && outputDefinition
                          ? t("refineryPanel.outputSlotLabel", {
                              item: outputDefinition.displayName,
                              quantity: lane.outputCount
                            })
                          : t("refineryPanel.emptyOutput")
                      }
                      role={lane.outputCount > 0 && !isClaimingOutput ? "button" : undefined}
                      aria-disabled={lane.outputCount > 0 && !isClaimingOutput ? undefined : true}
                      tabIndex={lane.outputCount > 0 && !isClaimingOutput ? 0 : -1}
                      onClick={() => handleClaimOutput(lane.laneIndex)}
                      onKeyDown={(event) => handleClaimOutputKeyDown(event, lane.laneIndex)}
                    >
                      <div className="refinerySlotVisual">
                        {showOutputItem && outputDefinition ? (
                          <span
                            key={`${lane.laneIndex}-${outputPulseToken}-${claimingOutputCount}`}
                            className={`refinerySlotVisualContent refineryOutputVisualContent${
                              outputPulseToken > 0 ? " isPulse" : ""
                            }${isClaimingOutput ? " isClaiming" : ""}`}
                          >
                            <span className="refinerySlotFallback">{getItemMonogram(outputDefinition)}</span>
                          </span>
                        ) : null}
                        {showOutputItem && outputDefinition ? (
                          <strong className="refinerySlotCountBadge">
                            {(isClaimingOutput ? claimingOutputCount : lane.outputCount).toLocaleString()}
                          </strong>
                        ) : null}
                      </div>
                    </article>

                    <div className="refineryLaneActions">
                      <button
                        type="button"
                        className="gardenActionButton refineryRecipesButton"
                        onClick={() => toggleLaneMenu(lane.laneIndex, lane.selectedCategory)}
                        disabled={lane.status === "running" || isClaimingOutput}
                        aria-expanded={openMenuLaneIndex === lane.laneIndex}
                      >
                        {t("refineryPanel.recipes")}
                      </button>

                      {openMenuLaneIndex === lane.laneIndex ? (
                        <div className="refineryRecipeMenu" role="dialog" aria-label={t("refineryPanel.recipes")}>
                          <div className="refineryRecipeCategoryRow">
                            {(["potions", "recycling"] as RefineryCategory[]).map((category) => (
                              <button
                                key={category}
                                type="button"
                                className={`refineryRecipeCategoryButton${openMenuCategory === category ? " isActive" : ""}`}
                                onClick={() => setOpenMenuCategory(category)}
                              >
                                {t(`refineryPanel.category.${category}`)}
                              </button>
                            ))}
                          </div>

                          <div className="refineryRecipeGrid">
                            {activeMenuRecipes.map((recipe) => {
                              const maxCraftable = getMaxCraftable(recipe, availableInventory);
                              const isDisabled = maxCraftable <= 0;
                              const outputItem = ITEM_DEFINITION_BY_ID[recipe.outputItemId] ?? null;

                              return (
                                <div
                                  key={recipe.id}
                                  className={`uiHoverTooltipTrigger refineryRecipeTileWrap${isDisabled ? " isDisabled" : ""}`}
                                >
                                  <button
                                    type="button"
                                    className={`refineryRecipeTile${isDisabled ? " isDisabled" : ""}${outputItem ? ` tone-${outputItem.tone}` : ""}`}
                                    onClick={() => handleRecipeSelect(lane.laneIndex, recipe)}
                                    disabled={isDisabled}
                                    aria-label={recipe.displayName}
                                  >
                                    <span className="refineryRecipeTileIcon">{getItemMonogram(outputItem)}</span>
                                    <span className="refineryRecipeTileName">{recipe.displayName}</span>
                                    <span className="refineryRecipeTileCount">
                                      {t("refineryPanel.maxCraftable", { count: maxCraftable })}
                                    </span>
                                  </button>

                                  <div className="uiHoverTooltip refineryRecipeTooltip" role="tooltip">
                                    <p className="uiHoverTooltipTitle">{recipe.displayName}</p>
                                    {recipe.inputs.map((input) => {
                                      const inputDefinition = ITEM_DEFINITION_BY_ID[input.itemId] ?? null;
                                      const available = availableInventory[input.itemId] ?? 0;

                                      return (
                                        <p
                                          key={`${recipe.id}-${input.itemId}`}
                                          className={`uiHoverTooltipLine refineryRecipeRequirement ${getRecipeRequirementClassName(input, availableInventory)}`}
                                        >
                                          <strong>{inputDefinition?.displayName ?? input.itemId}</strong>{" "}
                                          {input.perCraft} / {available}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            })}
          </section>

          {gardenIngredientEntries.length === 0 ? (
            <p className="refineryPanelHint">{t("refineryPanel.noGardenIngredientsHint")}</p>
          ) : null}
        </article>
      </section>
    </section>
  );
}
