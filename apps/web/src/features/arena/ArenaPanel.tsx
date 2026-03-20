import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { ArenaLadderEntry, ArenaMatchResult, ArenaOffer, ArenaStateResponse } from "@ebonkeep/shared/arena";
import type { PlayerClass } from "@ebonkeep/shared/core";

import {
  CombatEncounterArenaPanel,
  CombatEncounterLogPanel,
  CombatEncounterTurnTrackPanel
} from "../combat";
import { combatPlaybackActionResolvedSchema } from "../combat/playback";
import { fetchArenaState, fightArenaOffer, findArenaOpponents } from "./api";
import {
  ARENA_COMBAT_PLAYBACK_BEAT_MS,
  ARENA_COMBAT_PLAYBACK_IMPACT_DELAY_MS,
  ARENA_COMBAT_PLAYBACK_START_DELAY_MS,
  ARENA_COMBAT_SUMMARY_TYPE_DELAY_MS,
  getArenaAnimationRate,
  getArenaPlaybackProgress,
  getArenaPlaybackThresholdMs,
  resetArenaCombatPlayback,
  snapshotArenaPlayback,
  type ActiveArenaEncounterState
} from "./playback";
import { buildArenaCombatState } from "./serverPlayback";
import { ClassIcon } from "../../app/ClassIcon";
import { getViewBackgroundStyle } from "../../lib/viewBackgrounds";

export type ArenaPanelProps = {
  token: string | null;
  hasPlayerState: boolean;
  playerName: string;
  playerClass: PlayerClass | null;
  playerLevel: number | null;
  playerAvatarPath?: string;
  formatDurationFromMs: (value: number) => string;
};

function formatRatingDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatPlayerClassLabel(playerClass: string): string {
  return playerClass
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function toArenaStateFromMatchResult(result: ArenaMatchResult): ArenaStateResponse {
  const cooldownEndsAt = result.profile.cooldownEndsAt;
  const hasActiveCooldown = cooldownEndsAt !== null && Date.parse(cooldownEndsAt) > Date.now();

  return {
    serverTime: new Date().toISOString(),
    profile: result.profile,
    offers: [],
    ladder: result.ladder,
    recentMatches: result.recentMatches,
    canFindOpponents: !hasActiveCooldown
  };
}

function getCooldownLabel(args: {
  arenaState: ArenaStateResponse;
  nowMs: number;
  formatDurationFromMs: (value: number) => string;
}): string | null {
  const cooldownEndsAt = args.arenaState.profile.cooldownEndsAt;
  if (!cooldownEndsAt) {
    return null;
  }

  const remainingMs = Date.parse(cooldownEndsAt) - args.nowMs;
  if (remainingMs <= 0) {
    return null;
  }

  return args.formatDurationFromMs(remainingMs);
}

function renderLadderRow(t: (key: string) => string, entry: ArenaLadderEntry) {
  return (
    <tr key={entry.entryId} className={entry.isCurrentPlayer ? "arenaLadderCurrentRow" : undefined}>
      <td>#{entry.rank}</td>
      <td>
        <div className="arenaLadderIdentity">
          <span className="classPortrait classPortrait--md arenaIdentityAvatar" aria-hidden="true">
            <ClassIcon playerClass={entry.class} size={46} className="classPortraitIcon" alt="" />
          </span>
          <div className="arenaLadderNameCell">
            <strong>{entry.displayName}</strong>
            <span>{entry.source === "mock" ? t("arena.mockOpponent") : t("arena.youLabel")}</span>
          </div>
        </div>
      </td>
      <td>{formatPlayerClassLabel(entry.class)}</td>
      <td>{entry.level}</td>
      <td>{entry.gearScore}</td>
      <td>{entry.rating}</td>
      <td>{formatRecord(entry.wins, entry.losses)}</td>
    </tr>
  );
}

function renderOfferCard(args: {
  offer: ArenaOffer;
  t: (key: string, options?: Record<string, string | number>) => string;
  fightingOfferId: string | null;
  onFight: (offer: ArenaOffer) => void;
}) {
  const { offer, t, fightingOfferId, onFight } = args;

  return (
    <article key={offer.offerId} className="arenaOfferCard">
      <div className="arenaOfferTopRow">
        <div className="arenaOfferIdentity">
          <span className="classPortrait classPortrait--md arenaIdentityAvatar" aria-hidden="true">
            <ClassIcon playerClass={offer.opponent.class} size={46} className="classPortraitIcon" alt="" />
          </span>
          <div>
            <p className="sectionEyebrow">{t("arena.duelOffer")}</p>
            <h4>{offer.opponent.displayName}</h4>
          </div>
        </div>
        <div className="arenaOfferRating">
          <span>{t("arena.rating")}</span>
          <strong>{offer.opponent.rating}</strong>
        </div>
      </div>
      <p className="arenaOfferMeta">
        {formatPlayerClassLabel(offer.opponent.class)} • {t("player.level", { value: offer.opponent.level })} •{" "}
        {t("arena.gearScoreShort", { value: offer.opponent.gearScore })}
      </p>
      <p className="arenaOfferWeapon">{offer.opponent.weaponLabel ?? t("arena.unknownWeapon")}</p>
      <div className="arenaOfferStats">
        <div>
          <span>{t("profile.mainDamage")}</span>
          <strong>{offer.opponent.previewStats.mainDamage}</strong>
        </div>
        <div>
          <span>{t("profile.maxHitpoints")}</span>
          <strong>{offer.opponent.previewStats.maxHitpoints}</strong>
        </div>
        <div>
          <span>{t("profile.combatSpeed")}</span>
          <strong>{offer.opponent.previewStats.combatSpeed}</strong>
        </div>
        <div>
          <span>{t("profile.armor")}</span>
          <strong>{offer.opponent.previewStats.armor}</strong>
        </div>
      </div>
      <div className="arenaOfferFooter">
        <span>{formatRecord(offer.opponent.wins, offer.opponent.losses)}</span>
        <span>{offer.opponent.source === "mock" ? t("arena.mockOpponent") : t("arena.liveOpponent")}</span>
      </div>
      <button
        type="button"
        className="primaryButton arenaFightButton"
        onClick={() => onFight(offer)}
        disabled={Boolean(fightingOfferId)}
      >
        {fightingOfferId === offer.offerId ? t("arena.fighting") : t("arena.fightNow")}
      </button>
    </article>
  );
}

export function ArenaPanel(props: ArenaPanelProps) {
  const { t } = useTranslation();
  const arenaSceneStyle = {
    ...getViewBackgroundStyle("arena"),
    "--adaptive-scene-scrim": "linear-gradient(180deg, rgba(7, 11, 16, 0.42), rgba(8, 13, 18, 0.62))",
    "--adaptive-scene-backdrop-scrim": "linear-gradient(180deg, rgba(7, 11, 16, 0.56), rgba(8, 13, 18, 0.78))",
    "--adaptive-scene-backdrop-filter": "brightness(0.48) saturate(0.88)"
  } as CSSProperties;
  const [arenaState, setArenaState] = useState<ArenaStateResponse | null>(null);
  const [combatState, setCombatState] = useState<ActiveArenaEncounterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFindingOpponents, setIsFindingOpponents] = useState(false);
  const [fightingOfferId, setFightingOfferId] = useState<string | null>(null);
  const [isOpponentModalOpen, setIsOpponentModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!props.token || !props.hasPlayerState) {
      setArenaState(null);
      setCombatState(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const state = await fetchArenaState(props.token as string);
        if (!active) {
          return;
        }
        setArenaState(state);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : t("arena.loadFailed"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [props.hasPlayerState, props.token, t]);

  useEffect(() => {
    if (!combatState) {
      return;
    }
    if (combatState.resolutionState === "awaiting_return") {
      return;
    }

    const tickAtMs = Date.now();

    if (combatState.lastPlaybackTickAtMs === null) {
      setCombatState((previousEncounter) => {
        if (!previousEncounter || previousEncounter.lastPlaybackTickAtMs !== null) {
          return previousEncounter;
        }

        return {
          ...previousEncounter,
          segmentPlaybackRate: previousEncounter.playbackRate,
          lastPlaybackTickAtMs: tickAtMs
        };
      });
      return;
    }

    const effectiveProgressMs = getArenaPlaybackProgress(combatState, tickAtMs);

    if (combatState.resolutionState === "summarizing") {
      if (combatState.finalSummaryLine === null) {
        return;
      }

      const typedLength = Math.min(
        combatState.finalSummaryLine.length,
        Math.floor(effectiveProgressMs / ARENA_COMBAT_SUMMARY_TYPE_DELAY_MS)
      );
      const nextTypedSummaryLine = combatState.finalSummaryLine.slice(0, typedLength);

      if (nextTypedSummaryLine !== combatState.typedSummaryLine) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.resolutionState !== "summarizing" || previousEncounter.finalSummaryLine === null) {
            return previousEncounter;
          }

          const snapshot = snapshotArenaPlayback(previousEncounter);
          if (snapshot.finalSummaryLine === null) {
            return snapshot;
          }

          const snapshotTypedLength = Math.min(
            snapshot.finalSummaryLine.length,
            Math.floor(snapshot.playbackProgressMs / ARENA_COMBAT_SUMMARY_TYPE_DELAY_MS)
          );

          return {
            ...snapshot,
            typedSummaryLine: snapshot.finalSummaryLine.slice(0, snapshotTypedLength)
          };
        });
        return;
      }

      if (typedLength >= combatState.finalSummaryLine.length) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.resolutionState !== "summarizing") {
            return previousEncounter;
          }

          return {
            ...snapshotArenaPlayback(previousEncounter),
            resolutionState: "awaiting_return"
          };
        });
        return;
      }

      const nextCharacterThresholdMs = (typedLength + 1) * ARENA_COMBAT_SUMMARY_TYPE_DELAY_MS;
      const remainingRealMs = Math.max(0, (nextCharacterThresholdMs - effectiveProgressMs) / combatState.segmentPlaybackRate);
      const summaryTimer = window.setTimeout(() => {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.resolutionState !== "summarizing") {
            return previousEncounter;
          }
          return snapshotArenaPlayback(previousEncounter);
        });
      }, remainingRealMs);

      return () => {
        window.clearTimeout(summaryTimer);
      };
    }

    const currentEvent = combatState.timeline[combatState.currentEventIndex] ?? null;
    if (!currentEvent) {
      return;
    }

    if (currentEvent.type === "CombatPlaybackStarted") {
      if (effectiveProgressMs >= ARENA_COMBAT_PLAYBACK_START_DELAY_MS) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted") {
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
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackStarted") {
            return previousEncounter;
          }
          return snapshotArenaPlayback(previousEncounter);
        });
      }, Math.max(0, (ARENA_COMBAT_PLAYBACK_START_DELAY_MS - effectiveProgressMs) / combatState.segmentPlaybackRate));

      return () => {
        window.clearTimeout(startTimer);
      };
    }

    if (currentEvent.type === "CombatPlaybackActionResolved") {
      const impactThresholdMs = getArenaPlaybackThresholdMs(ARENA_COMBAT_PLAYBACK_IMPACT_DELAY_MS, combatState);
      const beatThresholdMs = getArenaPlaybackThresholdMs(ARENA_COMBAT_PLAYBACK_BEAT_MS, combatState);

      if (combatState.activeAction?.eventId !== currentEvent.eventId) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return {
            ...snapshotArenaPlayback(previousEncounter),
            segmentPlaybackRate: previousEncounter.playbackRate,
            activeAction: combatPlaybackActionResolvedSchema.parse(currentEvent),
            impactTargetId: null
          };
        });
        return;
      }

      const impactApplied =
        combatState.impactTargetId === currentEvent.targetId &&
        combatState.hpByActorId[currentEvent.targetId] === currentEvent.targetHpAfter &&
        combatState.combatLogEventIds.includes(currentEvent.eventId);

      if (!impactApplied && effectiveProgressMs >= impactThresholdMs) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          const snapshot = snapshotArenaPlayback(previousEncounter);
          return {
            ...snapshot,
            hpByActorId: {
              ...snapshot.hpByActorId,
              [currentEvent.targetId]: currentEvent.targetHpAfter
            },
            impactTargetId: currentEvent.targetId,
            combatLogEntries: [...snapshot.combatLogEntries, currentEvent.logLine],
            combatLogEventIds: [...snapshot.combatLogEventIds, currentEvent.eventId]
          };
        });
        return;
      }

      if (effectiveProgressMs >= beatThresholdMs) {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }

          return {
            ...previousEncounter,
            currentEventIndex: previousEncounter.currentEventIndex + 1,
            playbackProgressMs: 0,
            lastPlaybackTickAtMs: null,
            activeAction: null,
            impactTargetId: null
          };
        });
        return;
      }

      const nextThresholdMs = impactApplied ? beatThresholdMs : impactThresholdMs;
      const combatTimer = window.setTimeout(() => {
        setCombatState((previousEncounter) => {
          if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.eventId !== currentEvent.eventId) {
            return previousEncounter;
          }
          return snapshotArenaPlayback(previousEncounter);
        });
      }, Math.max(0, (nextThresholdMs - effectiveProgressMs) / combatState.segmentPlaybackRate));

      return () => {
        window.clearTimeout(combatTimer);
      };
    }

    if (currentEvent.type === "CombatPlaybackEnded") {
      setCombatState((previousEncounter) => {
        if (!previousEncounter || previousEncounter.timeline[previousEncounter.currentEventIndex]?.type !== "CombatPlaybackEnded") {
          return previousEncounter;
        }

        return {
          ...snapshotArenaPlayback(previousEncounter),
          currentEventIndex: previousEncounter.currentEventIndex + 1,
          playbackProgressMs: 0,
          lastPlaybackTickAtMs: null,
          activeAction: null,
          impactTargetId: null,
          resolutionState: "summarizing",
          finalSummaryLine: currentEvent.summaryLine,
          typedSummaryLine: ""
        };
      });
    }
  }, [combatState]);

  const cooldownLabel = arenaState
    ? getCooldownLabel({
        arenaState,
        nowMs,
        formatDurationFromMs: props.formatDurationFromMs
      })
    : null;
  const selectionExpiresAt = arenaState?.offers[0]?.cooldownEndsAt ?? null;
  const selectionLabel =
    selectionExpiresAt !== null
      ? props.formatDurationFromMs(Math.max(0, Date.parse(selectionExpiresAt) - nowMs))
      : null;
  const lastMatch = arenaState?.recentMatches[0] ?? null;
  const summaryRecord = arenaState ? formatRecord(arenaState.profile.wins, arenaState.profile.losses) : "0-0";
  const topLadderRows = useMemo(() => arenaState?.ladder.entries ?? [], [arenaState]);
  const hasAvailableOffers = arenaState?.offers.length ? arenaState.offers.length > 0 : false;
  const opponentButtonLabel = hasAvailableOffers ? t("arena.chooseOpponent") : t("arena.findOpponent");

  async function refreshArenaState() {
    if (!props.token) {
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      setArenaState(await fetchArenaState(props.token));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("arena.loadFailed"));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleFindOpponents() {
    if (!props.token || isFindingOpponents) {
      return;
    }

    if (arenaState?.offers.length) {
      setIsOpponentModalOpen(true);
      return;
    }

    setIsFindingOpponents(true);
    setError(null);
    try {
      const nextState = await findArenaOpponents(props.token);
      setArenaState(nextState);
      setIsOpponentModalOpen(nextState.offers.length > 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("arena.findFailed"));
    } finally {
      setIsFindingOpponents(false);
    }
  }

  async function handleFightOpponent(offer: ArenaOffer) {
    if (!props.token || fightingOfferId) {
      return;
    }

    setFightingOfferId(offer.offerId);
    setError(null);
    setHoveredActorId(null);
    try {
      const result = await fightArenaOffer(props.token, offer.offerId);
      setIsOpponentModalOpen(false);
      setArenaState(toArenaStateFromMatchResult(result));
      setCombatState(
        buildArenaCombatState({
          result,
          playerAvatarPath: props.playerAvatarPath
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("arena.fightFailed"));
    } finally {
      setFightingOfferId(null);
    }
  }

  function replayCombat() {
    setHoveredActorId(null);
    setCombatState((previousEncounter) => (previousEncounter ? resetArenaCombatPlayback(previousEncounter) : previousEncounter));
  }

  async function backToArenaBoard() {
    setHoveredActorId(null);
    setCombatState(null);
    setIsOpponentModalOpen(false);
    await refreshArenaState();
  }

  function toggleCombatFastForward() {
    setCombatState((previousEncounter) => {
      if (!previousEncounter) {
        return previousEncounter;
      }

      const toggledAtMs = Date.now();
      return {
        ...snapshotArenaPlayback(previousEncounter, toggledAtMs),
        playbackRate: previousEncounter.playbackRate === 5 ? 1 : 5,
        lastPlaybackTickAtMs: toggledAtMs
      };
    });
  }

  if (!props.hasPlayerState) {
    return (
      <section className="contentShell arenaPanelShell indoorSceneShell" style={arenaSceneStyle}>
        <section className="contentStack">
          <article className="contentCard">
            <h2>{t("menu.arena")}</h2>
            <p>{t("inventory.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (isLoading && !arenaState) {
    return (
      <section className="contentShell arenaPanelShell indoorSceneShell" style={arenaSceneStyle}>
        <section className="contentStack">
          <article className="contentCard">
            <h2>{t("menu.arena")}</h2>
            <p>{t("arena.loading")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (!arenaState) {
    return (
      <section className="contentShell arenaPanelShell indoorSceneShell" style={arenaSceneStyle}>
        <section className="contentStack">
          <article className="contentCard">
            <h2>{t("menu.arena")}</h2>
            <p>{error ?? t("arena.loadFailed")}</p>
          </article>
        </section>
      </section>
    );
  }

  if (combatState) {
    return (
      <section className="contentShell arenaPanelShell indoorSceneShell" style={arenaSceneStyle}>
        <section className="contentStack arenaReplayRoot">
          <article className="contentCard arenaHeaderCard">
            <div className="arenaHeaderRow">
              <div>
                <p className="sectionEyebrow">{t("arena.combatReplayEyebrow")}</p>
                <h2>{t("arena.combatReplayTitle")}</h2>
              </div>
              <div className="arenaReplaySummary">
                <span>{t("arena.currentRating", { value: arenaState.profile.rating })}</span>
                {lastMatch ? (
                  <span className={`arenaResultDelta${lastMatch.ratingDelta >= 0 ? " isPositive" : " isNegative"}`}>
                    {t("arena.ratingDeltaLabel", { value: formatRatingDelta(lastMatch.ratingDelta) })}
                  </span>
                ) : null}
              </div>
            </div>
          </article>

          <div className="contractsCombatViewportGroup arenaCombatViewportGroup">
            <div className="contractsCombatViewportMain arenaCombatViewportMain">
              <div className="contractsCombatViewportMainStack arenaCombatViewportMainStack">
                <CombatEncounterTurnTrackPanel
                  encounter={combatState.encounter}
                  timeline={combatState.timeline}
                  currentEventIndex={combatState.currentEventIndex}
                  hpByActorId={combatState.hpByActorId}
                  currentAction={combatState.activeAction}
                  resolutionState={combatState.resolutionState}
                  hoveredActorId={hoveredActorId}
                  onHoverActor={setHoveredActorId}
                />
                <CombatEncounterArenaPanel
                  encounter={combatState.encounter}
                  timeline={combatState.timeline}
                  currentEventIndex={combatState.currentEventIndex}
                  hpByActorId={combatState.hpByActorId}
                  currentAction={combatState.activeAction}
                  impactTargetId={combatState.impactTargetId}
                  playbackRate={getArenaAnimationRate(combatState)}
                  isFastForwardEnabled={combatState.playbackRate === 5}
                  hoveredActorId={hoveredActorId}
                  resolutionState={combatState.resolutionState}
                  onToggleFastForward={toggleCombatFastForward}
                  onReplayCombat={replayCombat}
                  onBackToBoard={backToArenaBoard}
                  replayButtonLabel={t("arena.replayCombat")}
                  backButtonLabel={t("arena.backToArena")}
                />
              </div>
            </div>
            <div className="contractsCombatViewportSide arenaCombatViewportSide">
              <CombatEncounterLogPanel
                encounter={combatState.encounter}
                timeline={combatState.timeline}
                currentEventIndex={combatState.currentEventIndex}
                combatLogEntries={combatState.combatLogEntries}
                combatLogEventIds={combatState.combatLogEventIds}
                resolutionState={combatState.resolutionState}
                typedSummaryLine={combatState.typedSummaryLine}
                onCloseLog={backToArenaBoard}
                onReplayCombat={replayCombat}
                onBackToBoard={backToArenaBoard}
                replayButtonLabel={t("arena.replayCombat")}
                backButtonLabel={t("arena.backToArena")}
              />
            </div>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="contentShell arenaPanelShell indoorSceneShell" style={arenaSceneStyle}>
      <section className="contentStack arenaPanelRoot">
        {error ? (
          <article className="contentCard arenaErrorCard">
            <p>{error}</p>
          </article>
        ) : null}

        <article className="contentCard arenaProfileCard">
          <div className="arenaProfileRow">
            <div className="arenaProfileSummary">
              <span className="classPortrait classPortrait--md arenaIdentityAvatar" aria-hidden="true">
                {props.playerClass ? (
                  <ClassIcon playerClass={props.playerClass} size={46} className="classPortraitIcon" alt="" />
                ) : null}
              </span>
              <div className="arenaProfileIdentityText">
                <p className="sectionEyebrow">{t("arena.profileEyebrow")}</p>
                <h3>{props.playerName}</h3>
                <p className="arenaProfileIdentityMeta">
                  {props.playerClass ? formatPlayerClassLabel(props.playerClass) : t("player.classUnknown")}
                </p>
                <p className="arenaProfileIdentityMeta">{t("player.level", { value: props.playerLevel ?? "-" })}</p>
              </div>
            </div>

            <div className="arenaProfileStats">
              <div className="arenaSummaryTile">
                <span>{t("arena.rating")}</span>
                <strong>{arenaState.profile.rating}</strong>
              </div>
              <div className="arenaSummaryTile">
                <span>{t("arena.rank")}</span>
                <strong>#{arenaState.profile.rank}</strong>
              </div>
              <div className="arenaSummaryTile">
                <span>{t("arena.record")}</span>
                <strong>{summaryRecord}</strong>
              </div>
              <div className="arenaSummaryTile">
                <span>{t("arena.cooldown")}</span>
                <strong>{cooldownLabel ?? t("arena.ready")}</strong>
              </div>
            </div>

            <div className="arenaProfileActions">
              {selectionLabel && hasAvailableOffers ? (
                <span className="arenaWindowChip">{t("arena.selectionExpiresIn", { duration: selectionLabel })}</span>
              ) : null}
              <button
                type="button"
                className="primaryButton arenaFindButton arenaFindButtonInline"
                onClick={handleFindOpponents}
                disabled={(!arenaState.canFindOpponents && !hasAvailableOffers) || isFindingOpponents}
              >
                {isFindingOpponents ? t("arena.findingOpponents") : opponentButtonLabel}
              </button>
            </div>
          </div>
        </article>

        <article className="contentCard arenaLadderCard">
          <div className="arenaLadderCardInner">
            <div className="arenaSectionHeader">
              <div>
                <p className="sectionEyebrow">{t("arena.ladderEyebrow")}</p>
                <h3>{t("arena.topLadder")}</h3>
              </div>
              <span className="arenaWindowChip">
                {t("arena.currentRank", {
                  rank: arenaState.ladder.currentPlayerRank ?? arenaState.profile.rank
                })}
              </span>
            </div>
            <div className="arenaLadderTableWrap arenaLadderTableScroll">
              <table className="arenaLadderTable">
                <thead>
                  <tr>
                    <th>{t("arena.ladderTable.rank")}</th>
                    <th>{t("arena.ladderTable.player")}</th>
                    <th>{t("arena.ladderTable.class")}</th>
                    <th>{t("arena.ladderTable.level")}</th>
                    <th>{t("arena.ladderTable.gearScore")}</th>
                    <th>{t("arena.ladderTable.rating")}</th>
                    <th>{t("arena.ladderTable.record")}</th>
                  </tr>
                </thead>
                <tbody>{topLadderRows.map((entry) => renderLadderRow(t, entry))}</tbody>
              </table>
            </div>
          </div>
        </article>

        <div className="arenaFooterActions">
          <button
            type="button"
            className="subtleButton arenaRefreshButton"
            onClick={refreshArenaState}
            disabled={isRefreshing || isFindingOpponents || Boolean(fightingOfferId)}
          >
            {isRefreshing ? t("arena.refreshing") : t("arena.refresh")}
          </button>
        </div>

        {isOpponentModalOpen ? (
          <div
            className="arenaModalBackdrop"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsOpponentModalOpen(false);
              }
            }}
          >
            <article className="arenaModalCard" role="dialog" aria-modal="true" aria-labelledby="arena-opponent-dialog-title">
              <div className="arenaSectionHeader">
                <div>
                  <p className="sectionEyebrow">{t("arena.opponentsEyebrow")}</p>
                  <h3 id="arena-opponent-dialog-title">
                    {hasAvailableOffers ? t("arena.chooseOpponent") : t("arena.findOpponentTitle")}
                  </h3>
                </div>
                <button
                  type="button"
                  className="subtleButton arenaModalCloseButton"
                  onClick={() => setIsOpponentModalOpen(false)}
                >
                  {t("common.close")}
                </button>
              </div>
              {hasAvailableOffers ? (
                <>
                  {selectionLabel ? (
                    <span className="arenaWindowChip">{t("arena.selectionExpiresIn", { duration: selectionLabel })}</span>
                  ) : null}
                  <div className="arenaOffersGrid arenaOffersGridModal">
                    {arenaState.offers.map((offer) =>
                      renderOfferCard({
                        offer,
                        t,
                        fightingOfferId,
                        onFight: handleFightOpponent
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="arenaSearchEmptyState arenaSearchEmptyStateModal">
                  {cooldownLabel ? <p>{t("arena.cooldownLocked", { duration: cooldownLabel })}</p> : null}
                </div>
              )}
            </article>
          </div>
        ) : null}
      </section>
    </section>
  );
}
