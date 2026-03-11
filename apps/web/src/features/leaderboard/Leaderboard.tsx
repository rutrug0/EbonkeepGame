import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import type { PlayerClass } from "@ebonkeep/shared/core";
import type {
  GuildLeaderboardResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardType
} from "@ebonkeep/shared/leaderboard";
import type { GuildDetailsResponse } from "@ebonkeep/shared/guild";
import { getGuildById } from "../guild";
import { fetchLeaderboard, getGuildLeaderboard } from "./api";

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

export interface LeaderboardProps {
  token: string | null;
  currentPlayerId?: string | null;
}

type ClassFilter = PlayerClass | "all";
type LeaderboardCategory = "players" | "guilds";
type GuildLeaderboardType = "totalPower" | "level" | "memberCount";

export function Leaderboard({ token }: LeaderboardProps) {
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
                  className={`profileSwitchButton${classFilter === "warrior" ? " active" : ""}`}
                  onClick={() => setClassFilter("warrior")}
                >
                  {t("leaderboards.filterWarrior")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "mage" ? " active" : ""}`}
                  onClick={() => setClassFilter("mage")}
                >
                  {t("leaderboards.filterMage")}
                </button>
                <button
                  type="button"
                  className={`profileSwitchButton${classFilter === "ranger" ? " active" : ""}`}
                  onClick={() => setClassFilter("ranger")}
                >
                  {t("leaderboards.filterRanger")}
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
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.entries.map((entry: LeaderboardEntry) => (
                      <tr key={entry.playerId} className="leaderboardRow">
                        <td data-label={t("leaderboards.rank")} className="leaderboardCellRank">
                          <span className={getRankClass(entry.rank)}>#{entry.rank}</span>
                        </td>
                        <td data-label={t("leaderboards.player")} className="leaderboardCellPlayer">
                          <strong>{entry.username}</strong>
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
