import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement
} from "react";
import { useTranslation } from "react-i18next";

import {
  getGardenPlotNextTransitionAt,
  gardenPlantCatalogById,
  type GardenPlantId,
  resolveGardenHarvestYield,
  resolveGardenPlotPhase,
  type GardenInventoryEntry,
  type GardenPlotPhase,
  type GardenPlotState,
  type GardenStateResponse
} from "@ebonkeep/shared/garden";

import { clearGardenPlot, fetchGardenState, harvestGardenPlot, plantGardenSeed } from "./api";
import { getGardenIngredientImagePath, getGardenPlantImagePath, getGardenSeedImagePath } from "./assets";

export type GardenPanelProps = {
  token: string | null;
};

const GARDEN_BACKGROUND_PATH = "/assets/items/generated/garden/garden.png";
const GARDEN_PLOT_SHAKE_DURATION_MS = 520;
const GARDEN_PLOT_PLANTING_DURATION_MS = 680;
const GARDEN_PLOT_HARVESTING_DURATION_MS = 560;
const GARDEN_PLOT_CLEARING_DURATION_MS = 420;
const GARDEN_FLOATING_REWARD_DURATION_MS = 1_250;
const GARDEN_INGREDIENT_FEEDBACK_DURATION_MS = 2_100;

type GardenPlotVisualFx =
  | {
      kind: "planting";
      plantId: GardenPlantId;
      phase: GardenPlotPhase;
      progressDotCount?: number;
    }
  | {
      kind: "phase";
      plantId: GardenPlantId;
      phase: GardenPlotPhase;
      progressDotCount?: number;
    }
  | {
      kind: "harvesting";
      plantId: GardenPlantId;
      phase: GardenPlotPhase;
      progressDotCount: number;
    }
  | {
      kind: "clearing";
      plantId: GardenPlantId;
      phase: GardenPlotPhase;
      progressDotCount?: number;
    };

type GardenFloatingReward = {
  id: number;
  x: number;
  y: number;
  label: string;
};

type GardenIngredientFeedback = {
  kind: "positive";
};

function deriveLivePlotState(plot: GardenPlotState, nowMs: number): GardenPlotState {
  const phase = resolveGardenPlotPhase({
    plantId: plot.plantId,
    growthEndsAt: plot.growthEndsAt,
    bloomStartsAt: plot.bloomStartsAt,
    bloomEndsAt: plot.bloomEndsAt,
    wiltAt: plot.wiltAt,
    now: new Date(nowMs)
  });

  return {
    ...plot,
    phase,
    nextTransitionAt: getGardenPlotNextTransitionAt({
      phase,
      growthEndsAt: plot.growthEndsAt,
      bloomStartsAt: plot.bloomStartsAt,
      bloomEndsAt: plot.bloomEndsAt,
      wiltAt: plot.wiltAt
    }),
    harvestYield: resolveGardenHarvestYield({
      plantId: plot.plantId,
      phase
    })
  };
}

function getDefaultSelectedSlotIndex(
  state: GardenStateResponse | null,
  previousSlotIndex: number | null
): number | null {
  if (!state) {
    return previousSlotIndex;
  }

  if (previousSlotIndex && state.plots.some((plot) => plot.slotIndex === previousSlotIndex)) {
    return previousSlotIndex;
  }

  const firstEmptyPlot = state.plots.find((plot) => plot.phase === "empty");
  return firstEmptyPlot?.slotIndex ?? state.plots[0]?.slotIndex ?? null;
}

function getPhaseTone(phase: GardenPlotPhase): string {
  switch (phase) {
    case "bloom":
      return "isBloom";
    case "wilted":
      return "isWilted";
    case "pre_bloom":
    case "post_bloom":
      return "isHarvestable";
    default:
      return "";
  }
}

function isHarvestablePhase(phase: GardenPlotPhase): boolean {
  return phase === "pre_bloom" || phase === "bloom" || phase === "post_bloom";
}

function getPlantPlaceholderLabel(plantId: GardenPlantId | null): string {
  if (!plantId) {
    return "";
  }

  return gardenPlantCatalogById[plantId]?.displayName?.[0] ?? "";
}

