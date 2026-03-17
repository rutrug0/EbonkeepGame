import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type {
  CombatPlaybackActionResolved,
  CombatPlaybackActor,
  CombatPlaybackEncounter,
  CombatPlaybackEvent
} from "./playback";

import { CombatActorFrame } from "./CombatActorFrame";
import { CombatLogRollTooltip } from "./CombatLogRollTooltip";
import {
  buildTooltipPositionFromElement,
  buildTooltipPositionFromPointer,
  type TooltipOverlayPosition
} from "./tooltipPosition";

const COMBAT_LOG_TOOLTIP_SIZING = {
  width: 420,
  estimatedHeight: 360
} as const;

export type CombatEncounterPanelProps = {
  phase: "travel" | "combat";
  encounter: CombatPlaybackEncounter;
  timeline: CombatPlaybackEvent[];
  currentEventIndex: number;
  nowMs: number;
  travelEndsAt: number | null;
  travelDurationMs: number;
  travelDescription: string;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  combatLogEventIds: string[];
  currentAction: CombatPlaybackActionResolved | null;
  impactTargetId: string | null;
  resolutionState: "playing" | "summarizing" | "awaiting_return";
  typedSummaryLine: string;
  playbackRate: number;
  isFastForwardEnabled: boolean;
  hoveredActorId?: string | null;
  onHoverActor?: (actorId: string | null) => void;
  onToggleFastForward: () => void;
  onCloseLog?: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
  replayButtonLabel?: string;
  backButtonLabel?: string;
  formatDurationFromMs: (value: number) => string;
};

