import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  EMPTY_BUNDLE,
  HOUR_MS,
  JOBS_HERO_BACKGROUND_PATH,
  buildRunReleaseAtMs,
  getCompletedHours,
  getElapsedMs,
  getFocusUnlockHours,
  getPlayerLevelRewardMultiplier,
  JOB_TEMPLATES_BY_ID,
  resolveRunRewards,
  type JobActiveRunRuntime,
  type JobsStateResponse,
  type RewardBundle
} from "@ebonkeep/shared/jobs";

import {
  advanceJobsDebugApi,
  claimJobsRunApi,
  fetchJobsState,
  rerollJobsBoardApi,
  selectJobsBonusApi,
  startJobsRunApi
} from "./api";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";
import "./jobs.css";

type JobsPanelProps = {
  token: string | null;
  hasPlayerState: boolean;
  currentDucats: number;
  playerLevel: number | null;
  developerToolsEnabled: boolean;
  onGrantDucats: (amount: number) => void;
  onMailboxRewardCreated?: (messageId: string | null | undefined) => void;
  onLockReleaseAtChange: (releaseAtMs: number | null) => void;
  onFirstPaintReadyChange?: (ready: boolean) => void;
};

type JobsPanelCacheEntry = {
  jobsState: JobsStateResponse | null;
  errorMessage: string | null;
  hasSettled: boolean;
};

type RewardChip = {
  key: string;
  label: string;
  value: number;
};

const DURATION_MIN = 1;
const DURATION_MAX = 10;
const DEFAULT_DURATION_HOURS = 5;
const jobsPanelCacheByToken = new Map<string, JobsPanelCacheEntry>();

function readJobsPanelCache(token: string | null): JobsPanelCacheEntry | null {
  if (!token) {
    return null;
  }

  return jobsPanelCacheByToken.get(token) ?? null;
}

export function __resetJobsPanelCacheForTests() {
  jobsPanelCacheByToken.clear();
}

export function getStoredJobsLockReleaseAtMs(): number | null {
  return null;
}

function parseRun(runtimeRun: JobsStateResponse["activeRun"]): JobActiveRunRuntime | null {
  if (!runtimeRun) {
    return null;
  }

  return {
    runId: runtimeRun.runId,
    jobId: runtimeRun.jobId,
    jobName: runtimeRun.jobName,
    durationHours: runtimeRun.durationHours,
    startedAtMs: Date.parse(runtimeRun.startedAt),
    debugOffsetMs: runtimeRun.debugOffsetMs,
    selectedFocusOptionIds: runtimeRun.selectedFocusOptionIds,
    levelRewardMultiplier: runtimeRun.levelRewardMultiplier,
    featuredRewardMultiplier: runtimeRun.featuredRewardMultiplier,
    featuredTitle: runtimeRun.featuredTitle
  };
}

function formatHoursLabel(value: number): string {
  return `${value}h`;
}

function formatDurationDistance(targetMs: number, nowMs: number): string {
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

function rewardBundleToChips(bundle: RewardBundle): RewardChip[] {
  const ordered: Array<[keyof RewardBundle, string]> = [
    ["ducats", "Ducats"],
    ["ironOre", "Iron Ore"],
    ["charcoal", "Charcoal"],
    ["supplyCrates", "Supply Crates"],
    ["seedBundles", "Seed Bundles"],
    ["herbs", "Wild Herbs"]
  ];

  return ordered.flatMap(([key, label]) => {
    const value = bundle[key];
    if (value <= 0) {
      return [];
    }

    return [{ key: String(key), label, value }];
  });
}

function formatBonusUnlocks(hours: number[]): string {
  if (hours.length === 0) {
    return "No bonus picks on 1h shifts.";
  }

  return `Unlocks at ${hours.map((hour) => `${hour}h`).join(" and ")}.`;
}

function getNextUnlockHour(unlockHours: number[], completedHours: number): number | null {
  return unlockHours.find((hour) => completedHours < hour) ?? null;
}

function JobInfoHover(props: { title: string; body: ReactNode; children: ReactNode; placement?: "top" | "bottom" }): ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null);

  function showPopup() {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const w = 290;
    const isTop = props.placement === "top";
    // Always align with the anchor's left edge, clamped to viewport.
    // Do NOT push to the right — that overlaps adjacent cards in the grid.
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    const top = isTop
      ? Math.max(8, rect.top - 8)
      : Math.max(8, rect.bottom + 8);
    setPopupStyle({
      position: "fixed",
      top,
      left: Math.max(8, Math.min(left, window.innerWidth - w - 8)),
      width: w,
      zIndex: 9999,
      pointerEvents: "none"
    });
  }

  function hidePopup() {
    setPopupStyle(null);
  }

  return (
    <div
      ref={anchorRef}
      className="jobsInfoAnchor"
      onMouseEnter={showPopup}
      onMouseLeave={hidePopup}
      onFocus={showPopup}
      onBlur={hidePopup}
    >
      {props.children}
      {popupStyle && createPortal(
        <div
          className="jobsInfoCard"
          role="tooltip"
          aria-label={props.title}
          style={popupStyle}
        >
          <strong>{props.title}</strong>
          <div>{props.body}</div>
        </div>,
        document.body
      )}
    </div>
  );
}

