import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type {
  MailboxInboxEntry,
  MailboxInboxResponse,
  MailboxMessageDetail,
  MailboxMessageMutationResponse,
  MailboxReplayResponse,
  MailboxRewardAttachment
} from "@ebonkeep/shared/messages";
import type { PlayerState } from "@ebonkeep/shared/player";

import {
  CombatEncounterArenaPanel,
  CombatEncounterLogPanel,
  CombatEncounterTurnTrackPanel,
  combatPlaybackActionResolvedSchema
} from "../combat";
import {
  COMBAT_PLAYBACK_BEAT_MS,
  COMBAT_PLAYBACK_IMPACT_DELAY_MS,
  COMBAT_PLAYBACK_START_DELAY_MS,
  COMBAT_SUMMARY_TYPE_DELAY_MS,
  getEncounterAnimationRate,
  getEncounterPlaybackProgress,
  getEncounterPlaybackThresholdMs,
  hydratePlaybackEncounterAssets,
  resetCombatEncounterPlayback,
  skipToEndCombatPlayback,
  snapshotEncounterPlayback,
  type ActiveContractEncounterState,
  type ContractEfficiencyTier,
  type ContractLevelBand,
  type ContractOffer,
  type ContractRoll
} from "../contracts";
import { GuildRaidBattlefield } from "../guild/GuildRaidBattlefield";
import { DUCATS_ICON_PATH, IMPERIALS_ICON_PATH } from "../../constants/uiAssets";
import {
  claimMailboxMessage,
  fetchMailbox,
  fetchMailboxMessage,
  fetchMailboxReplay,
  markMailboxMessageRead,
  sendDirectMailboxMessage,
  sendGuildMailboxMessage
} from "./api";
import { RewardInventoryGrid } from "./RewardInventoryGrid";
import "./messages.css";

type MessagesPanelProps = {
  token: string | null;
  playerState: PlayerState | null;
  playerAvatarPath?: string | null;
  onUnreadCountChange?: (count: number) => void;
  onRewardsClaimed?: (rewards: { ducats: number; imperials: number }) => Promise<void> | void;
  onFirstPaintReadyChange?: (ready: boolean) => void;
};

type ComposeMode = "direct" | "guild" | null;

const CLAIM_FLIGHT_ITEM_SELECTOR = "[data-message-reward-item='true']";
const CLAIM_FLIGHT_STAGGER_MS = 70;
const CLAIM_FLIGHT_DURATION_MS = 760;

function hasRewards(rewards: MailboxRewardAttachment | null | undefined): boolean {
  if (!rewards) {
    return false;
  }

  return rewards.ducats > 0
    || rewards.imperials > 0
    || rewards.renown > 0
    || rewards.items.length > 0;
}

function getSourceKey(message: Pick<MailboxInboxEntry, "sourceType"> | Pick<MailboxMessageDetail, "sourceType">): string {
  switch (message.sourceType) {
    case "jobs":
    case "contracts":
    case "guild_raid":
    case "auction":
    case "player":
    case "guild":
      return `messages.source.${message.sourceType}`;
    default:
      return "messages.source.player";
  }
}

function formatInboxTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function isAttentionMessage(entry: Pick<MailboxInboxEntry, "isRead" | "hasRewards" | "rewardsClaimed">): boolean {
  return !entry.isRead || (entry.hasRewards && !entry.rewardsClaimed);
}

function buildReplayContractOffer(args: {
  contractName: string;
  levelBand: ContractLevelBand;
  contractLevel: number;
}): ContractOffer {
  const rollCue: Record<"experience" | "ducats" | "materials" | "itemDrop" | "staminaCost", ContractRoll> = {
    experience: "medium",
    ducats: "medium",
    materials: "medium",
    itemDrop: "medium",
    staminaCost: "medium"
  };

  return {
    instanceId: `mailbox-${args.contractName.toLowerCase().replace(/\s+/g, "-")}`,
    template: {
      id: "mailbox-replay",
      name: args.contractName,
      levelBand: args.levelBand,
      contractLevel: args.contractLevel,
      experience: { low: 0, medium: 0, high: 0 },
      ducats: { low: 0, medium: 0, high: 0 },
      materials: { low: 0, medium: 0, high: 0 },
      itemDrop: { low: 0, medium: 0, high: 0 },
      staminaCost: { low: 0, medium: 0, high: 0 }
    },
    efficiencyTier: "standard_cost" as ContractEfficiencyTier,
    staminaCostValue: 0,
    rollCue,
    expiresAt: Date.now()
  };
}