function getGardenPlotAccessibleLabel(args: {
  slotIndex: number;
  phase: GardenPlotPhase;
  plantId: GardenPlantId | null;
  t: (key: string, options?: Record<string, string | number>) => string;
}): string {
  const slotLabel = args.t("gardenPanel.slotTitle", { slot: args.slotIndex });
  const phaseLabel = args.t(`gardenPanel.phase.${args.phase}`);
  const plantName = args.plantId ? gardenPlantCatalogById[args.plantId]?.displayName ?? "" : "";

  if (plantName) {
    return `${slotLabel}, ${plantName}, ${phaseLabel}`;
  }

  return `${slotLabel}, ${phaseLabel}`;
}

function formatGardenDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function getPlotStageProgressDotCount(plot: GardenPlotState, nowMs: number): number {
  if (plot.phase === "empty") {
    return 0;
  }

  if (plot.phase === "wilted") {
    return 3;
  }

  let stageStartAt: string | null = null;
  let stageEndAt: string | null = null;

  switch (plot.phase) {
    case "growing":
      stageStartAt = plot.plantedAt;
      stageEndAt = plot.growthEndsAt;
      break;
    case "pre_bloom":
      stageStartAt = plot.growthEndsAt;
      stageEndAt = plot.bloomStartsAt;
      break;
    case "bloom":
      stageStartAt = plot.bloomStartsAt;
      stageEndAt = plot.bloomEndsAt;
      break;
    case "post_bloom":
      stageStartAt = plot.bloomEndsAt;
      stageEndAt = plot.wiltAt;
      break;
  }

  if (!stageStartAt || !stageEndAt) {
    return 0;
  }

  const stageStartMs = Date.parse(stageStartAt);
  const stageEndMs = Date.parse(stageEndAt);
  const stageDurationMs = stageEndMs - stageStartMs;

  if (!Number.isFinite(stageStartMs) || !Number.isFinite(stageEndMs) || stageDurationMs <= 0) {
    return 3;
  }

  const progressRatio = Math.min(1, Math.max(0, (nowMs - stageStartMs) / stageDurationMs));
  let activeDotCount = 0;

  if (progressRatio >= 0.25) {
    activeDotCount += 1;
  }
  if (progressRatio >= 0.5) {
    activeDotCount += 1;
  }
  if (progressRatio >= 0.75) {
    activeDotCount += 1;
  }

  return activeDotCount;
}

function getFxDurationMs(kind: GardenPlotVisualFx["kind"]): number {
  switch (kind) {
    case "planting":
      return GARDEN_PLOT_PLANTING_DURATION_MS;
    case "harvesting":
      return GARDEN_PLOT_HARVESTING_DURATION_MS;
    case "clearing":
      return GARDEN_PLOT_CLEARING_DURATION_MS;
    default:
      return GARDEN_PLOT_SHAKE_DURATION_MS;
  }
}

