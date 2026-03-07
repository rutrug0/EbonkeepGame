import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";

import type {
  CombatPlaybackActionResolved,
  CombatPlaybackEncounter
} from "@ebonkeep/shared";

import { CombatActorFrame } from "./CombatActorFrame";

type CombatEncounterPanelProps = {
  phase: "travel" | "combat";
  encounter: CombatPlaybackEncounter;
  nowMs: number;
  travelEndsAt: number | null;
  travelDescription: string;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  currentAction: CombatPlaybackActionResolved | null;
  currentTurnIndex: number | null;
  impactTargetId: string | null;
  resolutionState: "playing" | "summarizing" | "awaiting_return";
  typedSummaryLine: string;
  playbackRate: number;
  isFastForwardEnabled: boolean;
  onToggleFastForward: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
  formatContractDifficulty: (difficulty: "easy" | "medium" | "hard") => string;
  formatDurationFromMs: (value: number) => string;
};

export function CombatEncounterPanel({
  phase,
  encounter,
  nowMs,
  travelEndsAt,
  travelDescription,
  hpByActorId,
  combatLogEntries,
  currentAction,
  currentTurnIndex,
  impactTargetId,
  resolutionState,
  typedSummaryLine,
  playbackRate,
  isFastForwardEnabled,
  onToggleFastForward,
  onReplayCombat,
  onBackToBoard,
  formatContractDifficulty,
  formatDurationFromMs
}: CombatEncounterPanelProps) {
  const { t } = useTranslation();
  const countdownLabel =
    phase === "travel" && travelEndsAt !== null ? formatDurationFromMs(Math.max(0, travelEndsAt - nowMs)) : null;
  const player = encounter.player;
  const enemyActors = encounter.enemies;
  const isSummaryVisible = resolutionState !== "playing";
  const showSummaryCursor = resolutionState === "summarizing";
  const combatAnimationStyle = {
    "--combat-animation-duration": `${2200 / playbackRate}ms`,
    "--combat-hit-duration": `${540 / playbackRate}ms`,
    "--combat-summary-cursor-duration": `${900 / playbackRate}ms`
  } as CSSProperties;

  if (phase === "travel") {
    return (
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard travelEncounterCard">
            <div className="combatEncounterHeader">
              <div>
                <p className="combatEncounterEyebrow">{t("contracts.travelingTitle")}</p>
                <h2>{encounter.contractName}</h2>
              </div>
              <span className={`contractDifficulty contractDifficulty-${encounter.difficulty}`}>
                {formatContractDifficulty(encounter.difficulty)}
              </span>
            </div>
            <div className="travelEncounterHero">
              <div className="travelEncounterArt">
                {encounter.travelImagePath && encounter.travelImageMode === "image" ? (
                  <img src={encounter.travelImagePath} alt={encounter.locationName} draggable={false} />
                ) : (
                  <div className="travelEncounterSilhouette" aria-hidden="true" />
                )}
              </div>
              <div className="travelEncounterSummary">
                <p className="travelEncounterLocation">
                  {t("contracts.travelingTo", { location: encounter.locationName })}
                </p>
                <p className="travelEncounterDescription">{travelDescription}</p>
                <div className="travelEncounterCountdownBlock">
                  <span>{t("contracts.arrivingIn", { duration: countdownLabel ?? "00m 00s" })}</span>
                  <div className="travelEncounterCountdownBar" aria-hidden="true">
                    <div
                      className="travelEncounterCountdownFill"
                      style={{
                        width: `${
                          travelEndsAt === null
                            ? 0
                            : Math.max(0, Math.min(100, ((travelEndsAt - nowMs) / 5000) * 100))
                        }%`
                      }}
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

  return (
    <section className="contentShell">
      <section className="contentStack combatEncounterStack" style={combatAnimationStyle}>
        <article className="contentCard combatEncounterCard">
          <div className="combatEncounterHeader">
            <div>
              <p className="combatEncounterEyebrow">
                {isSummaryVisible ? t("contracts.victoryTitle") : t("contracts.combatTitle")}
              </p>
              <h2>{encounter.contractName}</h2>
            </div>
            <div className="combatEncounterHeaderMeta">
              <span className={`combatTurnBadge ${currentTurnIndex === null ? "isHidden" : ""}`}>
                {currentTurnIndex === null ? "\u00a0" : t("contracts.turnLabel", { turn: currentTurnIndex })}
              </span>
              <button
                type="button"
                className={`combatSpeedToggle ${isFastForwardEnabled ? "isActive" : ""}`}
                aria-pressed={isFastForwardEnabled}
                onClick={onToggleFastForward}
              >
                {t("contracts.fastForward", { defaultValue: "Fast Forward x5" })}
              </button>
              <span className={`contractDifficulty contractDifficulty-${encounter.difficulty}`}>
                {formatContractDifficulty(encounter.difficulty)}
              </span>
            </div>
          </div>
          <div className="combatBattlefield">
            <div className="combatLane combatLane-enemy">
              {enemyActors.map((enemy) => (
                <CombatActorFrame
                  key={enemy.id}
                  actor={enemy}
                  currentHp={hpByActorId[enemy.id] ?? enemy.maxHp}
                  label={t("contracts.enemyLabel")}
                  isAttacking={currentAction?.actorId === enemy.id}
                  isHit={impactTargetId === enemy.id}
                />
              ))}
            </div>
            <div className="combatBattlefieldCenter" aria-hidden="true">
              <p className="combatBattlefieldLocation">{encounter.locationName}</p>
              <p className="combatBattlefieldDescription">{travelDescription}</p>
              <div className="combatBattlefieldDivider" />
            </div>
            <div className="combatLane combatLane-player">
              <CombatActorFrame
                actor={player}
                currentHp={hpByActorId[player.id] ?? player.maxHp}
                label={t("contracts.playerLabel")}
                isAttacking={currentAction?.actorId === player.id}
                isHit={impactTargetId === player.id}
              />
            </div>
          </div>
        </article>

        <article className="contentCard combatLogCard">
          <div className="combatEncounterHeader">
            <h3>{isSummaryVisible ? t("contracts.victoryTitle") : t("contracts.combatLog")}</h3>
          </div>
          <div className="combatLogBody">
            {combatLogEntries.length > 0 ? (
              <ol className="combatLogList">
                {combatLogEntries.map((entry, index) => (
                  <li key={`${index}-${entry}`}>{entry}</li>
                ))}
              </ol>
            ) : (
              <p className="combatLogEmpty">{t("contracts.travelingDescription")}</p>
            )}
            {isSummaryVisible ? (
              <div className="combatSummaryBlock">
                <p className="combatSummaryEyebrow">{t("contracts.victoryTitle")}</p>
                <p className="combatSummaryText">
                  {typedSummaryLine}
                  {showSummaryCursor ? <span className="combatSummaryCursor" aria-hidden="true" /> : null}
                </p>
              </div>
            ) : null}
            {resolutionState === "awaiting_return" ? (
              <div className="combatEndActions">
                <button type="button" className="combatBackButton" onClick={onReplayCombat}>
                  {t("contracts.replayCombat", { defaultValue: "Replay Combat" })}
                </button>
                <button type="button" className="combatBackButton" onClick={onBackToBoard}>
                  {t("contracts.backToBoard")}
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </section>
  );
}