function buildCombatReplayState(args: {
  payload: Extract<MailboxReplayResponse, { kind: "combat" }>;
  playerAvatarPath?: string | null;
}): ActiveContractEncounterState {
  const encounter = hydratePlaybackEncounterAssets({
    encounter: args.payload.encounter,
    playerAvatarPath: args.playerAvatarPath
  });
  const replayTitle = encounter.contractName || encounter.enemies[0]?.name || "Replay";
  return {
    slotIndex: 0,
    offer: buildReplayContractOffer({
      contractName: encounter.contractName || replayTitle,
      levelBand: encounter.levelBand,
      contractLevel: encounter.contractLevel
    }),
    phase: "combat",
    travelEndsAt: null,
    travelDurationMs: 0,
    travelDescription: "",
    encounter,
    timeline: args.payload.timeline,
    currentEventIndex: 0,
    hpByActorId: {
      [encounter.player.id]: encounter.player.maxHp,
      ...Object.fromEntries(encounter.enemies.map((enemy) => [enemy.id, enemy.maxHp]))
    },
    combatLogEntries: [],
    combatLogEventIds: [],
    activeAction: null,
    impactTargetId: null,
    resolutionState: "playing",
    finalSummaryLine: null,
    typedSummaryLine: "",
    playbackProgressMs: 0,
    playbackRate: 1,
    segmentPlaybackRate: 1,
    lastPlaybackTickAtMs: null
  };
}

