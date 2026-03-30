import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { GuildRaidHistoryEntry, GuildRaidStateResponse } from "@ebonkeep/shared/guild";

import { ClassIcon } from "../../app/ClassIcon";
import {
  commenceGuildRaidNow,
  getGuildRaidState,
  joinGuildRaid,
  leaveGuildRaid,
  summonGuildRaid
} from "./api";
import { GuildRaidActiveEncounter } from "./GuildRaidActiveEncounter";
import {
  buildGuildRaidPlaybackState,
  type ActiveGuildRaidPlaybackState
} from "./raidPlayback";

const RAID_POLL_INTERVAL_MS = 30_000;
const CLOCK_TICK_MS = 1_000;
type GuildRaidBossesProps = {
  token: string;
  guildId: string;
  guildName: string;
  onActiveEncounterChange?: (active: boolean) => void;
};

type RaidAction = "summon" | "join" | "leave" | "commence";
type RaidParticipant = NonNullable<GuildRaidStateResponse["activeEncounter"]>["participants"][number];
type RaidProgressionEntry = GuildRaidStateResponse["progression"][number];
type RaidEncounter = NonNullable<GuildRaidStateResponse["activeEncounter"]>;

function formatDuration(ms: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (ms <= 0) {
    return t("guild.raids.time.ready");
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return t("guild.raids.time.daysHours", { days, hours });
  }
  if (hours > 0) {
    return t("guild.raids.time.hoursMinutes", { hours, minutes });
  }
  if (minutes > 0) {
    return t("guild.raids.time.minutesSeconds", { minutes, seconds });
  }
  return t("guild.raids.time.seconds", { seconds });
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatPercentBps(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function getEncounterDeadline(encounter: GuildRaidStateResponse["activeEncounter"]): string | null {
  if (!encounter) {
    return null;
  }

  return encounter.state === "lobby" ? encounter.lobbyEndsAt : encounter.lockEndsAt;
}

function getTopStatusKey(
  raidState: GuildRaidStateResponse,
  activeEncounter: GuildRaidStateResponse["activeEncounter"],
  currentBoss: GuildRaidStateResponse["activeBoss"]
) {
  if (activeEncounter) {
    return activeEncounter.state === "lobby" ? "guild.raids.states.lobby" : "guild.raids.states.locked";
  }

  return currentBoss ? "guild.raids.states.ready" : "guild.raids.states.cleared";
}

function getPrimaryAction(
  raidState: GuildRaidStateResponse,
  activeEncounter: GuildRaidStateResponse["activeEncounter"]
): {
  action: RaidAction;
  enabled: boolean;
  labelKey: string;
} | null {
  if (!activeEncounter) {
    if (!raidState.currentUserCanSummon) {
      return null;
    }
    return {
      action: "summon",
      enabled: raidState.summonPreview.canSummon,
      labelKey: "guild.raids.actions.summon"
    };
  }

  if (activeEncounter.state === "lobby") {
    if (activeEncounter.currentUserJoined) {
      return {
        action: "leave",
        enabled: activeEncounter.canLeave,
        labelKey: "guild.raids.actions.leave"
      };
    }

    return {
      action: "join",
      enabled: activeEncounter.canJoin,
      labelKey: "guild.raids.actions.join"
    };
  }

  return null;
}

function getBusyLabelKey(action: RaidAction): string {
  switch (action) {
    case "summon":
      return "guild.raids.actions.summoning";
    case "join":
      return "guild.raids.actions.joining";
    case "leave":
      return "guild.raids.actions.leaving";
    case "commence":
      return "guild.raids.actions.commencing";
  }
}

function getJoinedAtTime(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function getRaidDeploymentOrder(
  encounter: GuildRaidStateResponse["activeEncounter"]
): RaidParticipant[] {
  if (!encounter) {
    return [];
  }

  return [...encounter.participants].sort((left, right) => {
    const powerDelta = left.power - right.power;
    if (powerDelta !== 0) {
      return powerDelta;
    }

    const joinedAtDelta = getJoinedAtTime(left.joinedAt) - getJoinedAtTime(right.joinedAt);
    if (joinedAtDelta !== 0) {
      return joinedAtDelta;
    }

    return left.playerName.localeCompare(right.playerName);
  });
}

function getResolvedPlaybackEncounter(state: GuildRaidStateResponse): RaidEncounter | null {
  const candidates = [state.activeEncounter, state.latestResolvedEncounter].filter(
    (encounter): encounter is RaidEncounter => Boolean(encounter?.report)
  );
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftResolvedAt = Date.parse(left.report?.resolvedAt ?? "");
    const rightResolvedAt = Date.parse(right.report?.resolvedAt ?? "");
    return rightResolvedAt - leftResolvedAt;
  })[0] ?? null;
}

function RaidNoticeModal(props: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="imperialShopModalOverlay" onClick={props.onClose}>
      <div className="imperialShopStatusModal guildConfirmModal" onClick={(event) => event.stopPropagation()}>
        <div className="guildConfirmModalIcon guildRaidNoticeIcon" aria-hidden="true">
          !
        </div>
        <h2 className="guildConfirmModalTitle">{props.title}</h2>
        <p className="guildConfirmModalMessage">{props.message}</p>
        <div className="guildConfirmModalActions">
          <button
            type="button"
            className="guildConfirmModalBtn guildConfirmModalBtnConfirm"
            onClick={props.onClose}
          >
            {t("ok")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RaidHistoryModal(props: {
  entries: GuildRaidHistoryEntry[];
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  function toggleEntry(instanceId: string) {
    setExpandedIds((currentIds) =>
      currentIds.includes(instanceId)
        ? currentIds.filter((value) => value !== instanceId)
        : [...currentIds, instanceId]
    );
  }

  return createPortal(
    <div className="imperialShopModalOverlay" onClick={props.onClose}>
      <div className="imperialShopStatusModal guildConfirmModal guildRaidHistoryModal" onClick={(event) => event.stopPropagation()}>
        <div className="guildRaidHistoryHeader">
          <h2 className="guildConfirmModalTitle">{t("guild.raids.historyTitle")}</h2>
          <button
            type="button"
            className="guildRaidInfoClose"
            aria-label={t("guild.raids.closeInfo")}
            onClick={props.onClose}
          >
            x
          </button>
        </div>
        <div className="guildRaidHistoryBody">
          {props.entries.length === 0 ? (
            <p className="guildRaidInfoEmpty">{t("guild.raids.historyEmpty")}</p>
          ) : (
            <div className="guildRaidHistoryList">
              {props.entries.map((entry: GuildRaidHistoryEntry) => (
                <div key={entry.instanceId} className="guildRaidHistoryCard">
                  <button
                    type="button"
                    className="guildRaidHistoryToggle"
                    onClick={() => toggleEntry(entry.instanceId)}
                    aria-expanded={expandedIds.includes(entry.instanceId)}
                  >
                    <div className="guildRaidHistoryCardTop">
                      <strong>{entry.bossName}</strong>
                      <div className="guildRaidHistoryCardTopRight">
                        {entry.firstClear ? (
                          <span className="guildRaidHistoryBadge">{t("guild.raids.historyFirstClear")}</span>
                        ) : null}
                        <span className="guildRaidHistoryChevron" aria-hidden="true">
                          {expandedIds.includes(entry.instanceId) ? "−" : "+"}
                        </span>
                      </div>
                    </div>
                    <span className="guildRaidHistoryZone">{entry.zoneName}</span>
                    <div className="guildRaidHistoryMeta">
                      <span>{formatTimestamp(entry.resolvedAt)}</span>
                      <span>DMG {formatNumber(entry.totalDamage)}</span>
                    </div>
                    <div className="guildRaidHistoryBonus">{entry.unlockedBonus.label}</div>
                  </button>
                  {expandedIds.includes(entry.instanceId) ? (
                    <div className="guildRaidHistoryReport">
                      <div className="guildRaidHistoryReportTitle">{t("guild.raids.report.title")}</div>
                      <div className="guildRaidReportGrid">
                        {entry.ranking.map((rankingEntry: GuildRaidHistoryEntry["ranking"][number], index: number) => (
                          <div key={`${entry.instanceId}-${rankingEntry.playerId}-${index}`} className="guildRaidReportRow">
                            <span className="guildRaidReportRank">#{index + 1}</span>
                            <strong className="guildRaidReportName">{rankingEntry.playerName}</strong>
                            <span className="guildRaidReportShare">
                              {formatPercentBps(rankingEntry.damageShareBps)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RaidInfoDrawer(props: {
  state: GuildRaidStateResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return createPortal(
    <>
      <button
        type="button"
        className="guildRaidInfoBackdrop"
        aria-label={t("guild.raids.closeInfo")}
        onClick={props.onClose}
      />
      <aside className="guildRaidInfoPanel" aria-modal="true" role="dialog">
        <div className="guildRaidInfoHeader">
          <h3>{t("guild.raids.infoTitle")}</h3>
          <button
            type="button"
            className="guildRaidInfoClose"
            aria-label={t("guild.raids.closeInfo")}
            onClick={props.onClose}
          >
            x
          </button>
        </div>

        <div className="guildRaidInfoBody">
          <section className="guildRaidInfoSection">
            <h4>{t("guild.raids.rulesTitle")}</h4>
            <div className="guildRaidRuleList">
              <p>{t("guild.raids.rules.lobby")}</p>
              <p>{t("guild.raids.rules.manualJoin")}</p>
              <p>{t("guild.raids.rules.lock")}</p>
              <p>{t("guild.raids.rules.bonus")}</p>
            </div>
          </section>

          <section className="guildRaidInfoSection">
            <h4>{t("guild.raids.unlockedBonusesTitle")}</h4>
            {props.state.unlockedBonuses.length === 0 ? (
              <p className="guildRaidInfoEmpty">{t("guild.raids.noBonuses")}</p>
            ) : (
              <div className="guildRaidInfoList">
                {props.state.unlockedBonuses.map((bonus) => (
                  <div key={bonus.type} className="guildRaidInfoCard">
                    <strong>{bonus.label}</strong>
                    <span>{bonus.description}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="guildRaidInfoSection">
            <h4>{t("guild.raids.progressionTitle")}</h4>
            <div className="guildRaidProgressChain">
              {props.state.progression.map((entry) => (
                <div
                  key={entry.bossId}
                  className={`guildRaidProgressStep guildRaidProgressStep--${entry.status}`}
                >
                  <div className={`guildRaidProgressMarker guildRaidProgressMarker--${entry.status}`}>
                    {entry.status === "cleared" ? "✓" : entry.orderIndex + 1}
                  </div>
                  <div className={`guildRaidProgressCard guildRaidProgressCard--${entry.status}`}>
                    <strong>{entry.bossName}</strong>
                    <span>{entry.unlockedBonus.label}</span>
                    {entry.clearedAt ? <small>{formatTimestamp(entry.clearedAt)}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>,
    document.body
  );
}

export function GuildRaidBosses({
  token,
  guildId,
  guildName,
  onActiveEncounterChange
}: GuildRaidBossesProps) {
  const { t } = useTranslation("common");
  const [raidState, setRaidState] = useState<GuildRaidStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyModal, setNotifyModal] = useState<{ title: string; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<RaidAction | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [infoOpen, setInfoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activePlayback, setActivePlayback] = useState<ActiveGuildRaidPlaybackState | null>(null);
  const activeEncounterChangeRef = useRef(onActiveEncounterChange);

  useEffect(() => {
    activeEncounterChangeRef.current = onActiveEncounterChange;
  }, [onActiveEncounterChange]);

  useEffect(() => {
    activeEncounterChangeRef.current?.(activePlayback !== null);
  }, [activePlayback]);

  useEffect(() => {
    return () => {
      activeEncounterChangeRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      setLoading(true);
      try {
        const nextState = await getGuildRaidState(token, guildId);
        if (!cancelled) {
          setRaidState(nextState);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("guild.raids.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadState();

    const pollId = window.setInterval(() => {
      void getGuildRaidState(token, guildId)
        .then((nextState) => {
          if (!cancelled) {
            setRaidState(nextState);
            setError(null);
          }
        })
        .catch(() => {
          // Keep current state if background poll fails.
        });
    }, RAID_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [guildId, reloadTick, t, token]);

  async function handleAction(action: RaidAction) {
    setActionLoading(action);
    setError(null);

    try {
      let nextState: GuildRaidStateResponse;
      switch (action) {
        case "summon":
          nextState = await summonGuildRaid(token, guildId);
          break;
        case "join":
          nextState = await joinGuildRaid(token, guildId);
          break;
        case "leave":
          nextState = await leaveGuildRaid(token, guildId);
          break;
        case "commence":
          nextState = await commenceGuildRaidNow(token, guildId);
          break;
      }

      setRaidState(nextState);
      const playbackEncounter = action === "commence" ? getResolvedPlaybackEncounter(nextState) : null;
      if (playbackEncounter?.report) {
        setInfoOpen(false);
        setActivePlayback(
          buildGuildRaidPlaybackState({
            encounter: playbackEncounter,
            guildName,
            nowMs: Date.now()
          })
        );
      }
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : t("guild.raids.actionFailed");
      if (action === "commence") {
        setNotifyModal({
          title: t("guild.notifications.error"),
          message
        });
      } else {
        setError(message);
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (activePlayback) {
    return (
      <GuildRaidActiveEncounter
        playback={activePlayback}
        nowMs={nowMs}
        onChange={(updater) => {
          setActivePlayback((currentPlayback) => (currentPlayback ? updater(currentPlayback) : currentPlayback));
        }}
        onExit={() => {
          setActivePlayback(null);
          setReloadTick((value) => value + 1);
        }}
        formatDurationFromMs={(value) => formatDuration(value, t)}
      />
    );
  }

  if (loading && !raidState) {
    return <p className="placeholderText">{t("guild.raids.loading")}</p>;
  }

  if (!raidState) {
    return (
      <div className="guildRaidBoard">
        <p className="guildFormError">{error ?? t("guild.raids.loadFailed")}</p>
        <button
          type="button"
          className="buttonSecondary"
          onClick={() => setReloadTick((value) => value + 1)}
        >
          {t("guild.raids.refresh")}
        </button>
      </div>
    );
  }

  const activeEncounter = raidState.activeEncounter;
  const currentBoss = activeEncounter?.boss ?? raidState.activeBoss;
  const encounterDeadline = getEncounterDeadline(activeEncounter);
  const timeRemaining =
    encounterDeadline !== null ? Math.max(0, new Date(encounterDeadline).getTime() - nowMs) : null;
  const primaryAction = getPrimaryAction(raidState, activeEncounter);
  const deploymentOrder = getRaidDeploymentOrder(activeEncounter);
  const topStatusKey = getTopStatusKey(raidState, activeEncounter, currentBoss);
  const latestUnlockedBonus = raidState.unlockedBonuses[raidState.unlockedBonuses.length - 1] ?? null;
  const currentUserRole = raidState.currentUserRole;
  const showSummonRoleHint = !activeEncounter && currentBoss && !raidState.currentUserCanSummon;
  const topHint = activeEncounter
    ? activeEncounter.state === "lobby"
      ? t("guild.raids.topHint.lobby", {
          joinedCount: `${activeEncounter.joinCount}/${activeEncounter.boss.participantCap}`
        })
      : t("guild.raids.topHint.locked")
    : raidState.summonPreview.canSummon
      ? t("guild.raids.topHint.ready")
      : raidState.summonPreview.blockedReason ?? t("guild.raids.topHint.wait");

  function handleCommenceClick() {
    if (!activeEncounter) {
      return;
    }

    if (!["leader", "officer"].includes(currentUserRole ?? "")) {
      setNotifyModal({
        title: t("guild.notifications.error"),
        message: t("guild.raids.commenceBlocked.permission")
      });
      return;
    }

    if (activeEncounter.joinCount < activeEncounter.boss.minParticipants) {
      setNotifyModal({
        title: t("guild.notifications.error"),
        message: t("guild.raids.commenceBlocked.participants", {
          min: activeEncounter.boss.minParticipants,
          joined: activeEncounter.joinCount
        })
      });
      return;
    }

    void handleAction("commence");
  }

  return (
    <div className="guildRaidBoard guildRaidBoard--compact">
      {notifyModal ? (
        <RaidNoticeModal
          title={notifyModal.title}
          message={notifyModal.message}
          onClose={() => setNotifyModal(null)}
        />
      ) : null}

      <div className="guildRaidTopBar">
        <div className="guildRaidTopStats">
          <div className="guildRaidTopStat">
            <span>{t("guild.raids.top.progress")}</span>
            <strong>{raidState.bossesDefeatedCount}/{raidState.totalBossCount}</strong>
          </div>
          <div className="guildRaidTopStat">
            <span>{t("guild.raids.top.status")}</span>
            <strong>{t(topStatusKey)}</strong>
          </div>
          <div className="guildRaidTopStat">
            <span>{t("guild.raids.top.bonus")}</span>
            <strong>{latestUnlockedBonus?.label ?? t("guild.raids.top.none")}</strong>
          </div>
        </div>

        <div className="guildRaidTopActions">
          <button
            type="button"
            className="buttonSecondary guildRaidInfoButton"
            onClick={() => setHistoryOpen(true)}
          >
            {t("guild.raids.historyButton")}
          </button>
          <button
            type="button"
            className="buttonSecondary guildRaidInfoButton"
            onClick={() => setInfoOpen(true)}
          >
            {t("guild.raids.infoButton")}
          </button>
          <button
            type="button"
            className="buttonSecondary"
            onClick={() => setReloadTick((value) => value + 1)}
            disabled={actionLoading !== null}
          >
            {t("guild.raids.refresh")}
          </button>
        </div>
      </div>

      {error ? <p className="guildFormError">{error}</p> : null}

      <article className="guildRaidCompactHero">
        {currentBoss ? (
          <div className={`guildRaidHeroVisual${currentBoss.portraitAssetPath ? " hasPortrait" : ""}`}>
            {currentBoss.portraitAssetPath ? (
              <img
                className="guildRaidHeroPortrait"
                src={currentBoss.portraitAssetPath}
                alt={currentBoss.bossName}
              />
            ) : (
              <div className="guildRaidHeroPlaceholder" aria-hidden="true">
                <span>RB</span>
                <small>{t("guild.raids.imageSlot")}</small>
              </div>
            )}
          </div>
        ) : null}

        <div className="guildRaidCompactSummary">
          <div className="guildRaidCompactHead">
            <div>
              <p className="guildRaidEyebrow">{t("guild.raids.currentBoss")}</p>
              <h3 className="guildRaidCompactTitle">
                {currentBoss ? currentBoss.bossName : t("guild.raids.chainComplete")}
              </h3>
              <p className="guildRaidCompactSubtitle">
                {currentBoss
                  ? currentBoss.zoneName
                  : t("guild.raids.chainCompleteSubtitle")}
              </p>
            </div>

            <span className={`guildRaidStateBadge guildRaidStateBadge--${activeEncounter?.state ?? "ready"}`}>
              {t(topStatusKey)}
            </span>
          </div>

          <p className="guildRaidCompactHint">{topHint}</p>

          {currentBoss ? (
            <div className="guildRaidMiniStats">
              <div className="guildRaidMiniStat">
                <span>{t("guild.raids.mini.power")}</span>
                <strong>{formatNumber(currentBoss.recommendedGuildPower)}</strong>
              </div>
              <div className="guildRaidMiniStat">
                <span>{t("guild.raids.mini.hp")}</span>
                <strong>{formatNumber(currentBoss.bossMaxHp)}</strong>
              </div>
              <div className="guildRaidMiniStat">
                <span>{t("guild.raids.mini.players")}</span>
                <strong>
                  {t("guild.raids.mini.playersValue", {
                    min: currentBoss.minParticipants,
                    max: currentBoss.participantCap
                  })}
                </strong>
              </div>
              <div className="guildRaidMiniStat">
                <span>{activeEncounter ? t("guild.raids.mini.timer") : t("guild.raids.mini.cost")}</span>
                <strong>
                  {activeEncounter && timeRemaining !== null
                    ? formatDuration(timeRemaining, t)
                    : raidState.summonPreview.imperialsCost > 0
                      ? t("guild.raids.mini.costValue", {
                          ducats: formatNumber(raidState.summonPreview.ducatsCost),
                          imperials: formatNumber(raidState.summonPreview.imperialsCost)
                        })
                      : t("guild.raids.mini.costValueNoImperials", {
                          ducats: formatNumber(raidState.summonPreview.ducatsCost)
                        })}
                </strong>
              </div>
            </div>
          ) : null}

          {primaryAction ? (
            <div className="guildRaidPrimaryAction">
              <button
                type="button"
                className="buttonPrimary guildRaidPrimaryButton"
                onClick={() => void handleAction(primaryAction.action)}
                disabled={!primaryAction.enabled || actionLoading !== null}
              >
                {actionLoading === primaryAction.action
                  ? t(getBusyLabelKey(primaryAction.action))
                  : t(primaryAction.labelKey)}
              </button>

              {activeEncounter?.state === "lobby" ? (
                <button
                  type="button"
                  className="buttonSecondary guildRaidSecondaryButton"
                  onClick={handleCommenceClick}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "commence"
                    ? t("guild.raids.actions.commencing")
                    : t("guild.raids.actions.commence")}
                </button>
              ) : null}
            </div>
          ) : null}

          {showSummonRoleHint ? (
            <p className="guildRaidCompactHint guildRaidCompactHint--role">
              {t("guild.raids.summonRoleHint")}
            </p>
          ) : null}

          {activeEncounter?.state === "lobby" && deploymentOrder.length > 0 ? (
            <div className="guildRaidRosterCompact">
              {deploymentOrder.map((participant) => (
                <div
                  key={participant.playerId}
                  className={`guildRaidRosterChip${participant.isCurrentUser ? " isSelf" : ""}`}
                >
                  <ClassIcon playerClass={participant.playerClass} size={22} alt="" />
                  <span>{participant.playerName}</span>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      </article>

      {historyOpen ? (
        <RaidHistoryModal
          entries={raidState.history}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}

      {infoOpen ? (
        <RaidInfoDrawer
          state={raidState}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
    </div>
  );
}
