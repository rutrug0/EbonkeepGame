import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
  type KeyboardEvent,
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
import { getGardenPlantImagePath, getGardenSeedImagePath } from "./assets";

export type GardenPanelProps = {
  token: string | null;
};

type PlotTimingWindow = {
  startAtMs: number;
  endAtMs: number;
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

function formatDurationShort(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function getPlotTimingWindow(plot: GardenPlotState): PlotTimingWindow | null {
  if (!plot.plantedAt) {
    return null;
  }

  const plantedAtMs = Date.parse(plot.plantedAt);
  const growthEndsAtMs = plot.growthEndsAt ? Date.parse(plot.growthEndsAt) : Number.NaN;
  const bloomStartsAtMs = plot.bloomStartsAt ? Date.parse(plot.bloomStartsAt) : Number.NaN;
  const bloomEndsAtMs = plot.bloomEndsAt ? Date.parse(plot.bloomEndsAt) : Number.NaN;
  const wiltAtMs = plot.wiltAt ? Date.parse(plot.wiltAt) : Number.NaN;

  switch (plot.phase) {
    case "growing":
      return Number.isNaN(growthEndsAtMs) ? null : { startAtMs: plantedAtMs, endAtMs: growthEndsAtMs };
    case "pre_bloom":
      return Number.isNaN(growthEndsAtMs) || Number.isNaN(bloomStartsAtMs)
        ? null
        : { startAtMs: growthEndsAtMs, endAtMs: bloomStartsAtMs };
    case "bloom":
      return Number.isNaN(bloomStartsAtMs) || Number.isNaN(bloomEndsAtMs)
        ? null
        : { startAtMs: bloomStartsAtMs, endAtMs: bloomEndsAtMs };
    case "post_bloom":
      return Number.isNaN(bloomEndsAtMs) || Number.isNaN(wiltAtMs)
        ? null
        : { startAtMs: bloomEndsAtMs, endAtMs: wiltAtMs };
    default:
      return null;
  }
}

function getPlotProgressPercent(plot: GardenPlotState, nowMs: number): number {
  const window = getPlotTimingWindow(plot);
  if (!window) {
    return plot.phase === "wilted" ? 100 : 0;
  }

  const duration = Math.max(1, window.endAtMs - window.startAtMs);
  const elapsed = Math.max(0, Math.min(duration, nowMs - window.startAtMs));
  return Math.round((elapsed / duration) * 100);
}

function getMilestoneKey(phase: GardenPlotPhase): string | null {
  switch (phase) {
    case "growing":
      return "gardenPanel.milestone.growthDone";
    case "pre_bloom":
      return "gardenPanel.milestone.bloomStarts";
    case "bloom":
      return "gardenPanel.milestone.bloomEnds";
    case "post_bloom":
      return "gardenPanel.milestone.wiltBegins";
    default:
      return null;
  }
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
    return "?";
  }

  return gardenPlantCatalogById[plantId]?.displayName?.[0] ?? "?";
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

  async function handleHarvest(slotIndex: number) {
    if (!token) {
      setError(t("gardenPanel.unavailable"));
      return;
    }

    const currentActionKey = `harvest:${slotIndex}`;
    setActionKey(currentActionKey);

    try {
      const response = await harvestGardenPlot(token, slotIndex);
      setGardenState(response.garden);
      setSelectedSlotIndex((current) =>
        current === slotIndex ? getDefaultSelectedSlotIndex(response.garden, current) : current
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

  function handleSlotClick(slotIndex: number) {
    setSelectedSlotIndex(slotIndex);

    const plot = plots.find((entry) => entry.slotIndex === slotIndex) ?? null;
    if (!plot || actionKey !== null) {
      return;
    }

    if (plot.phase === "wilted") {
      void handleClear(slotIndex);
      return;
    }

    if (isHarvestablePhase(plot.phase)) {
      void handleHarvest(slotIndex);
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
    handleSlotClick(slotIndex);
  }

  function handleSeedToggle(plantId: GardenPlantId) {
    setSelectedSeedPlantId((current) => current === plantId ? null : plantId);
  }

  if (isLoading) {
    return (
      <section className="contentShell gardenViewportShell">
        <section className="contentStack gardenViewportStack">
          <article className="contentCard">
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
          <article className="contentCard">
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
        <article className="contentCard gardenPanelCard">
          {error ? <p className="error">{error}</p> : null}

          <div className="gardenLayout">
            <section className="gardenPlotsColumn">
              <div className="gardenPlotsGrid">
                {plots.map((plot) => {
                  const plantImagePath = getGardenPlantImagePath(plot.plantId, plot.phase);
                  const nextTransitionAtMs = plot.nextTransitionAt ? Date.parse(plot.nextTransitionAt) : null;
                  const countdownLabel =
                    nextTransitionAtMs && nextTransitionAtMs > nowMs
                      ? formatDurationShort(nextTransitionAtMs - nowMs)
                      : null;
                  const milestoneKey = getMilestoneKey(plot.phase);
                  const progressPercent = getPlotProgressPercent(plot, nowMs);
                  const isSelected = plot.slotIndex === selectedSlotIndex;
                  const phaseTone = getPhaseTone(plot.phase);
                  const isSeedTarget = plot.phase === "empty" && selectedSeedPlantId !== null;

                  return (
                    <div
                      key={plot.slotIndex}
                      role="button"
                      tabIndex={0}
                      className={`gardenPlotCard${isSelected ? " isSelected" : ""}${phaseTone ? ` ${phaseTone}` : ""}${isSeedTarget ? " isSeedTarget" : ""}`}
                      onClick={() => handleSlotClick(plot.slotIndex)}
                      onKeyDown={(event) => handleSlotKeyDown(event, plot.slotIndex)}
                    >
                      <div className="gardenPlotVisual" aria-hidden="true">
                        {plantImagePath ? (
                          <img
                            className={`gardenPlantImage phase-${plot.phase}`}
                            src={plantImagePath}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <span className={`gardenPlantSilhouette phase-${plot.phase}`}>
                            {getPlantPlaceholderLabel(plot.plantId)}
                          </span>
                        )}
                      </div>

                      <div className="gardenPlotBody">
                        <div className="gardenProgressBlock">
                          <div className="gardenProgressTrack">
                            <span className="gardenProgressFill" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <p className="gardenProgressMeta">
                            {milestoneKey && countdownLabel ? (
                              <span>{t(milestoneKey, { duration: countdownLabel })}</span>
                            ) : plot.phase === "wilted" ? (
                              <span>{t("gardenPanel.wiltedHint")}</span>
                            ) : plot.phase === "empty" ? (
                              <span>{t("gardenPanel.selectSeedPrompt")}</span>
                            ) : (
                              <span>{t("gardenPanel.readyToHarvest")}</span>
                            )}
                          </p>
                        </div>
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
                  const totalGrowthMs =
                    (plant.growthSeconds + plant.preBloomSeconds + plant.bloomSeconds + plant.postBloomSeconds) * 1_000;
                  const plantDuration = formatDurationShort(totalGrowthMs);
                  const isSelected = entry.plantId === selectedSeedPlantId;

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
                        disabled={actionKey !== null}
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
                      </button>

                      <div className="uiHoverTooltip uiHoverTooltipBottom uiHoverTooltipAnchorStart gardenSeedTooltip" role="tooltip">
                        <article className={`gardenSeedTooltipCard rarity-${entry.rarity}`}>
                          <div className="gardenSeedTooltipHeader">
                            <div>
                              <h4>{entry.displayName}</h4>
                              <p>{t("gardenPanel.seedDuration", { duration: plantDuration })}</p>
                            </div>
                            <span className="gardenSeedTooltipBadge">
                              {isSelected ? t("gardenPanel.seedTooltipSelected") : t("gardenPanel.seedTooltipSelect")}
                            </span>
                          </div>

                          <div className="gardenSeedTooltipBody">
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
