import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  CRAFTING_JOB_SLOT_INDEXES,
  CRAFTING_MATERIALS,
  CRAFTING_RECYCLING_ITEM_CODES,
  ITEM_CRAFT_RECIPES,
  ITEM_CRAFT_RECIPE_BY_ID,
  MATERIAL_COMBINE_RECIPES,
  MATERIAL_COMBINE_RECIPE_BY_ID,
  POTION_DISTILLATION_RECIPES,
  POTION_DISTILLATION_RECIPE_BY_ID,
  getCraftingMaterialDefinition,
  getCraftingOutputDefinition,
  type CraftingInventoryResponse,
  type CraftingJob,
  type CraftingRecipeType,
  type ItemCraftRecipe,
  type MaterialCombineRecipe
} from "@ebonkeep/shared/crafting";
import { type PlayerState } from "@ebonkeep/shared/player";

import { getUploadedItemIconPathByItemCode } from "../../lib/itemIcons";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";
import {
  claimCraftingJob,
  combineMaterials,
  craftItem,
  distillPotion,
  fetchCraftingInventory
} from "../crafting/api";
import { fetchPlayerState } from "../player";

export type RefineryCategory = "potions" | "recycling";

type RefineryItemTone = "garden" | "reagent" | "scrap" | "potion" | "salvage";

type RefineryItemDefinition = {
  id: string;
  displayName: string;
  shortLabel: string;
  tone: RefineryItemTone;
};

type RefineryRecipeInput = {
  itemId: string;
  perCraft: number;
};

export type RefineryRecipe = {
  id: string;
  category: RefineryCategory;
  recipeType: CraftingRecipeType;
  displayName: string;
  outputItemId: string;
  outputDisplayName: string;
  outputQuantity: number;
  ducatCost: number;
  craftingTimeSec: number;
  requiredPlayerLevel: number;
  inputs: readonly RefineryRecipeInput[];
};

export type RefineryInventoryEntry = {
  itemId: string;
  quantity: number;
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
  cycleFinishesAt: number | null;
  outputItemId: string | null;
  jobId: string | null;
  inputSlots: [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot];
};

export type RefineryPanelProps = {
  token: string | null;
  playerState: PlayerState | null;
  onPlayerStateChange: (playerState: PlayerState) => void;
  onFirstPaintReadyChange?: (ready: boolean) => void;
};

type RefineryPanelCacheEntry = {
  inventorySnapshot: CraftingInventoryResponse | null;
  playerState: PlayerState | null;
  error: string | null;
  hasSettled: boolean;
};

const REFINERY_OUTPUT_CLAIM_DURATION_MS = 560;
const REFINERY_LANE_COUNT = CRAFTING_JOB_SLOT_INDEXES.length;
const UNLIMITED_REFINERY_CHEAT_QUANTITY = 999;
const refineryPanelCacheByToken = new Map<string, RefineryPanelCacheEntry>();

const MATERIAL_SUBSTITUTIONS: Record<string, readonly string[]> = {
  mat_t1_metal_common: ["all_salvaged_ingot"],
  mat_t1_binding_common: ["all_binding_spool"],
  mat_t1_nature_common: ["all_distilled_slurry"]
};

const RANDOM_MATERIAL_IMAGE_FILES: readonly string[] = Array.from(
  { length: 23 },
  (_, index) => `material-${(index + 1).toString().padStart(2, "0")}.png`
);

const CRAFTING_PUBLIC_ASSET_BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

const craftingVisualPathCache = new Map<string, string>();

const EMPTY_LANE_SLOT: RefineryLaneSlot = {
  itemId: null,
  initialCount: 0,
  remainingCount: 0,
  perCraft: 0
};

const REFINERY_STASH_ITEM_CODES = Object.freeze([
  ...CRAFTING_MATERIALS.map((material) => material.itemCode),
  ...CRAFTING_RECYCLING_ITEM_CODES
]);

const REFINERY_STASH_ITEM_CODE_SET = new Set<string>(REFINERY_STASH_ITEM_CODES);

const REFINERY_RELEVANT_ITEM_CODES = Object.freeze(
  Array.from(
    new Set([
      ...CRAFTING_MATERIALS.map((material) => material.itemCode),
      ...CRAFTING_RECYCLING_ITEM_CODES,
      ...MATERIAL_COMBINE_RECIPES.flatMap((recipe) => [
        recipe.outputItemCode,
        ...recipe.ingredients.map((ingredient) => ingredient.itemCode)
      ]),
      ...ITEM_CRAFT_RECIPES.flatMap((recipe) => [
        recipe.outputItemType,
        ...recipe.ingredients.map((ingredient) => ingredient.itemCode)
      ]),
      ...POTION_DISTILLATION_RECIPES.flatMap((recipe) => [
        recipe.outputItemType,
        ...recipe.ingredients.map((ingredient) => ingredient.itemCode)
      ])
    ])
  )
);

