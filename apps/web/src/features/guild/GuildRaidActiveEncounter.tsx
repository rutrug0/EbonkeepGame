import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CombatEncounterArenaPanel,
  CombatEncounterLogPanel,
  CombatEncounterPanel,
  CombatEncounterTurnTrackPanel
} from "../combat";
import {
  getGuildRaidEncounterAnimationRate,
  getGuildRaidPlaybackProgress,
  getGuildRaidPlaybackThresholdMs,
  GUILD_RAID_COMBAT_BEAT_MS,
  GUILD_RAID_COMBAT_IMPACT_DELAY_MS,
  GUILD_RAID_COMBAT_START_DELAY_MS,
  GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS,
  resetGuildRaidPlayback,
  skipToEndGuildRaidPlayback,
  snapshotGuildRaidPlayback,
  type ActiveGuildRaidPlaybackState
} from "./raidPlayback";

type GuildRaidActiveEncounterProps = {
  playback: ActiveGuildRaidPlaybackState;
  nowMs: number;
  onChange: (updater: (current: ActiveGuildRaidPlaybackState) => ActiveGuildRaidPlaybackState) => void;
  onExit: () => void;
  formatDurationFromMs: (value: number) => string;
};

export function GuildRaidActiveEncounter(props: GuildRaidActiveEncounterProps) {
  const { t } = useTranslation("common");
  const [isCombatLogVisible, setIsCombatLogVisible] = useState(true);
  const [hoveredCombatActorId, setHoveredCombatActorId] = useState<string | null>(null);

  useEffect(() => {
    setIsCombatLogVisible(true);
    setHoveredCombatActorId(null);
  }, [props.playback.encounter.encounterId]);

  useEffect(() => {
    if (props.playback.phase !== "travel" || props.playback.travelEndsAt === null) {
      return;
    }
    if (props.nowMs < props.playback.travelEndsAt) {
      return;
    }

    props.onChange((currentPlayback) => ({
      ...currentPlayback,
      phase: "combat",
      travelEndsAt: null,
      segmentPlaybackRate: currentPlayback.playbackRate,
      playbackProgressMs: 0,
      lastPlaybackTickAtMs: null
    }));
  }, [props.nowMs, props.onChange, props.playback.phase, props.playback.travelEndsAt]);

  useEffect(() => {
    if (props.playback.phase !== "combat" || props.playback.resolutionState === "awaiting_return") {
      return;
    }

    const tickedAtMs = Date.now();

    if (props.playback.lastPlaybackTickAtMs === null) {
      props.onChange((currentPlayback) => ({
        ...currentPlayback,
        segmentPlaybackRate: currentPlayback.playbackRate,
        lastPlaybackTickAtMs: tickedAtMs
      }));
      return;
    }

    const effectiveProgressMs = getGuildRaidPlaybackProgress(props.playback, tickedAtMs);

    if (props.playback.resolutionState === "summarizing") {
      if (props.playback.finalSummaryLine === null) {
        return;
      }

      const typedLength = Math.min(
        props.playback.finalSummaryLine.length,
        Math.floor(effectiveProgressMs / GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS)
      );
      const nextTypedSummaryLine = props.playback.finalSummaryLine.slice(0, typedLength);

      if (nextTypedSummaryLine !== props.playback.typedSummaryLine) {
        props.onChange((currentPlayback) => {
          const snapshot = snapshotGuildRaidPlayback(currentPlayback);
          const snapshotTypedLength = Math.min(
            snapshot.finalSummaryLine?.length ?? 0,
            Math.floor(snapshot.playbackProgressMs / GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS)
          );
          return {
            ...snapshot,
            typedSummaryLine: (snapshot.finalSummaryLine ?? "").slice(0, snapshotTypedLength)
          };
        });
        return;
      }

      if (typedLength >= props.playback.finalSummaryLine.length) {
        props.onChange((currentPlayback) => ({
          ...snapshotGuildRaidPlayback(currentPlayback),
          resolutionState: "awaiting_return"
        }));
        return;
      }

      const nextCharacterThresholdMs = (typedLength + 1) * GUILD_RAID_COMBAT_SUMMARY_TYPE_DELAY_MS;
      const timeoutId = window.setTimeout(() => {
        props.onChange((currentPlayback) => snapshotGuildRaidPlayback(currentPlayback));
      }, Math.max(0, (nextCharacterThresholdMs - effectiveProgressMs) / props.playback.segmentPlaybackRate));

      return () => window.clearTimeout(timeoutId);
    }

    const currentEvent = props.playback.timeline[props.playback.currentEventIndex] ?? null;
    if (!currentEvent) {
      return;
    }

    if (currentEvent.type === "CombatPlaybackStarted") {
      if (effectiveProgressMs >= GUILD_RAID_COMBAT_START_DELAY_MS) {
        props.onChange((currentPlayback) => ({
          ...currentPlayback,
          currentEventIndex: currentPlayback.currentEventIndex + 1,
          playbackProgressMs: 0,
          lastPlaybackTickAtMs: null
        }));
        return;
      }

      const timeoutId = window.setTimeout(() => {
        props.onChange((currentPlayback) => snapshotGuildRaidPlayback(currentPlayback));
      }, Math.max(0, (GUILD_RAID_COMBAT_START_DELAY_MS - effectiveProgressMs) / props.playback.segmentPlaybackRate));

      return () => window.clearTimeout(timeoutId);
    }

    if (currentEvent.type === "CombatPlaybackActionResolved") {
      const impactThresholdMs = getGuildRaidPlaybackThresholdMs(GUILD_RAID_COMBAT_IMPACT_DELAY_MS, props.playback);
      const beatThresholdMs = getGuildRaidPlaybackThresholdMs(GUILD_RAID_COMBAT_BEAT_MS, props.playback);
      const impactApplied =
        props.playback.impactTargetId === currentEvent.targetId &&
        props.playback.hpByActorId[currentEvent.targetId] === currentEvent.targetHpAfter &&
        props.playback.combatLogEventIds.includes(currentEvent.eventId);

      if (props.playback.activeAction?.eventId !== currentEvent.eventId) {
        props.onChange((currentPlayback) => ({
          ...snapshotGuildRaidPlayback(currentPlayback),
          segmentPlaybackRate: currentPlayback.playbackRate,
          activeAction: currentEvent,
          impactTargetId: null
        }));
        return;
      }

      if (!impactApplied && effectiveProgressMs >= impactThresholdMs) {
        props.onChange((currentPlayback) => {
          const snapshot = snapshotGuildRaidPlayback(currentPlayback);
          return {
            ...snapshot,
            hpByActorId: {
              ...snapshot.hpByActorId,
              [currentEvent.targetId]: currentEvent.targetHpAfter
            },
            combatLogEntries: snapshot.combatLogEventIds.includes(currentEvent.eventId)
              ? snapshot.combatLogEntries
              : [...snapshot.combatLogEntries, currentEvent.logLine],
            combatLogEventIds: snapshot.combatLogEventIds.includes(currentEvent.eventId)
              ? snapshot.combatLogEventIds
              : [...snapshot.combatLogEventIds, currentEvent.eventId],
            impactTargetId: currentEvent.targetId
          };
        });
        return;
      }

      if (effectiveProgressMs >= beatThresholdMs) {
        props.onChange((currentPlayback) => ({
          ...currentPlayback,
          activeAction: null,
          impactTargetId: null,
          currentEventIndex: currentPlayback.currentEventIndex + 1,
          playbackProgressMs: 0,
          lastPlaybackTickAtMs: null
        }));
        return;
      }

      const nextThresholdMs = impactApplied ? beatThresholdMs : impactThresholdMs;
      const timeoutId = window.setTimeout(() => {
        props.onChange((currentPlayback) => snapshotGuildRaidPlayback(currentPlayback));
      }, Math.max(0, (nextThresholdMs - effectiveProgressMs) / props.playback.segmentPlaybackRate));

      return () => window.clearTimeout(timeoutId);
    }

    if (effectiveProgressMs >= GUILD_RAID_COMBAT_START_DELAY_MS) {
      props.onChange((currentPlayback) => ({
        ...snapshotGuildRaidPlayback(currentPlayback),
        resolutionState: "summarizing",
        finalSummaryLine: currentEvent.summaryLine,
        typedSummaryLine: ""
      }));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      props.onChange((currentPlayback) => snapshotGuildRaidPlayback(currentPlayback));
    }, Math.max(0, (GUILD_RAID_COMBAT_START_DELAY_MS - effectiveProgressMs) / props.playback.segmentPlaybackRate));

    return () => window.clearTimeout(timeoutId);
  }, [props.onChange, props.playback]);

  function handleReplayCombat() {
    setHoveredCombatActorId(null);
    props.onChange((currentPlayback) => resetGuildRaidPlayback(currentPlayback));
  }

  function handleSkipToEnd() {
    props.onChange((currentPlayback) => skipToEndGuildRaidPlayback(currentPlayback));
  }

  function handleToggleFastForward() {
    const toggledAtMs = Date.now();
    props.onChange((currentPlayback) => ({
      ...snapshotGuildRaidPlayback(currentPlayback, toggledAtMs),
      playbackRate: currentPlayback.playbackRate === 5 ? 1 : 5,
      lastPlaybackTickAtMs: toggledAtMs
    }));
  }

  if (props.playback.phase === "travel") {
    return (
      <CombatEncounterPanel
        phase="travel"
        encounter={props.playback.encounter}
        timeline={props.playback.timeline}
        currentEventIndex={props.playback.currentEventIndex}
        nowMs={props.nowMs}
        travelEndsAt={props.playback.travelEndsAt}
        travelDurationMs={props.playback.travelDurationMs}
        travelDescription={props.playback.travelDescription}
        hpByActorId={props.playback.hpByActorId}
        combatLogEntries={props.playback.combatLogEntries}
        combatLogEventIds={props.playback.combatLogEventIds}
        currentAction={props.playback.activeAction}
        impactTargetId={props.playback.impactTargetId}
        resolutionState={props.playback.resolutionState}
        typedSummaryLine={props.playback.typedSummaryLine}
        playbackRate={props.playback.playbackRate}
        isFastForwardEnabled={props.playback.playbackRate === 5}
        onToggleFastForward={() => undefined}
        onReplayCombat={handleReplayCombat}
        onBackToBoard={props.onExit}
        formatDurationFromMs={props.formatDurationFromMs}
      />
    );
  }

  return isCombatLogVisible ? (
    <div className="panelViewportGroup contractsCombatViewportGroup guildRaidCombatViewportGroup">
      <div className="panelViewportProfileMain contractsCombatViewportMain">
        <div className="contractsCombatViewportMainStack">
          <CombatEncounterTurnTrackPanel
            encounter={props.playback.encounter}
            timeline={props.playback.timeline}
            currentEventIndex={props.playback.currentEventIndex}
            hpByActorId={props.playback.hpByActorId}
            currentAction={props.playback.activeAction}
            resolutionState={props.playback.resolutionState}
            hoveredActorId={hoveredCombatActorId}
            onHoverActor={setHoveredCombatActorId}
          />
          <CombatEncounterArenaPanel
            encounter={props.playback.encounter}
            timeline={props.playback.timeline}
            currentEventIndex={props.playback.currentEventIndex}
            hpByActorId={props.playback.hpByActorId}
            currentAction={props.playback.activeAction}
            impactTargetId={props.playback.impactTargetId}
            playbackRate={getGuildRaidEncounterAnimationRate(props.playback)}
            isFastForwardEnabled={props.playback.playbackRate === 5}
            hoveredActorId={hoveredCombatActorId}
            resolutionState={props.playback.resolutionState}
            onToggleFastForward={handleToggleFastForward}
            onSkipToEnd={handleSkipToEnd}
            onReplayCombat={handleReplayCombat}
            onBackToBoard={props.onExit}
          />
        </div>
      </div>
      <div className="panelViewportSide contractsCombatViewportSide">
        <CombatEncounterLogPanel
          encounter={props.playback.encounter}
          timeline={props.playback.timeline}
          currentEventIndex={props.playback.currentEventIndex}
          combatLogEntries={props.playback.combatLogEntries}
          combatLogEventIds={props.playback.combatLogEventIds}
          resolutionState={props.playback.resolutionState}
          typedSummaryLine={props.playback.typedSummaryLine}
          onCloseLog={() => setIsCombatLogVisible(false)}
          onReplayCombat={handleReplayCombat}
          onBackToBoard={props.onExit}
        />
      </div>
    </div>
  ) : (
    <div className="panelViewport contractsCombatViewportExpanded guildRaidCombatViewportExpanded">
      <div className="contractsCombatViewportMainStack">
        <CombatEncounterTurnTrackPanel
          encounter={props.playback.encounter}
          timeline={props.playback.timeline}
          currentEventIndex={props.playback.currentEventIndex}
          hpByActorId={props.playback.hpByActorId}
          currentAction={props.playback.activeAction}
          resolutionState={props.playback.resolutionState}
          hoveredActorId={hoveredCombatActorId}
          onHoverActor={setHoveredCombatActorId}
        />
        <CombatEncounterArenaPanel
          encounter={props.playback.encounter}
          timeline={props.playback.timeline}
          currentEventIndex={props.playback.currentEventIndex}
          hpByActorId={props.playback.hpByActorId}
          currentAction={props.playback.activeAction}
          impactTargetId={props.playback.impactTargetId}
          playbackRate={getGuildRaidEncounterAnimationRate(props.playback)}
          isFastForwardEnabled={props.playback.playbackRate === 5}
          hoveredActorId={hoveredCombatActorId}
          resolutionState={props.playback.resolutionState}
          onToggleFastForward={handleToggleFastForward}
          onSkipToEnd={handleSkipToEnd}
          onReplayCombat={handleReplayCombat}
          onBackToBoard={props.onExit}
        />
      </div>
      <button
        className="inventoryChatFloatingToggle combatLogFloatingToggle"
        onClick={() => setIsCombatLogVisible(true)}
        aria-label={t("contracts.combatLog")}
        aria-pressed="false"
        type="button"
      >
        <svg
          className="inventoryChatFloatingToggleIcon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M7 3h8l3 3v14H7V3Zm2 4h6V5H9v2Zm0 4h7V9H9v2Zm0 4h7v-2H9v2Zm0 4h5v-2H9v2Z" />
        </svg>
      </button>
    </div>
  );
}
