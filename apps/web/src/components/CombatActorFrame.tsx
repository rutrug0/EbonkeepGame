import type { CombatPlaybackActor } from "@ebonkeep/shared";

type CombatActorFrameProps = {
  actor: CombatPlaybackActor;
  currentHp: number;
  label: string;
  isAttacking: boolean;
  isHit: boolean;
};

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

  return (
    <article className={frameClassName} aria-label={actorAriaLabel}>
      <div className="combatActorFrameShell">
        <div className="combatActorPortraitWrap">
          {actor.avatarPath && !actor.usesSilhouetteFallback ? (
            <img src={actor.avatarPath} alt={actor.name} className="combatActorPortrait" draggable={false} />
          ) : (
            <div className="combatActorSilhouette" aria-hidden="true" />
          )}
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
        </div>
      </div>
    </article>
  );
}