function readRefineryPanelCache(token: string | null): RefineryPanelCacheEntry | null {
  if (!token) {
    return null;
  }

  return refineryPanelCacheByToken.get(token) ?? null;
}

export function __resetRefineryPanelCacheForTests() {
  refineryPanelCacheByToken.clear();
  craftingVisualPathCache.clear();
}

function formatHumanToken(token: string): string {
  if (/^t\d$/i.test(token)) {
    return token.toUpperCase();
  }
  if (token.toLowerCase() === "d1") {
    return "Distilled I";
  }
  if (token.toLowerCase() === "d2") {
    return "Distilled II";
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function humanizeCode(code: string): string {
  if (code.startsWith("forge_catalyst_")) {
    const tokens = code.replace(/^forge_catalyst_/, "").split("_");
    return ["Forge", "Catalyst", ...tokens.map(formatHumanToken)].join(" ");
  }

  return code
    .replace(/^mat_t\d_/, "")
    .replace(/^reagent_/, "")
    .replace(/^all_/, "")
    .replace(/^consumable_/, "")
    .replace(/_d1$/, " distilled i")
    .replace(/_d2$/, " distilled ii")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getItemDisplayName(itemCode: string, playerState: PlayerState | null): string {
  const materialDefinition = getCraftingMaterialDefinition(itemCode);
  if (materialDefinition) {
    return materialDefinition.displayName;
  }

  if (itemCode.startsWith("forge_catalyst_")) {
    return humanizeCode(itemCode);
  }

  const outputDefinition = getCraftingOutputDefinition(itemCode);
  if (outputDefinition) {
    return outputDefinition.displayName;
  }

  const inventoryItem = playerState?.inventory.find((entry) => entry.itemCode === itemCode);
  if (inventoryItem?.itemName) {
    return inventoryItem.itemName;
  }

  return humanizeCode(itemCode);
}

function getShortLabel(displayName: string): string {
  const compact = displayName
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (compact.length === 0) {
    return "??";
  }

  if (compact.length === 1) {
    return compact[0].slice(0, 2).toUpperCase().padEnd(2, compact[0].charAt(0).toUpperCase());
  }

  return `${compact[0][0] ?? ""}${compact[1][0] ?? ""}`.toUpperCase();
}

function getItemTone(itemCode: string): RefineryItemTone {
  if (itemCode.startsWith("consumable_")) {
    return "potion";
  }
  if (
    itemCode.startsWith("reagent_")
    || itemCode.startsWith("forge_catalyst_")
    || itemCode.startsWith("all_tempering_")
  ) {
    return "reagent";
  }
  if (itemCode.startsWith("mat_") || itemCode.startsWith("all_")) {
    return "salvage";
  }
  return "salvage";
}

function buildItemDefinition(itemCode: string, playerState: PlayerState | null): RefineryItemDefinition {
  const displayName = getItemDisplayName(itemCode, playerState);
  return {
    id: itemCode,
    displayName,
    shortLabel: getShortLabel(displayName),
    tone: getItemTone(itemCode)
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function getCraftingVisualPath(itemCode: string): string {
  const cachedPath = craftingVisualPathCache.get(itemCode);
  if (cachedPath) {
    return cachedPath;
  }

  const randomIndex = hashString(itemCode) % RANDOM_MATERIAL_IMAGE_FILES.length;
  const file = RANDOM_MATERIAL_IMAGE_FILES[randomIndex];
  const assetPath = `${CRAFTING_PUBLIC_ASSET_BASE}assets/random_stuff_materials/${file}`;
  craftingVisualPathCache.set(itemCode, assetPath);
  return assetPath;
}

function getItemImagePath(itemDefinition: RefineryItemDefinition | null): string | null {
  if (!itemDefinition) {
    return null;
  }
  return getUploadedItemIconPathByItemCode(itemDefinition.id) ?? getCraftingVisualPath(itemDefinition.id);
}

function createEmptyLaneState(
  laneIndex: number,
  selectedCategory: RefineryCategory = "potions"
): RefineryLaneState {
  return {
    laneIndex,
    selectedCategory,
    status: "idle",
    selectedRecipeId: null,
    queuedTotal: 0,
    completedCount: 0,
    claimedOutputCount: 0,
    outputCount: 0,
    cycleStartedAt: null,
    cycleFinishesAt: null,
    outputItemId: null,
    jobId: null,
    inputSlots: [{ ...EMPTY_LANE_SLOT }, { ...EMPTY_LANE_SLOT }, { ...EMPTY_LANE_SLOT }]
  };
}

function createInitialLaneStates(): RefineryLaneState[] {
  return Array.from({ length: REFINERY_LANE_COUNT }, (_, index) => createEmptyLaneState(index));
}

function formatDurationFromMs(value: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(value / 1000));
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getRecipeRequirementClassName(
  input: RefineryRecipeInput,
  availableInventory: Record<string, number>
): string {
  return getAvailableQuantityForItem(input.itemId, availableInventory) >= input.perCraft
    ? "isSufficient"
    : "isInsufficient";
}

function getItemMonogram(itemDefinition: RefineryItemDefinition | null): string {
  if (!itemDefinition) {
    return "";
  }
  return itemDefinition.shortLabel.slice(0, 2).toUpperCase();
}

function buildPlayerInventoryCounts(playerState: PlayerState | null): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of playerState?.inventory ?? []) {
    if (!REFINERY_RELEVANT_ITEM_CODES.includes(entry.itemCode)) {
      continue;
    }
    if (REFINERY_STASH_ITEM_CODE_SET.has(entry.itemCode)) {
      continue;
    }

    counts[entry.itemCode] = (counts[entry.itemCode] ?? 0) + (entry.quantity ?? 1);
  }

  return counts;
}

function buildCraftingMaterialCounts(
  inventorySnapshot: CraftingInventoryResponse | null
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of inventorySnapshot?.materials ?? []) {
    counts[entry.itemCode] = (counts[entry.itemCode] ?? 0) + entry.quantity;
  }

  return counts;
}

function buildAvailableInventory(
  inventorySnapshot: CraftingInventoryResponse | null,
  playerState: PlayerState | null,
  unlimitedRefineryMaterialsEnabled = false
): Record<string, number> {
  const nextInventory: Record<string, number> = {};

  for (const itemCode of REFINERY_RELEVANT_ITEM_CODES) {
    nextInventory[itemCode] = unlimitedRefineryMaterialsEnabled
      ? UNLIMITED_REFINERY_CHEAT_QUANTITY
      : 0;
  }

  if (unlimitedRefineryMaterialsEnabled) {
    return nextInventory;
  }

  for (const [itemCode, quantity] of Object.entries(buildCraftingMaterialCounts(inventorySnapshot))) {
    nextInventory[itemCode] = (nextInventory[itemCode] ?? 0) + quantity;
  }

  for (const [itemCode, quantity] of Object.entries(buildPlayerInventoryCounts(playerState))) {
    nextInventory[itemCode] = (nextInventory[itemCode] ?? 0) + quantity;
  }

  return nextInventory;
}

function getAvailableQuantityForItem(
  itemCode: string,
  availableInventory: Record<string, number>
): number {
  const directQuantity = availableInventory[itemCode] ?? 0;
  const substitutionQuantity = (MATERIAL_SUBSTITUTIONS[itemCode] ?? []).reduce(
    (sum, substitutionCode) => sum + (availableInventory[substitutionCode] ?? 0),
    0
  );
  return directQuantity + substitutionQuantity;
}

function getMaxCraftable(recipe: RefineryRecipe, availableInventory: Record<string, number>): number {
  return recipe.inputs.reduce((lowest, input) => {
    const quantity = getAvailableQuantityForItem(input.itemId, availableInventory);
    const craftable = Math.floor(quantity / input.perCraft);
    return Math.min(lowest, craftable);
  }, Number.POSITIVE_INFINITY);
}

function getRefineryCategoryForItemRecipe(recipe: ItemCraftRecipe): RefineryCategory {
  return recipe.category === "raid_consumable" || recipe.category === "distillation"
    ? "potions"
    : "recycling";
}

function toRefineryRecipe(recipe: MaterialCombineRecipe): RefineryRecipe;
function toRefineryRecipe(recipe: ItemCraftRecipe, recipeType?: "item" | "distill"): RefineryRecipe;
function toRefineryRecipe(
  recipe: MaterialCombineRecipe | ItemCraftRecipe,
  recipeType: "combine" | "item" | "distill" = "combine"
): RefineryRecipe {
  if ("outputItemCode" in recipe) {
    return {
      id: recipe.recipeId,
      category: "recycling",
      recipeType: "combine",
      displayName: getItemDisplayName(recipe.outputItemCode, null),
      outputItemId: recipe.outputItemCode,
      outputDisplayName: getItemDisplayName(recipe.outputItemCode, null),
      outputQuantity: recipe.outputQuantity,
      ducatCost: recipe.ducatCost,
      craftingTimeSec: recipe.craftingTimeSec,
      requiredPlayerLevel: 1,
      inputs: recipe.ingredients.map((ingredient) => ({
        itemId: ingredient.itemCode,
        perCraft: ingredient.quantity
      }))
    };
  }

  return {
    id: recipe.recipeId,
    category: recipeType === "distill" ? "potions" : getRefineryCategoryForItemRecipe(recipe),
    recipeType,
    displayName: getItemDisplayName(recipe.outputItemType, null),
    outputItemId: recipe.outputItemType,
    outputDisplayName: getItemDisplayName(recipe.outputItemType, null),
    outputQuantity: 1,
    ducatCost: recipe.ducatCost,
    craftingTimeSec: recipe.craftingTimeSec,
    requiredPlayerLevel: recipe.requiredPlayerLevel,
    inputs: recipe.ingredients.map((ingredient) => ({
      itemId: ingredient.itemCode,
      perCraft: ingredient.quantity
    }))
  };
}

const REFINERY_RECIPES: readonly RefineryRecipe[] = [
  ...MATERIAL_COMBINE_RECIPES.map((recipe) => toRefineryRecipe(recipe)),
  ...ITEM_CRAFT_RECIPES.map((recipe) => toRefineryRecipe(recipe, "item")),
  ...POTION_DISTILLATION_RECIPES.map((recipe) => toRefineryRecipe(recipe, "distill"))
];

function getRecipeForJob(job: CraftingJob): RefineryRecipe | null {
  if (job.recipeType === "combine") {
    const recipe = MATERIAL_COMBINE_RECIPE_BY_ID[job.recipeId];
    return recipe ? toRefineryRecipe(recipe) : null;
  }
  if (job.recipeType === "item") {
    const recipe = ITEM_CRAFT_RECIPE_BY_ID[job.recipeId];
    return recipe ? toRefineryRecipe(recipe, "item") : null;
  }
  const recipe = POTION_DISTILLATION_RECIPE_BY_ID[job.recipeId];
  return recipe ? toRefineryRecipe(recipe, "distill") : null;
}

function getRecipeInputSlots(
  recipe: RefineryRecipe,
  isComplete: boolean
): [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot] {
  return Array.from({ length: 3 }, (_, index) => {
    const input = recipe.inputs[index];
    if (!input) {
      return { ...EMPTY_LANE_SLOT };
    }

    return {
      itemId: input.itemId,
      initialCount: input.perCraft,
      remainingCount: isComplete ? 0 : input.perCraft,
      perCraft: input.perCraft
    };
  }) as [RefineryLaneSlot, RefineryLaneSlot, RefineryLaneSlot];
}

function buildLaneStateFromJob(
  laneIndex: number,
  job: CraftingJob | null,
  selectedCategory: RefineryCategory,
  nowMs: number
): RefineryLaneState {
  if (!job) {
    return createEmptyLaneState(laneIndex, selectedCategory);
  }

  const recipe = getRecipeForJob(job);
  if (!recipe) {
    return createEmptyLaneState(laneIndex, selectedCategory);
  }

  const startedAtMs = Date.parse(job.startedAt);
  const finishesAtMs = Date.parse(job.finishesAt);
  const isComplete = nowMs >= finishesAtMs;

  return {
    laneIndex,
    selectedCategory: recipe.category,
    status: isComplete ? "complete" : "running",
    selectedRecipeId: recipe.id,
    queuedTotal: 1,
    completedCount: isComplete ? 1 : 0,
    claimedOutputCount: 0,
    outputCount: isComplete ? recipe.outputQuantity : 0,
    cycleStartedAt: startedAtMs,
    cycleFinishesAt: finishesAtMs,
    outputItemId: recipe.outputItemId,
    jobId: job.id,
    inputSlots: getRecipeInputSlots(recipe, isComplete)
  };
}

function getLaneCycleProgressRatio(lane: RefineryLaneState, nowMs: number): number {
  if (lane.status === "complete") {
    return 1;
  }

  if (
    lane.status !== "running"
    || lane.cycleStartedAt === null
    || lane.cycleFinishesAt === null
    || lane.cycleFinishesAt <= lane.cycleStartedAt
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(0, (nowMs - lane.cycleStartedAt) / (lane.cycleFinishesAt - lane.cycleStartedAt))
  );
}

function getLaneTotalProgressRatio(lane: RefineryLaneState, nowMs: number): number {
  if (lane.queuedTotal <= 0) {
    return 0;
  }

  if (lane.status === "complete") {
    return 1;
  }

  return getLaneCycleProgressRatio(lane, nowMs);
}

export function RefineryPanel({
  token,
  playerState,
  onPlayerStateChange,
  onFirstPaintReadyChange
}: RefineryPanelProps): ReactElement {
  const { t } = useTranslation("common");
  const initialCacheEntry = readRefineryPanelCache(token);
  const [inventorySnapshot, setInventorySnapshot] = useState<CraftingInventoryResponse | null>(
    () => initialCacheEntry?.inventorySnapshot ?? null
  );
  const [playerStateSnapshot, setPlayerStateSnapshot] = useState<PlayerState | null>(
    () => initialCacheEntry?.playerState ?? null
  );
  const [openMenuLaneIndex, setOpenMenuLaneIndex] = useState<number | null>(null);
  const [openMenuCategory, setOpenMenuCategory] = useState<RefineryCategory>("potions");
  const [laneCategoryPreferences, setLaneCategoryPreferences] = useState<Record<number, RefineryCategory>>({});
  const [claimingOutputCountsByLane, setClaimingOutputCountsByLane] = useState<Record<number, number>>({});
  const [inputInsertTokensBySlot, setInputInsertTokensBySlot] = useState<Record<string, number>>({});
  const [inputPulseTokensBySlot, setInputPulseTokensBySlot] = useState<Record<string, number>>({});
  const [outputPulseTokensByLane, setOutputPulseTokensByLane] = useState<Record<number, number>>({});
  const [pendingLaneIndex, setPendingLaneIndex] = useState<number | null>(null);
  const [isMaterialStashExpanded, setIsMaterialStashExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(() => Boolean(token) && !initialCacheEntry?.hasSettled);
  const [error, setError] = useState<string | null>(() => initialCacheEntry?.error ?? null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const claimTimeoutsRef = useRef<Record<number, number>>({});
  const previousCompletedCountsRef = useRef<number[]>(
    createInitialLaneStates().map((lane) => lane.completedCount)
  );
  const onPlayerStateChangeRef = useRef(onPlayerStateChange);
  onPlayerStateChangeRef.current = onPlayerStateChange;
  const onFirstPaintReadyChangeRef = useRef(onFirstPaintReadyChange);
  onFirstPaintReadyChangeRef.current = onFirstPaintReadyChange;

  const sceneStyle = getViewBackgroundStyle("refinery") as CSSProperties;
  const effectivePlayerState = playerState ?? playerStateSnapshot;
  const unlimitedRefineryMaterialsEnabled = Boolean(
    effectivePlayerState?.cheatSettings?.unlimitedRefineryMaterialsEnabled
  );

  async function refreshState(activeToken: string): Promise<void> {
    const [nextInventory, nextPlayerState] = await Promise.all([
      fetchCraftingInventory(activeToken),
      fetchPlayerState(activeToken)
    ]);

    setInventorySnapshot(nextInventory);
    setPlayerStateSnapshot(nextPlayerState);
    onPlayerStateChangeRef.current(nextPlayerState);
  }

  useEffect(() => {
    let isDisposed = false;

    async function loadCraftingData() {
      const shouldShowSpinner = !initialCacheEntry?.hasSettled;
      if (shouldShowSpinner) {
        setIsLoading(true);
      }
      setError(null);

      if (!token) {
        refineryPanelCacheByToken.clear();
        setInventorySnapshot(null);
        setPlayerStateSnapshot(null);
        setOpenMenuLaneIndex(null);
        setClaimingOutputCountsByLane({});
        setPendingLaneIndex(null);
        setIsLoading(false);
        return;
      }

      try {
        const [nextInventory, nextPlayerState] = await Promise.all([
          fetchCraftingInventory(token),
          fetchPlayerState(token)
        ]);

        if (isDisposed) {
          return;
        }

        setInventorySnapshot(nextInventory);
        setPlayerStateSnapshot(nextPlayerState);
        onPlayerStateChangeRef.current(nextPlayerState);
      } catch (nextError) {
        if (isDisposed) {
          return;
        }

        const nextErrorMessage =
          nextError instanceof Error ? nextError.message : t("refineryPanel.unavailable");
        setInventorySnapshot((current) => (shouldShowSpinner || !current ? null : current));
        setError(nextErrorMessage);
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    }

    void loadCraftingData();

    return () => {
      isDisposed = true;
    };
  }, [token, t]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (isLoading) {
      return;
    }

    refineryPanelCacheByToken.set(token, {
      inventorySnapshot,
      playerState: effectivePlayerState,
      error,
      hasSettled: (inventorySnapshot !== null && effectivePlayerState !== null) || Boolean(error)
    });
  }, [token, isLoading, inventorySnapshot, effectivePlayerState, error]);

  useEffect(() => {
    const hasSettledRefineryResponse =
      (inventorySnapshot !== null && effectivePlayerState !== null) || Boolean(error);
    onFirstPaintReadyChangeRef.current?.(Boolean(token) && !isLoading && hasSettledRefineryResponse);
  }, [token, isLoading, inventorySnapshot, effectivePlayerState, error]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(
    () => () => {
      for (const timeoutId of Object.values(claimTimeoutsRef.current)) {
        window.clearTimeout(timeoutId);
      }
    },
    []
  );

  const availableInventory = useMemo(
    () =>
      buildAvailableInventory(
        inventorySnapshot,
        effectivePlayerState,
        unlimitedRefineryMaterialsEnabled
      ),
    [inventorySnapshot, effectivePlayerState, unlimitedRefineryMaterialsEnabled]
  );

  const visibleInventoryEntries = useMemo(
    () =>
      Object.entries(availableInventory)
        .filter(([itemCode, quantity]) =>
          quantity > 0 &&
          (!unlimitedRefineryMaterialsEnabled || REFINERY_STASH_ITEM_CODE_SET.has(itemCode))
        )
        .map(([itemCode, quantity]) => ({
          definition: buildItemDefinition(itemCode, effectivePlayerState),
          quantity
        }))
        .sort((left, right) => left.definition.displayName.localeCompare(right.definition.displayName)),
    [availableInventory, effectivePlayerState, unlimitedRefineryMaterialsEnabled]
  );
  const materialStashEntryCount = visibleInventoryEntries.length;

  const laneStates = useMemo(() => {
    const jobsBySlot = new Map<number, CraftingJob>();
    for (const job of inventorySnapshot?.activeJobs ?? []) {
      jobsBySlot.set(job.slotIndex, job);
    }

    return CRAFTING_JOB_SLOT_INDEXES.map((laneIndex) =>
      buildLaneStateFromJob(
        laneIndex,
        jobsBySlot.get(laneIndex) ?? null,
        laneCategoryPreferences[laneIndex] ?? "potions",
        nowMs
      )
    );
  }, [inventorySnapshot, laneCategoryPreferences, nowMs]);

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

  const activeMenuRecipes = useMemo(
    () => REFINERY_RECIPES.filter((recipe) => recipe.category === openMenuCategory),
    [openMenuCategory]
  );
  const openMenuLane = openMenuLaneIndex !== null ? laneStates[openMenuLaneIndex] ?? null : null;
  const openMenuLaneIsBusy = openMenuLane !== null && pendingLaneIndex === openMenuLane.laneIndex;
  const openMenuHasUnclaimedOutput =
    openMenuLane !== null &&
    (openMenuLane.outputCount > 0 || openMenuLane.laneIndex in claimingOutputCountsByLane);

  useEffect(() => {
    if (openMenuLaneIndex === null) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuLaneIndex(null);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuLaneIndex]);

  function toggleLaneMenu(laneIndex: number, category: RefineryCategory) {
    setOpenMenuLaneIndex((current) => (current === laneIndex ? null : laneIndex));
    setOpenMenuCategory(category);
  }

  async function handleRecipeSelect(laneIndex: number, recipe: RefineryRecipe) {
    const lane = laneStates[laneIndex];
    const hasUnclaimedOutput = lane.outputCount > 0 || laneIndex in claimingOutputCountsByLane;
    const maxCraftable = getMaxCraftable(recipe, availableInventory);
    const currentLevel = effectivePlayerState?.level ?? 0;
    const currentDucats = effectivePlayerState?.currency.ducats ?? 0;

    if (
      !token
      || !lane
      || pendingLaneIndex !== null
      || lane.status === "running"
      || hasUnclaimedOutput
      || maxCraftable <= 0
      || currentLevel < recipe.requiredPlayerLevel
      || currentDucats < recipe.ducatCost
    ) {
      return;
    }

    setError(null);
    setPendingLaneIndex(laneIndex);
    setLaneCategoryPreferences((current) => ({
      ...current,
      [laneIndex]: recipe.category
    }));
    setInputInsertTokensBySlot((current) => {
      const nextState = { ...current };

      recipe.inputs.slice(0, 3).forEach((input, slotIndex) => {
        const slotKey = `${laneIndex}-${slotIndex}`;
        nextState[slotKey] = (nextState[slotKey] ?? 0) + 1;
      });

      return nextState;
    });

    try {
      if (recipe.recipeType === "combine") {
        await combineMaterials(token, recipe.id, laneIndex);
      } else if (recipe.recipeType === "item") {
        await craftItem(token, recipe.id, laneIndex);
      } else {
        await distillPotion(token, recipe.id, laneIndex);
      }

      await refreshState(token);
      setOpenMenuLaneIndex(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("refineryPanel.unavailable"));
    } finally {
      setPendingLaneIndex(null);
    }
  }

  async function handleClaimOutput(laneIndex: number) {
    const lane = laneStates[laneIndex];

    if (
      !token
      || !lane
      || !lane.jobId
      || lane.outputCount <= 0
      || laneIndex in claimingOutputCountsByLane
      || pendingLaneIndex !== null
    ) {
      return;
    }

    setError(null);
    setOpenMenuLaneIndex((current) => (current === laneIndex ? null : current));
    setClaimingOutputCountsByLane((current) => ({
      ...current,
      [laneIndex]: lane.outputCount
    }));
    setPendingLaneIndex(laneIndex);

    try {
      await claimCraftingJob(token, lane.jobId);
      await refreshState(token);

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
    } catch (nextError) {
      setClaimingOutputCountsByLane((current) => {
        const nextState = { ...current };
        delete nextState[laneIndex];
        return nextState;
      });
      setError(nextError instanceof Error ? nextError.message : t("refineryPanel.unavailable"));
    } finally {
      setPendingLaneIndex(null);
    }
  }

  function handleClaimOutputKeyDown(event: KeyboardEvent<HTMLElement>, laneIndex: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    void handleClaimOutput(laneIndex);
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

  if (!inventorySnapshot || !effectivePlayerState) {
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

          <section
            className={`refineryCraftInventoryBar${isMaterialStashExpanded ? " isExpanded" : ""}`}
            aria-label={t("refineryPanel.materialStashTitle")}
          >
            <button
              type="button"
              className="refineryCraftInventoryToggle"
              aria-expanded={isMaterialStashExpanded}
              aria-controls="refinery-material-stash-panel"
              onClick={() => setIsMaterialStashExpanded((current) => !current)}
            >
              <span className="refineryCraftInventoryToggleCopy">
                <span className="refineryCraftInventoryToggleEyebrow">{t("menu.refinery")}</span>
                <strong className="refineryCraftInventoryToggleTitle">{t("refineryPanel.materialStashTitle")}</strong>
              </span>
              <span className="refineryCraftInventoryToggleMeta" aria-hidden="true">
                <span className="refineryCraftInventoryToggleCount">
                  {materialStashEntryCount.toLocaleString()}
                </span>
                <span className={`refineryCraftInventoryToggleChevron${isMaterialStashExpanded ? " isExpanded" : ""}`}>
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </span>
            </button>

            <div
              id="refinery-material-stash-panel"
              className={`refineryCraftInventoryPanel${isMaterialStashExpanded ? " isExpanded" : ""}`}
              hidden={!isMaterialStashExpanded}
            >
              <div className="refineryCraftInventoryScroller">
                {visibleInventoryEntries.map(({ definition, quantity }) => {
                  const itemImagePath = getItemImagePath(definition);
                  const tooltipId = `refinery-material-tooltip-${definition.id}`;

                  return (
                    <div
                      key={definition.id}
                      className={`uiHoverTooltipTrigger refineryInventoryChip tone-${definition.tone}`}
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
            </div>
          </section>

          <section className="refineryLaneList">
            {laneStates.map((lane) => {
              const outputDefinition = lane.outputItemId
                ? buildItemDefinition(lane.outputItemId, effectivePlayerState)
                : null;
              const outputImagePath = getItemImagePath(outputDefinition);
              const isClaimingOutput = lane.laneIndex in claimingOutputCountsByLane;
              const hasUnclaimedOutput = lane.outputCount > 0 || isClaimingOutput;
              const claimingOutputCount = claimingOutputCountsByLane[lane.laneIndex] ?? 0;
              const outputPulseToken = outputPulseTokensByLane[lane.laneIndex] ?? 0;
              const showOutputItem = Boolean(outputDefinition) && (lane.outputCount > 0 || isClaimingOutput);
              const nextCraftMsRemaining =
                lane.status === "running" && lane.cycleFinishesAt !== null
                  ? Math.max(0, lane.cycleFinishesAt - nowMs)
                  : 0;
              const totalProgressRatio = getLaneTotalProgressRatio(lane, nowMs);
              const cycleProgressRatio = getLaneCycleProgressRatio(lane, nowMs);
              const laneIsBusy = pendingLaneIndex === lane.laneIndex;

              return (
                <section key={lane.laneIndex} className="refineryLaneCard">
                  <div className="refineryLaneBody">
                    <div className="refinerySlotRow">
                      {lane.inputSlots.map((slot, slotIndex) => {
                        const itemDefinition = slot.itemId
                          ? buildItemDefinition(slot.itemId, effectivePlayerState)
                          : null;
                        const itemImagePath = getItemImagePath(itemDefinition);
                        const inputInsertToken =
                          inputInsertTokensBySlot[`${lane.laneIndex}-${slotIndex}`] ?? 0;
                        const inputPulseToken =
                          inputPulseTokensBySlot[`${lane.laneIndex}-${slotIndex}`] ?? 0;

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
                      onClick={() => {
                        void handleClaimOutput(lane.laneIndex);
                      }}
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
                            {outputImagePath ? (
                              <img src={outputImagePath} alt="" loading="lazy" draggable={false} />
                            ) : (
                              <span className="refinerySlotFallback">{getItemMonogram(outputDefinition)}</span>
                            )}
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
                        disabled={lane.status === "running" || hasUnclaimedOutput || laneIsBusy}
                        aria-expanded={openMenuLaneIndex === lane.laneIndex}
                        aria-haspopup="dialog"
                        aria-controls={openMenuLaneIndex === lane.laneIndex ? "refinery-recipes-menu" : undefined}
                      >
                        {t("refineryPanel.recipes")}
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </section>

          {openMenuLane && createPortal(
            <div className="refineryRecipeMenuOverlay" onClick={() => setOpenMenuLaneIndex(null)}>
              <div
                id="refinery-recipes-menu"
                className="refineryRecipeMenu"
                role="dialog"
                aria-modal="true"
                aria-label={t("refineryPanel.recipes")}
                onClick={(event) => event.stopPropagation()}
              >
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

                <div className="refineryRecipeScroller">
                  <div className="refineryRecipeGrid">
                    {activeMenuRecipes.map((recipe) => {
                      const ingredientCraftableCount = getMaxCraftable(recipe, availableInventory);
                      const currentDucats = effectivePlayerState.currency.ducats ?? 0;
                      const isDisabled =
                        openMenuLaneIsBusy
                        || openMenuHasUnclaimedOutput
                        || ingredientCraftableCount <= 0
                        || effectivePlayerState.level < recipe.requiredPlayerLevel
                        || currentDucats < recipe.ducatCost;
                      const outputItem = buildItemDefinition(recipe.outputItemId, effectivePlayerState);
                      const outputImagePath = getItemImagePath(outputItem);

                      return (
                        <div
                          key={recipe.id}
                          className={`uiHoverTooltipTrigger refineryRecipeTileWrap${isDisabled ? " isDisabled" : ""}`}
                        >
                          <button
                            type="button"
                            className={`refineryRecipeTile${isDisabled ? " isDisabled" : ""}${outputItem ? ` tone-${outputItem.tone}` : ""}`}
                            onClick={() => {
                              void handleRecipeSelect(openMenuLane.laneIndex, recipe);
                            }}
                            disabled={isDisabled}
                            aria-label={recipe.displayName}
                          >
                            <span className="refineryRecipeTileIcon">
                              {outputImagePath ? (
                                <img src={outputImagePath} alt="" loading="lazy" draggable={false} />
                              ) : (
                                getItemMonogram(outputItem)
                              )}
                            </span>
                            <span className="refineryRecipeTileName">{recipe.displayName}</span>
                            <span className="refineryRecipeTileCount">
                              {t("refineryPanel.maxCraftable", {
                                count: ingredientCraftableCount
                              })}
                            </span>
                          </button>

                          <div className="uiHoverTooltip refineryRecipeTooltip" role="tooltip">
                            <p className="uiHoverTooltipTitle">{recipe.displayName}</p>
                            {recipe.inputs.map((input) => {
                              const inputDefinition = buildItemDefinition(input.itemId, effectivePlayerState);
                              const available = getAvailableQuantityForItem(input.itemId, availableInventory);

                              return (
                                <p
                                  key={`${recipe.id}-${input.itemId}`}
                                  className={`uiHoverTooltipLine refineryRecipeRequirement ${getRecipeRequirementClassName(input, availableInventory)}`}
                                >
                                  <strong>{inputDefinition.displayName}</strong> {input.perCraft} / {available}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </article>
      </section>
    </section>
  );
}
