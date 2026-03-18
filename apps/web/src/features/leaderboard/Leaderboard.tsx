import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import type { PlayerClass, PlayerStatTree } from "@ebonkeep/shared/core";
import type {
  GuildLeaderboardResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardType
} from "@ebonkeep/shared/leaderboard";
import type { GuildDetailsResponse } from "@ebonkeep/shared/guild";
import type { PublicPlayerProfile } from "@ebonkeep/shared/player";
import { getGuildById, getMyGuild, sendGuildInvite } from "../guild";
import { fetchLeaderboard, getGuildLeaderboard, fetchPublicPlayerProfile } from "./api";
import { ClassIcon } from "../../app/ClassIcon";

function safeHtml(raw: string): string {
  return String(DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "span", "br", "small", "big", "h1", "h2", "h3", "p", "div"],
    ALLOWED_ATTR: ["style"],
  }));
}

function ShieldIconSm() {
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 6L6 18V36C6 48 16 57 32 60C48 57 58 48 58 36V18L32 6Z" fill="currentColor" opacity="0.18"/>
      <path d="M32 6L6 18V36C6 48 16 57 32 60C48 57 58 48 58 36V18L32 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

interface GuildModalProps {
  guildId: string;
  token: string | null;
  onClose: () => void;
}

function GuildDetailModal({ guildId, token, onClose }: GuildModalProps) {
  const { t } = useTranslation("common");
  const [data, setData] = useState<GuildDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getGuildById(guildId, token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load guild"))
      .finally(() => setLoading(false));
  }, [guildId]);

  const guild = data?.guild;

  return (
    <div className="guildLbModalOverlay" onClick={onClose}>
      <div className="guildLbModal" onClick={(e) => e.stopPropagation()}>

        <div className="guildLbModalHeader">
          <span className="guildLbModalHeaderTitle">
            <ShieldIconSm />
            {t("guild.guildDetail")}
          </span>
          <button type="button" className="guildLbModalClose" onClick={onClose} aria-label={t("cancel")}>✕</button>
        </div>

        <div className="guildLbModalBody">
          {loading && <p className="placeholderText">{t("loading")}</p>}
          {error && <p className="guildFormError">{error}</p>}

          {guild && (
            <>
              <div className="guildLbModalHero">
                <div className="guildLbModalCrest">
                  <ShieldIconSm />
                </div>
                <div className="guildLbModalTitles">
                  <h2 className="guildLbModalName">{guild.name}</h2>
                  <span className="guildTag guildTagLarge">[{guild.tag}]</span>
                  <span className={`guildHeroStatusBadge${guild.isRecruiting ? " guildHeroStatusBadge--open" : " guildHeroStatusBadge--closed"}`}>
                    {guild.isRecruiting ? t("guild.statusOpen") : t("guild.statusClosed")}
                  </span>
                </div>
              </div>

              <div className="guildLbModalStats">
                <div className="guildLbModalStat">
                  <span className="guildLbModalStatLabel">{t("guild.level")}</span>
                  <span className="guildLbModalStatValue">{guild.level}</span>
                </div>
                <div className="guildLbModalStat">
                  <span className="guildLbModalStatLabel">{t("guild.totalPower")}</span>
                  <span className="guildLbModalStatValue">{guild.totalPower.toLocaleString()}</span>
                </div>
                <div className="guildLbModalStat">
                  <span className="guildLbModalStatLabel">{t("guild.members")}</span>
                  <span className="guildLbModalStatValue">{data?.memberCount ?? 0}/{guild.maxMembers}</span>
                </div>
              </div>

              {guild.description ? (
                <>
                  <p className="guildLbModalDescHeader">{t("guild.description")}</p>
                  <div
                    className="guildLbModalDesc"
                    dangerouslySetInnerHTML={{ __html: safeHtml(guild.description) }}
                  />
                </>
              ) : (
                <p className="guildLbModalDescEmpty">{t("guild.noDescription")}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const EQUIPMENT_SLOT_ORDER = [
  "weapon", "helmet", "upperArmor", "pauldrons", "lowerArmor",
  "gloves", "boots", "belt", "necklace", "ringLeft", "ringRight",
  "vestige1", "vestige2", "vestige3"
] as const;

interface PlayerProfileModalProps {
  entry: LeaderboardEntry;
  token: string;
  onClose: () => void;
  canInvite: boolean;
  myGuildId: string | null;
  inviteStatuses: Record<string, "sending" | "sent" | "failed">;
  onInvite: (playerId: string, playerName: string) => void;
  onViewGuild: (guildId: string) => void;
}

function PlayerProfileModal({
  entry,
  token,
  onClose,
  canInvite,
  inviteStatuses,
  onInvite,
  onViewGuild
}: PlayerProfileModalProps) {
  const { t } = useTranslation("common");
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPublicPlayerProfile(token, entry.playerId)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : t("leaderboards.error")))
      .finally(() => setLoading(false));
  }, [token, entry.playerId, t]);

  const invStat = inviteStatuses[entry.playerId];

  return (
    <div className="guildLbModalOverlay" onClick={onClose}>
      <div className="guildLbModal playerProfileModal" onClick={(e) => e.stopPropagation()}>
        <div className="guildLbModalHeader">
          <span className="guildLbModalHeaderTitle">
            <span className={`profileModalClassBadge profileModalClassBadge--${entry.class}`}>
              <ClassIcon playerClass={entry.class} size={20} className="profileModalClassIcon" alt="" />
              {t(`class.${entry.class}`)}
            </span>
            {entry.username}
          </span>
          <button type="button" className="guildLbModalClose" onClick={onClose} aria-label={t("cancel")}>✕</button>
        </div>

        <div className="guildLbModalBody">
          <div className="profileModalMeta">
            <span className="profileModalMetaItem">{t("leaderboards.level")} <strong>{entry.level}</strong></span>
            <span className="profileModalMetaItem">{t("leaderboards.power")} <strong>{entry.gearScore}</strong></span>
            {entry.guildId && (
              <button
                type="button"
                className="profileModalGuildLink"
                onClick={() => { onClose(); onViewGuild(entry.guildId!); }}
              >
                {entry.guildTag ? `[${entry.guildTag}]` : ""} {t("leaderboards.viewGuild")}
              </button>
            )}
          </div>

          {canInvite && (
            <div className="profileModalInviteRow">
              <button
                type="button"
                className="leaderboardInviteButton"
                disabled={!!invStat}
                onClick={() => onInvite(entry.playerId, entry.username)}
              >
                {invStat === "sending" ? t("leaderboards.inviting") :
                 invStat === "sent" ? `✓ ${t("ok")}` :
                 invStat === "failed" ? t("guild.invite.error.failedToSend") :
                 t("leaderboards.invite")}
              </button>
            </div>
          )}

          {loading && <p className="placeholderText">{t("loading")}</p>}
          {error && <p className="guildFormError">{error}</p>}

          {profile && (
            <>
              <div className="profileModalSection">
                <h4 className="profileModalSectionTitle">{t("leaderboards.equipment")}</h4>
                <div className="profileModalEquipment">
                  {EQUIPMENT_SLOT_ORDER.map((slot) => {
                    const item = profile.equipment[slot];
                    return (
                      <div key={slot} className="profileModalEquipSlot">
                        <span className="profileModalSlotLabel">{t(`slots.${slot}`)}</span>
                        {item ? (
                          <span className={`profileModalItem profileModalItem--${item.rarity}`}>
                            {item.itemName}
                          </span>
                        ) : (
                          <span className="profileModalItemEmpty">{t("item.empty")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="profileModalSection">
                <h4 className="profileModalSectionTitle">{t("leaderboards.stats")}</h4>
                <div className="profileModalStats">
                  {[
                    ["profile.maxHitpoints", profile.statSnapshot.total.maxHitpoints],
                    ["profile.armor", profile.statSnapshot.total.armor],
                    ["profile.spellShield", profile.statSnapshot.total.spellShield],
                    ["profile.missileResistance", profile.statSnapshot.total.missileResistance],
                    ["profile.mainDamage", profile.statSnapshot.total.damage],
                    ["profile.critChance", profile.statSnapshot.total.critChance],
                    ["profile.critDamage", profile.statSnapshot.total.critMultiplier]
                  ].map(([key, val]) => (
                    <div key={key as string} className="profileModalStat">
                      <span className="profileModalStatLabel">{t(key as string)}</span>
                      <span className="profileModalStatValue">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export interface LeaderboardProps {
  token: string | null;
  currentPlayerId?: string | null;
}

interface InviteConfirmModalProps {
  playerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function InviteConfirmModal({ playerName, onConfirm, onCancel }: InviteConfirmModalProps) {
  const { t } = useTranslation("common");
  return (
    <div className="guildLbModalOverlay" onClick={onCancel}>
      <div className="guildLbModal inviteConfirmModal" onClick={(e) => e.stopPropagation()}>
        <div className="guildLbModalHeader">
          <span className="guildLbModalHeaderTitle">{t("leaderboards.inviteConfirmTitle")}</span>
          <button type="button" className="guildLbModalClose" onClick={onCancel} aria-label={t("cancel")}>✕</button>
        </div>
        <div className="guildLbModalBody">
          <p className="inviteConfirmMessage">
            {t("leaderboards.inviteConfirmMessage", { playerName })}
          </p>
          <div className="inviteConfirmButtons">
            <button type="button" className="inviteConfirmYesButton" onClick={onConfirm}>
              {t("leaderboards.inviteConfirm")}
            </button>
            <button type="button" className="guildActionButton" onClick={onCancel}>
              {t("cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ClassFilter = PlayerStatTree | "all";
type LeaderboardCategory = "players" | "guilds";
type GuildLeaderboardType = "totalPower" | "level" | "memberCount";

export function Leaderboard({ token, currentPlayerId }: LeaderboardProps) {
  const { t } = useTranslation("common");
  const [category, setCategory] = useState<LeaderboardCategory>("players");
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("power");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [guildLeaderboardType, setGuildLeaderboardType] = useState<GuildLeaderboardType>("totalPower");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [guildLeaderboardData, setGuildLeaderboardData] = useState<GuildLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [myGuildId, setMyGuildId] = useState<string | null>(null);
  const [myGuildRole, setMyGuildRole] = useState<"leader" | "officer" | "member" | null>(null);
  const [selectedPlayerEntry, setSelectedPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, "sending" | "sent" | "failed">>({});
  const [pendingInviteTarget, setPendingInviteTarget] = useState<{ playerId: string; playerName: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    getMyGuild(token)
      .then((data) => {
        setMyGuildId(data?.guild.id ?? null);
        setMyGuildRole((data?.currentUserMembership?.role ?? null) as typeof myGuildRole);
      })
      .catch(() => {});
  }, [token]);

  const canInviteToGuild = !!myGuildId && (myGuildRole === "leader" || myGuildRole === "officer");

  function requestInvite(playerId: string, playerName: string) {
    setPendingInviteTarget({ playerId, playerName });
  }

  async function confirmInvite() {
    if (!token || !myGuildId || !pendingInviteTarget) return;
    const { playerId } = pendingInviteTarget;
    setPendingInviteTarget(null);
    setInviteStatuses((prev) => ({ ...prev, [playerId]: "sending" }));
    try {
      await sendGuildInvite(token, myGuildId, playerId);
      setInviteStatuses((prev) => ({ ...prev, [playerId]: "sent" }));
    } catch {
      setInviteStatuses((prev) => ({ ...prev, [playerId]: "failed" }));
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);
      try {
        if (category === "players") {
          const data = await fetchLeaderboard(token!, leaderboardType, classFilter, 50);
          setLeaderboardData(data);
        } else if (category === "guilds") {
          const data = await getGuildLeaderboard({ 
            sortBy: guildLeaderboardType === "totalPower" ? "power" : guildLeaderboardType,
            limit: 50,
            offset: 0
          });
          setGuildLeaderboardData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("leaderboards.error"));
      } finally {
        setIsLoading(false);
      }
    }

    void loadLeaderboard();
  }, [token, category, leaderboardType, classFilter, guildLeaderboardType, t]);

  function formatClassName(playerClass: PlayerClass): string {
    return t(`class.${playerClass}`);
  }

  function getRankClass(rank: number): string {
    if (rank === 1) return "leaderboardRank leaderboardRank-first";
    if (rank === 2) return "leaderboardRank leaderboardRank-second";
    if (rank === 3) return "leaderboardRank leaderboardRank-third";
    return "leaderboardRank";
  }

  function handleRefresh() {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    
    if (category === "players") {
      fetchLeaderboard(token, leaderboardType, classFilter, 50)
        .then((data) => setLeaderboardData(data))
        .catch((err) => setError(err instanceof Error ? err.message : t("leaderboards.error")))
        .finally(() => setIsLoading(false));
    } else if (category === "guilds") {
      getGuildLeaderboard({ 
        sortBy: guildLeaderboardType === "totalPower" ? "power" : guildLeaderboardType,
        limit: 50,
        offset: 0
      })
        .then((data) => setGuildLeaderboardData(data))
        .catch((err) => setError(err instanceof Error ? err.message : t("leaderboards.error")))
        .finally(() => setIsLoading(false));
    }
  }

  if (!token) {
    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{t("leaderboards.title")}</h2>
            <p>{t("inventory.unavailable")}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <section className="contentShell">
      <section className="contentStack">
        {selectedGuildId && (
          <GuildDetailModal
            guildId={selectedGuildId}
            token={token}
            onClose={() => setSelectedGuildId(null)}
          />
        )}
        {selectedPlayerEntry && (
          <PlayerProfileModal
            entry={selectedPlayerEntry}
            token={token}
            onClose={() => setSelectedPlayerEntry(null)}
            canInvite={canInviteToGuild && selectedPlayerEntry.guildId === null && selectedPlayerEntry.playerId !== currentPlayerId}
            myGuildId={myGuildId}
            inviteStatuses={inviteStatuses}
            onInvite={requestInvite}
            onViewGuild={(guildId) => { setSelectedPlayerEntry(null); setSelectedGuildId(guildId); }}
          />
        )}
        {pendingInviteTarget && (
          <InviteConfirmModal
            playerName={pendingInviteTarget.playerName}
            onConfirm={confirmInvite}
            onCancel={() => setPendingInviteTarget(null)}
          />
        )}
        {/* Category tabs: Players vs Guilds */}
        <article className="contentCard">
          <div className="profileSwitchBar">
            <div className="profileSwitchButtons">
              <button
                type="button"
                className={`profileSwitchButton${category === "players" ? " active" : ""}`}
                onClick={() => setCategory("players")}
              >
                {t("leaderboards.players")}
              </button>
              <button
                type="button"
                className={`profileSwitchButton${category === "guilds" ? " active" : ""}`}
                onClick={() => setCategory("guilds")}
              >
                {t("leaderboards.guilds")}
              </button>
            </div>
          </div>
        </article>

        {category === "players" && (
          <>
            <article className="contentCard">
              <div className="leaderboardHeader">
                <h2>{t("leaderboards.title")}</h2>
                <button
                  type="button"
                  className="leaderboardRefreshButton"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  {t("leaderboards.refreshLeaderboard")}
                </button>
              </div>

              <div className="leaderboardFilters">
                <div className="leaderboardFilterGroup">
                  <label className="leaderboardFilterLabel">{t("leaderboards.typePower")} / {t("leaderboards.typeLevel")}</label>
                  <div className="profileSwitchButtons">
                    <button
                      type="button"
                      className={`profileSwitchButton${leaderboardType === "power" ? " active" : ""}`}
                      onClick={() => setLeaderboardType("power")}
                >
                  {t("leaderboards.typePower")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${leaderboardType === "level" ? " active" : ""}`}
                  onClick={() => setLeaderboardType("level")}
                >
                  {t("leaderboards.typeLevel")}
                </button>
              </div>
            </div>

            <div className="leaderboardFilterGroup">
              <label className="leaderboardFilterLabel">{t("leaderboards.class")}</label>
              <div className="profileSwitchButtons">
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "all" ? " active" : ""}`}
                  onClick={() => setClassFilter("all")}
                >
                  {t("leaderboards.filterAll")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "strength" ? " active" : ""}`}
                  onClick={() => setClassFilter("strength")}
                >
                  {t("leaderboards.filterStrength")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "dexterity" ? " active" : ""}`}
                  onClick={() => setClassFilter("dexterity")}
                >
                  {t("leaderboards.filterDexterity")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "intelligence" ? " active" : ""}`}
                  onClick={() => setClassFilter("intelligence")}
                >
                  {t("leaderboards.filterIntelligence")}
                </button>
              </div>
            </div>
          </div>
        </article>

        {error && (
          <article className="contentCard leaderboardErrorCard">
            <p className="leaderboardError">{error}</p>
          </article>
        )}

        {isLoading && !leaderboardData && (
          <article className="contentCard">
            <p>{t("leaderboards.loading")}</p>
          </article>
        )}

        {leaderboardData && (
          <>
            {leaderboardData.currentPlayerRank && (
              <article className="contentCard leaderboardPlayerRankCard">
                <p className="leaderboardPlayerRank">
                  {t("leaderboards.yourRank", { rank: leaderboardData.currentPlayerRank })}
                </p>
              </article>
            )}

            <article className="contentCard leaderboardTableCard">
              <div className="leaderboardTableWrap">
                <table className="leaderboardTable">
                  <thead>
                    <tr>
                      <th className="leaderboardColumnRank">{t("leaderboards.rank")}</th>
                      <th className="leaderboardColumnPlayer">{t("leaderboards.player")}</th>
                      <th className="leaderboardColumnClass">{t("leaderboards.class")}</th>
                      <th className="leaderboardColumnLevel">{t("leaderboards.level")}</th>
                      <th className="leaderboardColumnPower">{t("leaderboards.power")}</th>
                      {canInviteToGuild && <th className="leaderboardColumnActions">{t("leaderboards.actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.entries.map((entry: LeaderboardEntry) => (
                      <tr
                        key={entry.playerId}
                        className="leaderboardRow leaderboardRowClickable"
                        onClick={() => setSelectedPlayerEntry(entry)}
                        title={t("leaderboards.viewProfile")}
                      >
                        <td data-label={t("leaderboards.rank")} className="leaderboardCellRank">
                          <span className={getRankClass(entry.rank)}>#{entry.rank}</span>
                        </td>
                        <td data-label={t("leaderboards.player")} className="leaderboardCellPlayer">
                          <span className="leaderboardPlayerIdentity">
                            <span className="classPortrait classPortrait--md leaderboardPlayerAvatar" aria-hidden="true">
                              <ClassIcon playerClass={entry.class} size={46} className="classPortraitIcon" alt="" />
                            </span>
                            <span className="leaderboardPlayerIdentityText">
                              <strong>{entry.username}</strong>
                              {entry.guildTag && (
                                <span className="leaderboardGuildTag">[{entry.guildTag}]</span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td data-label={t("leaderboards.class")} className="leaderboardCellClass">
                          <span className={`leaderboardClass leaderboardClass-${entry.class}`}>
                            {formatClassName(entry.class)}
                          </span>
                        </td>
                        <td data-label={t("leaderboards.level")} className="leaderboardCellLevel">
                          {entry.level}
                        </td>
                        <td data-label={t("leaderboards.power")} className="leaderboardCellPower">
                          <strong>{entry.gearScore}</strong>
                        </td>
                        {canInviteToGuild && (
                          <td
                            className="leaderboardCellActions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entry.guildId === null && entry.playerId !== currentPlayerId ? (
                              <button
                                type="button"
                                className="leaderboardInviteButton"
                                disabled={!!inviteStatuses[entry.playerId]}
                                onClick={() => requestInvite(entry.playerId, entry.username)}
                              >
                                {inviteStatuses[entry.playerId] === "sending" ? t("leaderboards.inviting") :
                                 inviteStatuses[entry.playerId] === "sent" ? "✓" :
                                 inviteStatuses[entry.playerId] === "failed" ? "✗" :
                                 t("leaderboards.invite")}
                              </button>
                            ) : entry.playerId !== currentPlayerId ? (
                              <span className="leaderboardHasGuild">{t("leaderboards.hasGuild")}</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="leaderboardFooter">
                <p className="leaderboardFooterText">
                  {t("leaderboards.viewingTop", { count: leaderboardData.entries.length })} • {" "}
                  {t("leaderboards.totalPlayers", { count: leaderboardData.totalPlayers })}
                </p>
              </div>
            </article>
          </>
        )}
          </>
        )}

        {/* Guild Leaderboards */}
        {category === "guilds" && (
          <>
            <article className="contentCard">
              <div className="leaderboardHeader">
                <h2>{t("guild.leaderboardTitle")}</h2>
                <button
                  type="button"
                  className="leaderboardRefreshButton"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  {t("leaderboards.refreshLeaderboard")}
                </button>
              </div>

              <div className="guildLeaderboardFilters">
                <div className="leaderboardFilterGroup">
                  <label className="leaderboardFilterLabel">{t("guild.sortBy")}</label>
                  <div className="profileSwitchButtons">
                    <button
                      type="button"
                      className={`profileSwitchButton${guildLeaderboardType === "totalPower" ? " active" : ""}`}
                      onClick={() => setGuildLeaderboardType("totalPower")}
                    >
                      {t("guild.totalPower")}
                    </button>
                    <button
                      type="button"
                      className={`profileSwitchButton${guildLeaderboardType === "level" ? " active" : ""}`}
                      onClick={() => setGuildLeaderboardType("level")}
                    >
                      {t("guild.level")}
                    </button>
                    <button
                      type="button"
                      className={`profileSwitchButton${guildLeaderboardType === "memberCount" ? " active" : ""}`}
                      onClick={() => setGuildLeaderboardType("memberCount")}
                    >
                      {t("guild.memberCount")}
                    </button>
                  </div>
                </div>
              </div>
            </article>

            {error && (
              <article className="contentCard leaderboardErrorCard">
                <p className="leaderboardError">{error}</p>
              </article>
            )}

            {isLoading && !guildLeaderboardData && (
              <article className="contentCard">
                <p>{t("leaderboards.loading")}</p>
              </article>
            )}

            {guildLeaderboardData && guildLeaderboardData.guilds.length > 0 && (
              <article className="contentCard leaderboardTableCard">
                <div className="leaderboardTableWrap">
                  <table className="leaderboardTable">
                    <thead>
                      <tr>
                        <th className="leaderboardColumnRank">{t("leaderboards.rank")}</th>
                        <th className="leaderboardColumnPlayer">{t("guild.name")}</th>
                        <th className="leaderboardColumnClass">{t("guild.tag")}</th>
                        <th className="leaderboardColumnLevel">{t("guild.level")}</th>
                        <th className="leaderboardColumnPower">{t("guild.members")}</th>
                        <th className="leaderboardColumnPower">{t("guild.value")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guildLeaderboardData.guilds.map((entry) => (
                        <tr
                          key={entry.guild.id}
                          className="leaderboardRow leaderboardRowClickable"
                          onClick={() => setSelectedGuildId(entry.guild.id)}
                          title={t("guild.viewDetails")}
                        >
                          <td data-label={t("leaderboards.rank")} className="leaderboardCellRank">
                            <span className={getRankClass(entry.rank)}>#{entry.rank}</span>
                          </td>
                          <td data-label={t("guild.name")} className="leaderboardCellPlayer">
                            <strong>{entry.guild.name}</strong>
                          </td>
                          <td data-label={t("guild.tag")} className="leaderboardCellClass">
                            <span className="guildTag">[{entry.guild.tag}]</span>
                          </td>
                          <td data-label={t("guild.level")} className="leaderboardCellLevel">
                            {entry.guild.level}
                          </td>
                          <td data-label={t("guild.members")} className="leaderboardCellPower">
                            {entry.memberCount}/{entry.guild.maxMembers}
                          </td>
                          <td data-label={t("guild.value")} className="leaderboardCellPower">
                            <strong>{entry.value.toLocaleString()}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="leaderboardFooter">
                  <p className="leaderboardFooterText">
                    {t("leaderboards.viewingTop", { count: guildLeaderboardData.guilds.length })} • {" "}
                    {t("guild.totalGuilds", { count: guildLeaderboardData.totalGuilds })}
                  </p>
                </div>
              </article>
            )}

            {guildLeaderboardData && guildLeaderboardData.guilds.length === 0 && !isLoading && (
              <article className="contentCard">
                <p className="placeholderText">{t("guild.noLeaderboardData")}</p>
              </article>
            )}
          </>
        )}
      </section>
    </section>
  );
}