export function GardenPanel({ token }: GardenPanelProps): ReactElement {
  const { t } = useTranslation();
  const [gardenState, setGardenState] = useState<GardenStateResponse | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedSeedPlantId, setSelectedSeedPlantId] = useState<GardenPlantId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [plotVisualFxBySlot, setPlotVisualFxBySlot] = useState<Record<number, GardenPlotVisualFx>>({});
  const [floatingRewards, setFloatingRewards] = useState<GardenFloatingReward[]>([]);
  const [ingredientFeedbackByPlant, setIngredientFeedbackByPlant] = useState<
    Partial<Record<GardenPlantId, GardenIngredientFeedback>>
  >({});
  const previousPlotsRef = useRef<GardenPlotState[] | null>(null);
  const plotVisualFxTimersRef = useRef<Record<number, number>>({});
  const floatingRewardIdRef = useRef(0);
  const floatingRewardTimersRef = useRef<Record<number, number>>({});
  const ingredientFeedbackTimersRef = useRef<Partial<Record<GardenPlantId, number>>>({});
  const ingredientFeedbackFrameRefs = useRef<Partial<Record<GardenPlantId, number>>>({});
  const gardenPanelCardRef = useRef<HTMLElement | null>(null);
  const gardenSceneStyle = {
    "--indoor-scene-image": `url("${GARDEN_BACKGROUND_PATH}")`
  } as CSSProperties;

  function syncServerClock(serverTime: string) {
    const receivedAtMs = Date.now();
    const nextServerClockOffsetMs = Date.parse(serverTime) - receivedAtMs;

    setServerClockOffsetMs(nextServerClockOffsetMs);
    setNowMs(receivedAtMs + nextServerClockOffsetMs);
  }

  const loadState = useEffectEvent(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }

    if (!token) {
      setGardenState(null);
      setError(t("gardenPanel.unavailable"));
      if (isInitialLoad) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const state = await fetchGardenState(token);
      startTransition(() => {
        setGardenState(state);
        setSelectedSlotIndex((current) => getDefaultSelectedSlotIndex(state, current));
        syncServerClock(state.serverTime);
      });
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("gardenPanel.unavailable"));
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadState(true);
  }, [token]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now() + serverClockOffsetMs);
    }, 1_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [serverClockOffsetMs]);

  const plots = (gardenState?.plots ?? []).map((plot) => deriveLivePlotState(plot, nowMs));
  const seedEntries = (gardenState?.inventory ?? []).filter((entry) => entry.kind === "seed");
  const ingredientEntries = (gardenState?.inventory ?? []).filter((entry) => entry.kind === "ingredient");

  const schedulePlotVisualFx = useEffectEvent((slotIndex: number, fx: GardenPlotVisualFx) => {
    const existingTimerId = plotVisualFxTimersRef.current[slotIndex];
    if (existingTimerId) {
      window.clearTimeout(existingTimerId);
    }

    setPlotVisualFxBySlot((current) => ({
      ...current,
      [slotIndex]: fx
    }));

    plotVisualFxTimersRef.current[slotIndex] = window.setTimeout(() => {
      setPlotVisualFxBySlot((current) => {
        if (!current[slotIndex]) {
          return current;
        }

        const nextState = { ...current };
        delete nextState[slotIndex];
        return nextState;
      });
      delete plotVisualFxTimersRef.current[slotIndex];
    }, getFxDurationMs(fx.kind));
  });

  const spawnFloatingReward = useEffectEvent(
    (quantity: number, targetElement: HTMLElement | null, point?: { x: number; y: number }) => {
      const panelElement = gardenPanelCardRef.current;
      if (!panelElement) {
        return;
      }

      const panelRect = panelElement.getBoundingClientRect();
      const targetRect = targetElement?.getBoundingClientRect() ?? null;
      const baseX =
        point?.x ?? (targetRect ? targetRect.left + (targetRect.width / 2) : panelRect.left + (panelRect.width / 2));
      const baseY =
        point?.y ?? (targetRect ? targetRect.top + (targetRect.height / 2) : panelRect.top + (panelRect.height / 2));
      const nextReward: GardenFloatingReward = {
        id: floatingRewardIdRef.current++,
        x: Math.max(24, Math.min(panelRect.width - 24, (baseX - panelRect.left) + 16)),
        y: Math.max(24, Math.min(panelRect.height - 24, (baseY - panelRect.top) - 12)),
        label: `+${quantity}`
      };

      setFloatingRewards((current) => [...current, nextReward]);
      floatingRewardTimersRef.current[nextReward.id] = window.setTimeout(() => {
        setFloatingRewards((current) => current.filter((reward) => reward.id !== nextReward.id));
        delete floatingRewardTimersRef.current[nextReward.id];
      }, GARDEN_FLOATING_REWARD_DURATION_MS);
    }
  );

  const clearIngredientFeedback = useEffectEvent((plantId: GardenPlantId) => {
    const timeoutId = ingredientFeedbackTimersRef.current[plantId];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      delete ingredientFeedbackTimersRef.current[plantId];
    }

    const frameId = ingredientFeedbackFrameRefs.current[plantId];
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId);
      delete ingredientFeedbackFrameRefs.current[plantId];
    }

    setIngredientFeedbackByPlant((current) => {
      if (!current[plantId]) {
        return current;
      }

      const nextState = { ...current };
      delete nextState[plantId];
      return nextState;
    });
  });

  const triggerIngredientFeedback = useEffectEvent((plantId: GardenPlantId) => {
    clearIngredientFeedback(plantId);

    ingredientFeedbackFrameRefs.current[plantId] = window.requestAnimationFrame(() => {
      ingredientFeedbackFrameRefs.current[plantId] = window.requestAnimationFrame(() => {
        delete ingredientFeedbackFrameRefs.current[plantId];

        setIngredientFeedbackByPlant((current) => ({
          ...current,
          [plantId]: {
            kind: "positive"
          }
        }));

        ingredientFeedbackTimersRef.current[plantId] = window.setTimeout(() => {
          clearIngredientFeedback(plantId);
        }, GARDEN_INGREDIENT_FEEDBACK_DURATION_MS);
      });
    });
  });

  useEffect(() => {
    const previousPlots = previousPlotsRef.current;
    if (!previousPlots || previousPlots.length === 0) {
      previousPlotsRef.current = plots;
      return;
    }

    const previousPlotBySlot = new Map(previousPlots.map((plot) => [plot.slotIndex, plot]));

    for (const plot of plots) {
      const previousPlot = previousPlotBySlot.get(plot.slotIndex);
      if (!previousPlot) {
        continue;
      }

      if (!previousPlot.plantId && plot.plantId) {
        schedulePlotVisualFx(plot.slotIndex, {
          kind: "planting",
          plantId: plot.plantId,
          phase: plot.phase
        });
        continue;
      }

      if (
        previousPlot.plantId &&
        plot.plantId &&
        (previousPlot.plantId !== plot.plantId || previousPlot.phase !== plot.phase)
      ) {
        schedulePlotVisualFx(plot.slotIndex, {
          kind: "phase",
          plantId: plot.plantId,
          phase: plot.phase
        });
      }
    }

    previousPlotsRef.current = plots;
  }, [plots, schedulePlotVisualFx]);

  useEffect(() => {
    return () => {
      for (const timerId of Object.values(plotVisualFxTimersRef.current)) {
        window.clearTimeout(timerId);
      }
      for (const timerId of Object.values(floatingRewardTimersRef.current)) {
        window.clearTimeout(timerId);
      }
      for (const timeoutId of Object.values(ingredientFeedbackTimersRef.current)) {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
      for (const frameId of Object.values(ingredientFeedbackFrameRefs.current)) {
        if (frameId !== undefined) {
          window.cancelAnimationFrame(frameId);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedSeedPlantId) {
      return;
    }

    const selectedSeedEntry = seedEntries.find((entry) => entry.plantId === selectedSeedPlantId) ?? null;
    if (!selectedSeedEntry || selectedSeedEntry.quantity <= 0) {
      setSelectedSeedPlantId(null);
    }
  }, [seedEntries, selectedSeedPlantId]);

  async function handlePlantSeed(slotIndex: number, plantId: GardenInventoryEntry["plantId"]) {
    if (!token) {
      setError(t("gardenPanel.unavailable"));
      return;
    }

    const targetPlot = plots.find((plot) => plot.slotIndex === slotIndex) ?? null;
    if (!targetPlot || targetPlot.phase !== "empty") {
      setError(t("gardenPanel.chooseEmptyPlot"));
      return;
    }

    const currentActionKey = `plant:${slotIndex}:${plantId}`;
    setActionKey(currentActionKey);

    try {
      const response = await plantGardenSeed(token, slotIndex, { plantId });
      setGardenState(response.garden);
      setSelectedSlotIndex(getDefaultSelectedSlotIndex(response.garden, null));
      syncServerClock(response.garden.serverTime);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("gardenPanel.unavailable"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleHarvest(
    plot: GardenPlotState,
    targetElement: HTMLElement | null,
    point?: { x: number; y: number }
  ) {
    if (!token) {
      setError(t("gardenPanel.unavailable"));
      return;
    }

    const currentActionKey = `harvest:${plot.slotIndex}`;
    setActionKey(currentActionKey);

    try {
      const response = await harvestGardenPlot(token, plot.slotIndex);
      if (plot.plantId) {
        schedulePlotVisualFx(plot.slotIndex, {
          kind: "harvesting",
          plantId: plot.plantId,
          phase: plot.phase,
          progressDotCount: getPlotStageProgressDotCount(plot, nowMs)
        });
      }
      spawnFloatingReward(response.harvested.quantity, targetElement, point);
      triggerIngredientFeedback(response.harvested.plantId);
      setGardenState(response.garden);
      setSelectedSlotIndex((current) =>
        current === plot.slotIndex ? getDefaultSelectedSlotIndex(response.garden, current) : current
      );
      syncServerClock(response.garden.serverTime);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("gardenPanel.unavailable"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleClear(slotIndex: number) {
    if (!token) {
      setError(t("gardenPanel.unavailable"));
      return;
    }

    const currentActionKey = `clear:${slotIndex}`;
    setActionKey(currentActionKey);

    try {
      const response = await clearGardenPlot(token, slotIndex);
      setGardenState(response.garden);
      setSelectedSlotIndex((current) => current === slotIndex ? response.clearedSlotIndex : current);
      syncServerClock(response.garden.serverTime);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("gardenPanel.unavailable"));
    } finally {
      setActionKey(null);
    }
  }

  function handleSlotClick(
    slotIndex: number,
    targetElement: HTMLElement | null,
    point?: { x: number; y: number }
  ) {
    setSelectedSlotIndex(slotIndex);

    const plot = plots.find((entry) => entry.slotIndex === slotIndex) ?? null;
    if (!plot || actionKey !== null) {
      return;
    }

    if (plot.phase === "wilted") {
      if (plot.plantId) {
        schedulePlotVisualFx(slotIndex, {
          kind: "clearing",
          plantId: plot.plantId,
          phase: plot.phase
        });
      }
      void handleClear(slotIndex);
      return;
    }

    if (isHarvestablePhase(plot.phase)) {
      void handleHarvest(plot, targetElement, point);
      return;
    }

    if (plot.phase === "empty" && selectedSeedPlantId) {
      void handlePlantSeed(slotIndex, selectedSeedPlantId);
    }
  }

  function handleSlotKeyDown(event: KeyboardEvent<HTMLElement>, slotIndex: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleSlotClick(slotIndex, event.currentTarget);
  }

  function handleSeedToggle(plantId: GardenPlantId) {
    setSelectedSeedPlantId((current) => current === plantId ? null : plantId);
  }

  if (isLoading) {
    return (
      <section className="contentShell gardenViewportShell">
        <section className="contentStack gardenViewportStack">
          <article className="contentCard gardenPanelCard indoorSceneShell" style={gardenSceneStyle}>
            <h2>{t("menu.garden")}</h2>
            <p>{t("gardenPanel.loading")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (!gardenState) {
    return (
      <section className="contentShell gardenViewportShell">
        <section className="contentStack gardenViewportStack">
          <article className="contentCard gardenPanelCard indoorSceneShell" style={gardenSceneStyle}>
            <h2>{t("menu.garden")}</h2>
            <p>{error ?? t("gardenPanel.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <section className="contentShell gardenViewportShell">
      <section className="contentStack gardenViewportStack">
        <article
          ref={gardenPanelCardRef}
          className="contentCard gardenPanelCard indoorSceneShell"
          style={gardenSceneStyle}
        >
          {error ? <p className="error">{error}</p> : null}
          {floatingRewards.map((reward) => (
            <span
              key={reward.id}
              className="gardenFloatingReward"
              style={{
                left: `${reward.x}px`,
                top: `${reward.y}px`
              }}
            >
              {reward.label}
            </span>
          ))}

          <div className="gardenLayout">
            <section className="gardenIngredientInventoryBar" aria-label="Harvested ingredients">
              <div className="gardenIngredientInventoryScroller">
                {ingredientEntries.map((entry) => {
                  const ingredientImagePath = getGardenIngredientImagePath(entry.plantId);
                  const plantName = gardenPlantCatalogById[entry.plantId]?.displayName ?? entry.displayName;
                  const ingredientFeedback = ingredientFeedbackByPlant[entry.plantId];

                  return (
                    <div
                      key={`${entry.kind}-${entry.plantId}`}
                      className={`uiHoverTooltipTrigger gardenIngredientInventoryItem rarity-${entry.rarity}`}
                    >
                      <div
                        className={`gardenIngredientInventoryIcon${ingredientFeedback ? " gardenIngredientInventoryIcon-positive" : ""}`}
                      >
                        {ingredientImagePath ? (
                          <img src={ingredientImagePath} alt="" loading="lazy" draggable={false} />
                        ) : (
                          <span className="gardenIngredientFallback">{getPlantPlaceholderLabel(entry.plantId)}</span>
                        )}
                      </div>
                      <span
                        className={`gardenIngredientInventoryCount${ingredientFeedback ? " inventoryStatFlashValue inventoryStatFlashValue-positive" : ""}`}
                      >
                        {entry.quantity.toLocaleString()}
                      </span>
                      <div className="uiHoverTooltip uiHoverTooltipBottom gardenIngredientTooltip" role="tooltip">
                        <p className="uiHoverTooltipLine">
                          <strong>{plantName}</strong>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="gardenPlotsColumn">
              <div className="gardenPlotsGrid">
                {plots.map((plot) => {
                  const plantImagePath = getGardenPlantImagePath(plot.plantId, plot.phase);
                  const isSelected = plot.slotIndex === selectedSlotIndex;
                  const phaseTone = getPhaseTone(plot.phase);
                  const isSeedTarget = plot.phase === "empty" && selectedSeedPlantId !== null;
                  const accessibleLabel = getGardenPlotAccessibleLabel({
                    slotIndex: plot.slotIndex,
                    phase: plot.phase,
                    plantId: plot.plantId,
                    t
                  });
                  const plotVisualFx = plotVisualFxBySlot[plot.slotIndex] ?? null;
                  const showProgressDots = plot.phase !== "empty" || plotVisualFx?.kind === "harvesting";
                  const activeProgressDotCount =
                    plot.phase !== "empty"
                      ? getPlotStageProgressDotCount(plot, nowMs)
                      : plotVisualFx?.kind === "harvesting"
                        ? plotVisualFx.progressDotCount
                        : 0;
                  const isWiltedProgressDots =
                    plot.phase === "wilted" || (plot.phase === "empty" && plotVisualFx?.phase === "wilted");
                  const clearingPlantImagePath =
                    plotVisualFx?.kind === "clearing"
                      ? getGardenPlantImagePath(plotVisualFx.plantId, plotVisualFx.phase)
                      : null;
                  const harvestingPlantImagePath =
                    plotVisualFx?.kind === "harvesting"
                      ? getGardenPlantImagePath(plotVisualFx.plantId, plotVisualFx.phase)
                      : null;
                  const visualClassName = [
                    "gardenPlotVisual",
                    `phase-${plot.phase}`,
                    plot.phase === "bloom" ? "phase-bloom" : "",
                    plotVisualFx?.kind === "clearing" ? "fx-clearing" : "",
                    plotVisualFx?.kind === "planting" ? "fx-planting" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const plantClassName = [
                    "gardenPlantImage",
                    `phase-${plot.phase}`,
                    plotVisualFx?.kind === "planting" ? "fx-enter fx-shake-once" : "",
                    plotVisualFx?.kind === "phase" ? "fx-shake-once" : "",
                    plotVisualFx?.kind === "clearing" || plotVisualFx?.kind === "harvesting" ? "fx-hidden" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const plantPlaceholderClassName = [
                    "gardenPlantSilhouette",
                    `phase-${plot.phase}`,
                    plotVisualFx?.kind === "planting" ? "fx-enter fx-shake-once" : "",
                    plotVisualFx?.kind === "phase" ? "fx-shake-once" : "",
                    plotVisualFx?.kind === "clearing" || plotVisualFx?.kind === "harvesting" ? "fx-hidden" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={plot.slotIndex}
                      role="button"
                      tabIndex={0}
                      aria-label={accessibleLabel}
                      className={`gardenPlotCard${isSelected ? " isSelected" : ""}${phaseTone ? ` ${phaseTone}` : ""}${isSeedTarget ? " isSeedTarget" : ""}`}
                      onClick={(event: ReactMouseEvent<HTMLDivElement>) =>
                        handleSlotClick(plot.slotIndex, event.currentTarget, {
                          x: event.clientX,
                          y: event.clientY
                        })
                      }
                      onKeyDown={(event) => handleSlotKeyDown(event, plot.slotIndex)}
                    >
                      <div className={visualClassName} aria-hidden="true">
                        {plotVisualFx?.kind === "planting" ? (
                          <span className="gardenPlantSilhouette phase-empty fx-empty-fade-out" />
                        ) : null}

                        {plotVisualFx?.kind === "clearing" ? (
                          <>
                            <span className="gardenPlantSilhouette phase-empty fx-empty-fade-in" />
                            {clearingPlantImagePath ? (
                              <img
                                className="gardenPlantImage phase-wilted fx-clear-fade-out"
                                src={clearingPlantImagePath}
                                alt=""
                                loading="lazy"
                                draggable={false}
                              />
                            ) : (
                              <span className="gardenPlantSilhouette phase-wilted fx-clear-fade-out">
                                {getPlantPlaceholderLabel(plotVisualFx.plantId)}
                              </span>
                            )}
                          </>
                        ) : null}

                        {plotVisualFx?.kind === "harvesting" ? (
                          harvestingPlantImagePath ? (
                            <img
                              className="gardenPlantImage fx-harvest-out"
                              src={harvestingPlantImagePath}
                              alt=""
                              loading="lazy"
                              draggable={false}
                            />
                          ) : (
                            <span className="gardenPlantSilhouette fx-harvest-out">
                              {getPlantPlaceholderLabel(plotVisualFx.plantId)}
                            </span>
                          )
                        ) : null}

                        {plantImagePath ? (
                          <img
                            className={plantClassName}
                            src={plantImagePath}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <span className={plantPlaceholderClassName}>
                            {getPlantPlaceholderLabel(plot.plantId)}
                          </span>
                        )}
                      </div>

                      <div
                        className={`gardenPlotProgressDots${isWiltedProgressDots ? " isWilted" : ""}${showProgressDots ? "" : " isHidden"}${plotVisualFx?.kind === "harvesting" ? " fx-harvest-out" : ""}`}
                        aria-hidden="true"
                      >
                        {[0, 1, 2].map((dotIndex) => (
                          <span
                            key={dotIndex}
                            className={`gardenPlotProgressDot${dotIndex < activeProgressDotCount ? " isActive" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="gardenInventoryColumn">
              <div className="gardenSeedGrid">
                {seedEntries.map((entry) => {
                  const plant = gardenPlantCatalogById[entry.plantId];
                  const seedImagePath = getGardenSeedImagePath(entry.plantId);
                  const isSelected = entry.plantId === selectedSeedPlantId;
                  const isOutOfSeeds = entry.quantity <= 0;

                  return (
                    <div key={`${entry.kind}-${entry.plantId}`} className="uiHoverTooltipTrigger gardenSeedGridCell">
                      <button
                        type="button"
                        className={`gardenSeedSlot rarity-${entry.rarity}${isSelected ? " isSelected" : ""}`}
                        onClick={(event) => {
                          handleSeedToggle(entry.plantId);
                          event.currentTarget.blur();
                        }}
                        aria-label={entry.displayName}
                        aria-pressed={isSelected}
                        disabled={actionKey !== null || isOutOfSeeds}
                      >
                        {seedImagePath ? (
                          <img
                            className="gardenSeedImage"
                            src={seedImagePath}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <span className="gardenSeedFallback">{getPlantPlaceholderLabel(entry.plantId)}</span>
                        )}
                        <span className="gardenSeedCountBadge" aria-hidden="true">
                          {entry.quantity.toLocaleString()}
                        </span>
                      </button>

                      <div className="uiHoverTooltip gardenSeedTooltip" role="tooltip">
                        <article className={`gardenSeedTooltipCard rarity-${entry.rarity}`}>
                          <div className="gardenSeedTooltipHeader">
                            <div>
                              <h4>{entry.displayName}</h4>
                            </div>
                            <span className="gardenSeedTooltipBadge">
                              {isSelected ? t("gardenPanel.seedTooltipSelected") : t("gardenPanel.seedTooltipSelect")}
                            </span>
                          </div>

                          <div className="gardenSeedTooltipBody">
                            <p>{t("gardenPanel.seedGrowTime", { duration: formatGardenDuration(plant.growthSeconds) })}</p>
                            <p>
                              {t("gardenPanel.seedHarvestableTime", {
                                duration: formatGardenDuration(
                                  plant.preBloomSeconds + plant.bloomSeconds + plant.postBloomSeconds
                                )
                              })}
                            </p>
                            <p>{t("gardenPanel.seedBloomTime", { duration: formatGardenDuration(plant.bloomSeconds) })}</p>
                            <p>{t("gardenPanel.seedBaseYield", { yield: plant.baseYield })}</p>
                            <p>{t("gardenPanel.seedBloomYield", { yield: plant.bloomYield })}</p>
                            <p>{t("gardenPanel.recipeRefs", { recipes: plant.recipeRefs.join(", ") })}</p>
                          </div>
                        </article>
                      </div>
                    </div>
                  );
                })}

                {seedEntries.length === 0 ? (
                  <article className="gardenSeedEmptyState">
                    <h4>{t("gardenPanel.noSeedsTitle")}</h4>
                    <p>{t("gardenPanel.noSeedsDescription")}</p>
                  </article>
                ) : null}
              </div>
            </aside>
          </div>
        </article>
      </section>
    </section>
  );
}
