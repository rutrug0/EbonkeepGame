import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LeaderboardEntry, LeaderboardResponse, LeaderboardType, PlayerClass } from "@ebonkeep/shared";
import { fetchLeaderboard } from "../api";

export interface LeaderboardProps {
  token: string | null;
  currentPlayerId?: string | null;
}

type ClassFilter = PlayerClass | "all";

export function Leaderboard({ token }: LeaderboardProps) {
  const { t } = useTranslation("common");
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("power");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchLeaderboard(token!, leaderboardType, classFilter, 50);
        setLeaderboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("leaderboards.error"));
      } finally {
        setIsLoading(false);
      }
    }

    void loadLeaderboard();
  }, [token, leaderboardType, classFilter, t]);

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
    fetchLeaderboard(token, leaderboardType, classFilter, 50)
      .then((data) => setLeaderboardData(data))
      .catch((err) => setError(err instanceof Error ? err.message : t("leaderboards.error")))
      .finally(() => setIsLoading(false));
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
              <div className="leaderboardTypeButtons">
                <button
                  type="button"
                  className={`leaderboardTypeButton${leaderboardType === "power" ? " active" : ""}`}
                  onClick={() => setLeaderboardType("power")}
                >
                  {t("leaderboards.typePower")}
                </button>
                <button
                  type="button"
                  className={`leaderboardTypeButton${leaderboardType === "level" ? " active" : ""}`}
                  onClick={() => setLeaderboardType("level")}
                >
                  {t("leaderboards.typeLevel")}
                </button>
              </div>
            </div>

            <div className="leaderboardFilterGroup">
              <label className="leaderboardFilterLabel">{t("leaderboards.class")}</label>
              <div className="leaderboardClassButtons">
                <button
                  type="button"
                  className={`leaderboardClassButton${classFilter === "all" ? " active" : ""}`}
                  onClick={() => setClassFilter("all")}
                >
                  {t("leaderboards.filterAll")}
                </button>
                <button
                  type="button"
                  className={`leaderboardClassButton${classFilter === "warrior" ? " active" : ""}`}
                  onClick={() => setClassFilter("warrior")}
                >
                  {t("leaderboards.filterWarrior")}
                </button>
                <button
                  type="button"
                  className={`leaderboardClassButton${classFilter === "mage" ? " active" : ""}`}
                  onClick={() => setClassFilter("mage")}
                >
                  {t("leaderboards.filterMage")}
                </button>
                <button
                  type="button"
                  className={`leaderboardClassButton${classFilter === "ranger" ? " active" : ""}`}
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
      </section>
    </section>
  );
}