function MailboxCombatReplay(props: {
  payload: Extract<MailboxReplayResponse, { kind: "combat" }>;
  onBack: () => void;
  replayLabel: string;
  backLabel: string;
  playerAvatarPath?: string | null;
}): ReactElement {
  const [encounterState, setEncounterState] = useState<ActiveContractEncounterState>(() =>
    buildCombatReplayState({
      payload: props.payload,
      playerAvatarPath: props.playerAvatarPath
    })
  );
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [isCombatLogVisible, setIsCombatLogVisible] = useState(true);

  useEffect(() => {
    setEncounterState(buildCombatReplayState({
      payload: props.payload,
      playerAvatarPath: props.playerAvatarPath
    }));
    setHoveredActorId(null);
    setIsCombatLogVisible(true);
  }, [props.payload, props.playerAvatarPath]);

  useEffect(() => {
    if (encounterState.phase !== "combat" || encounterState.resolutionState === "awaiting_return") {
      return;
    }

    const nowMs = Date.now();

    if (encounterState.lastPlaybackTickAtMs === null) {
      setEncounterState((previousEncounter) => {
        if (previousEncounter.phase !== "combat" || previousEncounter.lastPlaybackTickAtMs !== null) {
          return previousEncounter;
        }
        return {
          ...previousEncounter,
          segmentPlaybackRate: previousEncounter.playbackRate,
          lastPlaybackTickAtMs: nowMs
        };
      });
      return;
    }

    const effectiveProgressMs = getEncounterPlaybackProgress(encounterState, nowMs);

    if (encounterState.resolutionState === "summarizing") {
      if (encounterState.finalSummaryLine === null) {
        return;
      }

      const typedLength = Math.min(
        encounterState.finalSummaryLine.length,
        Math.floor(effectiveProgressMs / COMBAT_SUMMARY_TYPE_DELAY_MS)
      );
      const nextTypedSummaryLine = encounterState.finalSummaryLine.slice(0, typedLength);

      if (nextTypedSummaryLine !== encounterState.typedSummaryLine) {
        setEncounterState((previousEncounter) => {
          if (
            previousEncounter.phase !== "combat"
            || previousEncounter.resolutionState !== "summarizing"
            || previousEncounter.finalSummaryLine === null
          ) {
            return previousEncounter;
          }

          const snapshot = snapshotEncounterPlayback(previousEncounter);
          const finalSummaryLine = snapshot.finalSummaryLine;
          if (finalSummaryLine === null) {
            return snapshot;
          }
          const snapshotTypedLength = Math.min(
            finalSummaryLine.length,
            Math.floor(snapshot.playbackProgressMs / COMBAT_SUMMARY_TYPE_DELAY_MS)
          );

          return {
            ...snapshot,
            typedSummaryLine: finalSummaryLine.slice(0, snapshotTypedLength)
          };
        });
        return;
      }

      if (typedLength >= encounterState.finalSummaryLine.length) {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.resolutionState !== "summarizing") {
            return previousEncounter;
          }

          return {
            ...snapshotEncounterPlayback(previousEncounter),
            resolutionState: "awaiting_return"
          };
        });
        return;
      }

      const nextCharacterThresholdMs = (typedLength + 1) * COMBAT_SUMMARY_TYPE_DELAY_MS;
      const remainingRealMs = Math.max(0, (nextCharacterThresholdMs - effectiveProgressMs) / encounterState.segmentPlaybackRate);
      const summaryTimer = window.setTimeout(() => {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.resolutionState !== "summarizing") {
            return previousEncounter;
          }

          return snapshotEncounterPlayback(previousEncounter);
        });
      }, remainingRealMs);

      return () => {
        window.clearTimeout(summaryTimer);
      };
    }

    const currentEvent = encounterState.timeline[encounterState.currentEventIndex] ?? null;
    if (!currentEvent) {
      return;
    }

    if (currentEvent.type === "CombatPlaybackStarted") {
      if (effectiveProgressMs >= COMBAT_PLAYBACK_START_DELAY_MS) {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted") {
            return previousEncounter;
          }

          return {
            ...previousEncounter,
            currentEventIndex: previousEncounter.currentEventIndex + 1,
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null
          };
        });
        return;
      }

      const startTimer = window.setTimeout(() => {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted") {
            return previousEncounter;
          }

          return snapshotEncounterPlayback(previousEncounter);
        });
      }, Math.max(0, (COMBAT_PLAYBACK_START_DELAY_MS - effectiveProgressMs) / encounterState.segmentPlaybackRate));

      return () => {
        window.clearTimeout(startTimer);
      };
    }

    if (currentEvent.type === "CombatPlaybackActionResolved") {
      const impactThresholdMs = getEncounterPlaybackThresholdMs(COMBAT_PLAYBACK_IMPACT_DELAY_MS, encounterState);
      const beatThresholdMs = getEncounterPlaybackThresholdMs(COMBAT_PLAYBACK_BEAT_MS, encounterState);

      if (encounterState.activeAction?.eventId !== currentEvent.eventId) {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return {
            ...snapshotEncounterPlayback(previousEncounter),
            segmentPlaybackRate: previousEncounter.playbackRate,
            activeAction: combatPlaybackActionResolvedSchema.parse(currentEvent),
            impactTargetId: null
          };
        });
        return;
      }

      const impactApplied =
        encounterState.impactTargetId === currentEvent.targetId
        && encounterState.hpByActorId[currentEvent.targetId] === currentEvent.targetHpAfter
        && encounterState.combatLogEventIds.includes(currentEvent.eventId);

      if (!impactApplied && effectiveProgressMs >= impactThresholdMs) {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return {
            ...snapshotEncounterPlayback(previousEncounter),
            impactTargetId: currentEvent.targetId,
            hpByActorId: {
              ...previousEncounter.hpByActorId,
              [currentEvent.targetId]: currentEvent.targetHpAfter
            },
            combatLogEntries: [...previousEncounter.combatLogEntries, currentEvent.logLine],
            combatLogEventIds: [...previousEncounter.combatLogEventIds, currentEvent.eventId]
          };
        });
      }

      if (effectiveProgressMs >= beatThresholdMs) {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return {
            ...previousEncounter,
            currentEventIndex: previousEncounter.currentEventIndex + 1,
            activeAction: null,
            impactTargetId: null,
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null
          };
        });
        return;
      }

      const nextThresholdMs = impactApplied ? beatThresholdMs : impactThresholdMs;
      const actionTimer = window.setTimeout(() => {
        setEncounterState((previousEncounter) => {
          if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return snapshotEncounterPlayback(previousEncounter);
        });
      }, Math.max(0, (nextThresholdMs - effectiveProgressMs) / encounterState.segmentPlaybackRate));

      return () => {
        window.clearTimeout(actionTimer);
      };
    }

    if (effectiveProgressMs >= COMBAT_PLAYBACK_START_DELAY_MS) {
      setEncounterState((previousEncounter) => {
        if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackEnded") {
          return previousEncounter;
        }

        return {
          ...previousEncounter,
          currentEventIndex: previousEncounter.currentEventIndex + 1,
          activeAction: null,
          impactTargetId: null,
          segmentPlaybackRate: previousEncounter.playbackRate,
          resolutionState: "summarizing",
          finalSummaryLine: currentEvent.summaryLine,
          typedSummaryLine: "",
          playbackProgressMs: 0,
          lastPlaybackTickAtMs: null
        };
      });
      return;
    }

    const endTimer = window.setTimeout(() => {
      setEncounterState((previousEncounter) => {
        if (previousEncounter.phase !== "combat" || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackEnded") {
          return previousEncounter;
        }

        return snapshotEncounterPlayback(previousEncounter);
      });
    }, Math.max(0, (COMBAT_PLAYBACK_START_DELAY_MS - effectiveProgressMs) / encounterState.segmentPlaybackRate));

    return () => {
      window.clearTimeout(endTimer);
    };
  }, [
    encounterState.activeAction?.eventId,
    encounterState.combatLogEntries.length,
    encounterState.currentEventIndex,
    encounterState.impactTargetId,
    encounterState.lastPlaybackTickAtMs,
    encounterState.phase,
    encounterState.playbackProgressMs,
    encounterState.playbackRate,
    encounterState.resolutionState,
    encounterState.typedSummaryLine
  ]);

  function handleReplay() {
    setHoveredActorId(null);
    setEncounterState((previousEncounter) => resetCombatEncounterPlayback(previousEncounter));
  }

  function handleSkip() {
    setEncounterState((previousEncounter) => skipToEndCombatPlayback(previousEncounter));
  }

  function handleFastForward() {
    setEncounterState((previousEncounter) => {
      const toggledAtMs = Date.now();
      const nextPlaybackRate = previousEncounter.playbackRate === 5 ? 1 : 5;
      return {
        ...snapshotEncounterPlayback(previousEncounter, toggledAtMs),
        playbackRate: nextPlaybackRate,
        segmentPlaybackRate: nextPlaybackRate
      };
    });
  }

  return (
    <section className="messagesReplayShell">
      <div className={`messagesReplayCombatShell${isCombatLogVisible ? "" : " messagesReplayCombatShell--solo"}`}>
          <div className="messagesReplayCombatMain">
          <div className="contractsCombatViewportMainStack">
            <CombatEncounterTurnTrackPanel
              encounter={encounterState.encounter}
              timeline={encounterState.timeline}
              currentEventIndex={encounterState.currentEventIndex}
              hpByActorId={encounterState.hpByActorId}
              currentAction={encounterState.activeAction}
              resolutionState={encounterState.resolutionState}
              hoveredActorId={hoveredActorId}
              onHoverActor={setHoveredActorId}
            />
            <CombatEncounterArenaPanel
              encounter={encounterState.encounter}
              timeline={encounterState.timeline}
              currentEventIndex={encounterState.currentEventIndex}
              hpByActorId={encounterState.hpByActorId}
              currentAction={encounterState.activeAction}
              impactTargetId={encounterState.impactTargetId}
              playbackRate={getEncounterAnimationRate(encounterState)}
              isFastForwardEnabled={encounterState.playbackRate === 5}
              hoveredActorId={hoveredActorId}
              resolutionState={encounterState.resolutionState}
              onToggleFastForward={handleFastForward}
              onSkipToEnd={handleSkip}
              onReplayCombat={handleReplay}
              onBackToBoard={props.onBack}
              replayButtonLabel={props.replayLabel}
              backButtonLabel={props.backLabel}
            />
          </div>
        </div>
        {isCombatLogVisible ? (
          <div className="messagesReplayCombatSide">
            <CombatEncounterLogPanel
              encounter={encounterState.encounter}
              timeline={encounterState.timeline}
              currentEventIndex={encounterState.currentEventIndex}
              combatLogEntries={encounterState.combatLogEntries}
              combatLogEventIds={encounterState.combatLogEventIds}
              resolutionState={encounterState.resolutionState}
              typedSummaryLine={encounterState.typedSummaryLine}
              onCloseLog={() => setIsCombatLogVisible(false)}
              onReplayCombat={handleReplay}
              onBackToBoard={props.onBack}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MessagesPanel(props: MessagesPanelProps): ReactElement {
  const { token, playerState, playerAvatarPath, onUnreadCountChange, onRewardsClaimed, onFirstPaintReadyChange } = props;
  const { t } = useTranslation();
  const unreadCountChangeRef = useRef(onUnreadCountChange);
  const rewardsClaimedRef = useRef(onRewardsClaimed);
  const firstPaintReadyChangeRef = useRef(onFirstPaintReadyChange);
  const rewardItemsHostRef = useRef<HTMLDivElement | null>(null);
  const claimFlightLayerRef = useRef<HTMLDivElement | null>(null);
  const claimFlightCleanupTimerRef = useRef<number | null>(null);
  const [mailbox, setMailbox] = useState<MailboxInboxResponse | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MailboxMessageDetail | null>(null);
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [composeStatus, setComposeStatus] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayView, setReplayView] = useState<MailboxReplayResponse | null>(null);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingReplay, setIsLoadingReplay] = useState(false);

  const entries = mailbox?.entries ?? [];
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.messageId === selectedMessageId) ?? null,
    [entries, selectedMessageId]
  );
  const displayedMessageId = selectedMessage?.messageId ?? selectedMessageId;
  const displayedEntry = useMemo(
    () => entries.find((entry) => entry.messageId === displayedMessageId) ?? selectedEntry,
    [displayedMessageId, entries, selectedEntry]
  );
  const isDetailTransitioning = Boolean(isLoadingDetail && selectedMessage && selectedMessage.messageId !== selectedMessageId);
  const isDetailInitiallyLoading = Boolean(isLoadingDetail && !selectedMessage);

  useEffect(() => {
    unreadCountChangeRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  useEffect(() => {
    rewardsClaimedRef.current = onRewardsClaimed;
  }, [onRewardsClaimed]);

  useEffect(() => {
    firstPaintReadyChangeRef.current = onFirstPaintReadyChange;
  }, [onFirstPaintReadyChange]);

  useEffect(() => () => {
    if (claimFlightCleanupTimerRef.current !== null) {
      window.clearTimeout(claimFlightCleanupTimerRef.current);
      claimFlightCleanupTimerRef.current = null;
    }

    claimFlightLayerRef.current?.remove();
    claimFlightLayerRef.current = null;
  }, []);

  function updateInboxEntry(
    messageId: string,
    updater: (entry: MailboxInboxEntry) => MailboxInboxEntry
  ) {
    setMailbox((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) => (entry.messageId === messageId ? updater(entry) : entry))
          }
        : current
    );
  }

  function applyMutation(response: MailboxMessageMutationResponse) {
    if (response.message === null) {
      if (response.deletedMessageId) {
        setMailbox((current) =>
          current
            ? {
                ...current,
                unreadCount: response.unreadCount,
                entries: current.entries.filter((entry) => entry.messageId !== response.deletedMessageId)
              }
            : current
        );
        if (selectedMessageId === response.deletedMessageId) {
          setSelectedMessage(null);
        }
      }
      unreadCountChangeRef.current?.(response.unreadCount);
      return;
    }

    const message = response.message;
    setSelectedMessage(message);
    updateInboxEntry(message.messageId, (entry) => ({
      ...entry,
      isRead: message.readAt !== null,
      rewardsClaimed: message.claimedAt !== null,
      hasRewards: hasRewards(message.rewards),
      hasReplay: message.hasReplay
    }));
    unreadCountChangeRef.current?.(response.unreadCount);
    setMailbox((current) =>
      current
        ? {
            ...current,
            unreadCount: response.unreadCount
          }
        : current
    );
  }

  function findNextAttentionMessageId(response: MailboxMessageMutationResponse): string | null {
    const targetMessageId = response.deletedMessageId ?? response.message?.messageId ?? null;
    if (targetMessageId === null) {
      return entries.find((entry) => isAttentionMessage(entry))?.messageId ?? null;
    }

    const updatedEntries = entries.map((entry) =>
      entry.messageId === targetMessageId
        ? {
            ...entry,
            isRead: response.message?.readAt !== null,
            rewardsClaimed: response.message?.claimedAt !== null,
            hasRewards: hasRewards(response.message?.rewards),
            hasReplay: response.message?.hasReplay ?? entry.hasReplay
          }
        : entry
    );
    const nextEntries = response.deletedMessageId
      ? updatedEntries.filter((entry) => entry.messageId !== response.deletedMessageId)
      : updatedEntries;

    if (nextEntries.length === 0) {
      return null;
    }

    const currentIndex = nextEntries.findIndex((entry) => entry.messageId === targetMessageId);
    const orderedEntries = currentIndex >= 0
      ? [
          ...nextEntries.slice(currentIndex + 1),
          ...nextEntries.slice(0, currentIndex)
        ]
      : nextEntries;

    return orderedEntries.find((entry) => isAttentionMessage(entry))?.messageId ?? null;
  }

  function clearClaimFlightLayer() {
    if (claimFlightCleanupTimerRef.current !== null) {
      window.clearTimeout(claimFlightCleanupTimerRef.current);
      claimFlightCleanupTimerRef.current = null;
    }

    claimFlightLayerRef.current?.remove();
    claimFlightLayerRef.current = null;
  }

  function playClaimFlightAnimation() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const itemElements = rewardItemsHostRef.current
      ? Array.from(rewardItemsHostRef.current.querySelectorAll<HTMLElement>(CLAIM_FLIGHT_ITEM_SELECTOR))
      : [];

    if (itemElements.length === 0) {
      return;
    }

    clearClaimFlightLayer();

    const flightLayer = document.createElement("div");
    flightLayer.className = "messagesClaimFlightLayer";
    document.body.appendChild(flightLayer);
    claimFlightLayerRef.current = flightLayer;

    const targetX = Math.round(Math.min(132, Math.max(64, window.innerWidth * 0.11)));
    const targetY = Math.round(Math.min(108, Math.max(56, window.innerHeight * 0.09)));

    itemElements.forEach((itemElement, index) => {
      const rect = itemElement.getBoundingClientRect();
      const clone = itemElement.cloneNode(true) as HTMLElement;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      clone.classList.add("messagesClaimFlightItem");
      clone.removeAttribute("data-testid");
      clone.removeAttribute("data-message-reward-item");
      clone.style.left = `${Math.round(rect.left)}px`;
      clone.style.top = `${Math.round(rect.top)}px`;
      clone.style.width = `${Math.round(rect.width)}px`;
      clone.style.height = `${Math.round(rect.height)}px`;
      clone.style.setProperty("--messages-claim-flight-x", `${Math.round(targetX - centerX)}px`);
      clone.style.setProperty("--messages-claim-flight-y", `${Math.round(targetY - centerY)}px`);
      clone.style.setProperty("--messages-claim-flight-delay", `${index * CLAIM_FLIGHT_STAGGER_MS}ms`);
      flightLayer.appendChild(clone);
    });

    const totalDurationMs = CLAIM_FLIGHT_DURATION_MS + ((itemElements.length - 1) * CLAIM_FLIGHT_STAGGER_MS);
    claimFlightCleanupTimerRef.current = window.setTimeout(() => {
      clearClaimFlightLayer();
    }, totalDurationMs + 80);
  }

  useEffect(() => {
    let active = true;

    if (!token) {
      setMailbox(null);
      setSelectedMessageId(null);
      setSelectedMessage(null);
      setReplayView(null);
      setComposeMode(null);
      setInboxError(null);
      setDetailError(null);
      firstPaintReadyChangeRef.current?.(false);
      return;
    }

    setIsLoadingInbox(true);
    setInboxError(null);

    void fetchMailbox(token)
      .then((response) => {
        if (!active) {
          return;
        }
        setMailbox(response);
        unreadCountChangeRef.current?.(response.unreadCount);
        setSelectedMessageId((current) =>
          current && response.entries.some((entry) => entry.messageId === current)
            ? current
            : response.entries[0]?.messageId ?? null
        );
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setMailbox(null);
        setSelectedMessageId(null);
        setSelectedMessage(null);
        setInboxError(error instanceof Error ? error.message : t("messages.loadFailed"));
      })
      .finally(() => {
        if (active) {
          setIsLoadingInbox(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, t]);

  useEffect(() => {
    const hasSettled = !isLoadingInbox && (mailbox !== null || inboxError !== null);
    firstPaintReadyChangeRef.current?.(hasSettled);
  }, [isLoadingInbox, mailbox, inboxError]);

  useEffect(() => {
    if (composeMode || !token || !selectedMessageId) {
      if (!composeMode) {
        setReplayView(null);
      }
      return;
    }

    let active = true;
    const previousMessageId = selectedMessage?.messageId ?? null;
    setIsLoadingDetail(true);
    setDetailError(null);

    void fetchMailboxMessage(token, selectedMessageId)
      .then(async (message) => {
        if (!active) {
          return;
        }

        setSelectedMessage(message);
        setReplayView(null);

        if (message.readAt === null) {
          try {
            const response = await markMailboxMessageRead(token, message.messageId);
            if (active) {
              applyMutation(response);
            }
          } catch (error: unknown) {
            if (active) {
              setDetailError(error instanceof Error ? error.message : t("messages.detailFailed"));
            }
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (previousMessageId !== null && previousMessageId !== selectedMessageId) {
          setSelectedMessageId(previousMessageId);
        } else {
          setSelectedMessage(null);
        }
        setDetailError(error instanceof Error ? error.message : t("messages.detailFailed"));
      })
      .finally(() => {
        if (active) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      active = false;
    };
  }, [composeMode, selectedMessageId, token, t]);

  async function handleClaimRewards() {
    if (!token || !selectedMessage || isClaiming) {
      return;
    }

    const claimedCurrencies = {
      ducats: Math.max(0, selectedMessage.rewards?.ducats ?? 0),
      imperials: Math.max(0, selectedMessage.rewards?.imperials ?? 0)
    };
    setIsClaiming(true);
    setComposeStatus(null);

    try {
      const response = await claimMailboxMessage(token, selectedMessage.messageId);
      const nextAttentionMessageId = findNextAttentionMessageId(response);
      playClaimFlightAnimation();
      applyMutation(response);
      setComposeStatus(null);
      setSelectedMessageId(nextAttentionMessageId);
      await rewardsClaimedRef.current?.(claimedCurrencies);
    } catch (error: unknown) {
      setComposeStatus(error instanceof Error ? error.message : t("messages.claimFailed"));
    } finally {
      setIsClaiming(false);
    }
  }

  async function handleOpenReplay() {
    if (!token || !selectedMessage || isLoadingReplay) {
      return;
    }

    setIsLoadingReplay(true);
    setReplayError(null);

    try {
      const replay = await fetchMailboxReplay(token, selectedMessage.messageId);
      setReplayView(replay);
    } catch (error: unknown) {
      setReplayError(error instanceof Error ? error.message : t("messages.replayFailed"));
    } finally {
      setIsLoadingReplay(false);
    }
  }

  async function handleSendCompose() {
    if (!token || !composeMode || isSending) {
      return;
    }

    setIsSending(true);
    setComposeStatus(null);

    try {
      if (composeMode === "direct") {
        await sendDirectMailboxMessage(token, {
          recipient: composeRecipient,
          subject: composeSubject,
          body: composeBody
        });
        setComposeStatus(t("messages.directSent"));
      } else {
        await sendGuildMailboxMessage(token, {
          subject: composeSubject,
          body: composeBody
        });
        setComposeStatus(t("messages.guildSent"));
      }
      setComposeRecipient("");
      setComposeSubject("");
      setComposeBody("");
    } catch (error: unknown) {
      setComposeStatus(error instanceof Error ? error.message : t("messages.sendFailed"));
    } finally {
      setIsSending(false);
    }
  }

  const selectedRewards = selectedMessage?.claimedAt === null ? selectedMessage?.rewards ?? null : null;
  const hasRewardCurrencies = Boolean(selectedRewards && (selectedRewards.ducats > 0 || selectedRewards.imperials > 0));
  const hasRewardItems = Boolean(selectedRewards && selectedRewards.items.length > 0);
  const hasRenownReward = Boolean(selectedRewards && selectedRewards.renown > 0);

  if (replayView?.kind === "combat") {
    return (
      <MailboxCombatReplay
        payload={replayView}
        onBack={() => setReplayView(null)}
        replayLabel={t("messages.replayAgain")}
        backLabel={t("messages.backToMessage")}
        playerAvatarPath={playerAvatarPath}
      />
    );
  }

  if (replayView?.kind === "guild_raid") {
    return (
      <section className="messagesReplayShell">
        <header className="messagesReplayHeader">
          <div>
            <span className="messagesEyebrow">{t("messages.replayTitle")}</span>
            <h2 className="messagesTitle">{replayView.boss.bossName}</h2>
          </div>
          <div className="messagesReplayActions">
            <button type="button" className="button messagesButton secondary" onClick={() => setReplayView(null)}>
              {t("messages.backToMessage")}
            </button>
          </div>
        </header>
        <div className="messagesReplayGuildWrap">
          <GuildRaidBattlefield boss={replayView.boss} encounter={replayView.encounter} />
        </div>
      </section>
    );
  }

  const canClaimRewards = Boolean(selectedMessage && selectedMessage.claimedAt === null && hasRewards(selectedRewards));

  return (
    <section className="messagesShell">
      <div className="messagesColumn">
        <div className="messagesCard messagesInboxCard">
          <header className="messagesListHeader">
            <div>
              <span className="messagesEyebrow">{t("messages.eyebrow")}</span>
              <h2 className="messagesTitle">{t("messages.title")}</h2>
              <p className="messagesUnreadCount">{t("messages.unreadCount", { count: mailbox?.unreadCount ?? 0 })}</p>
            </div>
            <div className="messagesHeaderActions">
              <button
                type="button"
                className="button messagesButton"
                onClick={() => {
                  setComposeMode("direct");
                  setReplayView(null);
                  setComposeStatus(null);
                }}
              >
                {t("messages.composeDirect")}
              </button>
              {mailbox?.capabilities.canSendGuild ? (
                <button
                  type="button"
                  className="button messagesButton secondary"
                  onClick={() => {
                    setComposeMode("guild");
                    setReplayView(null);
                    setComposeStatus(null);
                  }}
                >
                  {t("messages.composeGuild")}
                </button>
              ) : null}
            </div>
          </header>

          {inboxError ? <p className="messagesError">{inboxError}</p> : null}
          {isLoadingInbox ? <p className="messagesStatus">{t("messages.loading")}</p> : null}

          <div className="messagesList">
            {!isLoadingInbox && entries.length === 0 ? (
              <p className="messagesEmptyState">{t("messages.emptyInbox")}</p>
            ) : null}

            {entries.map((entry) => {
              const listLabel = entry.subject.trim() || entry.senderName || t(getSourceKey(entry));
              const isSettled = entry.isRead && (!entry.hasRewards || entry.rewardsClaimed);
              return (
                <button
                  key={entry.messageId}
                  type="button"
                  className={`messagesListItem${selectedMessageId === entry.messageId ? " isSelected" : ""}${entry.isRead ? " isRead" : " isUnread"}${isSettled ? " isSettled" : ""}`}
                  onClick={() => {
                    setComposeMode(null);
                    setComposeStatus(null);
                    setSelectedMessageId(entry.messageId);
                  }}
                >
                  <div className="messagesListItemHeader">
                    <span className="messagesMetaText">{formatInboxTimestamp(entry.createdAt)}</span>
                  </div>
                  <div className="messagesMetaRow">
                    <strong className="messagesListType">{listLabel}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="messagesColumn">
        <div className="messagesCard messagesDetailCard">
          {composeMode ? (
            <>
              <header className="messagesDetailHeader">
                <div>
                  <span className="messagesEyebrow">{t("messages.compose")}</span>
                  <h2 className="messagesTitle">
                    {composeMode === "direct" ? t("messages.composeDirect") : t("messages.composeGuild")}
                  </h2>
                  {composeMode === "guild" ? (
                    <p className="messagesUnreadCount">
                      {mailbox?.capabilities.guildName ?? t("messages.guildFallback")}
                    </p>
                  ) : null}
                </div>
                <div className="messagesDetailActions">
                  <button type="button" className="button messagesButton ghost" onClick={() => setComposeMode(null)}>
                    {t("messages.backToInbox")}
                  </button>
                </div>
              </header>

              <div className="messagesDetailBody">
                {composeStatus ? <p className={composeStatus === t("messages.directSent") || composeStatus === t("messages.guildSent") ? "messagesStatus" : "messagesError"}>{composeStatus}</p> : null}
                {!mailbox?.capabilities.canSendGuild && composeMode === "guild" ? (
                  <p className="messagesError">{t("messages.noAccess")}</p>
                ) : (
                  <div className="messagesComposeForm">
                    {composeMode === "direct" ? (
                      <label>
                        {t("messages.recipient")}
                        <input
                          value={composeRecipient}
                          onChange={(event) => setComposeRecipient(event.target.value)}
                          placeholder={t("messages.recipientPlaceholder")}
                        />
                      </label>
                    ) : (
                      <label>
                        {t("messages.guildTarget")}
                        <input value={mailbox?.capabilities.guildName ?? t("messages.guildFallback")} readOnly />
                      </label>
                    )}
                    <label>
                      {t("messages.subject")}
                      <input
                        value={composeSubject}
                        onChange={(event) => setComposeSubject(event.target.value)}
                        placeholder={t("messages.subjectPlaceholder")}
                      />
                    </label>
                    <label>
                      {t("messages.body")}
                      <textarea
                        value={composeBody}
                        onChange={(event) => setComposeBody(event.target.value)}
                        placeholder={t("messages.bodyPlaceholder")}
                      />
                    </label>
                    <div className="messagesComposeActions">
                      <button
                        type="button"
                        className="button messagesButton"
                        disabled={
                          isSending
                          || !composeSubject.trim()
                          || !composeBody.trim()
                          || (composeMode === "direct" && !composeRecipient.trim())
                        }
                        onClick={() => {
                          void handleSendCompose();
                        }}
                      >
                        {isSending ? t("messages.sending") : t("messages.send")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : displayedEntry === null ? (
            <p className="messagesEmptyState">{t("messages.emptySelection")}</p>
          ) : (
            <>
              <header className="messagesDetailHeader">
                <div>
                  <span className="messagesEyebrow">{selectedMessage?.senderName ?? t(getSourceKey(displayedEntry))}</span>
                  <h2 className="messagesTitle">{selectedMessage?.subject ?? displayedEntry.subject}</h2>
                  <p className="messagesUnreadCount">{new Date(displayedEntry.createdAt).toLocaleString()}</p>
                </div>
              </header>

              <div className={`messagesDetailBody${isDetailTransitioning ? " isTransitioning" : ""}`}>
                {detailError ? <p className="messagesError">{detailError}</p> : null}
                {replayError ? <p className="messagesError">{replayError}</p> : null}
                {composeStatus ? <p className="messagesError">{composeStatus}</p> : null}
                {isDetailInitiallyLoading ? <p className="messagesStatus">{t("messages.detailLoading")}</p> : null}

                {selectedMessage ? (
                  <>
                    <p className="messagesBody">{selectedMessage.body}</p>
                    <div className="messagesMetaRow">
                      <span className="messagesMetaText">{selectedMessage.senderName ?? t(getSourceKey(selectedMessage))}</span>
                    </div>

                    <section className="messagesRewardsSection">
                      <strong>{t("messages.rewardsTitle")}</strong>
                      {selectedRewards && (hasRewardCurrencies || hasRewardItems || hasRenownReward) ? (
                        <div className="messagesRewardBlocks">
                          {hasRewardCurrencies ? (
                            <div className="playerCardCurrencyRow messagesRewardCurrencyRow" aria-label={t("messages.rewardsTitle")}>
                              {selectedRewards.ducats > 0 ? (
                                <div className="playerCardCurrencyPair">
                                  <strong className="playerCardCurrencyValue ducats">{selectedRewards.ducats.toLocaleString()}</strong>
                                  <span className="currencyIcon ducatIcon ducatCurrencyIcon playerCardCurrencyIcon" aria-hidden="true">
                                    <img className="currencyIconImage" src={DUCATS_ICON_PATH} alt="" />
                                  </span>
                                </div>
                              ) : null}
                              {selectedRewards.imperials > 0 ? (
                                <div className="playerCardCurrencyPair">
                                  <strong className="playerCardCurrencyValue imperials">{selectedRewards.imperials.toLocaleString()}</strong>
                                  <span className="currencyIcon imperialIcon imperialCurrencyIcon playerCardCurrencyIcon" aria-hidden="true">
                                    <img className="currencyIconImage" src={IMPERIALS_ICON_PATH} alt="" />
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {hasRenownReward ? (
                            <div className="messagesRewardsList">
                              <span className="messagesRewardChip">
                                {selectedRewards.renown.toLocaleString()} {t("messages.rewards.renown")}
                              </span>
                            </div>
                          ) : null}
                          {hasRewardItems ? (
                            <div ref={rewardItemsHostRef}>
                              <RewardInventoryGrid items={selectedRewards.items} playerState={playerState} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="messagesMetaText">{t("messages.rewards.none")}</p>
                      )}
                      {selectedMessage?.hasReplay || canClaimRewards ? (
                        <div className="messagesRewardActions">
                          {canClaimRewards ? (
                            <button
                              type="button"
                              className="button messagesButton secondary"
                              disabled={isClaiming}
                              onClick={() => {
                                void handleClaimRewards();
                              }}
                            >
                              {isClaiming ? t("messages.claiming") : t("messages.claimRewards")}
                            </button>
                          ) : null}
                          {selectedMessage?.hasReplay ? (
                            <button
                              type="button"
                              className="button messagesButton ghost"
                              disabled={isLoadingReplay}
                              onClick={() => {
                                void handleOpenReplay();
                              }}
                            >
                              {isLoadingReplay ? t("messages.loadingReplay") : t("messages.openReplay")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  </>
                ) : (
                  <p className="messagesEmptyState">{t("messages.detailFailed")}</p>
                )}
                {isDetailTransitioning ? <div className="messagesDetailTransitionOverlay" aria-hidden="true" /> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
