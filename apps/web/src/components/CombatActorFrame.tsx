import type { CombatPlaybackActor } from "@ebonkeep/shared";

type CombatActorFrameProps = {
  actor: CombatPlaybackActor;
  currentHp: number;
  label: string;
  isAttacking: boolean;
  isHit: boolean;
};

function formatCombatStatLabel(combatStat: "strength" | "dexterity" | "intelligence"): string {
  switch (combatStat) {
    case "strength":
      return "Strength";
    case "dexterity":
      return "Dexterity";
    case "intelligence":
      return "Intelligence";
    default:
      return combatStat;
  }
}

function CombatStatIcon({ combatStat }: { combatStat: "strength" | "dexterity" | "intelligence" }) {
  switch (combatStat) {
    case "strength":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14 4h3l2 2v4l-2 2h-2l-2 2v3l-3 3H5l-2-2v-4l3-3h3l2-2V8l2-2V4Z" />
        </svg>
      );
    case "dexterity":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 18 18 4l2 2-14 14H4v-2Zm9-14h7v7h-2V7.41l-8.29 8.3-1.42-1.42 8.3-8.29H13V4Z" />
        </svg>
      );
    case "intelligence":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2 6 9l4 .5L8 16l8-9-4-.5L12 2Zm-4.5 15h9v2h-9v-2Zm1 3h7v2h-7v-2Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function CombatActorFrame({
  actor,
  currentHp,
  label,
  isAttacking,
  isHit
}: CombatActorFrameProps) {
  const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / actor.maxHp) * 100)));
  const frameClassName = [
    "combatActorFrame",
    `combatActorFrame-${actor.side}`,
    isAttacking ? "isAttacking" : "",
    isHit ? "isHit" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const actorAriaLabel = `${label}: ${actor.name}, ${currentHp} of ${actor.maxHp} HP`;
  const actorCombatStat = actor.combatStat;
  const showActorMeta = typeof actor.power === "number" && actorCombatStat;
  const combatStatLabel = actorCombatStat ? formatCombatStatLabel(actorCombatStat) : "";

  return (
    <article className={frameClassName} aria-label={actorAriaLabel}>
      <div className="combatActorFrameShell">
        <div className="combatActorPortraitWrap">
          {actor.avatarPath && !actor.usesSilhouetteFallback ? (
            <img src={actor.avatarPath} alt={actor.name} className="combatActorPortrait" draggable={false} />
          ) : (
            <div className="combatActorSilhouette" aria-hidden="true" />
          )}
          {showActorMeta ? (
            <>
              <div className="combatActorMeta combatActorMetaPower">{actor.power}</div>
              <div
                className="combatActorMeta combatActorMetaType"
                aria-label={combatStatLabel}
                tabIndex={0}
              >
                <CombatStatIcon combatStat={actorCombatStat} />
                <span className="combatActorMetaTooltip" role="tooltip">
                  {combatStatLabel}
                </span>
              </div>
            </>
          ) : null}
        </div>
        <div
          className="combatActorHpBar"
          role="progressbar"
          aria-label={`${actor.name} health`}
          aria-valuemin={0}
          aria-valuemax={actor.maxHp}
          aria-valuenow={currentHp}
        >
          <div className="combatActorHpFill" style={{ width: `${hpPercent}%` }} />
          <span className="combatActorHpLabel">
            {currentHp}/{actor.maxHp}
          </span>
        </div>
      </div>
    </article>
  );
}