function RewardChipRow(props: { bundle: RewardBundle; emptyLabel?: string }): ReactElement {
  const chips = rewardBundleToChips(props.bundle);
  if (chips.length === 0) {
    return <div className="jobsRewardChipRow"><span className="jobsRewardChip">{props.emptyLabel ?? "None"}</span></div>;
  }

  return (
    <div className="jobsRewardChipRow">
      {chips.map((chip) => (
        <span key={chip.key} className="jobsRewardChip">
          {chip.value.toLocaleString()} {chip.label}
        </span>
      ))}
    </div>
  );
}

function JobCard(props: {
  entry: JobsStateResponse["boardEntries"][number];
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}): ReactElement {
  const { entry, isSelected, disabled, onSelect } = props;
  const featured = entry.featuredWindow;

  return (
    <JobInfoHover
      title={entry.template.name}
      body={
        <>
          <p>{entry.template.rewardTilt}</p>
          {featured ? (
            <p>
              {featured.title}: {featured.description}
            </p>
          ) : null}
        </>
      }
    >
      <button
        type="button"
        className={`jobsChoiceCard jobsLandingChoice tone-${entry.template.accent}${isSelected ? " selected" : ""}`}
        onClick={onSelect}
        disabled={disabled}
      >
        {featured ? (
          <span className={`jobsChoiceFeaturedBadge tone-${entry.template.accent}`}>
            {featured.badge}
          </span>
        ) : null}
        <div
          className="jobsLandingChoiceVisual jobsChoiceVisual"
          style={{
            backgroundImage: `url("${entry.template.imagePath}"), url("${entry.template.fallbackImagePath}")`
          }}
        />
        <div className="jobsLandingChoiceBody jobsChoiceBody">
          <div className="jobsChoiceHeader">
            <strong>{entry.template.name}</strong>
          </div>
        </div>
      </button>
    </JobInfoHover>
  );
}

