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
  displayedPlayerActorIds?: Array<string | null>;
  reservePlayerActorIds?: string[];
  resolutionState: "playing" | "summarizing" | "awaiting_return";
  typedSummaryLine: string;
  playbackRate: number;
  isFastForwardEnabled: boolean;
  hoveredActorId?: string | null;
  onHoverActor?: (actorId: string | null) => void;
  onToggleFastForward: () => void;
  onSkipToEnd?: () => void;
  onCloseLog?: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
  replayButtonLabel?: string;
  backButtonLabel?: string;
  formatDurationFromMs: (value: number) => string;
};

function getEncounterAllies(encounter: CombatPlaybackEncounter): CombatPlaybackActor[] {
  return encounter.allies ?? [encounter.player];
}

function getRaidPlayerMotionStyle(slotIndex: number): CSSProperties {
  const slotMotion = [
    { attackX: "98px", attackY: "-214px", windupX: "-14px", hitPushX: "-18px" },
    { attackX: "52px", attackY: "-224px", windupX: "-8px", hitPushX: "-10px" },
    { attackX: "0px", attackY: "-236px", windupX: "0px", hitPushX: "0px" },
    { attackX: "-52px", attackY: "-224px", windupX: "8px", hitPushX: "10px" },
    { attackX: "-98px", attackY: "-214px", windupX: "14px", hitPushX: "18px" }
  ][slotIndex] ?? { attackX: "0px", attackY: "-218px", windupX: "0px", hitPushX: "0px" };

  return {
    "--combat-windup-x": slotMotion.windupX,
    "--combat-attack-x": slotMotion.attackX,
    "--combat-attack-y": slotMotion.attackY,
    "--combat-hit-push-x": slotMotion.hitPushX,
    "--combat-hit-push-y": "34px",
    "--combat-hit-anticipation-x": `calc(${slotMotion.hitPushX} * -0.4)`,
    "--combat-hit-anticipation-y": "-12px"
  } as CSSProperties;
}

function getRaidBossImpactStyle(args: {
  currentAction: CombatPlaybackActionResolved | null;
  displayedAllies: Array<CombatPlaybackActor | null>;
}): CSSProperties | undefined {
  if (!args.currentAction) {
    return undefined;
  }

  const attackerIndex = args.displayedAllies.findIndex((ally) => ally?.id === args.currentAction?.actorId);
  if (attackerIndex < 0) {
    return undefined;
  }

  const slotMotion = [
    { hitPushX: "22px" },
    { hitPushX: "12px" },
    { hitPushX: "0px" },
    { hitPushX: "-12px" },
    { hitPushX: "-22px" }
  ][attackerIndex] ?? { hitPushX: "0px" };

  return {
    "--combat-hit-push-x": slotMotion.hitPushX,
    "--combat-hit-push-y": "-28px",
    "--combat-hit-anticipation-x": slotMotion.hitPushX,
    "--combat-hit-anticipation-y": "12px"
  } as CSSProperties;
}

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
  const hasTravelFocusImage =
    typeof encounter.travelFocusImagePath === "string" && encounter.travelFocusImagePath.length > 0;

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
              <div className={`travelEncounterInfoCard${hasTravelFocusImage ? " hasFocusImage" : ""}`}>
                {hasTravelFocusImage ? (
                  <div className="travelEncounterFocusArt" aria-hidden="true">
                    <img src={encounter.travelFocusImagePath} alt="" draggable={false} />
                  </div>
                ) : null}
                <div className="travelEncounterInfoCopy">
                  <p className="combatEncounterEyebrow">{encounter.locationName}</p>
                  <h2 className="travelEncounterTitle">{encounter.contractName}</h2>
                  <p className="travelEncounterDescription">{travelDescription}</p>
                </div>
              </div>
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
  displayedPlayerActorIds,
  reservePlayerActorIds,
  playbackRate,
  isFastForwardEnabled,
  hoveredActorId,
  resolutionState,
  onToggleFastForward,
  onSkipToEnd,
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
  | "displayedPlayerActorIds"
  | "reservePlayerActorIds"
  | "playbackRate"
  | "isFastForwardEnabled"
  | "hoveredActorId"
  | "resolutionState"
  | "onToggleFastForward"
  | "onSkipToEnd"
  | "onReplayCombat"
  | "onBackToBoard"
  | "replayButtonLabel"
  | "backButtonLabel"
