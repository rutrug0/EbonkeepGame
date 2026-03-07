import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type {
  CombatPlaybackActionResolved,
  CombatPlaybackActor,
  CombatPlaybackEncounter,
  CombatPlaybackEvent
} from "@ebonkeep/shared";

import { CombatActorFrame } from "./CombatActorFrame";

export type CombatEncounterPanelProps = {
  phase: "travel" | "combat";
  encounter: CombatPlaybackEncounter;
  timeline: CombatPlaybackEvent[];
  nowMs: number;
  travelEndsAt: number | null;
  travelDescription: string;
  hpByActorId: Record<string, number>;
  combatLogEntries: string[];
  currentAction: CombatPlaybackActionResolved | null;
  impactTargetId: string | null;
  resolutionState: "playing" | "summarizing" | "awaiting_return";
  typedSummaryLine: string;
  playbackRate: number;
  isFastForwardEnabled: boolean;
  onToggleFastForward: () => void;
  onCloseLog?: () => void;
  onReplayCombat: () => void;
  onBackToBoard: () => void;
  formatContractDifficulty: (difficulty: "easy" | "medium" | "hard") => string;
  formatDurationFromMs: (value: number) => string;
};

export function CombatEncounterTravelPanel({
  encounter,
  timeline: _timeline,
  nowMs,
  travelEndsAt,
  travelDescription,
  formatContractDifficulty,
  formatDurationFromMs
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "nowMs"
  | "travelEndsAt"
  | "travelDescription"
  | "formatContractDifficulty"
  | "formatDurationFromMs"
>) {
  const { t } = useTranslation();
  const countdownLabel =
    travelEndsAt !== null ? formatDurationFromMs(Math.max(0, travelEndsAt - nowMs)) : null;

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

export function CombatEncounterArenaPanel({
  encounter,
  timeline: _timeline,
  hpByActorId,
  currentAction,
  impactTargetId,
  playbackRate,
  isFastForwardEnabled,
  onToggleFastForward
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "hpByActorId"
  | "currentAction"
  | "impactTargetId"
  | "playbackRate"
  | "isFastForwardEnabled"
  | "onToggleFastForward"
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
            <div className="combatBattlefieldCenter" aria-hidden="true" />
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
      </section>
    </section>
  );
}

export function CombatEncounterLogPanel({
  encounter,
  timeline,
  combatLogEntries,
  resolutionState,
  typedSummaryLine,
  onCloseLog,
  onReplayCombat,
  onBackToBoard
}: Pick<
  CombatEncounterPanelProps,
  | "encounter"
  | "timeline"
  | "combatLogEntries"
  | "resolutionState"
  | "typedSummaryLine"
  | "onCloseLog"
  | "onReplayCombat"
  | "onBackToBoard"
>) {
  const { t } = useTranslation();
  const isSummaryVisible = resolutionState !== "playing";
  const showSummaryCursor = resolutionState === "summarizing";
  const actorById = new Map<string, CombatPlaybackActor>([
    [encounter.player.id, encounter.player],
    ...encounter.enemies.map((enemy) => [enemy.id, enemy] as const)
  ]);
  const actionEvents = timeline.filter(
    (event): event is CombatPlaybackActionResolved => event.type === "CombatPlaybackActionResolved"
  );

  return (
    <section className="contentShell combatLogShell">
      <section className="contentStack">
        <article className="contentCard combatLogCard">
          <div className="combatLogToolbar">
            {resolutionState === "awaiting_return" ? (
              <div className="combatLogActionsBar">
                <button type="button" className="combatLogActionButton" onClick={onReplayCombat}>
                  {t("contracts.replayCombat", { defaultValue: "Replay Combat" })}
                </button>
                <button type="button" className="combatLogActionButton" onClick={onBackToBoard}>
                  {t("contracts.backToBoard")}
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
          <div className="combatLogBody">
            {combatLogEntries.length > 0 ? (
              <ol className="combatLogList">
                {combatLogEntries.map((entry, index) => {
                  const actionEvent = actionEvents[index] ?? null;
                  const attacker = actionEvent ? actorById.get(actionEvent.actorId) ?? null : null;
                  const defender = actionEvent ? actorById.get(actionEvent.targetId) ?? null : null;

                  return (
                    <li key={actionEvent?.eventId ?? `${index}-${entry}`} className="combatLogMessage">
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
  return (
    <CombatEncounterTravelPanel
      encounter={props.encounter}
      timeline={props.timeline}
      nowMs={props.nowMs}
      travelEndsAt={props.travelEndsAt}
      travelDescription={props.travelDescription}
      formatContractDifficulty={props.formatContractDifficulty}
      formatDurationFromMs={props.formatDurationFromMs}
    />
  );
}