export function JobsPanel(props: JobsPanelProps): ReactElement {
  const {
    token,
    hasPlayerState,
    currentDucats,
    playerLevel,
    developerToolsEnabled,
    onGrantDucats,
    onMailboxRewardCreated,
    onLockReleaseAtChange,
    onFirstPaintReadyChange
  } = props;
  const initialCacheEntry = readJobsPanelCache(token);
  const [jobsState, setJobsState] = useState<JobsStateResponse | null>(() => initialCacheEntry?.jobsState ?? null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState<number>(DEFAULT_DURATION_HOURS);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token) && hasPlayerState && !initialCacheEntry?.hasSettled);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => initialCacheEntry?.errorMessage ?? null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  async function loadState(showSpinner = false) {
    if (!token || !hasPlayerState) {
      if (token) {
        jobsPanelCacheByToken.delete(token);
      }
      setJobsState(null);
      setErrorMessage(null);
      setIsLoading(false);
      onLockReleaseAtChange(null);
      return;
    }

    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const response = await fetchJobsState(token);
      setJobsState(response);
      setErrorMessage(null);
    } catch (error) {
      const nextErrorMessage = error instanceof Error ? error.message : "Jobs state failed.";
      setJobsState((current) => (showSpinner || !current ? null : current));
      setErrorMessage(nextErrorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadState(!initialCacheEntry?.hasSettled);
  }, [token, hasPlayerState]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (!hasPlayerState) {
      jobsPanelCacheByToken.delete(token);
      return;
    }

    if (isLoading) {
      return;
    }

    jobsPanelCacheByToken.set(token, {
      jobsState,
      errorMessage,
      hasSettled: Boolean(jobsState) || Boolean(errorMessage)
    });
  }, [token, hasPlayerState, isLoading, jobsState, errorMessage]);

  useEffect(() => {
    setNowMs(Date.now());
    const tickRateMs = jobsState?.activeRun ? 1000 : 60_000;
    const interval = window.setInterval(() => setNowMs(Date.now()), tickRateMs);
    return () => window.clearInterval(interval);
  }, [jobsState?.activeRun]);

  useEffect(() => {
    if (!jobsState?.activeRun) {
      onLockReleaseAtChange(null);
      return;
    }

    onLockReleaseAtChange(Date.parse(jobsState.activeRun.releaseAt));
  }, [jobsState?.activeRun, onLockReleaseAtChange]);

  useEffect(() => {
    if (!jobsState?.boardEntries.length) {
      setSelectedJobId(null);
      return;
    }

    const hasCurrentSelection = selectedJobId
      ? jobsState.boardEntries.some((entry) => entry.template.id === selectedJobId)
      : false;

    if (!hasCurrentSelection) {
      setSelectedJobId(jobsState.boardEntries[0]?.template.id ?? null);
    }
  }, [jobsState, selectedJobId]);

  const selectedEntry = useMemo(
    () => jobsState?.boardEntries.find((entry) => entry.template.id === selectedJobId) ?? jobsState?.boardEntries[0] ?? null,
    [jobsState, selectedJobId]
  );

  useEffect(() => {
    const hasSettledJobsResponse = Boolean(jobsState) || Boolean(errorMessage);
    onFirstPaintReadyChange?.(Boolean(token) && hasPlayerState && !isLoading && hasSettledJobsResponse);
  }, [token, hasPlayerState, isLoading, jobsState, errorMessage, onFirstPaintReadyChange]);

  const selectedUnlockHours = useMemo(
    () => getFocusUnlockHours(durationHours),
    [durationHours]
  );

  const selectedPreviewRewards = useMemo(() => {
    if (!selectedEntry) {
      return { ...EMPTY_BUNDLE };
    }

    const previewRun: JobActiveRunRuntime = {
      runId: "preview",
      jobId: selectedEntry.template.id,
      jobName: selectedEntry.template.name,
      durationHours,
      startedAtMs: nowMs - durationHours * HOUR_MS,
      debugOffsetMs: 0,
      selectedFocusOptionIds: [],
      levelRewardMultiplier: getPlayerLevelRewardMultiplier(selectedEntry.template, playerLevel),
      featuredRewardMultiplier: selectedEntry.featuredWindow?.rewardMultiplier ?? 1,
      featuredTitle: selectedEntry.featuredWindow?.title ?? null
    };

    return resolveRunRewards({
      run: previewRun,
      nowMs,
      claimType: "completed"
    });
  }, [durationHours, nowMs, playerLevel, selectedEntry]);

  const activeRunRuntime = useMemo(() => parseRun(jobsState?.activeRun ?? null), [jobsState?.activeRun]);
  const activeReleaseAtMs = jobsState?.activeRun ? Date.parse(jobsState.activeRun.releaseAt) : null;
  const jobsSceneStyle = getViewBackgroundStyle("jobs") as CSSProperties;
  const jobsLandingSceneStyle = {
    "--adaptive-scene-image": `url("${JOBS_HERO_BACKGROUND_PATH}")`
  } as CSSProperties;
  const activeCompletedHours = activeRunRuntime ? getCompletedHours(activeRunRuntime, nowMs) : 0;
  const activeElapsedMs = activeRunRuntime ? getElapsedMs(activeRunRuntime, nowMs) : 0;
  const activeUnlockHours = activeRunRuntime ? getFocusUnlockHours(activeRunRuntime.durationHours) : [];
  const activeUnlockedCharges = activeUnlockHours.filter((hour) => activeCompletedHours >= hour).length;
  const activeAvailableCharges = activeRunRuntime
    ? Math.max(0, activeUnlockedCharges - activeRunRuntime.selectedFocusOptionIds.length)
    : 0;
  const activeNextUnlockHour = getNextUnlockHour(activeUnlockHours, activeCompletedHours);
  const activeProgressPercent = activeRunRuntime
    ? Math.min(100, (activeElapsedMs / (activeRunRuntime.durationHours * HOUR_MS)) * 100)
    : 0;
  const activeInterruptRewards = activeRunRuntime
    ? resolveRunRewards({ run: activeRunRuntime, nowMs, claimType: "interrupted" })
    : { ...EMPTY_BUNDLE };
  const activeCompletionRewards = activeRunRuntime
    ? resolveRunRewards({
        run: activeRunRuntime,
        nowMs: buildRunReleaseAtMs(activeRunRuntime),
        claimType: "completed"
      })
    : { ...EMPTY_BUNDLE };
  const activeTemplate = activeRunRuntime ? JOB_TEMPLATES_BY_ID[activeRunRuntime.jobId] ?? null : null;
  const activeFocusOptions = activeTemplate?.focusOptions ?? [];
  const isRunComplete = activeRunRuntime ? activeCompletedHours >= activeRunRuntime.durationHours : false;
  const canInterruptActiveRun = Boolean(activeRunRuntime) && !isRunComplete;

  async function runMutation(
    action: () => Promise<{ jobs: JobsStateResponse; ducatsGranted: number; rewardMessageId?: string | null }>,
    successMessage?: string
  ) {
    if (!token) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await action();
      setJobsState(response.jobs);
      if (response.ducatsGranted > 0) {
        onGrantDucats(response.ducatsGranted);
      }
      if (response.rewardMessageId) {
        onMailboxRewardCreated?.(response.rewardMessageId);
      }
      if (successMessage) {
        setStatusMessage(
          response.rewardMessageId
            ? `${successMessage} Rewards were sent to your mailbox.`
            : successMessage
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Jobs action failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const selectedBonusChargeText =
    selectedUnlockHours.length > 0 ? `${selectedUnlockHours.length} pick${selectedUnlockHours.length === 1 ? "" : "s"}` : "None";

  if (!hasPlayerState) {
    return (
      <section className="jobsSceneShell jobsPanelStack" style={jobsSceneStyle}>
        <div className="jobsActiveCard">
          <p className="jobsStatusMessage">Load a character to access Jobs.</p>
        </div>
      </section>
    );
  }

  return (
    <>
    <section className="jobsSceneShell" style={jobsSceneStyle}>
      <div className="jobsPanelStack">
        {errorMessage ? (
          <div className="jobsActiveCard">
            <p className="jobsStatusMessage">{errorMessage}</p>
          </div>
        ) : null}
        {statusMessage ? (
          <div className="jobsActiveCard">
            <p className="jobsStatusMessage">{statusMessage}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="jobsActiveCard">
            <p className="jobsStatusMessage">Loading jobs...</p>
          </div>
        ) : !jobsState || !selectedEntry ? (
          <div className="jobsActiveCard">
            <p className="jobsStatusMessage">Jobs are unavailable right now.</p>
          </div>
        ) : (
          <div
            className="jobsLandingCard jobsActiveCard adaptiveSceneShell"
            style={jobsLandingSceneStyle}
          >
            <div className="jobsLandingTop">
              <button
                type="button"
                className="jobsRulesButton"
                onClick={() => setShowRulesPanel(true)}
              >
                Rules
              </button>
            </div>

            <div className="jobsLandingChoices jobsCardGridMobile">
              {jobsState.boardEntries.map((entry) => (
                <JobCard
                  key={entry.template.id}
                  entry={entry}
                  isSelected={selectedEntry.template.id === entry.template.id}
                  disabled={Boolean(jobsState.activeRun) || isMutating}
                  onSelect={() => setSelectedJobId(entry.template.id)}
                />
              ))}
            </div>

            <div className="jobsLandingControls">
              <div className="jobsActionRow jobsLandingMeta">
                <span className="jobsChoiceTag">{selectedEntry.template.name}</span>
                <span className="jobsChoiceTag">{formatHoursLabel(durationHours)}</span>
                {selectedEntry.featuredWindow ? (
                  <span className="jobsChoiceTag jobsChoiceTagFeatured">
                    {selectedEntry.featuredWindow.badge} {selectedEntry.featuredWindow.title}
                  </span>
                ) : null}
              </div>

              <div className="jobsDurationSliderWrap">
                <input
                  className="jobsDurationSlider"
                  type="range"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={1}
                  value={durationHours}
                  onChange={(event) => setDurationHours(Number(event.target.value))}
                  disabled={Boolean(jobsState.activeRun) || isMutating}
                  aria-label="Duration"
                />
                <div className="jobsDurationScale">
                  <span>1h</span>
                  <span>5h</span>
                  <span>10h</span>
                </div>
              </div>

              <div className="jobsLandingFooter">
                <RewardChipRow bundle={selectedPreviewRewards} />
                <button
                  type="button"
                  className="jobsStartButton jobsLandingStart"
                      disabled={Boolean(jobsState.activeRun) || isMutating}
                      onClick={() =>
                        runMutation(
                          () => startJobsRunApi(token!, { jobId: selectedEntry.template.id, durationHours }),
                          `${selectedEntry.template.name} started for ${durationHours}h.`
                        )
                      }
                >
                  Start Job
                </button>
              </div>

              <div className="jobsSetupActions">
                <div className="jobsPreviewCard jobsBonusPreviewCard">
                  <JobInfoHover
                    title="Bonus Picks"
                    placement="top"
                    body={
                      <>
                        <p>This is only a preview of possible bonuses for the selected job.</p>
                        <p>Longer runs unlock up to 3 charges during the shift.</p>
                        <p>You lock them later in Active Run after reaching the required completed hours.</p>
                        {selectedEntry.template.focusOptions.map((option) => (
                          <span key={option.id} className="jobsBonusPreviewPopupItem">
                            <strong>{option.label}</strong>
                            <p>{option.description}</p>
                          </span>
                        ))}
                      </>
                    }
                  >
                    <div className="jobsChoiceHeader">
                      <div>
                        <strong>Bonus Picks</strong>
                        <p className="jobsStatusMessage">{selectedBonusChargeText} - {formatBonusUnlocks(selectedUnlockHours)}</p>
                      </div>
                    </div>
                  </JobInfoHover>
                </div>
                <button
                  type="button"
                  className="jobsActionButton jobsRefreshButton"
                  disabled={Boolean(jobsState.activeRun) || jobsState.refreshesRemaining <= 0 || isMutating}
                  onClick={() =>
                    runMutation(
                      () => rerollJobsBoardApi(token!),
                      `Board refreshed. ${Math.max(0, jobsState.refreshesRemaining - 1)} rerolls left today.`
                    )
                  }
                >
                  Refresh Board ({jobsState.refreshesRemaining}/2)
                </button>
              </div>

              <p className="jobsStatusMessage">
                Board rotates every 12h. Free rerolls reset in {formatDurationDistance(Date.parse(jobsState.refreshesResetAt), nowMs)}.
              </p>
            </div>
          </div>
        )}

        {jobsState?.activeRun && activeRunRuntime && activeReleaseAtMs !== null ? (
          <div className="jobsActiveCard">
            <div className="jobsRunHero">
              <div>
                <span className="jobsSectionEyebrow">Active Run</span>
                <strong className="jobsRunTitle">{jobsState.activeRun.jobName}</strong>
              </div>
              <div className="jobsRunProgressMeta">
                <span>{isRunComplete ? "Ready" : "Time left"}</span>
                <strong>{isRunComplete ? "Claim now" : formatDurationDistance(activeReleaseAtMs, nowMs)}</strong>
              </div>
            </div>

            <div className="jobsProgressBar" aria-hidden="true">
              <div className="jobsProgressFill" style={{ width: `${activeProgressPercent}%` }} />
            </div>

            <div className="jobsActionRow">
              <span className={`jobsStateBadge${isRunComplete ? " complete" : ""}`}>
                {activeCompletedHours}/{activeRunRuntime.durationHours}h banked
              </span>
              <span className="jobsStateBadge">{activeAvailableCharges} bonus picks ready</span>
              {jobsState.activeRun.featuredTitle ? (
                <span className="jobsStateBadge">{jobsState.activeRun.featuredTitle}</span>
              ) : null}
            </div>

            <div className="jobsRewardPreviewGrid">
              {canInterruptActiveRun ? (
                <div className="jobsPreviewCard jobsSetupPreviewCard">
                  <div className="jobsPreviewHeader">
                    <strong>Interrupt now</strong>
                  </div>
                  <RewardChipRow bundle={activeInterruptRewards} />
                </div>
              ) : null}
              <div className="jobsPreviewCard jobsSetupPreviewCard">
                <div className="jobsPreviewHeader">
                  <strong>Finish clean</strong>
                </div>
                <RewardChipRow bundle={activeCompletionRewards} />
              </div>
            </div>

            <details className="jobsFoldout">
              <summary className="jobsFoldoutSummary">
                <span>Bonus Picks</span>
                <span className="jobsFoldoutHint">
                  {activeAvailableCharges} ready / {activeUnlockHours.length} total
                </span>
              </summary>
              <div className="jobsFoldoutBody">
                <JobInfoHover
                  title="Bonus Picks"
                  body={
                    <>
                      <p>Charges unlock after completed checkpoints.</p>
                      <p>Each charge can be spent once on one bonus below.</p>
                      <p>Picked bonuses are added on claim and are halved if you interrupt.</p>
                    </>
                  }
                >
                  <div className="jobsChoiceHeader">
                    <span className="jobsStatusMessage">{formatBonusUnlocks(activeUnlockHours)}</span>
                  </div>
                </JobInfoHover>
                <p className="jobsStatusMessage">
                  {activeAvailableCharges > 0
                    ? `You can lock ${activeAvailableCharges} bonus pick${activeAvailableCharges === 1 ? "" : "s"} now.`
                    : activeNextUnlockHour !== null
                      ? `No pick ready yet. Reach ${activeNextUnlockHour} completed hour${activeNextUnlockHour === 1 ? "" : "s"} to unlock the next one.`
                      : "All available bonus picks for this run are already used."}
                </p>
                {activeFocusOptions.map((option) => {
                  const isPicked = activeRunRuntime.selectedFocusOptionIds.includes(option.id);
                  const canPick = activeAvailableCharges > 0 && !isPicked && !isMutating;
                  const stateLabel = isPicked
                    ? "Picked"
                    : canPick
                      ? "Lock"
                      : activeNextUnlockHour !== null
                        ? `At ${activeNextUnlockHour}h`
                        : "Locked";

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`jobsFocusChoice${isPicked ? " picked" : ""}`}
                      disabled={!canPick}
                      onClick={() =>
                        runMutation(
                          () => selectJobsBonusApi(token!, { optionId: option.id }),
                          `Bonus locked: ${option.label}.`
                        )
                      }
                    >
                      <div className="jobsFocusChoiceHeader">
                        <strong>{option.label}</strong>
                        <span className="jobsStateBadge">{stateLabel}</span>
                      </div>
                      <p className="jobsStatusMessage">{option.description}</p>
                      <RewardChipRow bundle={option.bonus} emptyLabel="No reward change" />
                    </button>
                  );
                })}
              </div>
            </details>

            <div className="jobsActionRow">
              {canInterruptActiveRun ? (
                <button
                  type="button"
                  className="jobsActionButton jobsActionButtonDanger"
                  disabled={isMutating}
                  onClick={() =>
                    runMutation(
                      () => claimJobsRunApi(token!, { claimType: "interrupted" }),
                      `${jobsState.activeRun?.jobName ?? "Job"} interrupted.`
                    )
                  }
                >
                  Interrupt
                </button>
              ) : null}
              <button
                type="button"
                className="jobsActionButton jobsActionButtonPrimary"
                disabled={!isRunComplete || isMutating}
                onClick={() =>
                  runMutation(
                    () => claimJobsRunApi(token!, { claimType: "completed" }),
                    `${jobsState.activeRun?.jobName ?? "Job"} completed.`
                  )
                }
              >
                Claim Rewards
              </button>
            </div>

            {developerToolsEnabled ? (
              <details className="jobsFoldout">
                <summary className="jobsFoldoutSummary">
                  <span>Prototype Controls</span>
                  <span className="jobsFoldoutHint">Fast test</span>
                </summary>
                <div className="jobsFoldoutBody jobsPrototypeButtons">
                  <button
                    type="button"
                    className="jobsPrototypeButton"
                    disabled={isMutating}
                    onClick={() => runMutation(() => advanceJobsDebugApi(token!, { hours: 1 }))}
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    className="jobsPrototypeButton"
                    disabled={isMutating}
                    onClick={() => runMutation(() => advanceJobsDebugApi(token!, { hours: activeRunRuntime.durationHours }))}
                  >
                    Complete now
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        <div className="jobsHistoryCard">
          <details className="jobsFoldout jobsHistoryFoldout">
            <summary className="jobsFoldoutSummary">
              <span>History &amp; Mail</span>
              <span className="jobsFoldoutHint">{jobsState?.history.length ?? 0} recent runs</span>
            </summary>
            <div className="jobsFoldoutBody">
              <div className="jobsStashGrid">
                <div className="jobsStashCard">
                  <span>Live Ducats</span>
                  <strong>{currentDucats.toLocaleString()}</strong>
                </div>
              </div>

              {jobsState?.history.length ? (
                <div className="jobsHistoryList">
                  {jobsState.history.map((entry) => (
                    <div key={entry.runId} className="jobsHistoryItem">
                      <div className="jobsChoiceHeader">
                        <strong>{entry.jobName}</strong>
                        <span className="jobsStateBadge">{entry.claimType === "completed" ? "Completed" : "Interrupted"}</span>
                      </div>
                      <div className="jobsHistoryMeta">
                        <span>
                          {formatHoursLabel(entry.durationHours)} - {new Date(entry.claimedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="jobsHistoryRewards">
                        {rewardBundleToChips(entry.rewards).map((chip) => (
                          <span key={`${entry.runId}-${chip.key}`}>
                            {chip.value.toLocaleString()} {chip.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="jobsStatusMessage">No claimed runs yet.</p>
              )}

              <div className="jobsSupportCard jobsSupportCardMuted">
                <div className="jobsChoiceHeader">
                  <strong>Materials</strong>
                </div>
                <p className="jobsStatusMessage">
                  Completed and interrupted jobs now arrive as claimable mail. Open Messages from the player card to collect
                  ducats, ore, charcoal, crates, seeds, and herbs.
                </p>
              </div>
            </div>
          </details>
        </div>

      </div>
    </section>

    {/* ── Rules panel ─────────────────────────────────── */}
    {showRulesPanel ? createPortal(
      <div className="jobsRulesPanelBackdrop" onClick={() => setShowRulesPanel(false)}>
        <aside className="jobsRulesPanel" onClick={(e) => e.stopPropagation()}>
          <div className="jobsRulesPanelHeader">
            <h3>Jobs – Rules</h3>
            <button type="button" className="jobsRulesPanelClose" onClick={() => setShowRulesPanel(false)}>×</button>
          </div>
          <div className="jobsRulesPanelBody">
            <p>Pick one job lane at a time for 1–10 hours.</p>
            <p>Interrupting a run pays out <strong>50%</strong> of banked rewards.</p>
            <p>Bonus Picks unlock mid-run after reaching required completed hours, and can tilt the final payout.</p>
            <p>Board rerolls: {jobsState?.refreshesRemaining ?? 0}/2 left today. Resets every 12 hours.</p>
            <ul className="jobsRuleList">
              <li>Longer runs = more total reward.</li>
              <li>Bonus Pick charges are locked in during the run — plan ahead.</li>
              <li>Rewards are halved on interrupt after bonus picks are used.</li>
            </ul>
          </div>
        </aside>
      </div>,
      document.body
    ) : null}
  </>
  );
}