export function CombatEncounterTravelPanel({
  encounter,
  timeline: _timeline,
  currentEventIndex: _currentEventIndex,
  nowMs,
  travelEndsAt,
  travelDurationMs,
  travelDescription,
  formatDurationFromMs
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "currentEventIndex"
  | "nowMs"
  | "travelEndsAt"
  | "travelDurationMs"
  | "travelDescription"
  | "formatDurationFromMs"
>) {
  const countdownLabel =
    travelEndsAt !== null ? formatDurationFromMs(Math.max(0, travelEndsAt - nowMs)) : null;
  const progressPercent =
    travelEndsAt === null
      ? 100
      : Math.max(0, Math.min(100, ((travelDurationMs - Math.max(0, travelEndsAt - nowMs)) / travelDurationMs) * 100));

  return (
    <section className="contentShell travelEncounterShell">
      <section className="contentStack">
        <article className="contentCard travelEncounterCard">
          <div className="travelEncounterStage">
            <div className="travelEncounterArt">
              {encounter.travelImagePath && encounter.travelImageMode === "image" ? (
                <img src={encounter.travelImagePath} alt="" draggable={false} />
              ) : (
                <div className="travelEncounterSilhouette" aria-hidden="true" />
              )}
            </div>
            <div className="travelEncounterOverlay">
              <div className="travelEncounterProgressCluster">
                <p className="travelEncounterTimer">{countdownLabel ?? "00m 00s"}</p>
                <div className="travelEncounterCountdownBar" aria-hidden="true">
                  <div
                    className="travelEncounterCountdownFill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

export function CombatEncounterArenaPanel({
  encounter,
  timeline: _timeline,
  currentEventIndex: _currentEventIndex,
  hpByActorId,
  currentAction,
  impactTargetId,
  playbackRate,
  isFastForwardEnabled,
  hoveredActorId,
  resolutionState,
  onToggleFastForward,
  onReplayCombat,
  onBackToBoard,
  replayButtonLabel,
  backButtonLabel
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "currentEventIndex"
  | "hpByActorId"
  | "currentAction"
  | "impactTargetId"
  | "playbackRate"
  | "isFastForwardEnabled"
  | "hoveredActorId"
  | "resolutionState"
  | "onToggleFastForward"
  | "onReplayCombat"
  | "onBackToBoard"
  | "replayButtonLabel"
  | "backButtonLabel"
>) {
  const { t } = useTranslation();
  const player = encounter.player;
  const enemyActors = encounter.enemies;
  const hasCombatBackground =
    typeof encounter.combatBackgroundPath === "string" && encounter.combatBackgroundPath.length > 0;
  const combatAnimationStyle = {
    "--combat-animation-duration": `${1470 / playbackRate}ms`,
    "--combat-hit-duration": `${540 / playbackRate}ms`,
    "--combat-summary-cursor-duration": `${900 / playbackRate}ms`
  } as CSSProperties;

  return (
    <section className="contentShell combatEncounterShell">
      <section className="contentStack combatEncounterStackSingle" style={combatAnimationStyle}>
        <article className="contentCard combatEncounterCard">
          <div className={`combatBattlefield${hasCombatBackground ? " hasBackdrop" : ""}`}>
            {hasCombatBackground ? (
              <div className="combatBattlefieldBackdrop" aria-hidden="true">
                <img src={encounter.combatBackgroundPath} alt="" draggable={false} />
              </div>
            ) : null}
            <button
              type="button"
              className={`combatSpeedToggle combatSpeedToggleOverlay ${isFastForwardEnabled ? "isActive" : ""}`}
              aria-pressed={isFastForwardEnabled}
              aria-label={t("contracts.fastForward", { defaultValue: "Fast Forward x5" })}
              title={t("contracts.fastForward", { defaultValue: "Fast Forward x5" })}
              onClick={onToggleFastForward}
            >
              &raquo;&raquo;
            </button>
            {resolutionState === "awaiting_return" ? (
              <div className="combatArenaResolvedActions">
                <button
                  type="button"
                  className="combatArenaReplayButton combatSpeedToggleOverlay"
                  onClick={onReplayCombat}
                >
                  {replayButtonLabel ?? t("contracts.replayCombat", { defaultValue: "Replay Combat" })}
                </button>
                <button
                  type="button"
                  className="combatArenaReturnButton combatSpeedToggleOverlay"
                  onClick={onBackToBoard}
                >
                  {backButtonLabel ?? t("contracts.backToBoard")}
                </button>
              </div>
            ) : null}
            <div className="combatLane combatLane-enemy">
              {enemyActors.map((enemy) => (
                <CombatActorFrame
                  key={enemy.id}
                  actor={enemy}
                  currentHp={hpByActorId[enemy.id] ?? enemy.maxHp}
                  label={t("contracts.enemyLabel")}
                  isAttacking={currentAction?.actorId === enemy.id}
                  isHit={impactTargetId === enemy.id}
                  isReferenced={hoveredActorId === enemy.id}
                  isDead={(hpByActorId[enemy.id] ?? enemy.maxHp) <= 0}
                />
              ))}
            </div>
            <div className="combatBattlefieldCenter" aria-hidden="true" />
            <div className="combatLane combatLane-player">
              <CombatActorFrame
                actor={player}
                currentHp={hpByActorId[player.id] ?? player.maxHp}
                label={t("contracts.playerLabel")}
                isAttacking={currentAction?.actorId === player.id}
                isHit={impactTargetId === player.id}
                isReferenced={hoveredActorId === player.id}
                isDead={(hpByActorId[player.id] ?? player.maxHp) <= 0}
              />
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

export function CombatEncounterLogPanel({
  encounter,
  timeline,
  currentEventIndex: _currentEventIndex,
  combatLogEntries,
  combatLogEventIds,
  resolutionState,
  typedSummaryLine,
  onCloseLog,
  onReplayCombat,
  onBackToBoard,
  replayButtonLabel,
  backButtonLabel
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "currentEventIndex"
  | "combatLogEntries"
  | "combatLogEventIds"
  | "resolutionState"
  | "typedSummaryLine"
  | "onCloseLog"
  | "onReplayCombat"
  | "onBackToBoard"
  | "replayButtonLabel"
  | "backButtonLabel"
>) {
  const { t } = useTranslation();
  const combatLogBodyRef = useRef<HTMLDivElement>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    eventId: string;
    position: TooltipOverlayPosition;
  } | null>(null);
  const isSummaryVisible = resolutionState !== "playing";
  const showSummaryCursor = resolutionState === "summarizing";
  const actorById = new Map<string, CombatPlaybackActor>([
    [encounter.player.id, encounter.player],
    ...encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const actionEvents = timeline.filter(
    (event): event is CombatPlaybackActionResolved => event.type === "CombatPlaybackActionResolved"
  );
  const actionEventsById = new Map(actionEvents.map((event) => [event.eventId, event] as const));
  const combatLogRows = combatLogEntries.map((entry, index) => {
    const actionEvent = actionEventsById.get(combatLogEventIds[index] ?? "") ?? null;
    return {
      entry,
      actionEvent,
      attacker: actionEvent ? actorById.get(actionEvent.actorId) ?? null : null,
      defender: actionEvent ? actorById.get(actionEvent.targetId) ?? null : null
    };
  });

  useEffect(() => {
    if (combatLogBodyRef.current) {
      combatLogBodyRef.current.scrollTop = combatLogBodyRef.current.scrollHeight;
    }
  }, [combatLogEntries.length]);

  function openTooltipFromPointer(eventId: string, clientX: number, clientY: number) {
    setActiveTooltip({
      eventId,
      position: buildTooltipPositionFromPointer(clientX, clientY, COMBAT_LOG_TOOLTIP_SIZING)
    });
  }

  function updateTooltipFromPointer(eventId: string, clientX: number, clientY: number) {
    if (activeTooltip?.eventId !== eventId) {
      return;
    }

    setActiveTooltip({
      eventId,
      position: buildTooltipPositionFromPointer(clientX, clientY, COMBAT_LOG_TOOLTIP_SIZING)
    });
  }

  function openTooltipFromFocus(eventId: string, target: HTMLElement) {
    setActiveTooltip({
      eventId,
      position: buildTooltipPositionFromElement(target, COMBAT_LOG_TOOLTIP_SIZING)
    });
  }

  function closeTooltip(eventId?: string) {
    setActiveTooltip((currentTooltip) => {
      if (!currentTooltip) {
        return null;
      }
      if (eventId && currentTooltip.eventId !== eventId) {
        return currentTooltip;
      }
      return null;
    });
  }

  return (
    <section className="contentShell combatLogShell">
      <section className="contentStack">
        <article className="contentCard combatLogCard">
          <div className="combatLogToolbar">
            {resolutionState === "awaiting_return" ? (
              <div className="combatLogActionsBar">
                <button type="button" className="combatLogActionButton" onClick={onReplayCombat}>
                  {replayButtonLabel ?? t("contracts.replayCombat", { defaultValue: "Replay Combat" })}
                </button>
                <button type="button" className="combatLogActionButton" onClick={onBackToBoard}>
                  {backButtonLabel ?? t("contracts.backToBoard")}
                </button>
              </div>
            ) : (
              <div />
            )}
            <button
              type="button"
              className="combatLogCloseButton"
              onClick={onCloseLog}
              aria-label={t("chat.close")}
              title={t("chat.close")}
            >
              ×
            </button>
          </div>
          <div className="combatLogBody" ref={combatLogBodyRef}>
            {combatLogEntries.length > 0 ? (
              <ol className="combatLogList">
                {combatLogRows.map(({ entry, actionEvent, attacker, defender }, index) => {
                  const tooltipId = actionEvent ? `combat-log-roll-${actionEvent.eventId}` : undefined;
                  const hasTooltip = Boolean(actionEvent?.rollBreakdown);

                  return (
                    <li
                      key={actionEvent?.eventId ?? `${index}-${entry}`}
                      className={`combatLogMessage${hasTooltip ? " combatLogMessageTooltipTrigger" : ""}${
                        activeTooltip?.eventId === actionEvent?.eventId ? " isTooltipVisible" : ""
                      }`}
                      aria-describedby={hasTooltip && activeTooltip?.eventId === actionEvent?.eventId ? tooltipId : undefined}
                      tabIndex={hasTooltip ? 0 : undefined}
                      onMouseEnter={
                        hasTooltip && actionEvent
                          ? (mouseEvent) =>
                              openTooltipFromPointer(actionEvent.eventId, mouseEvent.clientX, mouseEvent.clientY)
                          : undefined
                      }
                      onMouseMove={
                        hasTooltip && actionEvent
                          ? (mouseEvent) =>
                              updateTooltipFromPointer(actionEvent.eventId, mouseEvent.clientX, mouseEvent.clientY)
                          : undefined
                      }
                      onMouseLeave={hasTooltip && actionEvent ? () => closeTooltip(actionEvent.eventId) : undefined}
                      onFocus={
                        hasTooltip && actionEvent
                          ? (focusEvent) => openTooltipFromFocus(actionEvent.eventId, focusEvent.currentTarget)
                          : undefined
                      }
                      onBlur={hasTooltip && actionEvent ? () => closeTooltip(actionEvent.eventId) : undefined}
                    >
                      <div className="combatLogPortrait combatLogPortrait-attacker" aria-hidden="true">
                        {attacker?.avatarPath && !attacker.usesSilhouetteFallback ? (
                          <img
                            src={attacker.avatarPath}
                            alt=""
                            className="combatLogPortraitImage"
                            draggable={false}
                          />
                        ) : (
                          <div className="combatActorSilhouette combatLogPortraitFallback" />
                        )}
                      </div>
                      <div className="combatLogMessageText">{entry}</div>
                      <div className="combatLogPortrait combatLogPortrait-defender" aria-hidden="true">
                        {defender?.avatarPath && !defender.usesSilhouetteFallback ? (
                          <img
                            src={defender.avatarPath}
                            alt=""
                            className="combatLogPortraitImage"
                            draggable={false}
                          />
                        ) : (
                          <div className="combatActorSilhouette combatLogPortraitFallback" />
                        )}
                      </div>
                      {hasTooltip && actionEvent?.rollBreakdown && activeTooltip?.eventId === actionEvent.eventId && tooltipId ? (
                        <CombatLogRollTooltip
                          tooltipId={tooltipId}
                          breakdown={actionEvent.rollBreakdown}
                          position={activeTooltip.position}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="combatLogEmpty">{t("contracts.travelingDescription")}</p>
            )}
            {isSummaryVisible ? (
              <div className="combatSummaryBlock">
                <p className="combatSummaryText">
                  {typedSummaryLine}
                  {showSummaryCursor ? <span className="combatSummaryCursor" aria-hidden="true" /> : null}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </section>
  );
}

export function CombatEncounterPanel(props: CombatEncounterPanelProps) {
  if (props.phase === "travel") {
    return (
      <CombatEncounterTravelPanel
        encounter={props.encounter}
        timeline={props.timeline}
        currentEventIndex={props.currentEventIndex}
        nowMs={props.nowMs}
        travelEndsAt={props.travelEndsAt}
        travelDurationMs={props.travelDurationMs}
        travelDescription={props.travelDescription}
        formatDurationFromMs={props.formatDurationFromMs}
      />
    );
  }

  // Combat phase - should not be rendered through this component
  // Combat is rendered directly via CombatEncounterArenaPanel in App.tsx
  return null;
}

export function CombatEncounterTurnTrackPanel({
  encounter,
  timeline,
  currentEventIndex,
  hpByActorId,
  currentAction,
  resolutionState,
  hoveredActorId,
  onHoverActor
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "currentEventIndex"
  | "hpByActorId"
  | "currentAction"
  | "resolutionState"
  | "hoveredActorId"
  | "onHoverActor"
>) {
  type ProjectedTurnChip = {
    id: string;
    actor: CombatPlaybackActor;
    projectedIndex: number;
  };
  type RenderedTurnChip = ProjectedTurnChip & {
    state: "steady" | "entering" | "exiting";
  };
  const TURN_TRACK_VISIBLE_COUNT = 14;
  const actorById = new Map<string, CombatPlaybackActor>([
    [encounter.player.id, encounter.player],
    ...encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const aliveActorIds = new Set(
    [encounter.player, ...encounter.enemies]
      .filter((actor) => (hpByActorId[actor.id] ?? actor.maxHp) > 0)
      .map((actor) => actor.id)
  );
  const hasAlivePlayerActors = (hpByActorId[encounter.player.id] ?? encounter.player.maxHp) > 0;
  const hasAliveEnemyActors = encounter.enemies.some((enemy) => (hpByActorId[enemy.id] ?? enemy.maxHp) > 0);
  const actionEvents = timeline.filter(
    (event): event is CombatPlaybackActionResolved => event.type === "CombatPlaybackActionResolved"
  );
  const shouldFilterDeadActors =
    resolutionState === "playing" && hasAlivePlayerActors && hasAliveEnemyActors && aliveActorIds.size > 0;
  const projectedSourceEvents = shouldFilterDeadActors
    ? actionEvents.filter((event) => aliveActorIds.has(event.actorId))
    : actionEvents;
  const actionTimelineIndexById = new Map<string, number>();
  timeline.forEach((event, index) => {
    actionTimelineIndexById.set(event.eventId, index);
  });

  const currentActionIndex =
    currentAction !== null
      ? projectedSourceEvents.findIndex((event) => event.eventId === currentAction.eventId)
      : -1;
  const resolvedActionCount = projectedSourceEvents.filter((event) => {
    const timelineIndex = actionTimelineIndexById.get(event.eventId);
    return typeof timelineIndex === "number" && timelineIndex < currentEventIndex;
  }).length;
  const projectedStartIndex = currentActionIndex >= 0 ? currentActionIndex : resolvedActionCount;
  const projectedActions: ProjectedTurnChip[] =
    projectedSourceEvents.length > 0
      ? Array.from({ length: TURN_TRACK_VISIBLE_COUNT }, (_, offset) => {
          const wrappedIndex = (projectedStartIndex + offset) % projectedSourceEvents.length;
          const actor = actorById.get(projectedSourceEvents[wrappedIndex].actorId);
          if (!actor) {
            return null;
          }
          return {
            id: `${projectedSourceEvents[wrappedIndex].eventId}-${projectedStartIndex + offset}`,
            actor,
            projectedIndex: projectedStartIndex + offset
          };
        }).filter((chip): chip is ProjectedTurnChip => chip !== null)
      : [];
  const projectedActionSignature = projectedActions.map((chip) => chip.id).join("|");
  const [visibleChips, setVisibleChips] = useState<RenderedTurnChip[]>(() =>
    projectedActions.map((chip) => ({ ...chip, state: "steady" }))
  );
  const [isAnimatingShift, setIsAnimatingShift] = useState(false);
  const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shiftTimeoutRef.current !== null) {
        clearTimeout(shiftTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextChips = projectedActions.map((chip) => ({ ...chip, state: "steady" as const }));

    if (shiftTimeoutRef.current !== null) {
      clearTimeout(shiftTimeoutRef.current);
      shiftTimeoutRef.current = null;
    }

    setVisibleChips((currentChips) => {
      if (currentChips.length === 0 || nextChips.length === 0) {
        setIsAnimatingShift(false);
        return nextChips;
      }

      const canAnimateShift =
        nextChips.length === currentChips.length &&
        currentChips.length > 1 &&
        currentChips.slice(1).every((chip, index) => chip.id === nextChips[index].id);

      if (!canAnimateShift) {
        setIsAnimatingShift(false);
        return nextChips;
      }

      const animatedChips: RenderedTurnChip[] = [
        { ...currentChips[0], state: "exiting" as const },
        ...currentChips.slice(1).map((chip) => ({ ...chip, state: "steady" as const })),
        { ...nextChips[nextChips.length - 1], state: "entering" as const }
      ];

      setIsAnimatingShift(true);
      shiftTimeoutRef.current = setTimeout(() => {
        setVisibleChips(nextChips);
        setIsAnimatingShift(false);
        shiftTimeoutRef.current = null;
      }, 260);

      return animatedChips;
    });
  }, [projectedActionSignature]);

  return (
    <section className="contentShell combatTurnTrackShell">
      <section className="contentStack">
        <article className="contentCard combatTurnTrackCard">
          <div className="combatTurnTrackRow">
            <div className={`combatTurnTrackTrack${isAnimatingShift ? " isShifting" : ""}`}>
              {visibleChips.map((chip, index) => {
              return (
                <div
                  key={chip.id}
                  className={`combatTurnChip combatTurnChip-${chip.actor.side}${index === 0 ? " isNext" : ""}${
                    (hpByActorId[chip.actor.id] ?? chip.actor.maxHp) <= 0 ? " isDead" : ""
                  }${
                    hoveredActorId === chip.actor.id ? " isReferenced" : ""
                  }${
                    chip.state === "entering" ? " isEntering" : ""
                  }${chip.state === "exiting" ? " isExiting" : ""}`}
                  aria-label={`${chip.actor.name} projected turn ${chip.projectedIndex + 1}`}
                  onMouseEnter={() => onHoverActor?.(chip.actor.id)}
                  onMouseLeave={() => onHoverActor?.(null)}
                  onFocus={() => onHoverActor?.(chip.actor.id)}
                  onBlur={() => onHoverActor?.(null)}
                  tabIndex={0}
                >
                  <div className="combatTurnChipPortrait">
                    {chip.actor.avatarPath && !chip.actor.usesSilhouetteFallback ? (
                      <img
                        src={chip.actor.avatarPath}
                        alt=""
                        className="combatTurnChipPortraitImage"
                        draggable={false}
                      />
                    ) : (
                      <div className="combatActorSilhouette combatTurnChipPortraitFallback" />
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