>) {
  const { t } = useTranslation();
  const allies = getEncounterAllies(encounter);
  const enemyActors = encounter.enemies;
  const actorById = new Map<string, CombatPlaybackActor>([
    ...allies.map((ally) => [ally.id, ally] as const),
    ...enemyActors.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const isRaidBattlefield = Array.isArray(displayedPlayerActorIds);
  const hasCombatBackground =
    typeof encounter.combatBackgroundPath === "string" && encounter.combatBackgroundPath.length > 0;
  const combatAnimationStyle = {
    "--combat-animation-duration": `${1470 / playbackRate}ms`,
    "--combat-hit-duration": `${540 / playbackRate}ms`,
    "--combat-summary-cursor-duration": `${900 / playbackRate}ms`
  } as CSSProperties;
  const renderedAllies = displayedPlayerActorIds
    ? displayedPlayerActorIds.map((allyId) => (allyId ? actorById.get(allyId) ?? null : null))
    : allies;
  const raidBossImpactStyle = isRaidBattlefield
    ? getRaidBossImpactStyle({
        currentAction,
        displayedAllies: renderedAllies
      })
    : undefined;

  return (
    <section className="contentShell combatEncounterShell">
      <section className="contentStack combatEncounterStackSingle" style={combatAnimationStyle}>
        <article className="contentCard combatEncounterCard">
          <div className={`combatBattlefield${hasCombatBackground ? " hasBackdrop" : ""}${isRaidBattlefield ? " combatBattlefield--raid" : ""}`}>
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
            {resolutionState === "playing" ? (
              <button
                type="button"
                className="combatSkipToEndButton combatSpeedToggleOverlay"
                aria-label={t("contracts.skipToEnd", { defaultValue: "Skip to End" })}
                title={t("contracts.skipToEnd", { defaultValue: "Skip to End" })}
                onClick={onSkipToEnd}
              >
                {t("contracts.skipToEnd", { defaultValue: "Skip to End" })}
              </button>
            ) : null}
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
            <div className={`combatLane combatLane-enemy${isRaidBattlefield ? " combatLane-enemy--boss" : ""}`}>
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
                  size={isRaidBattlefield && enemyActors.length === 1 ? "boss" : "default"}
                  style={isRaidBattlefield ? raidBossImpactStyle : undefined}
                />
              ))}
            </div>
            <div className="combatBattlefieldCenter" aria-hidden="true" />
            {isRaidBattlefield ? (
              <div className="combatRaidPlayerCluster">
                <div className="combatLane combatLane-player combatLane-player--raid">
                  {renderedAllies.map((ally, index) =>
                    ally ? (
                      <CombatActorFrame
                        key={ally.id}
                        actor={ally}
                        currentHp={hpByActorId[ally.id] ?? ally.maxHp}
                        label={t("contracts.playerLabel")}
                        isAttacking={currentAction?.actorId === ally.id}
                        isHit={impactTargetId === ally.id}
                        isReferenced={hoveredActorId === ally.id}
                        isDead={(hpByActorId[ally.id] ?? ally.maxHp) <= 0}
                        size="compact"
                        style={getRaidPlayerMotionStyle(index)}
                      />
                    ) : (
                      <div
                        key={`raid-slot-${index}`}
                        className="combatActorFrame combatActorFrame-player combatActorFrame--compact combatActorFramePlaceholder"
                      >
                        <div className="combatActorFrameShell">
                          <div className="combatActorPortraitWrap combatActorPortraitWrap--placeholder">
                            <div className="combatActorSilhouette" aria-hidden="true" />
                          </div>
                          <div className="combatActorNameplate">
                            <span>{t("guild.raids.battlefield.openSlot")}</span>
                          </div>
                          <div className="combatActorHpBar combatActorHpBar--placeholder" aria-hidden="true">
                            <div className="combatActorHpFill" style={{ width: "0%" }} />
                            <span className="combatActorHpLabel">0/0</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
                {reservePlayerActorIds && reservePlayerActorIds.length > 0 ? (
                  <div className="combatRaidReserveStrip">
                    <span className="combatRaidReserveLabel">
                      {t("guild.raids.battlefield.reserve", { count: reservePlayerActorIds.length })}
                    </span>
                    <div className="combatRaidReserveChips">
                      {reservePlayerActorIds.slice(0, 6).map((allyId) => {
                        const ally = actorById.get(allyId);
                        if (!ally) {
                          return null;
                        }
                        return (
                          <span key={ally.id} className="combatRaidReserveChip">
                            {ally.name}
                          </span>
                        );
                      })}
                      {reservePlayerActorIds.length > 6 ? (
                        <span className="combatRaidReserveChip combatRaidReserveChip--count">
                          +{reservePlayerActorIds.length - 6}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="combatLane combatLane-player">
                {allies.map((ally) => (
                  <CombatActorFrame
                    key={ally.id}
                    actor={ally}
                    currentHp={hpByActorId[ally.id] ?? ally.maxHp}
                    label={t("contracts.playerLabel")}
                    isAttacking={currentAction?.actorId === ally.id}
                    isHit={impactTargetId === ally.id}
                    isReferenced={hoveredActorId === ally.id}
                    isDead={(hpByActorId[ally.id] ?? ally.maxHp) <= 0}
                  />
                ))}
              </div>
            )}
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
    ...getEncounterAllies(encounter).map((ally) => [ally.id, ally] as const),
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
    const TURN_TRACK_FALLBACK_VISIBLE_COUNT = 14;
    const turnTrackRowRef = useRef<HTMLDivElement | null>(null);
    const [visibleTurnCount, setVisibleTurnCount] = useState(TURN_TRACK_FALLBACK_VISIBLE_COUNT);
  const allies = getEncounterAllies(encounter);
  const actorById = new Map<string, CombatPlaybackActor>([
    ...allies.map((ally) => [ally.id, ally] as const),
    ...encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const aliveActorIds = new Set(
    [...allies, ...encounter.enemies]
      .filter((actor) => (hpByActorId[actor.id] ?? actor.maxHp) > 0)
      .map((actor) => actor.id)
  );
  const hasAlivePlayerActors = allies.some((ally) => (hpByActorId[ally.id] ?? ally.maxHp) > 0);
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
        ? Array.from({ length: visibleTurnCount }, (_, offset) => {
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
      const trackRow = turnTrackRowRef.current;
      if (!trackRow || typeof ResizeObserver === "undefined") {
        return;
      }

      const updateVisibleTurnCount = () => {
        const computedStyle = window.getComputedStyle(trackRow);
        const chipSize = Number.parseFloat(computedStyle.getPropertyValue("--combat-turn-chip-size")) || 54;
        const chipGap = Number.parseFloat(computedStyle.getPropertyValue("--combat-turn-chip-gap")) || 4;
        const availableWidth = trackRow.clientWidth;
        const nextVisibleCount = Math.max(1, Math.floor((availableWidth + chipGap) / (chipSize + chipGap)));

        setVisibleTurnCount((currentCount) =>
          currentCount === nextVisibleCount ? currentCount : nextVisibleCount
        );
      };

      updateVisibleTurnCount();

      const resizeObserver = new ResizeObserver(() => {
        updateVisibleTurnCount();
      });
      resizeObserver.observe(trackRow);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

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
            <div className="combatTurnTrackRow" ref={turnTrackRowRef}>
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
